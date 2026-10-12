#!/usr/bin/env bash
# ==============================================================================
# Radar de Voos - Atalho para o Autoloop Blindado e Seguro
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

if command -v autoloop-radarvoos &> /dev/null; then
    exec autoloop-radarvoos "$@"
else
    exec python3 "/home/wagmoraes/.local/bin/autoloop-radarvoos" "$@"
fi
