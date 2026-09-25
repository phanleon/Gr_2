package core

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type Host struct {
	app      *App
	name     string
	password string
	port     int

	mu      sync.RWMutex
	peers   map[string]*hostPeer
	nextIP  atomic.Int32
	ln      net.Listener
	closed  chan struct{}
	closeMu sync.Once
}

type hostPeer struct {
	name      string
	virtualIP string
	remoteIP  string
	conn      net.Conn
	enc       *json.Encoder
	sendMu    sync.Mutex
}

func NewHost(app *App, name, password string, port int) *Host {
	h := &Host{
		app:      app,
		name:     name,
		password: password,
		port:     port,
		peers:    make(map[string]*hostPeer),
		closed:   make(chan struct{}),
	}
	h.nextIP.Store(2)
	return h
}

func (h *Host) Start() error {
	ln, err := net.Listen("tcp", fmt.Sprintf("0.0.0.0:%d", h.port))
	if err != nil {
		return fmt.Errorf("không mở được cổng %d: %w", h.port, err)
	}
	h.ln = ln
	go h.acceptLoop()
	return nil
}

func (h *Host) acceptLoop() {
	for {
		conn, err := h.ln.Accept()
		if err != nil {
			select {
			case <-h.closed:
				return
			default:
				h.app.addEvent("error", "Lỗi accept: "+err.Error(), "", "*", "", "")
				continue
			}
		}
		go h.handleConn(conn)
	}
}

func (h *Host) handleConn(conn net.Conn) {
	defer conn.Close()

	_ = conn.SetDeadline(time.Now().Add(15 * time.Second))
	enc := json.NewEncoder(conn)
	dec := json.NewDecoder(conn)

	challengeBytes := make([]byte, 32)
	if _, err := rand.Read(challengeBytes); err != nil {
		return
	}
	challenge := base64.StdEncoding.EncodeToString(challengeBytes)

	if err := enc.Encode(WireMessage{
		Type:      "challenge",
		Challenge: challenge,
		Timestamp: time.Now().UnixMilli(),
	}); err != nil {
		return
	}

	var auth WireMessage
	if err := dec.Decode(&auth); err != nil {
		return
	}
	if auth.Type != "auth" || strings.TrimSpace(auth.Name) == "" {
		_ = enc.Encode(WireMessage{Type: "auth_fail", Error: "Thông tin đăng nhập không hợp lệ"})
		return
	}

	expected := authProof(h.password, challenge, auth.Name)
	got, err := base64.StdEncoding.DecodeString(auth.Proof)
	if err != nil || subtle.ConstantTimeCompare(expected, got) != 1 {
		_ = enc.Encode(WireMessage{Type: "auth_fail", Error: "Sai password"})
		return
	}

	h.mu.Lock()
	if auth.Name == h.name {
		h.mu.Unlock()
		_ = enc.Encode(WireMessage{Type: "auth_fail", Error: "Tên máy trùng với Host"})
		return
	}
	if _, exists := h.peers[auth.Name]; exists {
		h.mu.Unlock()
		_ = enc.Encode(WireMessage{Type: "auth_fail", Error: "Tên máy đã tồn tại"})
		return
	}

	virtualIP := fmt.Sprintf("10.10.0.%d", h.nextIP.Add(1)-1)
	remoteIP := remoteHost(conn.RemoteAddr().String())

	peer := &hostPeer{
		name:      auth.Name,
		virtualIP: virtualIP,
		remoteIP:  remoteIP,
		conn:      conn,
		enc:       enc,
	}
	h.peers[peer.name] = peer
	h.mu.Unlock()

	_ = conn.SetDeadline(time.Time{})

	if err := peer.send(WireMessage{
		Type:      "auth_ok",
		VirtualIP: virtualIP,
		Name:      h.name,
		Timestamp: time.Now().UnixMilli(),
	}); err != nil {
		h.removePeer(peer.name)
		return
	}

	h.app.addEvent("system", peer.name+" đã tham gia mạng.", peer.name, "*", "", "")
	h.broadcastPeerList()

	defer func() {
		h.removePeer(peer.name)
		h.app.addEvent("system", peer.name+" đã rời mạng.", peer.name, "*", "", "")
		h.broadcastPeerList()
	}()

	for {
		var msg WireMessage
		if err := dec.Decode(&msg); err != nil {
			return
		}

		msg.From = peer.name
		if msg.Target == "" {
			msg.Target = "*"
		}
		h.handleIncoming(peer, msg)
	}
}

