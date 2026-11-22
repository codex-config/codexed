#!/bin/sh
# Installs Codexed on macOS and Linux.
#
#   curl -fsSL https://raw.githubusercontent.com/codex-config/codexed/main/install.sh | sh
#
# Options, as environment variables:
#   CODEXED_VERSION=v1.2.0   Install this release instead of the latest one.
#   CODEXED_NO_AUTOSTART=1   Do not start Codexed when you log in.
#   CODEXED_DRY_RUN=1        Show what the script would do, and change nothing.
#
# To uninstall:
#   curl -fsSL https://raw.githubusercontent.com/codex-config/codexed/main/install.sh | sh -s -- --uninstall

set -eu

repo="codex-config/codexed"
releases="${CODEXED_DOWNLOAD_URL:-https://github.com/$repo/releases}"
version="${CODEXED_VERSION:-latest}"
label="app.codexed"
port=7378

say() { printf '%s\n' "$*"; }
fail() {
	printf 'codexed: %s\n' "$*" >&2
	exit 1
}
has() { command -v "$1" >/dev/null 2>&1; }

usage() {
	say "Usage: install.sh [--uninstall]"
	say ""
	say "Installs Codexed, starts it, and starts it again when you log in."
	say "Set CODEXED_VERSION to pick a release, CODEXED_NO_AUTOSTART=1 to skip the login item,"
	say "and CODEXED_DRY_RUN=1 to see what the script would do."
}

download() {
	if has curl; then
		curl -fsSL --retry 3 -o "$2" "$1"
	elif has wget; then
		wget -q -O "$2" "$1"
	else
		fail "install curl or wget, then try again."
	fi
}

# Prints the health response of the running Codexed. The API only answers
# requests that send the X-Codexed header.
health() {
	if has curl; then
		curl -fsS -m 2 -H 'X-Codexed: 1' "http://127.0.0.1:$port/api/health" 2>/dev/null
	else
		wget -q -T 2 --header 'X-Codexed: 1' -O - "http://127.0.0.1:$port/api/health" 2>/dev/null
	fi
}

sha256() {
	if has sha256sum; then
		sha256sum "$1" | cut -d ' ' -f 1
	elif has shasum; then
		shasum -a 256 "$1" | cut -d ' ' -f 1
	else
		fail "cannot check the download. Install sha256sum or shasum, then try again."
	fi
}

detect() {
	case "$(uname -s)" in
	Darwin) os=darwin ;;
	Linux) os=linux ;;
	*) fail "this script is for macOS and Linux. On Windows, use install.ps1." ;;
	esac

	case "$(uname -m)" in
	x86_64 | amd64) arch=amd64 ;;
	arm64 | aarch64) arch=arm64 ;;
	*) fail "there is no Codexed build for $(uname -m)." ;;
	esac

	# A shell that runs under Rosetta reports x86_64 on Apple silicon.
	if [ "$os" = darwin ] && [ "$arch" = amd64 ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || true)" = 1 ]; then
		arch=arm64
	fi

	if [ "$version" = latest ]; then
		base="$releases/latest/download"
	else
		base="$releases/download/$version"
	fi
}

# Downloads a release asset into $tmp and checks it against SHA256SUMS.
fetch() {
	asset=$1
	say "Downloading $asset ($version)..."
	download "$base/$asset" "$tmp/$asset" || fail "could not download $base/$asset."
	download "$base/SHA256SUMS" "$tmp/SHA256SUMS" || fail "could not download $base/SHA256SUMS."

	expected=$(awk -v name="$asset" '$2 == name || $2 == "*" name { print $1; exit }' "$tmp/SHA256SUMS")
	[ -n "$expected" ] || fail "SHA256SUMS has no entry for $asset."
	actual=$(sha256 "$tmp/$asset")
	[ "$actual" = "$expected" ] || fail "the download of $asset is damaged (expected $expected, got $actual). Try again."
}

# Shows what the script would do, for CODEXED_DRY_RUN=1.
dry_run() {
	say "Would download $base/$1 and $base/SHA256SUMS"
	say "Would install to $2"
	if [ "$os" = darwin ]; then
		say "Would add the codexed command to $(command_dir)"
	fi
	if [ -n "${CODEXED_NO_AUTOSTART:-}" ]; then
		say "Would not start Codexed at login, and would remove $3 if it exists"
	else
		say "Would start Codexed at login from $3"
	fi
}

