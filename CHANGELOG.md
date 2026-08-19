# Changelog

Todas as alterações relevantes do GiRED Structure Manager são registadas neste ficheiro.

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
