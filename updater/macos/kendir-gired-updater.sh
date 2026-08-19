#!/bin/bash
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

send_response() {
    local json="$1"
    local length
    length=$(printf '%s' "$json" | LC_ALL=C wc -c | tr -d '[:space:]')

    printf "\\$(printf '%03o' $((length & 255)))"
    printf "\\$(printf '%03o' $(((length >> 8) & 255)))"
    printf "\\$(printf '%03o' $(((length >> 16) & 255)))"
    printf "\\$(printf '%03o' $(((length >> 24) & 255)))"
    printf '%s' "$json"
}

find_git() {
    if [ -x "/Applications/GitHub Desktop.app/Contents/Resources/app/git/bin/git" ]; then
        printf '%s' "/Applications/GitHub Desktop.app/Contents/Resources/app/git/bin/git"
        return 0
    fi

    if [ -x "$HOME/Applications/GitHub Desktop.app/Contents/Resources/app/git/bin/git" ]; then
        printf '%s' "$HOME/Applications/GitHub Desktop.app/Contents/Resources/app/git/bin/git"
        return 0
    fi

    if command -v git >/dev/null 2>&1; then
        command -v git
        return 0
    fi

    return 1
}

read_length() {
    dd bs=4 count=1 2>/dev/null | od -An -tu4 | tr -d '[:space:]'
}

LENGTH="$(read_length)"
if [ -z "$LENGTH" ]; then
    exit 0
fi

MESSAGE="$(dd bs=1 count="$LENGTH" 2>/dev/null)"
GIT_BIN="$(find_git 2>/dev/null || true)"

if [ -z "$GIT_BIN" ]; then
    send_response '{"ok":false,"code":"git_not_found","message":"Git não encontrado. Instala ou abre o GitHub Desktop."}'
    exit 0
fi

if [ ! -d "$REPO_ROOT/.git" ]; then
    send_response '{"ok":false,"code":"not_git_repo","message":"A pasta da extensão não é um clone Git."}'
    exit 0
fi

if printf '%s' "$MESSAGE" | grep -Eq '"action"[[:space:]]*:[[:space:]]*"check"'; then
    if ! "$GIT_BIN" -C "$REPO_ROOT" fetch origin main --quiet >/dev/null 2>&1; then
        send_response '{"ok":false,"code":"fetch_failed","message":"Não foi possível verificar atualizações. Confirma o login no GitHub Desktop."}'
        exit 0
    fi

    LOCAL_COMMIT=$("$GIT_BIN" -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || true)
    REMOTE_COMMIT=$("$GIT_BIN" -C "$REPO_ROOT" rev-parse origin/main 2>/dev/null || true)
    CURRENT_VERSION=$(grep -E '"version"[[:space:]]*:' "$REPO_ROOT/manifest.json" | head -1 | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')
    REMOTE_MANIFEST=$("$GIT_BIN" -C "$REPO_ROOT" show origin/main:manifest.json 2>/dev/null || true)
    LATEST_VERSION=$(printf '%s' "$REMOTE_MANIFEST" | grep -E '"version"[[:space:]]*:' | head -1 | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')

    if [ -z "$LOCAL_COMMIT" ] || [ -z "$REMOTE_COMMIT" ]; then
        send_response '{"ok":false,"code":"revision_failed","message":"Não foi possível comparar as versões."}'
        exit 0
    fi

    if [ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]; then
        UPDATE_AVAILABLE=true
    else
        UPDATE_AVAILABLE=false
    fi

    send_response "{\"ok\":true,\"action\":\"check\",\"currentVersion\":\"$CURRENT_VERSION\",\"latestVersion\":\"$LATEST_VERSION\",\"updateAvailable\":$UPDATE_AVAILABLE}"
    exit 0
fi

if printf '%s' "$MESSAGE" | grep -Eq '"action"[[:space:]]*:[[:space:]]*"update"'; then
    STATUS=$("$GIT_BIN" -C "$REPO_ROOT" status --porcelain 2>/dev/null || true)
    if [ -n "$STATUS" ]; then
        send_response '{"ok":false,"code":"dirty_repo","message":"Existem alterações locais na pasta da extensão. Faz commit/reverte antes de atualizar."}'
        exit 0
    fi

    if ! "$GIT_BIN" -C "$REPO_ROOT" fetch origin main --quiet >/dev/null 2>&1; then
        send_response '{"ok":false,"code":"fetch_failed","message":"Não foi possível contactar o GitHub. Confirma o login no GitHub Desktop."}'
        exit 0
    fi

    if ! "$GIT_BIN" -C "$REPO_ROOT" pull --ff-only origin main >/dev/null 2>&1; then
        send_response '{"ok":false,"code":"pull_failed","message":"A atualização falhou. Abre o GitHub Desktop e confirma se o repositório consegue fazer Pull."}'
        exit 0
    fi

    VERSION=$(grep -E '"version"[[:space:]]*:' "$REPO_ROOT/manifest.json" | head -1 | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')
    send_response "{\"ok\":true,\"action\":\"update\",\"version\":\"$VERSION\",\"message\":\"Atualização concluída.\"}"
    exit 0
fi

send_response '{"ok":false,"code":"unknown_action","message":"Ação desconhecida."}'
