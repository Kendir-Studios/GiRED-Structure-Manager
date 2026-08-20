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
- Permite ativar um modo `Só lista de correções`, escondendo o formulário e mantendo apenas os comentários já existentes
- Permite escolher se o painel nativo de Controlo de Versões aparece à direita ou mantém o lado esquerdo original
- Respeita os controlos nativos de abrir/fechar dos painéis do GiRED
- As preferências dos painéis ficam guardadas e são aplicadas imediatamente
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

- Ativa: quando o utilizador abre a Revisão, o painel aparece do lado esquerdo
- Desativada: mantém o comportamento original do GiRED, com o painel do lado direito
- O botão nativo `Revisão` continua responsável por abrir/fechar o painel
- A preferência fica guardada em `chrome.storage.local`

Por omissão, numa instalação nova, o painel é apresentado à esquerda quando é aberto.

A partir da v1.6.0 existe também a opção `Só lista de correções`.

- Ativa: ao abrir a Revisão, mantém o cabeçalho do painel e mostra apenas a lista de comentários/correções existentes
- O formulário de nova correção, a informação da unidade e as tabs ficam ocultos
- A aba de Correções é automaticamente mantida ativa
- Desativada: o painel volta ao modo completo do GiRED
- Esta opção vem desativada por omissão

## Controlo de Versões

A partir da v1.7.0, o popup inclui a opção `Controlo de Versões à direita`.

- Ativa: quando o utilizador abre o Controlo de Versões, o painel aparece do lado direito
- Desativada: mantém o comportamento original do GiRED, com o painel do lado esquerdo
- A extensão acompanha a classe nativa `course-vc-open` e não força o painel a ficar aberto
- O botão e o `X` nativos continuam responsáveis pela abertura e fecho
- A largura é detetada automaticamente para reservar espaço no lado correto
- Se a Revisão estiver aberta à esquerda ao mesmo tempo, a página reserva espaço para os dois painéis
- Por omissão, numa instalação nova, o Controlo de Versões abre à direita

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

A v1.7.0 acrescenta controlo independente do lado dos dois painéis principais: Revisão pode ficar à esquerda e Controlo de Versões à direita.

## Versão atual

`1.7.0`

## Versionamento

O projeto usa versionamento semântico:

- `PATCH` (`1.7.0` -> `1.7.1`): correções e melhorias pequenas
- `MINOR` (`1.7.x` -> `1.8.0`): novas funcionalidades compatíveis
- `MAJOR` (`1.x` -> `2.0.0`): alterações maiores/incompatíveis

## Uso

Projeto interno da Kendir Studios.
