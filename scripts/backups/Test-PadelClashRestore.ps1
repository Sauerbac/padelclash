param(
    [Parameter(Mandatory)][string]$Archive,
    [string]$PgRestorePath
)

$ErrorActionPreference = 'Stop'
Import-Module "$PSScriptRoot/PadelClashBackup.psm1" -Force

$archivePath = (Resolve-Path -LiteralPath $Archive).Path
Assert-BackupArchive -Path $archivePath -Validator {
    param($Path)
    Invoke-PgRestoreValidation -Path $Path -PgRestorePath $PgRestorePath
}

$container = "padelclash-restore-check-$([guid]::NewGuid().ToString('N'))"
try {
    & docker run --detach --rm --name $container --env POSTGRES_PASSWORD=disposable-restore-only postgres:17-alpine *> $null
    if ($LASTEXITCODE -ne 0) { throw 'Could not start disposable PostgreSQL 17 container' }

    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        & docker exec $container pg_isready -U postgres *> $null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) { throw 'Disposable PostgreSQL did not become ready' }

    & docker cp $archivePath "${container}:/tmp/padelclash.dump" *> $null
    if ($LASTEXITCODE -ne 0) { throw 'Could not copy archive into disposable PostgreSQL' }
    & docker exec $container createdb -U postgres padelclash_restore *> $null
    if ($LASTEXITCODE -ne 0) { throw 'Could not create disposable restore database' }
    & docker exec $container pg_restore --exit-on-error --no-owner --no-acl -U postgres -d padelclash_restore /tmp/padelclash.dump *> $null
    if ($LASTEXITCODE -ne 0) { throw 'Archive failed disposable restore' }

    Write-Output "Disposable PostgreSQL 17 restore succeeded: $archivePath"
} finally {
    & docker stop $container *> $null
}
