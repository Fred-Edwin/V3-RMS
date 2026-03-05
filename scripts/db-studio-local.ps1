# Opens Prisma Studio connected to the local Docker PostgreSQL database.
#
# Usage:
#   .\scripts\db-studio-local.ps1

$ErrorActionPreference = "Stop"

Write-Host "Starting Prisma Studio for LOCAL database..." -ForegroundColor Cyan
Write-Host "Database: backend/.env DATABASE_URL mapped to localhost:5433" -ForegroundColor DarkGray
Write-Host "Studio: http://localhost:5555" -ForegroundColor Green
Write-Host ""

Push-Location "d:\AI applications\web\V3-RMS\backend"
try {
    $databaseUrlLine = Get-Content "d:\AI applications\web\V3-RMS\backend\.env" | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
    if (-not $databaseUrlLine) {
        throw "DATABASE_URL not found in backend/.env."
    }

    $databaseUrl = $databaseUrlLine -replace '^DATABASE_URL=', ''
    # Backend containers use host `postgres:5432`; Prisma Studio from host must use exposed port `localhost:5433`.
    $databaseUrlForStudio = $databaseUrl -replace '@postgres:5432', '@localhost:5433'
    $env:DATABASE_URL = $databaseUrlForStudio
    pnpm prisma studio
} finally {
    $env:DATABASE_URL = ""
    Pop-Location
}