func (h *Host) handleIncoming(sender *hostPeer, msg WireMessage) {
	switch msg.Type {
	case "chat":
		if h.shouldDeliverToHost(msg.Target) {
			h.app.addEvent("chat", msg.Text, sender.name, msg.Target, "", "")
		}
		h.routeToPeers(sender.name, msg)

	case "file_begin":
		if h.shouldDeliverToHost(msg.Target) {
			h.app.beginReceiveFile(msg)
		}
		h.routeToPeers(sender.name, msg)

	case "file_chunk":
		if h.shouldDeliverToHost(msg.Target) {
			h.app.receiveFileChunk(msg)
		}
		h.routeToPeers(sender.name, msg)

	case "file_end":
		if h.shouldDeliverToHost(msg.Target) {
			h.app.endReceiveFile(msg)
		}
		h.routeToPeers(sender.name, msg)
	}
}

func (h *Host) SendFromHost(msg WireMessage) {
	if msg.Target == "" {
		msg.Target = "*"
	}
	if msg.From == "" {
		msg.From = h.name
	}

	h.routeToPeers("", msg)
}

func (h *Host) routeToPeers(senderName string, msg WireMessage) {
	h.mu.RLock()
	targets := make([]*hostPeer, 0)

	for name, p := range h.peers {
		if name == senderName {
			continue
		}
		if msg.Target == "*" || msg.Target == name {
			targets = append(targets, p)
		}
	}
	h.mu.RUnlock()

	for _, p := range targets {
		_ = p.send(msg)
	}
}

func (h *Host) shouldDeliverToHost(target string) bool {
	return target == "*" || target == "" || target == h.name
}

func (h *Host) PeerList() []PeerInfo {
	h.mu.RLock()
	defer h.mu.RUnlock()

	out := []PeerInfo{
		{Name: h.name, VirtualIP: "10.10.0.1", RemoteIP: "HOST"},
	}
	for _, p := range h.peers {
		out = append(out, PeerInfo{
			Name:      p.name,
			VirtualIP: p.virtualIP,
			RemoteIP:  p.remoteIP,
		})
	}
	return out
}

func (h *Host) broadcastPeerList() {
	msg := WireMessage{
		Type:   "peer_list",
		Target: "*",
		Peers:  h.PeerList(),
	}
	h.routeToPeers("", msg)
}

func (h *Host) removePeer(name string) {
	h.mu.Lock()
	delete(h.peers, name)
	h.mu.Unlock()
}

func (h *Host) Close() {
	h.closeMu.Do(func() {
		close(h.closed)

		if h.ln != nil {
			_ = h.ln.Close()
		}

		h.mu.Lock()
		for _, p := range h.peers {
			_ = p.conn.Close()
		}
		h.peers = make(map[string]*hostPeer)
		h.mu.Unlock()
	})
}

func (p *hostPeer) send(msg WireMessage) error {
	p.sendMu.Lock()
	defer p.sendMu.Unlock()
	return p.enc.Encode(msg)
}

func authProof(password, challenge, name string) []byte {
	mac := hmac.New(sha256.New, []byte(password))
	_, _ = mac.Write([]byte(challenge))
	_, _ = mac.Write([]byte("|"))
	_, _ = mac.Write([]byte(name))
	return mac.Sum(nil)
}

func encodeBase64(data []byte) string {
	return base64.StdEncoding.EncodeToString(data)
}

func decodeBase64(s string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(s)
}

func remoteHost(addr string) string {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return addr
	}
	return host
}

var errDisconnected = errors.New("đã ngắt kết nối")
