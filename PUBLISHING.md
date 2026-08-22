# Publicação automática na Chrome Web Store

Cada `push` para `main` corre o workflow [build-store-package.yml](.github/workflows/build-store-package.yml):

1. O job `build` valida o manifest e gera o ZIP da store (sempre).
2. O job `publish` corre **apenas quando a `version` do `manifest.json` mudou** nesse commit (ou ao correr o workflow manualmente com a opção `publish`). Envia o ZIP para a Chrome Web Store e submete-o para publicação.

Ou seja: para lançar uma versão basta subir a `version` no `manifest.json`, atualizar o `CHANGELOG.md` e fazer push. Commits sem mudança de versão só geram o ZIP como artefacto.

A store continua a fazer a sua revisão; o estado `ITEM_PENDING_REVIEW` é normal e a versão fica disponível assim que for aprovada.

## Configuração inicial (uma vez)

### 1. Credenciais OAuth da Google

1. Abrir <https://console.cloud.google.com/> e criar um projeto (ex.: `GiRED Fixer Publishing`).
2. Em **APIs & Services → Library**, ativar a **Chrome Web Store API**.
3. Em **APIs & Services → OAuth consent screen**: tipo *External*, preencher nome/email, e em *Test users* adicionar a conta Google que é dona da extensão na store. Não é preciso submeter a app para verificação.
4. Em **APIs & Services → Credentials → Create credentials → OAuth client ID**, tipo **Desktop app**. Guardar o `Client ID` e o `Client secret`.

### 2. Obter o refresh token

Substituir `CLIENT_ID` e `CLIENT_SECRET` e abrir este URL no browser, com sessão iniciada na conta dona da extensão:

```
https://accounts.google.com/o/oauth2/v2/auth?client_id=CLIENT_ID&redirect_uri=http://localhost:8080&response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&access_type=offline&prompt=consent
```

Depois de aceitar, o browser é redirecionado para `http://localhost:8080/?code=4/0A...&scope=...` (a página dá erro, é esperado). Copiar o valor de `code` da barra de endereço e trocá-lo pelo token:

```bash
curl -X POST https://oauth2.googleapis.com/token \
  -d client_id="CLIENT_ID" \
  -d client_secret="CLIENT_SECRET" \
  -d code="CODE" \
  -d redirect_uri="http://localhost:8080" \
  -d grant_type=authorization_code
```

Em PowerShell:

```powershell
Invoke-RestMethod -Method Post -Uri https://oauth2.googleapis.com/token -Body @{
  client_id = "CLIENT_ID"; client_secret = "CLIENT_SECRET"; code = "CODE"
  redirect_uri = "http://localhost:8080"; grant_type = "authorization_code"
}
```

A resposta inclui `refresh_token`. Guardar esse valor (só é devolvido nesta troca, por causa do `prompt=consent`).

### 3. ID da extensão

Em <https://chrome.google.com/webstore/devconsole> abrir o item GiRED Fixer; o ID (32 letras) aparece no URL e na página do item. Como o `manifest.json` inclui a `key`, deve ser `mackaaceiagpmapjgllmecpodnnhpcdm`, mas confirmar na consola.

### 4. Segredos no GitHub

No repositório: **Settings → Environments → New environment** com o nome exato `chrome-web-store`. Dentro do environment, adicionar os *Environment secrets*:

| Segredo | Valor |
| --- | --- |
| `CWS_CLIENT_ID` | Client ID do passo 1 |
| `CWS_CLIENT_SECRET` | Client secret do passo 1 |
| `CWS_REFRESH_TOKEN` | Refresh token do passo 2 |
| `CWS_EXTENSION_ID` | ID do passo 3 |

Opcionalmente, no mesmo environment, ativar *Required reviewers* para que cada publicação tenha de ser aprovada manualmente no GitHub antes de ir para a store.

### 5. Testar

**Actions → Build and publish Chrome Web Store package → Run workflow**, marcar `publish` e correr. O resumo do job `publish` mostra a resposta da store.

## Problemas comuns

- `Falta o segredo ...` — o environment `chrome-web-store` não existe ou o segredo tem outro nome.
- `invalid_grant` ao obter o token — o refresh token foi revogado (por exemplo, app em modo *Testing* com tokens que expiram ao fim de 7 dias se o *publishing status* nunca foi passado a *In production*). Em **OAuth consent screen**, carregar em **Publish app** (não exige verificação para este scope) e repetir o passo 2.
- `ITEM_NOT_UPDATABLE` — já existe uma submissão pendente de revisão na store; esperar que termine.
- `PKG_INVALID_VERSION_NUMBER` / versão igual ou inferior — a `version` do manifest tem de ser superior à que está publicada.
