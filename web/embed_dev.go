//go:build dev

package web

import "net/http"

// DevURL is the Vite dev server, which proxies /api back to the Go server.
const DevURL = "http://localhost:5173"

func Handler() http.Handler {
	return http.RedirectHandler(DevURL, http.StatusTemporaryRedirect)
}
