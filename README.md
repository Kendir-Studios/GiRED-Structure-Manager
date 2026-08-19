# GiRED Structure Manager

Extensão interna para Chrome/Edge que adiciona automaticamente códigos de estrutura ao editor do GiRED.

## Funcionalidades

- `SA 01`, `SA 02`, ... nas subseções
- `INTROD` na primeira unidade de cada SA
- `AT 01`, `AT 02`, ... nas unidades seguintes
- A numeração das ATs reinicia em cada SA
- Mostra os códigos também nos dropdowns/menus de navegação
- Mantém o contexto ao entrar numa unidade
- Suporta `apps.gired.pt` e `cms.gired.pt`
- Pode ser ligada/desligada diretamente no popup
- Verifica novas versões automaticamente ao abrir o popup
- Permite atualizar o clone local com um único botão através de um helper nativo

## Instalação

### Windows / macOS

1. Clonar este repositório através do GitHub Desktop
2. Abrir `chrome://extensions/` ou `edge://extensions/`
3. Ativar o "Modo de programador"
4. Escolher "Carregar sem compactação" / "Load unpacked"
5. Selecionar a pasta deste repositório

A extensão fica instalada a partir da pasta local.

## Configurar atualizações automáticas

O botão `Atualizar agora` utiliza Native Messaging para executar o `git pull` no clone local.

O helper só precisa de ser configurado uma vez por computador.

### Windows

1. Abrir `chrome://extensions/` ou `edge://extensions/`
2. Copiar o ID da extensão
3. Abrir `updater/windows`
4. Executar `install-updater.bat`
5. Colar o ID da extensão quando for pedido
6. Fechar e voltar a abrir o popup da extensão

### macOS

1. Copiar o ID da extensão em `chrome://extensions/` ou `edge://extensions/`
2. Abrir um Terminal na pasta do repositório
3. Executar:

```bash
bash updater/macos/install-updater.sh
```

4. Colar o ID da extensão quando for pedido
5. Fechar e voltar a abrir o popup

Mais detalhes em `updater/README.md`.

## Atualizar

Depois de o helper estar configurado, basta abrir o popup da extensão.

A extensão verifica automaticamente se `origin/main` tem uma versão mais recente. Quando existir uma atualização, aparece o botão `Atualizar agora`.

O updater:

1. Confirma que não existem alterações locais no clone
2. Faz `git fetch origin main`
3. Faz `git pull --ff-only origin main`
4. Recarrega automaticamente a extensão

Como fallback, continua a ser possível atualizar manualmente através do GitHub Desktop e depois carregar em "Recarregar" em `chrome://extensions/` / `edge://extensions/`.

## Versão atual

`1.4.0`

## Versionamento

O projeto usa versionamento semântico:

- `PATCH` (`1.4.0` -> `1.4.1`): correções
- `MINOR` (`1.4.x` -> `1.5.0`): novas funcionalidades compatíveis
- `MAJOR` (`1.x` -> `2.0.0`): alterações maiores/incompatíveis

## Uso

Projeto interno da Kendir Studios.
