package main

import "net"

// Windows builds are GUI apps, so a terminal does not wait for them and
// Codexed never needs to move to the background.

func fromTerminal() bool { return false }

func inheritedListener() (net.Listener, error) { return nil, nil }

func detach(net.Listener) (string, error) { return "", nil }
