$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $projectRoot
$wifiAddress = Get-NetIPAddress -InterfaceAlias 'Wi-Fi' -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.AddressState -eq 'Preferred' -and $_.IPAddress -notlike '169.254*' } | Select-Object -First 1 -ExpandProperty IPAddress
if (-not $wifiAddress) { throw 'No active Wi-Fi IPv4 address found. Connect this PC to Wi-Fi and try again.' }
$env:MALAEB_HOST = $wifiAddress
$env:MALAEB_PORT = '4173'
Write-Host 'Malaeb is starting on this PC Wi-Fi address.' -ForegroundColor Green
Write-Host "Open this address on this PC or another device on the same Wi-Fi: http://${wifiAddress}:4173" -ForegroundColor Cyan

Write-Host 'Keep this window open. Press Ctrl+C to stop.' -ForegroundColor DarkGray
python .\server.py
