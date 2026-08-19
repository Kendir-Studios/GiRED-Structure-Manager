#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOST_NAME="pt.kendir.gired_updater"
HOST_PATH="$SCRIPT_DIR/kendir-gired-updater.sh"
EXTENSION_ID="mackaaceiagpmapjgllmecpodnnhpcdm"

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

echo 'Updater configurado com sucesso.'
echo "ID fixo da extensão: $EXTENSION_ID"
echo 'Chrome e Edge foram configurados para o utilizador atual.'

open "$REPO_ROOT" >/dev/null 2>&1 || true

if [ -d "/Applications/Google Chrome.app" ]; then
    open -a "Google Chrome" "chrome://extensions/" >/dev/null 2>&1 || true
elif [ -d "/Applications/Microsoft Edge.app" ]; then
    open -a "Microsoft Edge" "edge://extensions/" >/dev/null 2>&1 || true
fi

echo ''
echo "Último passo: ativa o Modo de programador e usa 'Carregar sem compactação' nesta pasta:"
echo "$REPO_ROOT"
