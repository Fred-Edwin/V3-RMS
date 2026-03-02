# Stream backend logs from the production server.
#
# Usage:
#   .\scripts\logs.ps1          # streams api logs (default)
#   .\scripts\logs.ps1 worker   # streams worker logs
#   .\scripts\logs.ps1 api 100  # last 100 lines then stream

param(
    [string]$service = "api",
    [int]$tail = 0
)

$tailFlag = if ($tail -gt 0) { "--tail=$tail" } else { "" }

Write-Host "Streaming logs for '$service' on production... (Ctrl+C to stop)" -ForegroundColor Cyan

ssh edwinfred@104.248.29.42 "cd ~/wendo-rms && docker compose logs $service -f $tailFlag"
