$ErrorActionPreference = 'Stop'
$wifiAddress = Get-NetIPAddress -InterfaceAlias 'Wi-Fi' -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.AddressState -eq 'Preferred' -and $_.IPAddress -notlike '169.254*' } | Select-Object -First 1 -ExpandProperty IPAddress
if (-not $wifiAddress) { throw 'No active Wi-Fi IPv4 address found.' }
$ruleName = 'Malaeb Wi-Fi only TCP 4173'
Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 4173 -LocalAddress $wifiAddress -RemoteAddress LocalSubnet -Profile Private -Description 'Allow Malaeb from devices on the local Wi-Fi subnet only.' | Out-Null
$result = Get-NetFirewallRule -DisplayName $ruleName | Get-NetFirewallAddressFilter
"Wi-Fi IP $wifiAddress; local addresses $($result.LocalAddress -join ', '); allowed remotes $($result.RemoteAddress -join ', ')" | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'data\wifi-firewall-status.txt') -Encoding UTF8
