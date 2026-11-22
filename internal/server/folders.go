package server

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"sync"
)

// folders keeps the project folders that were added by hand.
type folders struct {
	mu   sync.Mutex
	path string
}

func newFolders() (*folders, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}
	return &folders{path: filepath.Join(dir, "codexed", "folders.json")}, nil
}

func (f *folders) list() ([]string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.read()
}

func (f *folders) add(path string) error {
	return f.update(func(paths []string) []string {
		if slices.Contains(paths, path) {
			return paths
		}
		return append(paths, path)
	})
}

func (f *folders) remove(path string) error {
	return f.update(func(paths []string) []string {
		return slices.DeleteFunc(paths, func(p string) bool { return p == path })
	})
}

func (f *folders) update(change func([]string) []string) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	paths, err := f.read()
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(change(paths), "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(f.path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(f.path, data, 0o644)
}

func (f *folders) read() ([]string, error) {
	data, err := os.ReadFile(f.path)
	if errors.Is(err, fs.ErrNotExist) {
		return []string{}, nil
	}
	if err != nil {
		return nil, err
	}
	var paths []string
	return paths, json.Unmarshal(data, &paths)
}
