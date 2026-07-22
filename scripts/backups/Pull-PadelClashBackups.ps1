[CmdletBinding(DefaultParameterSetName = 'Ssh')]
param(
    [Parameter(Mandatory)][string]$Destination,
    [Parameter(Mandatory, ParameterSetName = 'Ssh')][string]$RemoteHost,
    [Parameter(Mandatory, ParameterSetName = 'Ssh')][string]$SshUser,
    [Parameter(Mandatory, ParameterSetName = 'Ssh')][string]$RemoteDirectory,
    [Parameter(Mandatory, ParameterSetName = 'Ssh')][string]$IdentityFile,
    [Parameter(Mandatory, ParameterSetName = 'Fixture')][string]$FixtureRemoteDirectory,
    [string]$PgRestorePath,
    [int]$DailyRetention = 90,
    [int]$MonthlyRetention = 12,
    [int]$StaleDays = 7
)

$ErrorActionPreference = 'Stop'
Import-Module "$PSScriptRoot/PadelClashBackup.psm1" -Force

New-Item -ItemType Directory -Path $Destination -Force | Out-Null
$destinationPath = (Resolve-Path -LiteralPath $Destination).Path

if ($PSCmdlet.ParameterSetName -eq 'Fixture') {
    $remoteNames = @(Get-ChildItem -LiteralPath $FixtureRemoteDirectory -File |
        Select-Object -ExpandProperty Name)
} else {
    if ($RemoteDirectory.Contains("'") -or $RemoteDirectory.Contains("`n")) {
        throw 'RemoteDirectory may not contain a quote or newline'
    }
    $target = "$SshUser@$RemoteHost"
    $remoteNames = @(& ssh -i $IdentityFile $target "find '$RemoteDirectory' -maxdepth 1 -type f -name 'padelclash-*.dump' -printf '%f\n'")
    if ($LASTEXITCODE -ne 0) { throw 'Could not list remote backup directory' }
}

$localNames = @(Get-ChildItem -LiteralPath $destinationPath -File -Filter 'padelclash-*.dump' |
    Select-Object -ExpandProperty Name)
$missing = Get-MissingBackupNames -RemoteNames $remoteNames -LocalNames $localNames

foreach ($name in $missing) {
    $partial = Join-Path $destinationPath "$name.partial"
    $final = Join-Path $destinationPath $name
    try {
        if ($PSCmdlet.ParameterSetName -eq 'Fixture') {
            Copy-Item -LiteralPath (Join-Path $FixtureRemoteDirectory $name) -Destination $partial
        } else {
            $remoteFile = "${target}:$RemoteDirectory/$name"
            & scp -i $IdentityFile -- $remoteFile $partial
            if ($LASTEXITCODE -ne 0) { throw "Could not download $name" }
        }
        Assert-BackupArchive -Path $partial -Validator {
            param($Path)
            Invoke-PgRestoreValidation -Path $Path -PgRestorePath $PgRestorePath
        }
        Move-Item -LiteralPath $partial -Destination $final
        Write-Output "Verified $name"
    } catch {
        Remove-Item -LiteralPath $partial -Force -ErrorAction SilentlyContinue
        throw
    }
}

$all = @(Get-ChildItem -LiteralPath $destinationPath -File -Filter 'padelclash-*.dump')
$keep = [System.Collections.Generic.HashSet[string]]::new(
    [string[]](Get-RetainedBackupNames -Names $all.Name -Daily $DailyRetention -Monthly $MonthlyRetention),
    [System.StringComparer]::Ordinal
)
foreach ($item in $all) {
    if (-not $keep.Contains($item.Name)) {
        Remove-Item -LiteralPath $item.FullName -Force
        Write-Output "Removed by local retention: $($item.Name)"
    }
}

$verifiedNames = @(Get-ChildItem -LiteralPath $destinationPath -File -Filter 'padelclash-*.dump' |
    Select-Object -ExpandProperty Name)
if (-not (Test-BackupFreshness -Names $verifiedNames -StaleDays $StaleDays)) {
    Write-Warning "Newest verified local PadelClash backup is more than $StaleDays days old."
    exit 2
}
