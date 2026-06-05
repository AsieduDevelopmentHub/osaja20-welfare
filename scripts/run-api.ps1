# Run API using the local venv (not global Python).
$ErrorActionPreference = "Stop"
$ApiDir = Join-Path $PSScriptRoot "..\apps\api"
Set-Location $ApiDir

if (-not (Test-Path ".venv")) {
    Write-Host "No .venv found. Run scripts\setup-api-venv.ps1 first."
    exit 1
}

& ".\.venv\Scripts\Activate.ps1"
$env:PYTHONPATH = "."
uvicorn v1.main:app --reload --host 0.0.0.0 --port 8000
