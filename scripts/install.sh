#!/bin/bash
set -euo pipefail
# Gcoolers installer — from git checkout or release tarball
PREFIX="${PREFIX:-$HOME/bin}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$PREFIX" \
  "$HOME/Library/Application Support/Gcoolers" \
  "$HOME/Applications" \
  "$HOME/Library/LaunchAgents"

echo "→ Gcoolers → $PREFIX"
cp -f "$ROOT/bin/gcoolers" "$PREFIX/gcoolers"
chmod +x "$PREFIX/gcoolers"
ln -sfn "$PREFIX/gcoolers" "$PREFIX/gcool"

# helpers
if [[ "$(uname -m)" == "arm64" ]]; then
  if [[ -x "$ROOT/vendor/darwin-arm64/macmon" ]]; then
    cp -f "$ROOT/vendor/darwin-arm64/macmon" "$PREFIX/macmon"
    chmod +x "$PREFIX/macmon"
  fi
  if [[ -x "$ROOT/vendor/darwin-arm64/heatwatch-fan" ]]; then
    cp -f "$ROOT/vendor/darwin-arm64/heatwatch-fan" "$PREFIX/heatwatch-fan"
    chmod +x "$PREFIX/heatwatch-fan"
  elif [[ -f "$ROOT/Tools/heatwatch-fan.c" ]]; then
    echo "→ compiling heatwatch-fan"
    cc -O2 -o "$PREFIX/heatwatch-fan" "$ROOT/Tools/heatwatch-fan.c" \
      -framework IOKit -framework CoreFoundation
  fi
fi

# Swift sources for menubar/widget build
mkdir -p "$HOME/Library/Application Support/Gcoolers"
cp -f "$ROOT/Sources/"*.swift "$HOME/Library/Application Support/Gcoolers/" 2>/dev/null || true
cp -f "$ROOT/Sources/"*.entitlements "$HOME/Library/Application Support/Gcoolers/" 2>/dev/null || true

# PATH
if ! echo ":$PATH:" | grep -q ":$PREFIX:"; then
  if [[ -f "$HOME/.zshrc" ]] && ! grep -q 'HOME/bin' "$HOME/.zshrc" 2>/dev/null; then
    echo 'export PATH="$HOME/bin:$PATH"' >> "$HOME/.zshrc"
  fi
fi

echo "→ first-run setup (password once for fan helper)"
"$PREFIX/gcoolers" install
"$PREFIX/gcoolers" doctor
echo "✓ Done — https://gcoolers.com"
echo "  Add widget: Edit Widgets → Gcoolers"
