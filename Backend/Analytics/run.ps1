# Run the Analytics API with the correct working directory.
# Usage: ./run.ps1   (from Analytics/)
#
# This exists because uvicorn must be launched from Analytics/, not
# Analytics/api/. The imports in api/main.py reference sibling packages
# (realtime_dashboard, scheduler, utils) that only resolve when the
# project root is on sys.path.

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$VenvActivate = Join-Path $ScriptDir 'venv\Scripts\Activate.ps1'
if (Test-Path $VenvActivate) {
    . $VenvActivate
}

uvicorn api.main:app --reload
