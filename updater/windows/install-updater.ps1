param(
    [string]$ExtensionId = ""
)

$ErrorActionPreference = "Stop"
$hostName = "pt.kendir.gired_updater"

if (-not $ExtensionId) {
    $ExtensionId = Read-Host "Cole o ID da extensão apresentado em chrome://extensions ou edge://extensions"
}

$ExtensionId = $ExtensionId.Trim()
if ($ExtensionId -notmatch '^[a-p]{32}$') {
    Write-Host "ID inválido. O ID deve ter 32 caracteres entre a e p." -ForegroundColor Red
    exit 1
}

$manifestPath = Join-Path $PSScriptRoot "$hostName.json"
$hostManifest = [ordered]@{
    name = $hostName
    description = "Kendir GiRED Structure Manager Updater"
    path = "kendir-gired-updater.bat"
    type = "stdio"
    allowed_origins = @("chrome-extension://$ExtensionId/")
}

$json = $hostManifest | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText(
    $manifestPath,
    $json,
    (New-Object System.Text.UTF8Encoding($false))
)

$registryPaths = @(
    "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName",
    "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$hostName"
)

foreach ($registryPath in $registryPaths) {
    New-Item -Path $registryPath -Force | Out-Null
    Set-Item -Path $registryPath -Value $manifestPath
}

Write-Host "Updater instalado com sucesso." -ForegroundColor Green
Write-Host "Extensão autorizada: $ExtensionId"
Write-Host "Chrome e Edge foram configurados para o utilizador atual."
Write-Host "Fecha e volta a abrir o popup da extensão para testar."
