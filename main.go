package main

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"fyne.io/systray"

	"codexed/internal/codex"
	"codexed/internal/server"
	"codexed/web"
)

var version = "dev"

func main() {
	port := flag.Int("port", 7378, "port for the local web UI")
	noOpen := flag.Bool("no-open", false, "don't open the browser at launch")
	foreground := flag.Bool("foreground", false, "stay in the terminal instead of running in the background")
	flag.Parse()

	addr := net.JoinHostPort("127.0.0.1", strconv.Itoa(*port))
	apiURL := "http://" + addr
	uiURL := cmp.Or(web.DevURL, apiURL)

	listener, err := inheritedListener()
	if err != nil {
		log.Fatalf("use the listener from the terminal: %v", err)
	}
	if listener == nil {
		listener, err = net.Listen("tcp", addr)
		if err != nil {
			if isRunning(apiURL) {
				openBrowser(uiURL)
				return
			}
			log.Fatalf("listen on %s: %v", addr, err)
		}

		// Started from a terminal, Codexed continues in the background and gives the
		// terminal back. It listens first, so that errors still show in the terminal.
		if !*foreground && web.DevURL == "" && fromTerminal() {
			logPath, err := detach(listener)
			if err != nil {
				log.Fatalf("start in the background: %v", err)
			}
			fmt.Printf("Codexed is running in the background at %s.\n", uiURL)
			fmt.Printf("Quit it from its tray icon. Its log is in %s.\n", logPath)
			return
		}
	}

	paths, err := codex.DefaultPaths()
	if err != nil {
		log.Fatal(err)
	}
	api, err := server.New(paths, version)
	if err != nil {
		log.Fatal(err)
	}
	srv := &http.Server{
		Handler:           api.Handler(strconv.Itoa(*port), web.Handler()),
		ReadHeaderTimeout: 10 * time.Second,
	}
	go func() {
		if err := srv.Serve(listener); !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()
	log.Printf("codexed %s is running at %s", version, uiURL)

	if !*noOpen {
		openBrowser(uiURL)
	}

	signals := make(chan os.Signal, 1)
	signal.Notify(signals, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-signals
		systray.Quit()
	}()

	runTray(uiURL, func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		srv.Shutdown(ctx)
		api.Close()
	})
}

// isRunning checks if another Codexed instance already uses the address.
func isRunning(url string) bool {
	req, err := http.NewRequest(http.MethodGet, url+"/api/health", nil)
	if err != nil {
		return false
	}
	req.Header.Set(server.Header, "1")

	client := http.Client{Timeout: time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	var health struct {
		App string `json:"app"`
	}
	return json.NewDecoder(resp.Body).Decode(&health) == nil && health.App == "codexed"
}
