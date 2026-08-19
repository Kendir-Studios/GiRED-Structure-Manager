$ErrorActionPreference = "Stop"

$hostName = "pt.kendir.gired_updater"
$extensionId = "mackaaceiagpmapjgllmecpodnnhpcdm"
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$launcherPath = Join-Path $PSScriptRoot "kendir-gired-updater.bat"
$configDirectory = Join-Path $env:LOCALAPPDATA "Kendir\GiREDStructureMapper"

New-Item -ItemType Directory -Path $configDirectory -Force | Out-Null

$manifestPath = Join-Path $configDirectory "$hostName.json"
$hostManifest = [ordered]@{
    name = $hostName
    description = "Kendir GiRED Structure Manager Updater"
    path = $launcherPath
    type = "stdio"
    allowed_origins = @("chrome-extension://$extensionId/")
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

Write-Host "Updater configurado com sucesso." -ForegroundColor Green
Write-Host "ID fixo da extensão: $extensionId"
Write-Host "Chrome e Edge foram configurados para o utilizador atual."

function Open-ExtensionsPage {
    $chromePaths = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    )

    foreach ($path in $chromePaths) {
        if ($path -and (Test-Path $path)) {
            Start-Process -FilePath $path -ArgumentList "chrome://extensions/"
            return
        }
    }

    $edgePaths = @(
        "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
    )

    foreach ($path in $edgePaths) {
        if ($path -and (Test-Path $path)) {
            Start-Process -FilePath $path -ArgumentList "edge://extensions/"
            return
        }
    }
}

try {
    Start-Process explorer.exe -ArgumentList $repoRoot
    Open-ExtensionsPage
} catch {
    # A configuração do updater já ficou concluída mesmo que não seja possível abrir as janelas.
}

Write-Host ""
Write-Host "Último passo: ativa o Modo de programador e usa 'Carregar sem compactação' nesta pasta:" -ForegroundColor Cyan
Write-Host $repoRoot
