# 🚀 Progresso do Projeto: Radar de Voos (v2.9.2)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.9.2 100% operacional com 202/202 testes JS e 10/10 testes Python aprovados. Sprint atual: `escanearCorredoresProativos` com Working Buffer em memória, Z-Score e deduplicação de 24h implementados e validados (11 novos testes).
- **Diretriz Prioritária**: Adicionar sparklines de histórico tarifário no Cockpit PWA e implementar detecção de deltas com Z-Score no FlightScanner (varredura de rotas monitoradas).
- **Última Tarefa Concluída**: `src/services/bug_fare_hunter.js` · `escanearCorredoresProativos` · Working Buffer em memória com janela deslizante de 5 leituras, Z-Score < -2.5 → BUG_FARE / < -1.5 → OPORTUNIDADE / queda > 30% → OPORTUNIDADE / INFO silencioso. Deduplicação defensiva de 24h. Retrocompatibilidade via alias. 11 novos testes (202/202 verdes).

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/public/app.js`
- **Função/Componente/Seletor**: `renderizarRotas` (função que monta os cards de rota no Cockpit PWA)
- **Comportamento Esperado / Critério de Aceite**: Adicionar sparkline SVG puro ultraleve (5–10 pontos do histórico de preços) em cada card de rota, exibindo a curva temporal de preço com marcação do ponto mínimo; e ordenação rápida por maior economia percentual em relação ao preço alvo/teto. Deve funcionar offline (dados cacheados) e não adicionar nenhuma dependência externa de biblioteca de gráficos.

---

## 📋 Backlog Prioritário
- [ ] `src/services/flight_scanner.js` • `executarCicloVarredura` • Integrar detecção de deltas com Z-Score (via `rotasRepo.obterEstatisticasPreco`) e supressão de ruído para oscilações normais de mercado nas rotas monitoradas.
- [ ] `src/services/providers/scrapling_client.js` • `extrairPrecoCheapestTab` • Adicionar 4ª camada de extração via decode base64url do parâmetro `tfu` da URL de resposta para capturar preços em respostas AJAX sem corpo HTML.
- [ ] `src/services/bug_fare_hunter.js` • `escanearCorredoresProativos` • Persistir Working Buffer em `data/working_buffer.json` para sobreviver a reinicializações do processo (volatilidade zero após restart).
- [ ] `src/public/app.js` • `renderizarRotas` • Sparklines SVG puro + ordenação por economia no Cockpit PWA (`smart-charts`).

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Integração com API de milhas (Smiles, LATAM Pass, TudoAzul) para cálculo de paridade pontos vs reais.
2. Visualização de rotas com arcos ortodrômicos geodésicos SVG (`remotion-maps`) no Cockpit PWA.
3. Notificação Push nativa no navegador (Web Push API com VAPID).
4. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.
5. Gráfico de dispersão de preços históricos por época do ano no Cockpit PWA.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
