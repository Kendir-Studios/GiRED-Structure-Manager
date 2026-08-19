# Atualizador automático

O GiRED Structure Manager pode verificar o repositório e fazer `Pull` diretamente a partir do popup através de Native Messaging.

Desde a versão `1.4.1`, o ID da extensão é fixo (`mackaaceiagpmapjgllmecpodnnhpcdm`), por isso já não é necessário copiar nem colar o ID durante a instalação.

## Windows

1. Clonar o repositório através do GitHub Desktop
2. Executar `INSTALL-WINDOWS.bat` na raiz do repositório
3. O instalador configura o Native Messaging Host para Chrome e Edge
4. O instalador abre a pasta da extensão e a página de extensões
5. Ativar o "Modo de programador" e usar "Carregar sem compactação"

## macOS

1. Clonar o repositório através do GitHub Desktop
2. Executar `INSTALL-MAC.command`
3. O instalador configura o Native Messaging Host para Chrome e Edge
4. O instalador abre a pasta da extensão e a página de extensões
5. Ativar o "Modo de programador" e usar "Carregar sem compactação"

Se o macOS não permitir executar `INSTALL-MAC.command` diretamente, executar uma vez:

```bash
bash INSTALL-MAC.command
```

## Funcionamento

Ao abrir o popup, a extensão pede ao helper para fazer `git fetch origin main` e compara o commit local com `origin/main`.

Quando existe uma atualização, o botão `Atualizar agora` executa um `git pull --ff-only origin main`. Se o `Pull` terminar com sucesso, a extensão chama `chrome.runtime.reload()` e volta a carregar os ficheiros atualizados.

O updater recusa atualizar quando existem alterações locais não guardadas no clone, para não sobrescrever trabalho local.

## Requisitos

- O repositório tem de ter sido clonado com Git
- O computador tem de conseguir autenticar no repositório privado
- Git ou GitHub Desktop deve estar instalado

Depois desta configuração inicial, não é necessário voltar ao GitHub Desktop para atualizações normais.
