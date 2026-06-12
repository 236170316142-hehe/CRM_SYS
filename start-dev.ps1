# ============================================================
# start-dev.ps1
# One-command startup: server + tunnel + demo site
# Automatically updates the tunnel URL everywhere it's needed
# Usage: Right-click → Run with PowerShell  (or: pwsh start-dev.ps1)
# ============================================================

$ErrorActionPreference = 'Stop'
$ROOT   = $PSScriptRoot
$SERVER = Join-Path $ROOT "server"
$DEMO   = Join-Path $ROOT "demo-site"

Write-Host "`n⚡ Teamgrid CRM — Dev Startup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# ── 1. Kill any old tunnels / servers on port 5000 ──────────
Write-Host "`n[1/5] Cleaning up old processes..." -ForegroundColor Yellow
Get-Process -Name cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
$pids = (netstat -ano | Select-String ":5000 " | ForEach-Object { ($_ -split '\s+')[-1] } | Sort-Object -Unique)
foreach ($pid in $pids) {
    if ($pid -match '^\d+$') {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
}
Start-Sleep -Seconds 1

# ── 2. Start the CRM API server ─────────────────────────────
Write-Host "[2/5] Starting CRM API server (port 5000)..." -ForegroundColor Yellow
$serverJob = Start-Process -FilePath "node" -ArgumentList "server.js" `
    -WorkingDirectory $SERVER -PassThru -WindowStyle Minimized
Start-Sleep -Seconds 3

# Verify server is up
try {
    $ping = Invoke-RestMethod -Uri "http://localhost:5000/" -TimeoutSec 5
    Write-Host "      Server is up" -ForegroundColor Green
} catch {
    Write-Host "      Server failed to start — check server logs" -ForegroundColor Red
    exit 1
}

# ── 3. Start Cloudflare tunnel, capture URL ─────────────────
Write-Host "[3/5] Starting Cloudflare tunnel..." -ForegroundColor Yellow
$tunnelLog  = Join-Path $env:TEMP "cloudflared-output.txt"
$tunnelProc = Start-Process -FilePath "cloudflared" `
    -ArgumentList "tunnel", "--url", "http://localhost:5000" `
    -RedirectStandardError $tunnelLog -PassThru -WindowStyle Minimized

# Wait for the URL to appear in the log (up to 20 seconds)
$tunnelUrl = $null
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-Path $tunnelLog) {
        $content = Get-Content $tunnelLog -Raw -ErrorAction SilentlyContinue
        if ($content -match 'https://[a-z0-9\-]+\.trycloudflare\.com') {
            $tunnelUrl = $Matches[0]
            break
        }
    }
}

if (-not $tunnelUrl) {
    Write-Host "      Could not get tunnel URL — using localhost only" -ForegroundColor Red
    $tunnelUrl = "http://localhost:5000"
} else {
    Write-Host "      Tunnel URL: $tunnelUrl" -ForegroundColor Green
}

# ── 4. Update all config files with the new URL ─────────────
Write-Host "[4/5] Updating config with new tunnel URL..." -ForegroundColor Yellow

# Update demo-site/index.html
$htmlPath = Join-Path $DEMO "index.html"
$html = Get-Content $htmlPath -Raw
$html = $html -replace "(?<=: ')https://[a-z0-9\-]+\.trycloudflare\.com(?=')", $tunnelUrl
$html | Set-Content $htmlPath -NoNewline
Write-Host "      Updated: demo-site/index.html" -ForegroundColor Green

# Update server/.env
$envPath = Join-Path $SERVER ".env"
$env = Get-Content $envPath -Raw
$env = $env -replace "SERVER_URL=.*", "SERVER_URL=$tunnelUrl"
$env | Set-Content $envPath -NoNewline
Write-Host "      Updated: server/.env" -ForegroundColor Green

# ── 5. Start demo site server ────────────────────────────────
Write-Host "[5/5] Starting demo site (port 3000)..." -ForegroundColor Yellow
$demoJob = Start-Process -FilePath "serve" -ArgumentList ".", "--listen", "3000" `
    -WorkingDirectory $DEMO -PassThru -WindowStyle Minimized
Start-Sleep -Seconds 2

# ── Summary ──────────────────────────────────────────────────
Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "All services running!" -ForegroundColor Green
Write-Host ""
Write-Host "  CRM Dashboard  : http://localhost:5173"      -ForegroundColor White
Write-Host "  Demo Site      : http://localhost:3000"      -ForegroundColor White
Write-Host "  API (local)    : http://localhost:5000"      -ForegroundColor White
Write-Host "  API (public)   : $tunnelUrl"                 -ForegroundColor Cyan
Write-Host ""
Write-Host "  Demo form URL  : http://localhost:3000/#demo" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor DarkGray
Write-Host "================================`n" -ForegroundColor Cyan

# Keep script alive
try {
    while ($true) { Start-Sleep -Seconds 60 }
} finally {
    Write-Host "`nShutting down..." -ForegroundColor Yellow
    Stop-Process -Id $tunnelProc.Id  -ErrorAction SilentlyContinue
    Stop-Process -Id $serverJob.Id   -ErrorAction SilentlyContinue
    Stop-Process -Id $demoJob.Id     -ErrorAction SilentlyContinue
}
