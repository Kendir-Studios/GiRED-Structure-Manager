# GiRED Structure Manager

Extensão interna para Chrome/Edge que adiciona automaticamente códigos de estrutura ao editor do GiRED.

## Funcionalidades

- `SA 01`, `SA 02`, ... nas subseções
- `INTROD` na primeira unidade de cada SA
- `AT 01`, `AT 02`, ... nas unidades seguintes
- A numeração das ATs reinicia em cada SA
- Mostra os códigos também nos dropdowns/menus de navegação quando existe correspondência
- Mantém o contexto ao entrar numa unidade através de um indicador discreto, por exemplo `SA 05 / AT 03`
- Suporta a navegação dinâmica do GiRED e atualizações do DOM

## Instalação para desenvolvimento

### Windows / macOS

1. Fazer clone deste repositório
2. Abrir `chrome://extensions/` ou `edge://extensions/`
3. Ativar o "Modo de programador"
4. Escolher "Carregar sem compactação" / "Load unpacked"
5. Selecionar a pasta deste repositório

A extensão fica instalada a partir da pasta local.

## Atualizar

Depois de uma nova versão ser publicada no repositório:

```bash
git pull
```

Depois, em `chrome://extensions/` ou `edge://extensions/`, carregar em "Recarregar" na extensão e atualizar a página do GiRED.

## Versão atual

`1.3.1`

## Versionamento

O projeto usa versionamento semântico:

- `PATCH` (`1.3.1` -> `1.3.2`): correções
- `MINOR` (`1.3.x` -> `1.4.0`): novas funcionalidades compatíveis
- `MAJOR` (`1.x` -> `2.0.0`): alterações maiores/incompatíveis

## Uso

Projeto interno da Kendir Studios.
