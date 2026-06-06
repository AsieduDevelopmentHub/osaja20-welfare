# Create an administrator account (uses apps/api/.env for Supabase or local auth)
param(
    [Parameter(Mandatory = $true)][string]$Email,
    [Parameter(Mandatory = $true)][string]$Password,
    [string]$FullName = "System Administrator",
    [string]$MembershipId = "OSA-ADMIN-001"
)

$ErrorActionPreference = "Stop"
$apiRoot = Join-Path $PSScriptRoot ".." "apps" "api"
Push-Location $apiRoot
$env:PYTHONPATH = "."
try {
    & ".\.venv\Scripts\python.exe" scripts/create_admin.py `
        --email $Email `
        --password $Password `
        --full-name $FullName `
        --membership-id $MembershipId
} finally {
    Pop-Location
}
