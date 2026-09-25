package core

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type App struct {
	mu sync.RWMutex

	mode      string
	name      string
	virtualIP string
	server    string
	port      int

	host   *Host
	client *Client

	events      []UIEvent
	nextEventID atomic.Int64

	recvMu    sync.Mutex
	receivers map[string]*receivedFile
}

type receivedFile struct {
	file     *os.File
	name     string
	path     string
	from     string
	target   string
	expected int64
	written  int64
}

func NewApp() *App {
	return &App{
		mode:      "disconnected",
		receivers: make(map[string]*receivedFile),
	}
}

func (a *App) RegisterHTTP(mux *http.ServeMux) {
	mux.HandleFunc("/api/state", a.handleState)
	mux.HandleFunc("/api/events", a.handleEvents)
	mux.HandleFunc("/api/host/start", a.handleStartHost)
	mux.HandleFunc("/api/client/join", a.handleJoin)
	mux.HandleFunc("/api/disconnect", a.handleDisconnect)
	mux.HandleFunc("/api/chat", a.handleChat)
	mux.HandleFunc("/api/file", a.handleFile)
	mux.HandleFunc("/api/local-ips", a.handleLocalIPs)
}

func (a *App) handleState(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}

	a.mu.RLock()
	mode := a.mode
	name := a.name
	virtualIP := a.virtualIP
	server := a.server
	port := a.port
	host := a.host
	client := a.client
	a.mu.RUnlock()

	var peers []PeerInfo
	switch mode {
	case "host":
		if host != nil {
			peers = host.PeerList()
		}
	case "client":
		if client != nil {
			peers = client.PeerList()
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"mode":      mode,
		"name":      name,
		"virtualIp": virtualIP,
		"server":    server,
		"port":      port,
		"peers":     peers,
	})
}

func (a *App) handleEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}

	after, _ := strconv.ParseInt(r.URL.Query().Get("after"), 10, 64)

	a.mu.RLock()
	out := make([]UIEvent, 0)
	for _, ev := range a.events {
		if ev.ID > after {
			out = append(out, ev)
		}
	}
	a.mu.RUnlock()

	writeJSON(w, http.StatusOK, out)
}

func (a *App) handleStartHost(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}

	var req struct {
		Name     string `json:"name"`
		Port     int    `json:"port"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Dữ liệu không hợp lệ")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "Tên máy và password không được để trống")
		return
	}
	if req.Port <= 0 || req.Port > 65535 {
		req.Port = 50000
	}

	a.Disconnect()

	host := NewHost(a, req.Name, req.Password, req.Port)
	if err := host.Start(); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	a.mu.Lock()
	a.mode = "host"
	a.name = req.Name
	a.virtualIP = "10.10.0.1"
	a.server = "0.0.0.0"
	a.port = req.Port
	a.host = host
	a.client = nil
	a.mu.Unlock()

	a.addEvent("system", fmt.Sprintf("Đã tạo mạng. Đang lắng nghe cổng %d.", req.Port), req.Name, "*", "", "")
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *App) handleJoin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}

	var req struct {
		Name     string `json:"name"`
		Server   string `json:"server"`
		Port     int    `json:"port"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Dữ liệu không hợp lệ")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Server = strings.TrimSpace(req.Server)

	if req.Name == "" || req.Server == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "Tên máy, IP/host và password là bắt buộc")
		return
	}
	if req.Port <= 0 || req.Port > 65535 {
		req.Port = 50000
	}

	a.Disconnect()

	client := NewClient(a, req.Name, req.Server, req.Port, req.Password)
	if err := client.Connect(); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	a.mu.Lock()
	a.mode = "client"
	a.name = req.Name
	a.virtualIP = client.VirtualIP()
	a.server = req.Server
	a.port = req.Port
	a.client = client
	a.host = nil
	a.mu.Unlock()

	a.addEvent("system", "Đã kết nối tới mạng.", req.Name, "*", "", "")
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"virtualIp": client.VirtualIP(),
	})
}