stop_running() {
	if [ "$os" = darwin ]; then
		launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
	fi
	if pgrep -x codexed >/dev/null 2>&1; then
		say "Stopping the running Codexed..."
		pkill -x codexed 2>/dev/null || true
		tries=0
		while pgrep -x codexed >/dev/null 2>&1 && [ "$tries" -lt 10 ]; do
			sleep 1
			tries=$((tries + 1))
		done
	fi
}

open_url() {
	if [ "$os" = darwin ]; then
		open "$1"
	elif has xdg-open; then
		xdg-open "$1" >/dev/null 2>&1 || true
	fi
}

# Waits until Codexed answers, then opens it in the browser and reads its version.
open_when_ready() {
	tries=0
	while [ "$tries" -lt 15 ]; do
		if response=$(health); then
			running=$(printf '%s' "$response" | sed -n 's/.*"version":"\([^"]*\)".*/\1/p')
			open_url "http://127.0.0.1:$port"
			return 0
		fi
		sleep 1
		tries=$((tries + 1))
	done
	return 1
}

# Opens Codexed once it runs and says how it went. The argument says where the icon shows.
report() {
	say ""
	if open_when_ready; then
		say "Codexed ${running:-} is running in the $1."
	else
		say "Codexed did not start. Run \"$binary\" to see why."
	fi
	if [ -z "${CODEXED_NO_AUTOSTART:-}" ]; then
		say "It starts again when you log in."
	fi
	say "To start it or open it from a terminal, type codexed."
}

# Where the codexed command goes on macOS: /usr/local/bin if it is yours to write, as with Homebrew.
command_dir() {
	if [ -d /usr/local/bin ] && [ -w /usr/local/bin ]; then
		say /usr/local/bin
	else
		say "$HOME/.local/bin"
	fi
}

# Says how to add a folder to PATH, if it is not there yet.
check_path() {
	case ":$PATH:" in
	*":$1:"*) ;;
	*) say "Add $1 to your PATH to start codexed from a terminal." ;;
	esac
}

install_macos() {
	asset="codexed-darwin-$arch.zip"
	app="$HOME/Applications/Codexed.app"
	binary="$app/Contents/MacOS/codexed"
	agent="$HOME/Library/LaunchAgents/$label.plist"
	if [ -n "${CODEXED_DRY_RUN:-}" ]; then
		dry_run "$asset" "$app" "$agent"
		return
	fi

	fetch "$asset"
	ditto -x -k "$tmp/$asset" "$tmp/unzipped"
	[ -d "$tmp/unzipped/Codexed.app" ] || fail "the download does not contain Codexed.app."

	stop_running
	mkdir -p "$HOME/Applications"
	rm -rf "$app"
	mv "$tmp/unzipped/Codexed.app" "$app"
	# curl does not set the quarantine flag, but remove it in case something else did.
	xattr -dr com.apple.quarantine "$app" 2>/dev/null || true
	say "Installed $app"

	# The command runs the binary inside the app, so that Codexed has no Dock icon.
	command="$(command_dir)/codexed"
	mkdir -p "$(dirname "$command")"
	cat >"$command" <<CMD
#!/bin/sh
# Starts Codexed from a terminal. install.sh wrote this file.
exec "$binary" "\$@"
CMD
	chmod 755 "$command"

	if [ -n "${CODEXED_NO_AUTOSTART:-}" ]; then
		rm -f "$agent"
		open "$app" --args -no-open
		report "menu bar"
		say "To start it when you log in, add it in System Settings > General > Login Items."
		check_path "$(dirname "$command")"
		return
	fi

	# A launch agent starts Codexed at login without opening the browser.
	mkdir -p "$HOME/Library/LaunchAgents"
	cat >"$agent" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>$label</string>
	<key>ProgramArguments</key>
	<array>
		<string>$binary</string>
		<string>-no-open</string>
	</array>
	<key>RunAtLoad</key>
	<true/>
	<key>ProcessType</key>
	<string>Interactive</string>
</dict>
</plist>
PLIST

	# Outside a desktop session, for example over SSH, the agent only loads at the next login.
	launchctl bootstrap "gui/$(id -u)" "$agent" 2>/dev/null || open "$app" --args -no-open 2>/dev/null || true
	report "menu bar"
	check_path "$(dirname "$command")"
}

