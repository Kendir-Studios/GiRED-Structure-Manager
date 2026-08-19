$ErrorActionPreference = "Stop"

$script:RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$script:GitPath = $null

function Read-NativeMessage {
    $inputStream = [Console]::OpenStandardInput()
    $lengthBytes = New-Object byte[] 4
    $read = $inputStream.Read($lengthBytes, 0, 4)
    if ($read -ne 4) { return $null }

    $length = [BitConverter]::ToInt32($lengthBytes, 0)
    if ($length -le 0 -or $length -gt 67108864) { return $null }

    $buffer = New-Object byte[] $length
    $offset = 0
    while ($offset -lt $length) {
        $chunk = $inputStream.Read($buffer, $offset, $length - $offset)
        if ($chunk -le 0) { return $null }
        $offset += $chunk
    }

    $json = [Text.Encoding]::UTF8.GetString($buffer)
    return $json | ConvertFrom-Json
}

function Write-NativeMessage([hashtable]$value) {
    $json = $value | ConvertTo-Json -Compress
    $payload = [Text.Encoding]::UTF8.GetBytes($json)
    $lengthBytes = [BitConverter]::GetBytes([int]$payload.Length)
    $outputStream = [Console]::OpenStandardOutput()
    $outputStream.Write($lengthBytes, 0, $lengthBytes.Length)
    $outputStream.Write($payload, 0, $payload.Length)
    $outputStream.Flush()
}

function Find-Git {
    $command = Get-Command git.exe -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }

    $desktopRoot = Join-Path $env:LOCALAPPDATA "GitHubDesktop"
    if (Test-Path $desktopRoot) {
        $apps = Get-ChildItem $desktopRoot -Directory -Filter "app-*" -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending

        foreach ($app in $apps) {
            $candidate = Join-Path $app.FullName "resources\app\git\cmd\git.exe"
            if (Test-Path $candidate) { return $candidate }
        }
    }

    return $null
}

function Invoke-Git([string[]]$arguments) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $script:GitPath
    $psi.WorkingDirectory = $script:RepoRoot
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.Arguments = ($arguments | ForEach-Object { '"' + $_.Replace('"', '\"') + '"' }) -join " "

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi
    [void]$process.Start()
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    return [PSCustomObject]@{
        ExitCode = $process.ExitCode
        StdOut = $stdout.Trim()
        StdErr = $stderr.Trim()
    }
}

function Get-LocalVersion {
    try {
        $manifestPath = Join-Path $script:RepoRoot "manifest.json"
        $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
        return [string]$manifest.version
    } catch {
        return ""
    }
}

function Get-RemoteVersion {
    $result = Invoke-Git @("show", "origin/main:manifest.json")
    if ($result.ExitCode -ne 0) { return "" }

    try {
        $manifest = $result.StdOut | ConvertFrom-Json
        return [string]$manifest.version
    } catch {
        return ""
    }
}

try {
    $message = Read-NativeMessage
    if (-not $message) {
        Write-NativeMessage @{ ok = $false; code = "invalid_message"; message = "Pedido inválido." }
        exit 0
    }

    $script:GitPath = Find-Git
    if (-not $script:GitPath) {
        Write-NativeMessage @{ ok = $false; code = "git_not_found"; message = "Git não encontrado. Instala ou abre o GitHub Desktop." }
        exit 0
    }

    if (-not (Test-Path (Join-Path $script:RepoRoot ".git"))) {
        Write-NativeMessage @{ ok = $false; code = "not_git_repo"; message = "A pasta da extensão não é um clone Git." }
        exit 0
    }

    $action = [string]$message.action

    if ($action -eq "check") {
        $fetch = Invoke-Git @("fetch", "origin", "main", "--quiet")
        if ($fetch.ExitCode -ne 0) {
            Write-NativeMessage @{ ok = $false; code = "fetch_failed"; message = "Não foi possível verificar atualizações. Confirma o login no GitHub Desktop." }
            exit 0
        }

        $localCommit = Invoke-Git @("rev-parse", "HEAD")
        $remoteCommit = Invoke-Git @("rev-parse", "origin/main")
        if ($localCommit.ExitCode -ne 0 -or $remoteCommit.ExitCode -ne 0) {
            Write-NativeMessage @{ ok = $false; code = "revision_failed"; message = "Não foi possível comparar as versões." }
            exit 0
        }

        $currentVersion = Get-LocalVersion
        $latestVersion = Get-RemoteVersion
        Write-NativeMessage @{
            ok = $true
            action = "check"
            currentVersion = $currentVersion
            latestVersion = $latestVersion
            updateAvailable = ($localCommit.StdOut -ne $remoteCommit.StdOut)
        }
        exit 0
    }

    if ($action -eq "update") {
        $status = Invoke-Git @("status", "--porcelain")
        if ($status.ExitCode -ne 0) {
            Write-NativeMessage @{ ok = $false; code = "status_failed"; message = "Não foi possível verificar o estado do repositório." }
            exit 0
        }

        if ($status.StdOut) {
            Write-NativeMessage @{ ok = $false; code = "dirty_repo"; message = "Existem alterações locais na pasta da extensão. Faz commit/reverte antes de atualizar." }
            exit 0
        }

        $fetch = Invoke-Git @("fetch", "origin", "main", "--quiet")
        if ($fetch.ExitCode -ne 0) {
            Write-NativeMessage @{ ok = $false; code = "fetch_failed"; message = "Não foi possível contactar o GitHub. Confirma o login no GitHub Desktop." }
            exit 0
        }

        $pull = Invoke-Git @("pull", "--ff-only", "origin", "main")
        if ($pull.ExitCode -ne 0) {
            Write-NativeMessage @{ ok = $false; code = "pull_failed"; message = "A atualização falhou. Abre o GitHub Desktop e confirma se o repositório consegue fazer Pull." }
            exit 0
        }

        Write-NativeMessage @{
            ok = $true
            action = "update"
            version = (Get-LocalVersion)
            message = "Atualização concluída."
        }
        exit 0
    }

    Write-NativeMessage @{ ok = $false; code = "unknown_action"; message = "Ação desconhecida." }
} catch {
    Write-NativeMessage @{ ok = $false; code = "host_error"; message = "O updater encontrou um erro inesperado." }
}