func (a *App) handleDisconnect(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	a.Disconnect()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *App) Disconnect() {
	a.mu.Lock()
	host := a.host
	client := a.client

	a.mode = "disconnected"
	a.name = ""
	a.virtualIP = ""
	a.server = ""
	a.port = 0
	a.host = nil
	a.client = nil
	a.mu.Unlock()

	if client != nil {
		client.Close()
	}
	if host != nil {
		host.Close()
	}
}

func (a *App) handleChat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}

	var req struct {
		Text   string `json:"text"`
		Target string `json:"target"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Dữ liệu chat không hợp lệ")
		return
	}

	req.Text = strings.TrimSpace(req.Text)
	if req.Text == "" {
		writeError(w, http.StatusBadRequest, "Tin nhắn đang trống")
		return
	}
	if req.Target == "" {
		req.Target = "*"
	}

	a.mu.RLock()
	mode := a.mode
	name := a.name
	host := a.host
	client := a.client
	a.mu.RUnlock()

	msg := WireMessage{
		Type:      "chat",
		From:      name,
		Target:    req.Target,
		Text:      req.Text,
		Timestamp: time.Now().UnixMilli(),
	}

	switch mode {
	case "host":
		if host == nil {
			writeError(w, http.StatusConflict, "Host chưa sẵn sàng")
			return
		}
		a.addEvent("chat", req.Text, name, req.Target, "", "")
		host.SendFromHost(msg)

	case "client":
		if client == nil {
			writeError(w, http.StatusConflict, "Client chưa sẵn sàng")
			return
		}
		if err := client.Send(msg); err != nil {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}

	default:
		writeError(w, http.StatusConflict, "Bạn chưa tham gia mạng")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *App) handleFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}

	const maxUpload = 100 << 20 // 100 MB
	r.Body = http.MaxBytesReader(w, r.Body, maxUpload+1<<20)

	if err := r.ParseMultipartForm(maxUpload); err != nil {
		writeError(w, http.StatusBadRequest, "File quá lớn hoặc dữ liệu upload không hợp lệ")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Chưa chọn file")
		return
	}
	defer file.Close()

	target := r.FormValue("target")
	if target == "" {
		target = "*"
	}

	a.mu.RLock()
	mode := a.mode
	name := a.name
	host := a.host
	client := a.client
	a.mu.RUnlock()

	if mode == "disconnected" {
		writeError(w, http.StatusConflict, "Bạn chưa tham gia mạng")
		return
	}

	fileID := randomID()
	begin := WireMessage{
		Type:      "file_begin",
		From:      name,
		Target:    target,
		FileID:    fileID,
		FileName:  filepath.Base(header.Filename),
		FileSize:  header.Size,
		Timestamp: time.Now().UnixMilli(),
	}

	send := func(m WireMessage) error {
		if mode == "host" {
			host.SendFromHost(m)
			return nil
		}
		return client.Send(m)
	}

	if err := send(begin); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	buf := make([]byte, 32*1024)
	var sent int64

	for {
		n, readErr := file.Read(buf)
		if n > 0 {
			chunk := WireMessage{
				Type:     "file_chunk",
				From:     name,
				Target:   target,
				FileID:   fileID,
				FileData: encodeBase64(buf[:n]),
			}
			if err := send(chunk); err != nil {
				writeError(w, http.StatusBadGateway, err.Error())
				return
			}
			sent += int64(n)
		}

		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			writeError(w, http.StatusInternalServerError, readErr.Error())
			return
		}
	}

	if err := send(WireMessage{
		Type:     "file_end",
		From:     name,
		Target:   target,
		FileID:   fileID,
		FileName: filepath.Base(header.Filename),
		FileSize: sent,
	}); err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	a.addEvent(
		"file_sent",
		fmt.Sprintf("Đã gửi %s (%d bytes)", filepath.Base(header.Filename), sent),
		name,
		target,
		filepath.Base(header.Filename),
		"",
	)

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "bytes": sent})
}

func (a *App) handleLocalIPs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}

	addrs, _ := net.InterfaceAddrs()
	ips := make([]string, 0)

	for _, addr := range addrs {
		ipNet, ok := addr.(*net.IPNet)
		if !ok || ipNet.IP.IsLoopback() {
			continue
		}
		if v4 := ipNet.IP.To4(); v4 != nil {
			ips = append(ips, v4.String())
		}
	}

	writeJSON(w, http.StatusOK, ips)
}

func (a *App) addEvent(eventType, message, from, target, fileName, filePath string) {
	ev := UIEvent{
		ID:        a.nextEventID.Add(1),
		Type:      eventType,
		Message:   message,
		From:      from,
		Target:    target,
		FileName:  fileName,
		FilePath:  filePath,
		Timestamp: time.Now().UnixMilli(),
	}

	a.mu.Lock()
	a.events = append(a.events, ev)
	if len(a.events) > 500 {
		a.events = append([]UIEvent(nil), a.events[len(a.events)-500:]...)
	}
	a.mu.Unlock()
}

func (a *App) beginReceiveFile(msg WireMessage) {
	if msg.FileID == "" || msg.FileName == "" {
		return
	}

	if err := os.MkdirAll("downloads", 0o755); err != nil {
		a.addEvent("error", "Không tạo được thư mục downloads: "+err.Error(), msg.From, msg.Target, msg.FileName, "")
		return
	}

	safeName := sanitizeFileName(msg.FileName)
	path := uniquePath(filepath.Join("downloads", safeName))

	f, err := os.Create(path)
	if err != nil {
		a.addEvent("error", "Không tạo được file nhận: "+err.Error(), msg.From, msg.Target, msg.FileName, "")
		return
	}

	a.recvMu.Lock()
	a.receivers[msg.FileID] = &receivedFile{
		file:     f,
		name:     safeName,
		path:     path,
		from:     msg.From,
		target:   msg.Target,
		expected: msg.FileSize,
	}
	a.recvMu.Unlock()

	a.addEvent("file_begin", "Đang nhận file "+safeName, msg.From, msg.Target, safeName, "")
}

func (a *App) receiveFileChunk(msg WireMessage) {
	data, err := decodeBase64(msg.FileData)
	if err != nil {
		return
	}

	a.recvMu.Lock()
	rf := a.receivers[msg.FileID]
	if rf != nil {
		n, writeErr := rf.file.Write(data)
		if writeErr == nil {
			rf.written += int64(n)
		}
	}
	a.recvMu.Unlock()
}

func (a *App) endReceiveFile(msg WireMessage) {
	a.recvMu.Lock()
	rf := a.receivers[msg.FileID]
	if rf != nil {
		_ = rf.file.Close()
		delete(a.receivers, msg.FileID)
	}
	a.recvMu.Unlock()

	if rf != nil {
		a.addEvent(
			"file_received",
			fmt.Sprintf("Đã nhận %s (%d bytes)", rf.name, rf.written),
			rf.from,
			rf.target,
			rf.name,
			rf.path,
		)
	}
}

func sanitizeFileName(name string) string {
	name = filepath.Base(name)
	name = strings.ReplaceAll(name, "..", "_")
	name = strings.TrimSpace(name)
	if name == "" {
		return "received_file"
	}
	return name
}

func uniquePath(path string) string {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return path
	}

	ext := filepath.Ext(path)
	base := strings.TrimSuffix(path, ext)
	for i := 1; ; i++ {
		candidate := fmt.Sprintf("%s_%d%s", base, i, ext)
		if _, err := os.Stat(candidate); os.IsNotExist(err) {
			return candidate
		}
	}
}

func randomID() string {
	buf := make([]byte, 12)
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]any{"error": message})
}

func methodNotAllowed(w http.ResponseWriter) {
	writeError(w, http.StatusMethodNotAllowed, "Method không được hỗ trợ")
}
