package codex

import (
	"os/exec"
	"syscall"
)

// createNoWindow keeps a console window from opening, because Codexed has none.
const createNoWindow = 0x08000000

func hideWindow(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: createNoWindow}
}
