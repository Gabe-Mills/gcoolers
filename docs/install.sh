#!/bin/bash
# One-liner: curl -fsSL https://gcoolers.com/install.sh | bash
# (mirrors scripts/get.sh)
set -euo pipefail
REPO="https://github.com/Gabe-Mills/gcoolers.git"
DIR="${GCOOLERS_SRC:-$HOME/.cache/gcoolers}"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required" >&2
  exit 1
fi

echo "→ Gcoolers (latest main)"
if [[ -d "$DIR/.git" ]]; then
  git -C "$DIR" fetch --depth 1 origin main
  git -C "$DIR" checkout -qf FETCH_HEAD
else
  mkdir -p "$(dirname "$DIR")"
  rm -rf "$DIR"
  git clone --depth 1 --branch main "$REPO" "$DIR"
fi

exec bash "$DIR/scripts/install.sh"
