package core

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"sync"
	"time"
)

type Client struct {
	app      *App
	name     string
	server   string
	port     int
	password string

	mu        sync.RWMutex
	virtualIP string
	peers     []PeerInfo

	conn   net.Conn
	enc    *json.Encoder
	dec    *json.Decoder
	sendMu sync.Mutex

	closeOnce sync.Once
	closed    chan struct{}
}

func NewClient(app *App, name, server string, port int, password string) *Client {
	return &Client{
		app:      app,
		name:     name,
		server:   server,
		port:     port,
		password: password,
		closed:   make(chan struct{}),
	}
}

func (c *Client) Connect() error {
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", c.server, c.port), 7*time.Second)
	if err != nil {
		return fmt.Errorf("không kết nối được tới %s:%d: %w", c.server, c.port, err)
	}

	c.conn = conn
	c.enc = json.NewEncoder(conn)
	c.dec = json.NewDecoder(conn)

	_ = conn.SetDeadline(time.Now().Add(15 * time.Second))

	var challenge WireMessage
	if err := c.dec.Decode(&challenge); err != nil {
		_ = conn.Close()
		return fmt.Errorf("không nhận được challenge: %w", err)
	}
	if challenge.Type != "challenge" {
		_ = conn.Close()
		return fmt.Errorf("server không đúng giao thức InternetLAN")
	}

	proof := base64.StdEncoding.EncodeToString(authProof(c.password, challenge.Challenge, c.name))
	if err := c.enc.Encode(WireMessage{
		Type:  "auth",
		Name:  c.name,
		Proof: proof,
	}); err != nil {
		_ = conn.Close()
		return err
	}

	var authResp WireMessage
	if err := c.dec.Decode(&authResp); err != nil {
		_ = conn.Close()
		return fmt.Errorf("server không trả lời đăng nhập: %w", err)
	}

	if authResp.Type == "auth_fail" {
		_ = conn.Close()
		if authResp.Error == "" {
			authResp.Error = "Đăng nhập thất bại"
		}
		return fmt.Errorf("%s", authResp.Error)
	}
	if authResp.Type != "auth_ok" {
		_ = conn.Close()
		return fmt.Errorf("phản hồi đăng nhập không hợp lệ")
	}

	c.mu.Lock()
	c.virtualIP = authResp.VirtualIP
	c.mu.Unlock()

	_ = conn.SetDeadline(time.Time{})

	go c.readLoop()
	return nil
}

func (c *Client) readLoop() {
	defer c.Close()

	for {
		var msg WireMessage
		if err := c.dec.Decode(&msg); err != nil {
			select {
			case <-c.closed:
				return
			default:
				c.app.addEvent("error", "Mất kết nối tới Host: "+err.Error(), "", "*", "", "")
				return
			}
		}

		switch msg.Type {
		case "peer_list":
			c.mu.Lock()
			c.peers = append([]PeerInfo(nil), msg.Peers...)
			c.mu.Unlock()

		case "chat":
			c.app.addEvent("chat", msg.Text, msg.From, msg.Target, "", "")

		case "file_begin":
			c.app.beginReceiveFile(msg)

		case "file_chunk":
			c.app.receiveFileChunk(msg)

		case "file_end":
			c.app.endReceiveFile(msg)
		}
	}
}

func (c *Client) Send(msg WireMessage) error {
	select {
	case <-c.closed:
		return errDisconnected
	default:
	}

	c.sendMu.Lock()
	defer c.sendMu.Unlock()
	return c.enc.Encode(msg)
}

func (c *Client) VirtualIP() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.virtualIP
}

func (c *Client) PeerList() []PeerInfo {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return append([]PeerInfo(nil), c.peers...)
}

func (c *Client) Close() {
	c.closeOnce.Do(func() {
		close(c.closed)
		if c.conn != nil {
			_ = c.conn.Close()
		}
	})
}
