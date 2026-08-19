#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
bash "$ROOT_DIR/updater/macos/install-updater.sh"

echo ''
echo 'Configuração concluída.'
echo 'Na página de extensões, ativa o Modo de programador e seleciona esta pasta em "Carregar sem compactação".'
echo ''
read -r -p 'Prime Enter para fechar...'
