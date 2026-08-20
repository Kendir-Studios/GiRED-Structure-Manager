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
- Mantém o painel nativo de Revisão no lado direito do GiRED
- Faz a página adaptar-se automaticamente à largura do painel de Revisão, evitando que este tape o conteúdo
- Permite ativar um modo `Só lista de correções`, escondendo o formulário e mantendo apenas os comentários já existentes
- Mantém o painel nativo de Controlo de Versões no lado esquerdo do GiRED
- Faz a página adaptar-se automaticamente à largura do Controlo de Versões, evitando que este tape o conteúdo
- Respeita os controlos nativos de abrir/fechar dos painéis do GiRED
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

A partir da v1.7.1, o painel de Revisão permanece no lado direito nativo do GiRED.

- A extensão deixa de reposicionar o painel para a esquerda
- O botão nativo `Revisão` continua responsável por abrir/fechar o painel
- O botão `X` e todo o ciclo de abertura/fecho ficam totalmente a cargo do GiRED
- A antiga preferência `Revisão do lado esquerdo` foi removida
- A antiga chave `giredReviewSidebarLeft` é limpa automaticamente

A partir da v1.7.2, a Revisão deixa de funcionar visualmente como um overlay sobre o conteúdo:

- quando o painel abre, a extensão mede a largura real de `#vc-review-sidebar`
- enquanto `vc-review-open` está ativo, a página reserva essa largura no lado direito
- o layout responsivo do GiRED adapta-se ao espaço restante em vez de ficar escondido por baixo do painel
- quando o painel fecha, a página recupera automaticamente toda a largura

Continua disponível a opção `Só lista de correções`:

- Ativa: ao abrir a Revisão, mantém o cabeçalho do painel e mostra apenas a lista de comentários/correções existentes
- O formulário de nova correção, a informação da unidade e as tabs ficam ocultos
- A aba de Correções é automaticamente mantida ativa
- Desativada: o painel volta ao modo completo do GiRED
- Esta opção vem desativada por omissão

## Controlo de Versões

A partir da v1.7.3, o Controlo de Versões permanece sempre no lado esquerdo nativo do GiRED e deixa de funcionar visualmente como overlay.

- a preferência `Controlo de Versões à direita` foi removida do popup
- a antiga chave `giredVersionSidebarRight` é limpa automaticamente
- o painel continua a abrir e fechar através dos controlos nativos do GiRED
- quando o painel abre, a extensão mede a largura real de `#course-vc-sidebar`
- enquanto `course-vc-open` está ativo, a página reserva essa largura no lado esquerdo
- o layout responsivo adapta-se ao espaço restante em vez de ficar escondido por baixo do painel
- quando o painel fecha, a margem esquerda desaparece e a página recupera toda a largura
- se a Revisão estiver aberta ao mesmo tempo, o Controlo de Versões reserva espaço à esquerda e a Revisão reserva espaço à direita

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

Na v1.7.3, os dois painéis principais adaptam a página sem a tapar: Controlo de Versões à esquerda e Revisão à direita.

## Versão atual

`1.7.3`

## Versionamento

O projeto usa versionamento semântico:

- `PATCH` (`1.7.3` -> `1.7.4`): correções e melhorias pequenas
- `MINOR` (`1.7.x` -> `1.8.0`): novas funcionalidades compatíveis
- `MAJOR` (`1.x` -> `2.0.0`): alterações maiores/incompatíveis

## Uso

Projeto interno da Kendir Studios.
