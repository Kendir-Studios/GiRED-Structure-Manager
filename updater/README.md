# Atualizador automático

O GiRED Structure Manager pode verificar o repositório e fazer `Pull` diretamente a partir do popup através de Native Messaging.

O helper só precisa de ser configurado uma vez por computador.

## Windows

1. Instalar/carregar a extensão normalmente em `chrome://extensions/` ou `edge://extensions/`
2. Copiar o ID da extensão apresentado nessa página
3. Abrir a pasta `updater/windows`
4. Executar `install-updater.bat`
5. Colar o ID da extensão quando for pedido
6. Fechar e voltar a abrir o popup da extensão

O instalador regista o helper para Chrome e Edge apenas para o utilizador atual.

## macOS

1. Instalar/carregar a extensão normalmente
2. Copiar o ID da extensão apresentado em `chrome://extensions/` ou `edge://extensions/`
3. Abrir o Terminal na pasta do repositório
4. Executar:

```bash
bash updater/macos/install-updater.sh
```

5. Colar o ID da extensão quando for pedido
6. Fechar e voltar a abrir o popup da extensão

## Funcionamento

Ao abrir o popup, a extensão pede ao helper para fazer `git fetch origin main` e compara o commit local com `origin/main`.

Quando existe uma atualização, o botão `Atualizar agora` executa um `git pull --ff-only origin main`. Se o `Pull` terminar com sucesso, a extensão chama `chrome.runtime.reload()` e volta a carregar os ficheiros atualizados.

O updater recusa atualizar quando existem alterações locais não guardadas no clone, para não sobrescrever trabalho local.

## Requisitos

- O repositório tem de ter sido clonado com Git
- O computador tem de conseguir autenticar no repositório privado
- Git ou GitHub Desktop deve estar instalado

Se o helper não estiver configurado, o popup continua funcional; apenas a atualização automática fica indisponível.
