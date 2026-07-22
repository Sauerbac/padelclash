param(
    [Parameter(Mandatory)][string]$RemoteHost,
    [Parameter(Mandatory)][string]$SshUser,
    [Parameter(Mandatory)][string]$RemoteDirectory,
    [Parameter(Mandatory)][string]$IdentityFile,
    [Parameter(Mandatory)][string]$Destination,
    [string]$PgRestorePath,
    [string]$DailyAt = '02:30'
)

$ErrorActionPreference = 'Stop'
$pullScript = (Resolve-Path "$PSScriptRoot/Pull-PadelClashBackups.ps1").Path

function Quote-TaskArgument([string]$Value) {
    return '"' + $Value.Replace('"', '\"') + '"'
}

$pullArguments = @(
    '-NoProfile',
    '-ExecutionPolicy', 'RemoteSigned',
    '-File', (Quote-TaskArgument $pullScript),
    '-RemoteHost', (Quote-TaskArgument $RemoteHost),
    '-SshUser', (Quote-TaskArgument $SshUser),
    '-RemoteDirectory', (Quote-TaskArgument $RemoteDirectory),
    '-IdentityFile', (Quote-TaskArgument (Resolve-Path $IdentityFile).Path),
    '-Destination', (Quote-TaskArgument $Destination)
)
if ($PgRestorePath) {
    $pullArguments += @('-PgRestorePath', (Quote-TaskArgument (Resolve-Path $PgRestorePath).Path))
}
$argumentLine = $pullArguments -join ' '

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argumentLine
$dailyTime = [datetime]::ParseExact($DailyAt, 'HH:mm', [cultureinfo]::InvariantCulture)
$triggers = @(
    (New-ScheduledTaskTrigger -AtLogOn)
    (New-ScheduledTaskTrigger -Daily -At $dailyTime)
)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'PadelClash Backup Catch-up' -Action $action -Trigger $triggers -Settings $settings -Description 'Append-only verified PadelClash backup pull at sign-in and daily.' -Force | Out-Null

# Event 10000 is a connected NetworkProfile. This separate trigger catches up
# after the PC was offline at sign-in or at the daily time.
$eventQuery = '*[System[Provider[@Name=''Microsoft-Windows-NetworkProfile''] and EventID=10000]]'
$taskCommand = 'powershell.exe -NoProfile -Command "Start-ScheduledTask -TaskName ''PadelClash Backup Catch-up''"'
& schtasks.exe /Create /F /TN 'PadelClash Backup Network Catch-up' /SC ONEVENT /EC 'Microsoft-Windows-NetworkProfile/Operational' /MO $eventQuery /TR $taskCommand | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not register network catch-up task' }

Write-Output 'Registered sign-in, daily, and network catch-up tasks. Run each once from Task Scheduler and inspect its history.'
