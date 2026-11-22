# Raise it in the VERSION file before you run the Release workflow.
VERSION ?= $(shell cat VERSION)
LDFLAGS := -s -w -X main.version=$(VERSION)

.PHONY: build web app release dev dev-go dev-web docs config-schema test clean

build: web
	go build -ldflags "$(LDFLAGS)" -o bin/codexed .

web: web/node_modules
	cd web && npm run build

web/node_modules: web/package-lock.json
	cd web && npm ci
	@touch $@

# macOS menu bar app, which you can add to Login Items.
app: build
	rm -rf bin/Codexed.app
	mkdir -p bin/Codexed.app/Contents/MacOS
	cp bin/codexed bin/Codexed.app/Contents/MacOS/codexed
	sed 's/VERSION/$(VERSION)/' packaging/darwin/Info.plist > bin/Codexed.app/Contents/Info.plist

# Release assets and their SHA256SUMS in bin/release, as install.sh and install.ps1 expect them.
# macOS gets a zipped menu bar app. Run this on a Mac: the macOS tray needs cgo.
release: web
	rm -rf bin/release
	mkdir -p bin/release
	for arch in arm64 amd64; do \
		app=bin/release/darwin-$$arch/Codexed.app; \
		mkdir -p $$app/Contents/MacOS; \
		GOOS=darwin GOARCH=$$arch CGO_ENABLED=1 go build -ldflags "$(LDFLAGS)" -o $$app/Contents/MacOS/codexed . || exit 1; \
		sed 's/VERSION/$(VERSION)/' packaging/darwin/Info.plist > $$app/Contents/Info.plist; \
		codesign --force --sign - $$app || exit 1; \
		ditto -c -k --keepParent $$app bin/release/codexed-darwin-$$arch.zip || exit 1; \
		rm -rf bin/release/darwin-$$arch; \
	done
	GOOS=windows GOARCH=amd64 go build -ldflags "$(LDFLAGS) -H=windowsgui" -o bin/release/codexed-windows-amd64.exe .
	GOOS=windows GOARCH=arm64 go build -ldflags "$(LDFLAGS) -H=windowsgui" -o bin/release/codexed-windows-arm64.exe .
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags "$(LDFLAGS)" -o bin/release/codexed-linux-amd64 .
	GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -ldflags "$(LDFLAGS)" -o bin/release/codexed-linux-arm64 .
	cd bin/release && shasum -a 256 codexed-* > SHA256SUMS

# Go API on :7378 and Vite on :5173. Open http://localhost:5173.
dev:
	$(MAKE) -j2 dev-go dev-web

dev-go:
	go run -tags dev . -no-open

dev-web: web/node_modules
	cd web && npm run dev

docs:
	cd docs && npm run dev

# The app bundles the config schema of one Codex release, and the docs homepage
# lists its settings. Run this after you update Codex.
config-schema:
	go run ./cmd/config-schema > internal/codex/config-schema.json
	cp internal/codex/config-schema.json "docs/app/(home)/config-schema.json"

# Only list Go packages by name: web/node_modules can contain stray .go files.
test: web
	go vet . ./cmd/... ./internal/... ./web
	go test ./internal/...

clean:
	rm -rf bin web/dist
