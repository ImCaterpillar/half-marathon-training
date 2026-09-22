$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot
node scripts/run-local.mjs @args
