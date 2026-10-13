# 🚀 Progresso do Projeto: Radar de Voos (v2.9.3)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.9.3 100% operacional com 204/204 testes JS e 10/10 testes Python aprovados. Alertas de nova queda no mesmo dia (> 5% de melhoria) liberados e deduplicação inteligente de mesmo valor implementada em `db.js`, `flight_scanner.js` e `bug_fare_hunter.js`.
- **Diretriz Prioritária**: Adicionar sparklines de histórico tarifário no Cockpit PWA e implementar detecção de deltas com Z-Score no FlightScanner (varredura de rotas monitoradas).
- **Última Tarefa Concluída**: `src/db.js` · `alertasRepo` & `src/services/flight_scanner.js` · Fim do bloqueio cego temporal: quedas de preço comprovadas no mesmo dia (> 5% em relação ao último alerta) disparam novas notificações imediatamente; enquanto mesmo valor a cada minuto é suprimido silenciosamente. 2 novos testes (204/204 verdes).

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
