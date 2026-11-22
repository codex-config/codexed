# Installs Codexed on Windows, with PowerShell 5.1 or later.
#
#   irm https://raw.githubusercontent.com/codex-config/codexed/main/install.ps1 | iex
#
# Options, as environment variables:
#   $env:CODEXED_VERSION = 'v1.2.0'   Install this release instead of the latest one.
#   $env:CODEXED_NO_AUTOSTART = '1'   Do not start Codexed when you sign in.
#   $env:CODEXED_DRY_RUN = '1'        Show what the script would do, and change nothing.
#
# To uninstall:
#   & ([scriptblock]::Create((irm https://raw.githubusercontent.com/codex-config/codexed/main/install.ps1))) -Uninstall
#
# From a downloaded copy: .\install.ps1 -Uninstall

# Everything runs in this block, so that its settings stay out of your session
# and a partial download does nothing.
& {
    param([switch]$Uninstall)

    $ErrorActionPreference = 'Stop'
    $ProgressPreference = 'SilentlyContinue'
    # Windows PowerShell 5.1 does not use TLS 1.2 by default.
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

    $repo = 'codex-config/codexed'
    $releases = if ($env:CODEXED_DOWNLOAD_URL) { $env:CODEXED_DOWNLOAD_URL } else { "https://github.com/$repo/releases" }
    $version = if ($env:CODEXED_VERSION) { $env:CODEXED_VERSION } else { 'latest' }
    $installDir = Join-Path $env:LOCALAPPDATA 'Programs\Codexed'
    $exe = Join-Path $installDir 'codexed.exe'
    $shortcut = Join-Path ([Environment]::GetFolderPath('Programs')) 'Codexed.lnk'
    $runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
    $url = 'http://127.0.0.1:7378'

    function Stop-Codexed {
        $running = @(Get-Process -Name codexed -ErrorAction SilentlyContinue)
        if ($running.Count -gt 0) {
            Write-Host 'Stopping the running Codexed...'
            $running | Stop-Process -Force
            $running | Wait-Process -Timeout 10 -ErrorAction SilentlyContinue
        }
    }

    # Returns the version of the running Codexed, or nothing. The API only
    # answers requests that send the X-Codexed header.
    function Get-RunningVersion {
        try {
            (Invoke-RestMethod -UseBasicParsing -TimeoutSec 2 -Headers @{ 'X-Codexed' = '1' } -Uri "$url/api/health").version
        } catch {
            $null
        }
    }

    # The user PATH, as written, so that entries such as %USERPROFILE%\bin stay as they are.
    function Get-UserPath {
        $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment')
        $value = $key.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
        $key.Close()
        @($value -split ';' | Where-Object { $_ })
    }

    function Set-UserPath([string[]]$entries) {
        $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $true)
        $key.SetValue('Path', ($entries -join ';'), [Microsoft.Win32.RegistryValueKind]::ExpandString)
        $key.Close()
        # Changing a user variable through .NET tells Windows to reload the environment,
        # so that new terminals see the new PATH.
        [Environment]::SetEnvironmentVariable('CODEXED_PATH_CHANGED', '1', 'User')
        [Environment]::SetEnvironmentVariable('CODEXED_PATH_CHANGED', $null, 'User')
    }

    if ($Uninstall) {
        Stop-Codexed
        $entries = @(Get-UserPath)
        if ($entries -contains $installDir) {
            Set-UserPath @($entries | Where-Object { $_ -ne $installDir })
        }
        Remove-ItemProperty -Path $runKey -Name 'Codexed' -ErrorAction SilentlyContinue
        foreach ($path in @($installDir, $shortcut, (Join-Path $env:APPDATA 'codexed'), (Join-Path $env:LOCALAPPDATA 'codexed'))) {
            Remove-Item -Recurse -Force -Path $path -ErrorAction SilentlyContinue
        }
        Write-Host 'Codexed is uninstalled. Your Codex files did not change.'
        return
    }

    # 32-bit PowerShell on 64-bit Windows reports the real CPU in PROCESSOR_ARCHITEW6432.
    $cpu = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
    $arch = switch ($cpu) {
        'AMD64' { 'amd64' }
        'ARM64' { 'arm64' }
        default { throw "There is no Codexed build for $cpu." }
    }

    $asset = "codexed-windows-$arch.exe"
    $base = if ($version -eq 'latest') { "$releases/latest/download" } else { "$releases/download/$version" }

    if ($env:CODEXED_DRY_RUN) {
        Write-Host "Would download $base/$asset and $base/SHA256SUMS"
        Write-Host "Would install to $exe, with a Start menu entry"
        Write-Host "Would add $installDir to your PATH"
        if ($env:CODEXED_NO_AUTOSTART) {
            Write-Host "Would not start Codexed at sign-in, and would remove the Codexed value from $runKey if it exists"
        } else {
            Write-Host "Would start Codexed at sign-in from $runKey"
        }
        return
    }

    $tmp = Join-Path ([IO.Path]::GetTempPath()) ('codexed-' + [Guid]::NewGuid())
    New-Item -ItemType Directory -Path $tmp | Out-Null
    try {
        Write-Host "Downloading $asset ($version)..."
        $download = Join-Path $tmp $asset
        $sums = Join-Path $tmp 'SHA256SUMS'
        Invoke-WebRequest -UseBasicParsing -Uri "$base/$asset" -OutFile $download
        Invoke-WebRequest -UseBasicParsing -Uri "$base/SHA256SUMS" -OutFile $sums

        $expected = Get-Content $sums | ForEach-Object {
            $fields = $_ -split '\s+'
            if ($fields.Count -ge 2 -and $fields[1].TrimStart('*') -eq $asset) { $fields[0].ToLowerInvariant() }
        } | Select-Object -First 1
        if (-not $expected) { throw "SHA256SUMS has no entry for $asset." }
        $actual = (Get-FileHash -Algorithm SHA256 -Path $download).Hash.ToLowerInvariant()
        if ($actual -ne $expected) {
            throw "The download of $asset is damaged (expected $expected, got $actual). Try again."
        }

        Stop-Codexed
        New-Item -ItemType Directory -Force -Path $installDir | Out-Null
        Move-Item -Force -Path $download -Destination $exe
        # Invoke-WebRequest does not mark the file as downloaded, but clear the mark in case something else did.
        Unblock-File -Path $exe -ErrorAction SilentlyContinue
    } finally {
        Remove-Item -Recurse -Force -Path $tmp -ErrorAction SilentlyContinue
    }
    Write-Host "Installed $exe"

    $shell = New-Object -ComObject WScript.Shell
    $link = $shell.CreateShortcut($shortcut)
    $link.TargetPath = $exe
    $link.WorkingDirectory = $installDir
    $link.Description = 'Manage your Codex settings'
    $link.Save()

    # Lets you type codexed in a terminal. It is a GUI app, so the terminal does not wait for it.
    $entries = @(Get-UserPath)
    if ($entries -notcontains $installDir) {
        Set-UserPath ($entries + $installDir)
    }
    if (($env:Path -split ';') -notcontains $installDir) {
        $env:Path = "$env:Path;$installDir"
    }

    if ($env:CODEXED_NO_AUTOSTART) {
        Remove-ItemProperty -Path $runKey -Name 'Codexed' -ErrorAction SilentlyContinue
    } else {
        New-ItemProperty -Path $runKey -Name 'Codexed' -Value "`"$exe`" -no-open" -PropertyType String -Force | Out-Null
    }

    # Start without the browser, wait until Codexed answers, then open it.
    Start-Process -FilePath $exe -ArgumentList '-no-open'
    $running = $null
    foreach ($attempt in 1..15) {
        $running = Get-RunningVersion
        if ($running) { break }
        Start-Sleep -Seconds 1
    }

    Write-Host ''
    if ($running) {
        Start-Process $url
        Write-Host "Codexed $running is running in the notification area."
    } else {
        Write-Host "Codexed did not start. Run `"$exe`" to see why."
    }
    if (-not $env:CODEXED_NO_AUTOSTART) {
        Write-Host 'It starts again when you sign in.'
    }
    Write-Host 'To start it or open it, choose Codexed in the Start menu or type codexed in a new terminal.'
} @args
