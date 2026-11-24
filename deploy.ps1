# Pushes Code.gs, index.html and appsscript.json to the Apps Script project and
# points the existing web app deployment at a new version. The /exec link never changes.
# Run: double-click deploy.cmd, or  powershell -ExecutionPolicy Bypass -File deploy.ps1
param([switch]$NoPause)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

# The web app deployment users open (Deploy > Manage deployments in Apps Script).
$DeploymentId = 'AKfycby3Ew76jx62Mf0UAhuDsRNpl1r809SIjwXdSc3Sia2wHf2FQKsWm82Z5Ni8aYhaGISf'

function Stop-WithMessage([string]$msg) {
  Write-Host ''
  Write-Host $msg -ForegroundColor Red
  if (-not $NoPause) { Read-Host 'Press Enter to close' | Out-Null }
  exit 1
}

if (-not (Get-Command clasp -ErrorAction SilentlyContinue)) {
  Stop-WithMessage 'clasp is not installed. Run:  npm install -g @google/clasp   then:  clasp login'
}

$ver = '?'
$m = Select-String -LiteralPath 'Code.gs' -Pattern "APP_VER\s*=\s*'([^']+)'" | Select-Object -First 1
if ($m) { $ver = $m.Matches[0].Groups[1].Value }
$desc = "v$ver " + (Get-Date -Format 'yyyy-MM-dd HH:mm')

Write-Host "Pushing RPI Inventory $desc to Apps Script..." -ForegroundColor Cyan
& clasp push --force
if ($LASTEXITCODE -ne 0) { Stop-WithMessage 'Push failed. If it says you are not logged in, run:  clasp login' }

Write-Host 'Creating a new version on the existing deployment...' -ForegroundColor Cyan
& clasp deploy -i $DeploymentId -d $desc
if ($LASTEXITCODE -ne 0) { Stop-WithMessage 'Deploy failed. Check the message above.' }

Write-Host ''
Write-Host "Done. $desc is live on the same link." -ForegroundColor Green
Write-Host 'Open pages show "A new version is ready" if you raised APP_VER and VER.'
if (-not $NoPause) { Read-Host 'Press Enter to close' | Out-Null }
