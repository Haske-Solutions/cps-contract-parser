# Verify duckdb.node exists in a packaged Windows app directory.
param(
  [string]$AppRoot = "release\win-unpacked"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $AppRoot)) {
  throw "Packaged app directory not found: $AppRoot"
}

$matches = Get-ChildItem -Path $AppRoot -Recurse -Filter "duckdb.node" -ErrorAction SilentlyContinue
if ($matches) {
  Write-Host "DuckDB binding OK: $($matches[0].FullName)"
  exit 0
}

Write-Host "duckdb.node not found under $AppRoot"
$duckdbDirs = Get-ChildItem -Path $AppRoot -Recurse -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -eq "@duckdb" -or $_.Name -like "node-bindings-*" }
if ($duckdbDirs) {
  Write-Host "@duckdb-related directories found:"
  $duckdbDirs | ForEach-Object { Write-Host "  $($_.FullName)" }
} else {
  Write-Host "No @duckdb directories found in packaged app."
}

throw "Missing DuckDB Windows native module (duckdb.node) in packaged app."
