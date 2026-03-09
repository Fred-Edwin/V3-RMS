# Opens Prisma Studio connected to the production database via SSH tunnel.
# Tunnel is automatically opened before Studio starts and closed when Studio exits.
#
# Usage:
#   .\scripts\db-studio.ps1

$ErrorActionPreference = "Stop"

$securePassword = Read-Host "Postgres password" -AsSecureString
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
)

Write-Host "Opening SSH tunnel (localhost:5433 -> server:5433)..." -ForegroundColor Cyan

$tunnel = Start-Process ssh -ArgumentList @(
    "-L", "5433:localhost:5433",
    "edwinfred@104.248.29.42",
    "-N"
) -PassThru

# Give the tunnel a moment to establish
Start-Sleep -Seconds 2

Write-Host "Tunnel open (PID $($tunnel.Id)). Starting Prisma Studio..." -ForegroundColor Green
Write-Host "Studio will open at http://localhost:5555" -ForegroundColor Green
Write-Host ""

try {
    $env:DATABASE_URL = "postgresql://wendo_user:$plain@localhost:5433/wendo_rms"
    Push-Location "d:\AI applications\web\V3-RMS\backend"
    pnpm prisma studio
} finally {
    Pop-Location
    $env:DATABASE_URL = ""
    Write-Host ""
    Write-Host "Closing SSH tunnel..." -ForegroundColor Cyan
    Stop-Process -Id $tunnel.Id -ErrorAction SilentlyContinue
    Write-Host "Done." -ForegroundColor Green
}
