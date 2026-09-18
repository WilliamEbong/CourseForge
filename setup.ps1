# CourseForge setup for Windows PowerShell 5.1+.
# Thin wrapper: unblocks downloaded scripts, checks Node.js, then runs scripts\bootstrap.mjs.
# Flags pass through: -- --ci --no-smoke --offline --json   (example: .\setup.ps1 --no-smoke)

# Scripts extracted from a downloaded ZIP carry Mark-of-the-Web; unblock the repo's own wrappers.
Get-ChildItem -Path (Join-Path $PSScriptRoot '*') -Include '*.ps1', '*.cmd' -File -ErrorAction SilentlyContinue |
  Unblock-File -ErrorAction SilentlyContinue

function Show-NodeHint {
  Write-Host 'CourseForge needs Node.js 22.12 or newer.' -ForegroundColor Yellow
  Write-Host '  Install:  winget install OpenJS.NodeJS.LTS'
  Write-Host '  or download the LTS installer from https://nodejs.org/en/download'
  Write-Host 'Then open a NEW PowerShell window and rerun .\setup.ps1'
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Show-NodeHint
  exit 2
}

$raw = (& node -p 'process.versions.node' | Out-String).Trim()
$parts = $raw.Split('.')
$major = 0
$minor = 0
[void][int]::TryParse($parts[0], [ref]$major)
if ($parts.Length -gt 1) { [void][int]::TryParse($parts[1], [ref]$minor) }
if (($major -lt 22) -or (($major -eq 22) -and ($minor -lt 12))) {
  Write-Host "Found Node.js $raw."
  Show-NodeHint
  exit 2
}

& node (Join-Path $PSScriptRoot 'scripts\bootstrap.mjs') @args
exit $LASTEXITCODE
