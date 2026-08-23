param(
  [string]$ProjectRoot = "C:\sanjithnfcbarcode"
)

$ErrorActionPreference = "Stop"

$PackRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectRoot ".tenant-isolation-backup-$Stamp"

Write-Host "CaviarQR kitchen tenant-isolation installer"
Write-Host "Project: $ProjectRoot"

if (-not (Test-Path (Join-Path $ProjectRoot "backend\src\app.module.ts"))) {
  throw "Could not find backend\src\app.module.ts under $ProjectRoot"
}

New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null

$Targets = @(
  "backend\src\order\order.gateway.ts",
  "web\app\login\page.tsx",
  "web\app\dashboard\kitchen\page.tsx",
  "backend\src\app.module.ts"
)

foreach ($relative in $Targets) {
  $target = Join-Path $ProjectRoot $relative
  if (Test-Path $target) {
    $backup = Join-Path $BackupRoot $relative
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $backup) | Out-Null
    Copy-Item $target $backup -Force
  }
}

# Copy new isolated kitchen auth module.
$KitchenAuthTarget = Join-Path $ProjectRoot "backend\src\kitchen-auth"
New-Item -ItemType Directory -Force -Path $KitchenAuthTarget | Out-Null
Copy-Item (Join-Path $PackRoot "backend\src\kitchen-auth\*") $KitchenAuthTarget -Force

# Replace the two files that contained client-controlled tenant routing.
Copy-Item (Join-Path $PackRoot "backend\src\order\order.gateway.ts") (Join-Path $ProjectRoot "backend\src\order\order.gateway.ts") -Force
Copy-Item (Join-Path $PackRoot "web\app\login\page.tsx") (Join-Path $ProjectRoot "web\app\login\page.tsx") -Force
Copy-Item (Join-Path $PackRoot "web\app\dashboard\kitchen\page.tsx") (Join-Path $ProjectRoot "web\app\dashboard\kitchen\page.tsx") -Force

# Patch AppModule instead of blindly overwriting local changes.
$AppModulePath = Join-Path $ProjectRoot "backend\src\app.module.ts"
$AppText = Get-Content $AppModulePath -Raw

if ($AppText -notmatch "kitchen-auth/kitchen-auth\.module") {
  $Import = @"

import {
  KitchenAuthModule,
} from './kitchen-auth/kitchen-auth.module'
"@

  $Anchor = "import {`r?`n  SupportModule,`r?`n} from './support/support.module'"
  $Match = [regex]::Match($AppText, $Anchor)

  if (-not $Match.Success) {
    throw "Could not safely locate SupportModule import in app.module.ts. Use backend/src/app.module.ts from this pack manually."
  }

  $InsertAt = $Match.Index + $Match.Length
  $AppText = $AppText.Insert($InsertAt, $Import)
}

if ($AppText -notmatch "(?m)^\s+KitchenAuthModule,\s*$") {
  $AppText = [regex]::Replace(
    $AppText,
    "(?m)^(\s+BusinessModule,\s*)$",
    "`$1`r`n    KitchenAuthModule,",
    1
  )
}

Set-Content -Path $AppModulePath -Value $AppText -Encoding UTF8

# Generate a dedicated kitchen token secret if the project does not have one.
$EnvPath = Join-Path $ProjectRoot "backend\.env"
if (Test-Path $EnvPath) {
  $EnvText = Get-Content $EnvPath -Raw
  if ($EnvText -notmatch "(?m)^KITCHEN_TOKEN_SECRET=") {
    $Bytes = New-Object byte[] 48
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($Bytes)
    $Secret = [Convert]::ToHexString($Bytes).ToLowerInvariant()
    Add-Content -Path $EnvPath -Value "`r`nKITCHEN_TOKEN_SECRET=$Secret"
    Write-Host "Generated KITCHEN_TOKEN_SECRET in backend\.env (not printed)."
  }
} else {
  Write-Warning "backend\.env was not found. Add KITCHEN_TOKEN_SECRET with at least 32 random characters before starting the backend."
}

Write-Host ""
Write-Host "Fix installed. Backups: $BackupRoot"
Write-Host ""
Write-Host "Now restart backend and frontend:"
Write-Host "  cd $ProjectRoot\backend && npm run start:dev"
Write-Host "  cd $ProjectRoot\web     && npm run dev"
Write-Host ""
Write-Host "Then log out and log in again as each kitchen. Old kitchen sessions are intentionally invalidated."
