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
- Permite escolher se o painel nativo de Revisão do GiRED aparece à esquerda ou à direita
- A preferência do lado da Revisão fica guardada e é aplicada imediatamente às páginas abertas
- Verifica e instala novas versões automaticamente em segundo plano
- Mantém o botão `Atualizar agora` no popup como controlo manual/fallback
- Popup compacto com interface visual própria para o mapper

## Instalação

### 1. Clonar com GitHub Desktop

Clonar:

`https://github.com/Kendir-Studios/GiRED-Structure-Manager.git`

### 2. Executar o instalador

#### Windows

Executar:

`INSTALL-WINDOWS.bat`

O instalador configura automaticamente o updater, abre a pasta da extensão e abre a página de extensões do Chrome ou Edge.

#### macOS

Executar:

`INSTALL-MAC.command`

Se o macOS não permitir executar o ficheiro diretamente, abrir o Terminal na pasta e executar:

```bash
bash INSTALL-MAC.command
```

### 3. Carregar a extensão

Na página de extensões:

1. Ativar o "Modo de programador"
2. Escolher "Carregar sem compactação" / "Load unpacked"
3. Selecionar a pasta deste repositório

O ID da extensão é fixo entre computadores: `mackaaceiagpmapjgllmecpodnnhpcdm`.

## Painel de Revisão

A partir da v1.5.0, o popup inclui a opção `Revisão do lado esquerdo`.

- Ativa: o painel nativo de Revisão do GiRED fica do lado esquerdo
- Desativada: mantém o comportamento original do GiRED, com o painel do lado direito
- A preferência fica guardada em `chrome.storage.local`
- A alteração é aplicada imediatamente sem ser necessário recarregar a página

Por omissão, numa instalação nova, o painel é apresentado à esquerda.

## Atualizações

Depois da configuração inicial, a extensão verifica automaticamente o repositório em segundo plano e no arranque do browser.

Quando existe uma atualização e o clone está limpo:

1. O helper faz `git fetch origin main`
2. Deteta que `origin/main` está à frente
3. Executa `git pull --ff-only origin main`
4. A extensão recarrega automaticamente

O popup continua a permitir verificar e instalar uma atualização manualmente através do botão `Atualizar agora`.

Não é necessário copiar IDs nem voltar a configurar o updater.

Como fallback, continua a ser possível atualizar manualmente através do GitHub Desktop e depois carregar em "Recarregar" em `chrome://extensions/` / `edge://extensions/`.

## Interface

A v1.5.0 adiciona uma área de preferências ao popup, mantendo a estrutura visual introduzida na v1.4.4.

## Versão atual

`1.5.0`

## Versionamento

O projeto usa versionamento semântico:

- `PATCH` (`1.5.0` -> `1.5.1`): correções e melhorias pequenas
- `MINOR` (`1.5.x` -> `1.6.0`): novas funcionalidades compatíveis
- `MAJOR` (`1.x` -> `2.0.0`): alterações maiores/incompatíveis

## Uso

Projeto interno da Kendir Studios.
