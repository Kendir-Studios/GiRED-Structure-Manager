# Changelog

Todas as alterações relevantes do GiRED Structure Manager são registadas neste ficheiro.

## [2.0.3] - 2026-08-22

### Corrigido

- Ícones PNG regenerados a partir de `icons/icon-source.svg` (os anteriores estavam corrompidos e a Chrome Web Store rejeitava-os)
- O ZIP da store deixa de incluir a `key` do manifest, que fazia o upload falhar com `PKG_MANIFEST_KEY_NOT_MATCH`
- O build valida a integridade dos PNG antes de empacotar
- Publicação automática na Chrome Web Store quando a versão muda (ver `PUBLISHING.md`)

## [2.0.2] - 2026-08-21

### Alterado

- O modal `Editando: ...` deixa de ficar colado às bordas do browser: passa a ter uma margem de 24px à volta (10px em ecrãs estreitos), cantos arredondados e sombra
- O editor de código ajusta a sua altura a essa margem

## [2.0.1] - 2026-08-21

### Corrigido

- A barra de navegação das unidades no CMS (`#sequence-nav`, com `Anterior`/`Seguinte`/`Nova Unidade`) deixa de desaparecer: a extensão guarda uma cópia sempre que ela está presente e, se o Studio não a renderizar ao fim de 2,5 s, repõe a última cópia conhecida com a unidade atual marcada como ativa
- Na cópia restaurada, as tabs e os botões `Anterior`/`Seguinte` navegam normalmente; `Nova Unidade` recarrega a página para usar o fluxo nativo
- Assim que o Studio volta a renderizar a barra nativa, esta substitui a cópia automaticamente
- Novo `cms-sequence-nav.js`

## [2.0.0] - 2026-08-21

### Adicionado

- O modal nativo `Editando: ...` do CMS passa a ocupar o ecrã inteiro, com scroll apenas na área de conteúdo
- Novo editor de código para o `Code view` dos componentes SAGE, em `cms-code-editor.js` e `cms-editor-modal.css`:
  - realce de sintaxe JSON com tema escuro (chaves, strings, números, booleanos, `null` e parênteses coloridos por nível)
  - numeração de linhas e destaque da linha ativa
  - validação em tempo real com indicação de linha/coluna do erro
  - botões `Formatar`, `Compactar` e `Copiar`
  - `Tab`/`Shift+Tab` para indentar, indentação automática no `Enter`, fecho automático de `{`, `[` e `"`, e `Shift+Alt+F` para formatar
  - colapso de regiões `{...}` e `[...]` através das setas na numeração de linhas, dos botões `Colapsar tudo`/`Expandir tudo` ou de `Ctrl+Shift+[` / `Ctrl+Shift+]`
  - as regiões colapsadas aparecem como `{⋯}`, expandem-se automaticamente ao serem tocadas pelo cursor e são sempre expandidas antes de `Save`/`Visual view`, pelo que o JSON guardado fica sempre completo

### Compatibilidade

- A textarea nativa continua a ser a fonte de verdade; os botões `Save`/`Visual view` do xblock continuam a ler o seu valor
- Ao desligar a extensão, o modal e o `Code view` voltam ao aspeto nativo do GiRED

## [1.8.0] - 2026-08-20

### Adicionado

- Nova barra de pesquisa na aba `Comentários` do Controlo de Versões, colocada imediatamente antes de `#vc-comments-list`
- Pesquisa em tempo real em todo o texto de cada `.course-vc-comment-item`
- Pesquisa sem distinção entre maiúsculas/minúsculas e acentos
- Suporte para procurar autores, IDs de issues, nomes de atividades, localização, descrição, sugestão, citações e restante texto dos comentários
- Contador de resultados durante a pesquisa
- Botão para limpar a pesquisa e suporte à tecla `Esc`
- Novo `version-comments-search.js`

### Compatibilidade

- A pesquisa funciona em conjunto com os filtros nativos de Severidade, Estado e Equipa
- A barra e o filtro são reaplicados automaticamente quando o GiRED recria a lista de comentários
- Ao desligar a extensão, qualquer filtro de pesquisa aplicado aos comentários é removido

## [1.7.3] - 2026-08-20

### Alterado

