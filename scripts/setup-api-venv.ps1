# Creates a local virtual environment for the API (not global).
$ErrorActionPreference = "Stop"
$ApiDir = Join-Path $PSScriptRoot "..\apps\api"
Set-Location $ApiDir

if (-not (Test-Path ".venv")) {
    python -m venv .venv
    Write-Host "Created .venv in apps/api"
}

& ".\.venv\Scripts\Activate.ps1"
python -m pip install --upgrade pip
pip install -r requirements.txt

Write-Host ""
Write-Host "API venv ready. Activate with:"
Write-Host "  cd apps\api"
Write-Host "  .\.venv\Scripts\Activate.ps1"
