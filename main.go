package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os/exec"
	"runtime"
	"time"

	"internetlan/internal/core"
)

//go:embed web/*
var webFS embed.FS

func main() {
	app := core.NewApp()

	staticFS, err := fs.Sub(webFS, "web")
	if err != nil {
		log.Fatal(err)
	}

	mux := http.NewServeMux()
	app.RegisterHTTP(mux)
	mux.Handle("/", http.FileServer(http.FS(staticFS)))

	addr := "127.0.0.1:8787"
	url := "http://" + addr

	fmt.Println("==========================================")
	fmt.Println("             INTERNETLAN GO")
	fmt.Println("==========================================")
	fmt.Println("Giao diện:", url)
	fmt.Println("File nhận được lưu tại thư mục ./downloads")
	fmt.Println("Nhấn Ctrl+C để thoát.")
	fmt.Println()

	go func() {
		time.Sleep(600 * time.Millisecond)
		openBrowser(url)
	}()

	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

func openBrowser(url string) {
	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}

	_ = cmd.Start()
}
