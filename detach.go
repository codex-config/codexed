//go:build !windows

package main

import (
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"

	"golang.org/x/term"
)

// The background copy finds its listener as file descriptor 3 when this is set.
const listenerEnv = "CODEXED_LISTENER"

// fromTerminal reports whether someone started Codexed in a terminal. Login
// items and app launchers give it no terminal.
func fromTerminal() bool {
	for _, file := range []*os.File{os.Stdin, os.Stdout, os.Stderr} {
		if term.IsTerminal(int(file.Fd())) {
			return true
		}
	}
	return false
}

// inheritedListener returns the listener that the terminal copy passed on, if any.
func inheritedListener() (net.Listener, error) {
	if os.Getenv(listenerEnv) == "" {
		return nil, nil
	}
	os.Unsetenv(listenerEnv)
	file := os.NewFile(3, "listener")
	defer file.Close()
	return net.FileListener(file)
}

// detach starts a copy of Codexed in the background that serves on the
// listener, so that the terminal is free again. It returns the copy's log file.
func detach(listener net.Listener) (string, error) {
	file, err := listener.(*net.TCPListener).File()
	if err != nil {
		return "", err
	}
	defer file.Close()

	// The real path keeps the copy inside Codexed.app on macOS, so it has no Dock icon.
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	if real, err := filepath.EvalSymlinks(exe); err == nil {
		exe = real
	}

	logPath := filepath.Join(os.TempDir(), "codexed.log")
	if dir, err := os.UserCacheDir(); err == nil && os.MkdirAll(filepath.Join(dir, "codexed"), 0o755) == nil {
		logPath = filepath.Join(dir, "codexed", "codexed.log")
	}
	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return "", err
	}
	defer logFile.Close()

	cmd := exec.Command(exe, os.Args[1:]...)
	cmd.Env = append(os.Environ(), listenerEnv+"=1")
	cmd.ExtraFiles = []*os.File{file}
	cmd.Stdout = logFile
	cmd.Stderr = logFile
	// A new session, so that closing the terminal does not stop it.
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	if err := cmd.Start(); err != nil {
		return "", err
	}
	return logPath, cmd.Process.Release()
}
