#!/usr/bin/env bash
# Supabase Storage (fotoğraf yükleme) servisini yerel test için kaynaktan derler.
# Bir kez çalıştırılır; sonra ./scripts/e2e-stack.sh onu da başlatır.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/.e2e/storage"
[ -d "$DIR/dist" ] && { echo "Zaten derlenmiş: $DIR"; exit 0; }
rm -rf "$DIR"
git clone -q --depth 1 --branch v1.19.3 https://github.com/supabase/storage "$DIR"
(cd "$DIR" && npm ci --ignore-scripts && npm rebuild fs-xattr && npm run build)
echo "Storage derlendi: $DIR"
