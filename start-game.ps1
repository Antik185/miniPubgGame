$ErrorActionPreference = 'Stop'

$port = 4173
$url = "http://127.0.0.1:$port/"

Set-Location -LiteralPath $PSScriptRoot

function Test-LocalPort {
    param([int]$Port)

    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $task = $client.ConnectAsync('127.0.0.1', $Port)
        return $task.Wait(250) -and $client.Connected
    }
    catch {
        return $false
    }
    finally {
        $client.Dispose()
    }
}

if (-not (Test-LocalPort -Port $port)) {
    $python = Get-Command python -ErrorAction SilentlyContinue
    if (-not $python) {
        Add-Type -AssemblyName PresentationFramework
        [System.Windows.MessageBox]::Show(
            'Python 3 was not found. Install Python and enable Add Python to PATH.',
            'Unable to start the game',
            'OK',
            'Error'
        ) | Out-Null
        exit 1
    }

    Start-Process `
        -FilePath $python.Source `
        -ArgumentList @('-m', 'http.server', "$port", '--bind', '127.0.0.1') `
        -WorkingDirectory $PSScriptRoot `
        -WindowStyle Hidden

    $started = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Milliseconds 100
        if (Test-LocalPort -Port $port) {
            $started = $true
            break
        }
    }

    if (-not $started) {
        Add-Type -AssemblyName PresentationFramework
        [System.Windows.MessageBox]::Show(
            "The local server did not start on port $port.",
            'Unable to start the game',
            'OK',
            'Error'
        ) | Out-Null
        exit 1
    }
}

Start-Process -FilePath $url