- O painel de Controlo de Versões passa a permanecer sempre no lado esquerdo nativo do GiRED
- Removida a preferência `Controlo de Versões à direita` do popup
- A antiga preferência `giredVersionSidebarRight` é removida automaticamente do `chrome.storage.local`

### Corrigido

- O Controlo de Versões deixa de tapar o conteúdo da página quando está aberto
- A extensão mede automaticamente a largura real de `#course-vc-sidebar`
- Enquanto `course-vc-open` está ativo, a página reserva essa largura à esquerda e o layout responsivo adapta-se ao espaço disponível
- Ao fechar o painel, a margem esquerda desaparece automaticamente e a página recupera toda a largura
- Se a Revisão estiver aberta ao mesmo tempo, o Controlo de Versões reserva espaço à esquerda e a Revisão reserva espaço à direita

## [1.7.2] - 2026-08-20

### Corrigido

- A Revisão continua no lado direito nativo, mas deixa de tapar o conteúdo da página
- A extensão mede automaticamente a largura real de `#vc-review-sidebar` quando o painel abre
- Enquanto `vc-review-open` está ativo, a página reserva essa largura à direita e o conteúdo responsivo adapta-se ao espaço disponível
- Ao fechar a Revisão, a margem deixa de ser aplicada automaticamente e a página recupera toda a largura
- Se Revisão e Controlo de Versões estiverem abertos simultaneamente à direita, os painéis ficam lado a lado e a página reserva a soma das duas larguras

## [1.7.1] - 2026-08-20

### Alterado

- O painel de Revisão volta a usar permanentemente o lado direito nativo do GiRED
- Removida a preferência `Revisão do lado esquerdo` do popup
- Removidos os estilos que reposicionavam `#vc-review-sidebar` e alteravam as margens da página
- `review-sidebar-control.js` passa a gerir apenas o modo `Só lista de correções`
- A antiga preferência `giredReviewSidebarLeft` é removida automaticamente do `chrome.storage.local`
- O Controlo de Versões continua a poder ser colocado do lado direito de forma independente

## [1.7.0] - 2026-08-20

### Adicionado

- Nova preferência `Controlo de Versões à direita` no popup
- Novo `version-sidebar-control.js` para acompanhar o painel nativo `#course-vc-sidebar`
- Novo `version-sidebar.css` para espelhar o painel de Controlo de Versões para o lado direito
- A preferência fica guardada em `chrome.storage.local` e é aplicada imediatamente às páginas abertas
- O painel continua a usar o ciclo nativo de abertura/fecho do GiRED através da classe `course-vc-open`
- Suporte para manter simultaneamente a Revisão à esquerda e o Controlo de Versões à direita, reservando espaço para ambos

### Alterado

- Numa instalação nova, o painel de Controlo de Versões passa a abrir do lado direito por omissão
- Quando a opção é desativada, o painel volta ao comportamento original do GiRED, do lado esquerdo
- O botão/controlo nativo continua responsável por abrir e fechar o painel

## [1.6.2] - 2026-08-19

### Corrigido

- Corrigido o botão `X` do painel de Revisão quando este está configurado para abrir do lado esquerdo
- Os estilos que reposicionam `#vc-review-sidebar` passam a ser aplicados apenas enquanto o `body` tem a classe nativa `vc-review-open`
- Ao fechar a Revisão, o GiRED volta a controlar integralmente o estado fechado e o painel sai corretamente do viewport
- O modo `Só lista de correções` também passa a aplicar os seus overrides apenas enquanto o painel está aberto

## [1.6.1] - 2026-08-19

### Corrigido

- O modo `Só lista de correções` passa a funcionar corretamente quando o painel de Revisão começa fechado
- A extensão deteta a abertura através do botão nativo `Revisão` do GiRED e aplica as preferências nesse momento
- A classe `vc-review-open` do `body` passa a ser observada para acompanhar abertura e fecho do painel sem depender de alterações estruturais no DOM
- A aba `Correções` é novamente ativada quando necessário após abrir o painel
- O cálculo da largura do painel esquerdo é atualizado apenas quando a Revisão está efetivamente aberta

### Alterado

- O botão nativo que abre a Revisão permanece no lado direito, mesmo quando o painel está configurado para abrir à esquerda
- As preferências de lado e de modo compacto já não abrem o painel automaticamente; apenas alteram a forma como este aparece quando o utilizador o abre