# The Codexed logo, for the app menu and the desktop entry.
write_icon() {
	mkdir -p "$(dirname "$1")"
	cat >"$1" <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="16" fill="#e07a5f"/>
  <rect x="11" y="19.5" width="42" height="25" rx="12.5" fill="none" stroke="#fff" stroke-width="4.5"/>
  <circle cx="41" cy="32" r="6.5" fill="#fff"/>
</svg>
SVG
}

# Writes a desktop entry. The second argument adds options to the command.
write_entry() {
	mkdir -p "$(dirname "$1")"
	cat >"$1" <<ENTRY
[Desktop Entry]
Type=Application
Name=Codexed
Comment=Manage your Codex settings
Exec="$binary"$2
Icon=codexed
Terminal=false
Categories=Development;Utility;
ENTRY
}

install_linux() {
	asset="codexed-linux-$arch"
	bin_dir="$HOME/.local/bin"
	binary="$bin_dir/codexed"
	data="${XDG_DATA_HOME:-$HOME/.local/share}"
	autostart="${XDG_CONFIG_HOME:-$HOME/.config}/autostart/codexed.desktop"
	if [ -n "${CODEXED_DRY_RUN:-}" ]; then
		dry_run "$asset" "$binary" "$autostart"
		return
	fi

	fetch "$asset"
	stop_running
	mkdir -p "$bin_dir"
	# Copy next to the target first, so that the rename replaces the old file in one step.
	cp "$tmp/$asset" "$binary.new"
	chmod 755 "$binary.new"
	mv -f "$binary.new" "$binary"
	say "Installed $binary"

	write_icon "$data/icons/hicolor/scalable/apps/codexed.svg"
	write_entry "$data/applications/codexed.desktop" ""
	if [ -n "${CODEXED_NO_AUTOSTART:-}" ]; then
		rm -f "$autostart"
	else
		write_entry "$autostart" " -no-open"
	fi

	if [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
		nohup "$binary" -no-open >/dev/null 2>&1 &
		report "tray"
	else
		say ""
		say "There is no desktop session, so Codexed did not start. Run codexed to start it."
	fi

	check_path "$bin_dir"
	case "${XDG_CURRENT_DESKTOP:-}" in
	*GNOME*) say "On GNOME, the tray icon needs the AppIndicator extension." ;;
	esac
}

uninstall() {
	stop_running
	if [ "$os" = darwin ]; then
		for command in /usr/local/bin/codexed "$HOME/.local/bin/codexed"; do
			if grep -q 'Codexed.app' "$command" 2>/dev/null; then
				rm -f "$command"
			fi
		done
		rm -rf "$HOME/Applications/Codexed.app" \
			"$HOME/Library/LaunchAgents/$label.plist" \
			"$HOME/Library/Application Support/codexed" \
			"$HOME/Library/Caches/codexed"
	else
		data="${XDG_DATA_HOME:-$HOME/.local/share}"
		config="${XDG_CONFIG_HOME:-$HOME/.config}"
		rm -rf "$HOME/.local/bin/codexed" \
			"$data/applications/codexed.desktop" \
			"$data/icons/hicolor/scalable/apps/codexed.svg" \
			"$config/autostart/codexed.desktop" \
			"$config/codexed" \
			"${XDG_CACHE_HOME:-$HOME/.cache}/codexed"
	fi
	say "Codexed is uninstalled. Your Codex files did not change."
}

main() {
	case "${1:-}" in
	"") action=install ;;
	--uninstall) action=uninstall ;;
	-h | --help)
		usage
		exit 0
		;;
	*) fail "unknown option: $1. Run with --help to see the options." ;;
	esac

	detect
	if [ "$action" = uninstall ]; then
		uninstall
		return
	fi

	tmp=$(mktemp -d 2>/dev/null || mktemp -d -t codexed)
	trap 'rm -rf "$tmp"' EXIT
	trap 'exit 1' INT TERM

	if [ "$os" = darwin ]; then
		install_macos
	else
		install_linux
	fi
}

# Everything runs from here, so that a partial download does nothing.
main "$@"
