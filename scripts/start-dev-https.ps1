$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$toolsDirectory = Join-Path $env:LOCALAPPDATA 'IndusHospitalTools'
$cloudflared = Join-Path $toolsDirectory 'cloudflared.exe'
$tunnelLog = Join-Path $toolsDirectory 'tunnel.log'
$backendEnv = Join-Path $root 'Backend\.env'

New-Item -ItemType Directory -Force -Path $toolsDirectory | Out-Null

if (-not (Test-Path $cloudflared)) {
    Write-Host 'Downloading Cloudflare Tunnel...'
    Invoke-WebRequest `
        -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' `
        -OutFile $cloudflared
}

Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item $tunnelLog -Force -ErrorAction SilentlyContinue

Start-Process `
    -FilePath $cloudflared `
    -ArgumentList 'tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', 'http://localhost:5173', '--logfile', $tunnelLog `
    -WindowStyle Hidden

$tunnelUrl = $null
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Seconds 1
    if (Test-Path $tunnelLog) {
        $match = Select-String -Path $tunnelLog -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches |
            Select-Object -Last 1
        if ($match) {
            $tunnelUrl = $match.Matches[0].Value
            break
        }
    }
}

if (-not $tunnelUrl) {
    throw 'Could not start the HTTPS video tunnel.'
}

$envContent = Get-Content -Raw $backendEnv
if ($envContent -match '(?m)^CALL_WEB_BASE_URL=') {
    $envContent = $envContent -replace '(?m)^CALL_WEB_BASE_URL=.*$', "CALL_WEB_BASE_URL=$tunnelUrl"
} else {
    $envContent = "$envContent`r`nCALL_WEB_BASE_URL=$tunnelUrl`r`n"
}
[IO.File]::WriteAllText($backendEnv, $envContent, [Text.UTF8Encoding]::new($false))

Write-Host "Video HTTPS URL: $tunnelUrl" -ForegroundColor Green
Write-Host 'This is a temporary development URL and is refreshed automatically whenever this command is restarted.'
Write-Host 'Starting backend and web app. Run mobile separately with npm run dev:mobile:expo-go.'

Set-Location $root
npm run dev
