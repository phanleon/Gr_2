package core

type PeerInfo struct {
	Name      string `json:"name"`
	VirtualIP string `json:"virtualIp"`
	RemoteIP  string `json:"remoteIp,omitempty"`
}

type WireMessage struct {
	Type      string     `json:"type"`
	Name      string     `json:"name,omitempty"`
	From      string     `json:"from,omitempty"`
	Target    string     `json:"target,omitempty"`
	Text      string     `json:"text,omitempty"`
	VirtualIP string     `json:"virtualIp,omitempty"`
	Challenge string     `json:"challenge,omitempty"`
	Proof     string     `json:"proof,omitempty"`
	Peers     []PeerInfo `json:"peers,omitempty"`
	FileID    string     `json:"fileId,omitempty"`
	FileName  string     `json:"fileName,omitempty"`
	FileSize  int64      `json:"fileSize,omitempty"`
	FileData  string     `json:"fileData,omitempty"`
	Error     string     `json:"error,omitempty"`
	Timestamp int64      `json:"timestamp,omitempty"`
}

type UIEvent struct {
	ID        int64  `json:"id"`
	Type      string `json:"type"`
	Message   string `json:"message,omitempty"`
	From      string `json:"from,omitempty"`
	Target    string `json:"target,omitempty"`
	FileName  string `json:"fileName,omitempty"`
	FilePath  string `json:"filePath,omitempty"`
	Timestamp int64  `json:"timestamp"`
}
