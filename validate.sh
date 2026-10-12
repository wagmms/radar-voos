#!/usr/bin/env bash
# ==============================================================================
# Radar de Voos - Validação Rápida em Camadas (Fast / Standard / Full)
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

TIER="${1:-fast}"
TIER_CLEAN=$(echo "$TIER" | tr '[:upper:]' '[:lower:]' | tr -d '-')

echo "🧪 [VALIDATE] Iniciando validação do Radar de Voos (Tier: $TIER_CLEAN)..."

# 1. Verificação de Sintaxe em Arquivos JavaScript Críticos
echo "🔍 [1/3] Verificando sintaxe dos scripts Node.js..."
node --check src/index.js

# Verifica arquivos principais
for f in $(find src/ -name "*.js" 2>/dev/null); do
    node --check "$f" >/dev/null 2>&1 || {
        echo "❌ [ERRO] Falha de sintaxe no arquivo: $f"
        exit 1
    }
done

for f in $(find tests/ -name "*.test.js" 2>/dev/null); do
    node --check "$f" >/dev/null 2>&1 || {
        echo "❌ [ERRO] Falha de sintaxe no teste: $f"
        exit 1
    }
done
echo "✅ Sintaxe JS íntegra em todos os arquivos de src/ e tests/."

# 2. Verificação do PROGRESS.md (Diretriz Global Enxuta)
echo "📋 [2/3] Verificando integridade do PROGRESS.md..."
if [ ! -f "PROGRESS.md" ]; then
    echo "❌ [ERRO] Arquivo PROGRESS.md não encontrado!"
    exit 1
fi

PROGRESS_SIZE=$(stat -c%s PROGRESS.md 2>/dev/null || stat -f%z PROGRESS.md)
if [ "$PROGRESS_SIZE" -gt 35000 ]; then
    echo "⚠️ [AVISO] PROGRESS.md está muito grande ($PROGRESS_SIZE bytes). Limite recomendado: ~10 KB."
fi
echo "✅ PROGRESS.md presente e válido."

# 3. Execução dos Testes Automatizados com SQLite Nativo
echo "🚀 [3/3] Executando suíte automatizada de testes do Radar..."
NODE_ENV=test node --experimental-sqlite --test --test-concurrency=1 tests/**/*.test.js

echo "🎉 [VALIDATE] Sucesso absoluto! Todos os gates de validação foram aprovados com 100% de sucesso!"
exit 0
