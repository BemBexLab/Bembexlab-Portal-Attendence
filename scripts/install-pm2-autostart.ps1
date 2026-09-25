param(
  [string]$TaskName = "Bembex Portal PM2",
  [switch]$AtStartup
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$pm2Command = Get-Command pm2.cmd -ErrorAction SilentlyContinue
if (-not $pm2Command) {
  $pm2Command = Get-Command pm2 -ErrorAction SilentlyContinue
}
if (-not $pm2Command) {
  throw "PM2 was not found. Install it first with: npm install --global pm2"
}

$userId = "$env:USERDOMAIN\$env:USERNAME"
$action = New-ScheduledTaskAction `
  -Execute $pm2Command.Source `
  -Argument "resurrect" `
  -WorkingDirectory $projectRoot

if ($AtStartup) {
  Write-Host "Registering PM2 resurrection at Windows startup."
  Write-Host "This requires an administrator PowerShell window."
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $principal = New-ScheduledTaskPrincipal `
    -UserId $userId `
    -LogonType S4U `
    -RunLevel Highest
} else {
  Write-Host "Registering PM2 resurrection when $userId signs in."
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
  $principal = New-ScheduledTaskPrincipal `
    -UserId $userId `
    -LogonType Interactive `
    -RunLevel Limited
}

$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Force | Out-Null

Write-Host "Saved task '$TaskName'."
Write-Host "Before rebooting, save the PM2 process list with:"
Write-Host "  pm2 save"
Write-Host "Test it with:"
Write-Host "  Start-ScheduledTask -TaskName '$TaskName'"
