Set-StrictMode -Version Latest

function Get-BackupTimestamp {
    param([Parameter(Mandatory)][string]$Name)

    if ($Name -notmatch '^padelclash-(\d{8}T\d{6}Z)\.dump$') {
        return $null
    }
    return [datetime]::ParseExact(
        $Matches[1],
        'yyyyMMddTHHmmssZ',
        [System.Globalization.CultureInfo]::InvariantCulture,
        [System.Globalization.DateTimeStyles]::AssumeUniversal -bor
            [System.Globalization.DateTimeStyles]::AdjustToUniversal
    )
}

function Get-MissingBackupNames {
    param(
        [string[]]$RemoteNames = @(),
        [string[]]$LocalNames = @()
    )

    $local = [System.Collections.Generic.HashSet[string]]::new(
        [string[]]$LocalNames,
        [System.StringComparer]::Ordinal
    )
    return @($RemoteNames |
        Where-Object { (Get-BackupTimestamp $_) -and -not $local.Contains($_) } |
        Sort-Object { Get-BackupTimestamp $_ })
}

function Get-RetainedBackupNames {
    param(
        [string[]]$Names = @(),
        [int]$Daily = 90,
        [int]$Monthly = 12
    )

    $ordered = @($Names |
        Where-Object { Get-BackupTimestamp $_ } |
        Sort-Object { Get-BackupTimestamp $_ } -Descending)
    $dailyNames = @($ordered | Select-Object -First $Daily)
    $older = @($ordered | Select-Object -Skip $Daily)
    $monthlyNames = @($older |
        Group-Object { (Get-BackupTimestamp $_).ToString('yyyy-MM') } |
        Sort-Object Name -Descending |
        Select-Object -First $Monthly |
        ForEach-Object { $_.Group | Select-Object -First 1 })
    return @($dailyNames + $monthlyNames)
}

function Test-BackupFreshness {
    param(
        [string[]]$Names = @(),
        [datetime]$Now = [datetime]::UtcNow,
        [int]$StaleDays = 7
    )

    $newest = $Names |
        ForEach-Object { Get-BackupTimestamp $_ } |
        Where-Object { $_ } |
        Sort-Object -Descending |
        Select-Object -First 1
    return $null -ne $newest -and ($Now.ToUniversalTime() - $newest).TotalDays -le $StaleDays
}

function Assert-BackupArchive {
    param(
        [Parameter(Mandatory)][string]$Path,
        [scriptblock]$Validator
    )

    $item = Get-Item -LiteralPath $Path -ErrorAction Stop
    if ($item.Length -le 0) {
        throw "Backup archive is empty: $Path"
    }
    if ($Validator -and -not (& $Validator $item.FullName)) {
        throw "PostgreSQL 17 rejected backup archive: $Path"
    }
}

function Invoke-PgRestoreValidation {
    param(
        [Parameter(Mandatory)][string]$Path,
        [string]$PgRestorePath
    )

    if ($PgRestorePath) {
        $version = & $PgRestorePath --version 2>&1
        if ($LASTEXITCODE -ne 0 -or "$version" -notmatch 'PostgreSQL\) 17\.') {
            throw "PgRestorePath must point to PostgreSQL 17 pg_restore"
        }
        & $PgRestorePath --list $Path *> $null
        return $LASTEXITCODE -eq 0
    }

    $item = Get-Item -LiteralPath $Path
    $mount = "type=bind,source=$($item.DirectoryName),target=/backup,readonly"
    & docker run --rm --mount $mount postgres:17-alpine pg_restore --list "/backup/$($item.Name)" *> $null
    return $LASTEXITCODE -eq 0
}

Export-ModuleMember -Function @(
    'Get-BackupTimestamp',
    'Get-MissingBackupNames',
    'Get-RetainedBackupNames',
    'Test-BackupFreshness',
    'Assert-BackupArchive',
    'Invoke-PgRestoreValidation'
)
