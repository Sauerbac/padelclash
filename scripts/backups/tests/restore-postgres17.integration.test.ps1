$ErrorActionPreference = "Stop"

# This is intentionally separate from the fast backup-tools test. It builds the
# production image, uses its PostgreSQL 17 clients, and exercises the real
# recovery command against disposable databases owned by a non-superuser role.

$repository = (Resolve-Path "$PSScriptRoot/../../..").Path
$suffix = [guid]::NewGuid().ToString("N").Substring(0, 8)
$fixtureDirectory = Join-Path $repository ".tmp-recovery-integration-$suffix"
$image = "padelclash-recovery-integration-$suffix"
$role = "recovery_owner_$suffix"
$sourceDatabase = "recovery_source_$suffix"
$cleanDatabase = "recovery_clean_$suffix"
$collationDatabase = "recovery_collation_$suffix"
$databaseContainer = $null

function Invoke-Recovery([string]$Database, [string]$Archive) {
    $mount = "${repository}:/work:ro"
    $output = & docker run --rm --entrypoint node `
        --network $script:composeNetwork `
        -v $mount `
        -w /work `
        -e "DATABASE_URL=postgresql://${role}:owner-test-password@db:5432/$Database" `
        $image `
        scripts/backups/restore-padelclash.mjs `
        "/work/$Archive" 2>&1
    return @{
        ExitCode = $LASTEXITCODE
        Output = "$output"
    }
}

New-Item -ItemType Directory -Path $fixtureDirectory | Out-Null

try {
    Push-Location $repository
    try {
        docker compose up -d db | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "PostgreSQL 17 service could not be started." }
        $databaseContainer = docker compose ps -q db
        if (-not $databaseContainer) { throw "PostgreSQL 17 service was not found." }
        $script:composeNetwork = docker inspect --format `
            '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{end}}' `
            $databaseContainer
        if (-not $script:composeNetwork) { throw "Compose network was not found." }

        docker build -q -t $image . | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Recovery integration image could not be built." }
    } finally {
        Pop-Location
    }

    docker exec $databaseContainer psql -U postgres -d postgres `
        -v ON_ERROR_STOP=1 `
        -c "CREATE ROLE $role LOGIN PASSWORD 'owner-test-password';" | Out-Null
    docker exec $databaseContainer createdb -U postgres $sourceDatabase
    docker exec $databaseContainer psql -U postgres -d $sourceDatabase `
        -v ON_ERROR_STOP=1 `
        -c "CREATE TABLE proof (id integer PRIMARY KEY); INSERT INTO proof VALUES (1);" | Out-Null
    docker exec $databaseContainer pg_dump -U postgres --format=custom `
        --file=/tmp/recovery-custom.dump $sourceDatabase
    docker exec $databaseContainer pg_dump -U postgres --format=tar `
        --file=/tmp/recovery-tar.dump $sourceDatabase
    docker cp "${databaseContainer}:/tmp/recovery-custom.dump" `
        (Join-Path $fixtureDirectory "custom.dump") | Out-Null
    docker cp "${databaseContainer}:/tmp/recovery-tar.dump" `
        (Join-Path $fixtureDirectory "tar.dump") | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $fixtureDirectory "directory.dump") | Out-Null

    docker exec $databaseContainer createdb -U postgres -O $role $cleanDatabase
    docker exec $databaseContainer createdb -U postgres -O $role $collationDatabase
    docker exec $databaseContainer psql -U $role -d $collationDatabase `
        -v ON_ERROR_STOP=1 `
        -c "CREATE COLLATION custom_collation (provider = icu, locale = 'und');" | Out-Null

    $relativeFixture = Split-Path -Leaf $fixtureDirectory
    $custom = Invoke-Recovery $cleanDatabase "$relativeFixture/custom.dump"
    if ($custom.ExitCode -ne 0) {
        throw "Ordinary database owner could not restore a fresh target: $($custom.Output)"
    }
    $proof = docker exec $databaseContainer psql -U $role -d $cleanDatabase `
        -tAc "SELECT count(*) FROM proof;"
    if ("$proof".Trim() -ne "1") { throw "Custom archive did not restore the proof row." }

    $tar = Invoke-Recovery $collationDatabase "$relativeFixture/tar.dump"
    if ($tar.ExitCode -eq 0 -or $tar.Output -notmatch "not a PostgreSQL custom archive") {
        throw "Tar archive was not rejected before target inspection: $($tar.Output)"
    }
    $directory = Invoke-Recovery $collationDatabase "$relativeFixture/directory.dump"
    if ($directory.ExitCode -eq 0 -or $directory.Output -notmatch "not a PostgreSQL custom archive") {
        throw "Directory archive was not rejected before target inspection: $($directory.Output)"
    }
    $collation = Invoke-Recovery $collationDatabase "$relativeFixture/custom.dump"
    if ($collation.ExitCode -eq 0 -or $collation.Output -notmatch "Recovery target is not empty") {
        throw "Custom-collation target was not rejected: $($collation.Output)"
    }

    Write-Output "PostgreSQL 17 recovery integration tests passed."
} finally {
    if ($databaseContainer) {
        docker exec $databaseContainer dropdb -U postgres --if-exists $sourceDatabase | Out-Null
        docker exec $databaseContainer dropdb -U postgres --if-exists $cleanDatabase | Out-Null
        docker exec $databaseContainer dropdb -U postgres --if-exists $collationDatabase | Out-Null
        docker exec $databaseContainer psql -U postgres -d postgres `
            -c "DROP ROLE IF EXISTS $role;" | Out-Null
        docker exec $databaseContainer rm -f `
            /tmp/recovery-custom.dump /tmp/recovery-tar.dump
    }
    docker image rm -f $image 2>$null | Out-Null
    if (Test-Path -LiteralPath $fixtureDirectory) {
        $resolvedFixture = (Resolve-Path -LiteralPath $fixtureDirectory).Path
        if (-not $resolvedFixture.StartsWith(
            $repository,
            [System.StringComparison]::OrdinalIgnoreCase
        )) {
            throw "Refusing to remove integration fixture outside the repository."
        }
        Remove-Item -LiteralPath $resolvedFixture -Recurse -Force
    }
}