## [1.6.0] - 2026-08-19

### Adicionado

- Nova preferência `Só lista de correções` no popup
- Modo compacto opcional para o painel nativo de Revisão do GiRED
- Quando ativo, mantém apenas o cabeçalho e a lista de comentários/correções existentes
- O formulário de nova correção, a informação da unidade e as tabs ficam ocultos
- A aba de Correções é mantida ativa automaticamente
- A preferência fica guardada em `chrome.storage.local` e é aplicada imediatamente às páginas abertas

### Alterado

- `review-sidebar-control.js` passa a gerir também o modo compacto do painel de Revisão
- A área de Preferências do popup passa a suportar múltiplos toggles
- O modo `Só lista de correções` fica desativado por omissão para preservar o comportamento completo do GiRED

## [1.5.0] - 2026-08-19

### Adicionado

- Nova preferência no popup para mover o painel nativo de Revisão do GiRED para o lado esquerdo
- Toggle `Revisão do lado esquerdo`, persistido em `chrome.storage.local`
- Aplicação imediata da preferência às páginas GiRED já abertas
- Novo `review-sidebar-control.js` para acompanhar a inserção dinâmica e a largura do painel

### Alterado

- O painel de Revisão passa a aparecer à esquerda por omissão em instalações novas
- Quando a opção é desativada, o GiRED mantém o comportamento original com o painel à direita
- O conteúdo da página reserva espaço do lado correspondente ao painel para evitar sobreposição

## [1.4.4] - 2026-08-19

### Alterado

- Interface do popup redesenhada novamente, mantendo a lógica funcional estável da v1.4.3
- Novo cabeçalho compacto com identidade visual SA / AT
- Estado da extensão reorganizado num card dedicado
- Área de atualizações reorganizada com melhor hierarquia visual
- Melhorados espaçamentos, contraste, tipografia e estados do botão/toggle
- Adicionado rodapé discreto com identificação da Kendir Studios

### Segurança / Estabilidade

- `popup.js` não foi alterado nesta versão
- `background.js` não foi alterado nesta versão
- Mantidos exatamente os mesmos IDs usados pelo JavaScript (`enabledToggle`, `statusText`, `version`, `updateStatus`, `latestVersion`, `updateButton`, `updaterSetup`)

## [1.4.3] - 2026-08-19

### Corrigido

- Restaurada a interface estável do popup após a regressão introduzida na v1.4.2
- Restaurado o service worker de background estável, removendo a geração dinâmica do ícone que podia interferir com o funcionamento da extensão
- Mantidas todas as funcionalidades de mapeamento SA/AT, updater, toggle e contexto entre tabs

## [1.4.2] - 2026-08-19

### Adicionado

- Novo branding visual para o popup da extensão
- Novo ícone da barra do browser, gerado em memória pelo service worker
- Ficheiro vetorial `icons/icon-source.svg` como fonte do ícone
- Identificação visual "Kendir Studios" no rodapé do popup

### Alterado

- Interface do popup totalmente renovada com tema escuro e destaque teal
- Melhor organização visual do estado da extensão e das atualizações
- Melhor contraste, tipografia, espaçamentos e estados de interação
- Descrição da extensão atualizada no `manifest.json`

## [1.4.1] - 2026-08-19

### Adicionado

- ID fixo da extensão através da chave pública definida no `manifest.json`
- `INSTALL-WINDOWS.bat` na raiz do repositório para configurar o updater sem pedir o ID
- `INSTALL-MAC.command` para simplificar a configuração no macOS
- Abertura automática da pasta da extensão e da página de extensões durante a configuração
- Service worker de atualização automática em segundo plano
- Verificação de updates no arranque do browser, após updates e periodicamente através de `chrome.alarms`
- Instalação automática da nova versão através do helper quando `origin/main` está à frente e o clone está limpo

### Alterado

- O instalador do Native Messaging deixa de pedir o ID da extensão
- Chrome e Edge passam a autorizar diretamente o ID fixo `mackaaceiagpmapjgllmecpodnnhpcdm`
- A instalação inicial fica reduzida a clonar, executar o instalador e usar `Carregar sem compactação`
- O botão `Atualizar agora` continua disponível no popup apenas como controlo manual/fallback

