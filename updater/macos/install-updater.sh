#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_NAME="pt.kendir.gired_updater"
HOST_PATH="$SCRIPT_DIR/kendir-gired-updater.sh"

printf 'Cole o ID da extensão apresentado em chrome://extensions ou edge://extensions: '
read -r EXTENSION_ID

if ! printf '%s' "$EXTENSION_ID" | grep -Eq '^[a-p]{32}$'; then
    echo 'ID inválido. O ID deve ter 32 caracteres entre a e p.'
    exit 1
fi

chmod +x "$HOST_PATH"

CHROME_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
EDGE_DIR="$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
mkdir -p "$CHROME_DIR" "$EDGE_DIR"

MANIFEST_CONTENT=$(cat <<EOF
{
  "name": "$HOST_NAME",
  "description": "Kendir GiRED Structure Manager Updater",
  "path": "$HOST_PATH",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF
)

printf '%s\n' "$MANIFEST_CONTENT" > "$CHROME_DIR/$HOST_NAME.json"
printf '%s\n' "$MANIFEST_CONTENT" > "$EDGE_DIR/$HOST_NAME.json"

echo 'Updater instalado com sucesso.'
echo "Extensão autorizada: $EXTENSION_ID"
echo 'Chrome e Edge foram configurados para o utilizador atual.'
echo 'Fecha e volta a abrir o popup da extensão para testar.'
