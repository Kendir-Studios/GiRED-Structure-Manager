# Changelog

Todas as alterações relevantes do GiRED Structure Manager são registadas neste ficheiro.

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
