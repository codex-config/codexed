package server

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"runtime"

	"github.com/ncruces/zenity"
)

// Browsers only reveal a folder's name, so the server opens the system dialog,
// which knows the full path.
func pickFolder(ctx context.Context) (string, error) {
	home, _ := os.UserHomeDir()
	path, err := zenity.SelectFile(
		zenity.Directory(),
		zenity.Title("Select a project folder"),
		zenity.Filename(home+string(os.PathSeparator)),
		zenity.Context(ctx),
	)
	if errors.Is(err, zenity.ErrCanceled) {
		return "", nil
	}
	return path, err
}

// selectFolder returns an empty path when the dialog is canceled.
func (s *Server) selectFolder(w http.ResponseWriter, r *http.Request) {
	if !s.picking.TryLock() {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "A folder dialog is already open."})
		return
	}
	defer s.picking.Unlock()

	path, err := s.pickFolder(r.Context())
	if err != nil {
		log.Printf("folder dialog: %v", err)
		message := "Could not open the folder dialog."
		if runtime.GOOS == "linux" {
			message += " It needs zenity, qarma or matedialog."
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": message})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"path": path})
}