## [1.4.0] - 2026-08-19

### Adicionado

- Secção de atualizações diretamente no popup da extensão
- Verificação automática de novas versões ao abrir o popup
- Botão `Atualizar agora` quando existe uma versão mais recente
- Atualização do clone local através de Native Messaging e `git pull --ff-only`
- Recarregamento automático da extensão após uma atualização concluída
- Helper de atualização para Windows e macOS
- Botão para copiar o ID da extensão durante a configuração inicial do updater

### Segurança

- O updater recusa atualizar quando existem alterações locais no clone, evitando sobrescrever trabalho local
- O helper nativo só aceita mensagens da extensão autorizada no respetivo manifesto de Native Messaging

## [1.3.7] - 2026-08-18

### Adicionado

- Popup próprio ao clicar no ícone da extensão
- Interruptor para ligar/desligar o GiRED Structure Mapper
- Estado do interruptor guardado em `chrome.storage.local`
- Atualização imediata das páginas GiRED abertas quando o estado é alterado
- Indicação da versão atual diretamente no popup

## [1.3.6] - 2026-08-18

### Corrigido

- Numeração dos dropdowns do CMS adaptada à estrutura real `.nav-sub > ul > li.nav-item > a`

## [1.3.5] - 2026-08-18

### Alterado

- Separada a lógica específica dos dropdowns do CMS para `cms-dropdowns.js`

## [1.3.4] - 2026-08-18

### Adicionado

- Numeração sequencial de todas as SAs apresentadas no dropdown do editor CMS
- Numeração sequencial das atividades no dropdown da SA, usando `INTROD` na primeira unidade e `AT 01`, `AT 02`, etc. nas restantes
- Deteção automática do tipo de dropdown através da SA ou AT atualmente aberta

## [1.3.3] - 2026-08-18

### Adicionado

- Suporte ao editor de atividades em `cms.gired.pt`
- Etiqueta `SA XX` integrada junto ao nome da SA no cabeçalho do editor
- Etiqueta `AT XX` ou `INTROD` integrada antes do título da atividade
- Partilha do contexto guardado em `chrome.storage.local` entre `apps.gired.pt` e `cms.gired.pt`

### Alterado

- O indicador flutuante anterior deixa de ser apresentado no CMS quando os indicadores integrados são usados
- O content script passa a ser executado tanto em `apps.gired.pt` como em `cms.gired.pt`

## [1.3.2] - 2026-08-18

### Corrigido

- O contexto SA/AT passa a ser partilhado entre tabs através de `chrome.storage.local`
- As atividades abertas numa nova tab recuperam automaticamente o respetivo `SA XX / AT XX` ou `SA XX / INTROD`
- O mapa de rotas das atividades passa a ser partilhado entre todas as tabs da extensão
- O content script passa a abranger todas as rotas de `apps.gired.pt`
- `localStorage` é mantido como fallback de compatibilidade

## [1.3.1] - 2026-08-18

### Corrigido

- Corrigido o indicador SA/AT nas páginas de atividade quando o GiRED mantém a página de estrutura anterior escondida no DOM
- A estrutura só é considerada ativa quando está realmente visível

## [1.3.0] - 2026-08-18

### Adicionado

- Contexto persistente ao entrar numa unidade
- Indicador discreto com `SA XX / AT XX` ou `SA XX / INTROD`
- Associação dos destinos das unidades ao respetivo contexto para suportar navegação interna do GiRED

## [1.2.1] - 2026-08-18

### Alterado

- A primeira unidade de cada SA passa a ser `INTROD`
- As ATs começam em `AT 01` a partir da segunda unidade
- `INTROD` também é apresentado nos menus/dropdowns

## [1.2.0] - 2026-08-18

### Adicionado

- Códigos SA/AT nos dropdowns e menus de navegação
- Badges mais pequenos e discretos
- Atualização automática quando os menus são abertos ou o DOM muda

## [1.1.0] - 2026-08-18

### Adicionado

- Numeração das ATs dentro das SAs
- Reinício da numeração AT em cada SA

## [1.0.0] - 2026-08-18

### Adicionado

- Primeira versão do mapper
- Numeração automática das SAs na estrutura do GiRED
