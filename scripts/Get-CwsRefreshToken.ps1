<#
.SYNOPSIS
    Obtém o refresh token OAuth necessário para o workflow publicar na Chrome Web Store.

.DESCRIPTION
    Abre o browser para autorizar a app, recebe o código no redirect http://localhost:8080
    e troca-o por um refresh token. Nada é enviado para lado nenhum além da Google.

.EXAMPLE
    .\scripts\Get-CwsRefreshToken.ps1 -ClientId "1707...apps.googleusercontent.com" -ClientSecret "GOCSPX-..."
#>
param(
    [Parameter(Mandatory = $true)] [string] $ClientId,
    [Parameter(Mandatory = $true)] [string] $ClientSecret,
    [int] $Port = 8080
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Web
$redirectUri = "http://localhost:$Port"
$scope = "https://www.googleapis.com/auth/chromewebstore"

$authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" +
    "client_id=$([uri]::EscapeDataString($ClientId))" +
    "&redirect_uri=$([uri]::EscapeDataString($redirectUri))" +
    "&response_type=code" +
    "&scope=$([uri]::EscapeDataString($scope))" +
    "&access_type=offline&prompt=consent"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("$redirectUri/")
try {
    $listener.Start()
} catch {
    Write-Host "Não foi possível escutar em $redirectUri. Fecha o que estiver a usar a porta $Port ou usa -Port." -ForegroundColor Red
    throw
}

Write-Host "A abrir o browser para autorizar (inicia sessão com a conta dona da extensão)..." -ForegroundColor Cyan
Start-Process $authUrl

$context = $listener.GetContext()
$query = $context.Request.QueryString
$code = $query["code"]
$error_ = $query["error"]

$body = if ($code) { "<h2>Autorizado. Podes fechar esta janela.</h2>" } else { "<h2>Erro: $error_</h2>" }
$bytes = [System.Text.Encoding]::UTF8.GetBytes("<html><body style='font-family:sans-serif'>$body</body></html>")
$context.Response.ContentType = "text/html; charset=utf-8"
$context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
$context.Response.Close()
$listener.Stop()

if (-not $code) { throw "A Google devolveu um erro: $error_" }

$token = Invoke-RestMethod -Method Post -Uri "https://oauth2.googleapis.com/token" -Body @{
    client_id     = $ClientId
    client_secret = $ClientSecret
    code          = $code
    redirect_uri  = $redirectUri
    grant_type    = "authorization_code"
}

if (-not $token.refresh_token) {
    throw "A resposta não trouxe refresh_token. Revoga o acesso da app em https://myaccount.google.com/permissions e volta a correr o script."
}

Write-Host ""
Write-Host "Refresh token (guardar como segredo CWS_REFRESH_TOKEN no GitHub):" -ForegroundColor Green
Write-Host $token.refresh_token
Write-Host ""
Set-Clipboard -Value $token.refresh_token
Write-Host "Copiado para a área de transferência." -ForegroundColor DarkGray
