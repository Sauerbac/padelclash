$ErrorActionPreference = "Stop"

Import-Module "$PSScriptRoot/../PadelClashBackup.psm1" -Force

$fallbackScript = Get-Content -LiteralPath "$PSScriptRoot/../create-postgres-backup.sh" -Raw
if ($fallbackScript -match 'pg_dump[^\r\n]*DATABASE_URL') {
    throw "Fallback backup must not place DATABASE_URL in pg_dump arguments"
}
if ($fallbackScript -notmatch 'PGDATABASE="\$DATABASE_URL"') {
    throw "Fallback backup must pass the connection through libpq environment variables"
}
if ($fallbackScript -notmatch 'unset DATABASE_URL') {
    throw "Fallback backup must remove DATABASE_URL before starting pg_dump"
}

function Assert-Equal($Actual, $Expected, [string]$Message) {
    if ("$Actual" -ne "$Expected") {
        throw "$Message. Expected '$Expected', got '$Actual'."
    }
}

$remote = @(
    "padelclash-20260720T020000Z.dump",
    "padelclash-20260721T020000Z.dump",
    "padelclash-20260722T020000Z.dump"
)
$missing = Get-MissingBackupNames -RemoteNames $remote -LocalNames @($remote[0])
Assert-Equal ($missing -join ",") ($remote[1..2] -join ",") "Offline catch-up must copy every missing generation"

$afterRemoteRotation = Get-MissingBackupNames -RemoteNames @($remote[2]) -LocalNames $remote
Assert-Equal $afterRemoteRotation.Count 0 "Remote rotation must not request local deletion"

$stale = Test-BackupFreshness -Names @("padelclash-20260701T020000Z.dump") -Now ([datetime]"2026-07-22T12:00:00Z") -StaleDays 7
Assert-Equal $stale $false "Old newest copy must report stale"

$fresh = Test-BackupFreshness -Names @("padelclash-20260722T020000Z.dump") -Now ([datetime]"2026-07-22T12:00:00Z") -StaleDays 7
Assert-Equal $fresh $true "Recent newest copy must report fresh"

$retained = Get-RetainedBackupNames -Names @(
    "padelclash-20260115T020000Z.dump",
    "padelclash-20260215T020000Z.dump",
    "padelclash-20260315T020000Z.dump",
    "padelclash-20260415T020000Z.dump"
) -Daily 1 -Monthly 2
Assert-Equal ($retained -join ",") (
    "padelclash-20260415T020000Z.dump," +
    "padelclash-20260315T020000Z.dump," +
    "padelclash-20260215T020000Z.dump"
) "Monthly retention must keep the newest older months"

$fixture = Join-Path ([System.IO.Path]::GetTempPath()) "padelclash-backup-test-$([guid]::NewGuid())"
New-Item -ItemType Directory -Path $fixture | Out-Null
try {
    $empty = Join-Path $fixture "empty.dump"
    New-Item -ItemType File -Path $empty | Out-Null
    try {
        Assert-BackupArchive -Path $empty -Validator { param($Path) $true }
        throw "Empty archive was accepted"
    } catch {
        if ($_.Exception.Message -eq "Empty archive was accepted") { throw }
    }

    $corrupt = Join-Path $fixture "corrupt.dump"
    Set-Content -LiteralPath $corrupt -Value "not a PostgreSQL archive"
    try {
        Assert-BackupArchive -Path $corrupt -Validator { param($Path) $false }
        throw "Corrupt archive was accepted"
    } catch {
        if ($_.Exception.Message -eq "Corrupt archive was accepted") { throw }
    }
} finally {
    Remove-Item -LiteralPath $fixture -Recurse -Force
}

Write-Output "Backup tool tests passed"
