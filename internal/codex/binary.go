package codex

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

var ErrNotInstalled = errors.New("could not find the Codex CLI on this computer")

// Binary is an installed Codex CLI.
type Binary struct {
	Path    string `json:"path"`
	Version string `json:"version"`
}

// FindBinary looks in PATH and in the usual install folders. Apps started from
// the Dock or a login item do not get the PATH of your shell, so both matter.
func FindBinary() (Binary, error) {
	for _, path := range candidates() {
		if info, err := os.Stat(path); err != nil || info.IsDir() {
			continue
		}
		version, err := versionOf(path)
		if err != nil {
			continue
		}
		return Binary{Path: path, Version: version}, nil
	}
	return Binary{}, ErrNotInstalled
}

func candidates() []string {
	names := []string{"codex"}
	if runtime.GOOS == "windows" {
		names = []string{"codex.exe", "codex.cmd"}
	}

	var paths []string
	for _, name := range names {
		if p, err := exec.LookPath(name); err == nil {
			paths = append(paths, p)
		}
	}
	home, _ := os.UserHomeDir()
	if runtime.GOOS == "windows" {
		if dir := os.Getenv("APPDATA"); dir != "" {
			paths = append(paths, filepath.Join(dir, "npm", "codex.cmd"))
		}
		return paths
	}
	for _, dir := range searchDirs(home) {
		paths = append(paths, filepath.Join(dir, "codex"))
	}
	return paths
}

func searchDirs(home string) []string {
	dirs := []string{"/opt/homebrew/bin", "/usr/local/bin"}
	if home != "" {
		dirs = append(dirs,
			filepath.Join(home, ".local", "bin"),
			filepath.Join(home, ".npm-global", "bin"),
			filepath.Join(home, ".volta", "bin"),
			filepath.Join(home, ".bun", "bin"),
			filepath.Join(home, ".cargo", "bin"),
		)
	}
	return dirs
}

func versionOf(path string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, path, "--version")
	cmd.Env = childEnv(path, "")
	hideWindow(cmd)
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	// The output looks like "codex-cli 0.145.0".
	fields := strings.Fields(string(out))
	if len(fields) == 0 {
		return "", errors.New("codex printed no version")
	}
	return fields[len(fields)-1], nil
}

// childEnv adds the install folders to PATH, so that an npm install finds node.
// A non-empty home replaces CODEX_HOME.
func childEnv(binary, home string) []string {
	env := os.Environ()
	extra := []string{filepath.Dir(binary)}
	if runtime.GOOS != "windows" {
		h, _ := os.UserHomeDir()
		extra = append(extra, searchDirs(h)...)
	}
	path := strings.Join(append(extra, os.Getenv("PATH")), string(os.PathListSeparator))

	out := make([]string, 0, len(env)+2)
	for _, kv := range env {
		if strings.HasPrefix(kv, "PATH=") || (home != "" && strings.HasPrefix(kv, "CODEX_HOME=")) {
			continue
		}
		out = append(out, kv)
	}
	out = append(out, "PATH="+path)
	if home != "" {
		out = append(out, "CODEX_HOME="+home)
	}
	return out
}
