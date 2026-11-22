package main

import "fyne.io/systray"

const repoURL = "https://github.com/codex-config/codexed"

func runTray(url string, onExit func()) {
	systray.Run(func() {
		systray.SetTemplateIcon(templateIcon(), colorIcon())
		systray.SetTooltip("Codexed")

		open := systray.AddMenuItem("Open", "Open Codexed in your browser")
		github := systray.AddMenuItem("GitHub", "Open the Codexed repository on GitHub")
		systray.AddSeparator()
		quit := systray.AddMenuItem("Quit", "Quit Codexed")

		go func() {
			for {
				select {
				case <-open.ClickedCh:
					openBrowser(url)
				case <-github.ClickedCh:
					openBrowser(repoURL)
				case <-quit.ClickedCh:
					systray.Quit()
					return
				}
			}
		}()
	}, onExit)
}
