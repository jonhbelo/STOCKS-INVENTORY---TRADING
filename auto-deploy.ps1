# Watches Code.gs, index.html and appsscript.json. When one of them is saved and then
# stays unchanged for 15 seconds, it runs deploy.ps1 (push + new version, same link).
# Leave this window open while you work. Close it to stop.
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$files = 'Code.gs', 'index.html', 'appsscript.json'

function Get-Stamp { ($files | ForEach-Object { (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash }) -join '|' }

$deployed = Get-Stamp
Write-Host 'RPI Inventory auto-deploy is watching:' ($files -join ', ') -ForegroundColor Cyan
Write-Host 'Save a change and it goes live about 15 seconds later. Close this window to stop.'
$pending = $null; $since = $null
while ($true) {
  Start-Sleep -Seconds 3
  try { $now = Get-Stamp } catch { continue }   # a file is being written; try again
  if ($now -eq $deployed) { $pending = $null; continue }
  if ($now -ne $pending) { $pending = $now; $since = Get-Date; Write-Host (Get-Date -Format 'HH:mm:ss') 'Change detected, waiting for saving to finish...'; continue }
  if (((Get-Date) - $since).TotalSeconds -lt 15) { continue }
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'deploy.ps1') -NoPause
  if ($LASTEXITCODE -eq 0) { $deployed = $now } else { Write-Host 'Deploy failed; it will retry on the next change.' -ForegroundColor Yellow; $deployed = $now }
  $pending = $null
}
