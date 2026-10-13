# 🚀 Progresso do Projeto: Radar de Voos (v2.9.1)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.9.1 100% operacional com 191/191 testes JS e 10/10 testes Python aprovados. Sprint QA Adversarial concluído: 5 bugs críticos corrigidos nos providers de voo (parsing monetário, precisão de duração, sufixos corporativos e regex da aba Cheapest) com 34 novos testes adversariais adicionados.
- **Diretriz Prioritária**: Implementar caçador proativo de Bug Fares (`proactive-agent`) com Working Buffer de 24h, deduplicação de alertas e Z-Score estatístico, e adicionar sparklines de histórico tarifário no Cockpit PWA.
- **Última Tarefa Concluída**: `src/services/providers/google_flights_direct_provider.js` + `scrapling_client.js` — Sprint QA Adversarial — Corrigidos 5 bugs: `extrairPrecoNumerico("0")→null`, `converterDuracaoParaHoras` com precisão `toFixed(3)` + suporte `2h30m`, `limparNomeCompanhia` com sufixos corporativos e `"Múltiplas Companhias"`, `extrairPrecoCheapestTab` tolerante a espaços e formato compacto `[null,N]` (191/191 verdes).

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/services/bug_fare_hunter.js`
- **Função/Componente/Seletor**: `escanearCorredoresProativos`
- **Comportamento Esperado / Critério de Aceite**: Integrar padrão `proactive-agent` com Working Buffer em memória de 24h por rota, deduplicação defensiva de alertas idênticos dentro da janela, cálculo de Z-Score sobre série histórica de tarifas e classificação estrita em `INFO` (sem alerta) → `OPORTUNIDADE` (queda >30%) → `BUG_FARE` (Z-score < -2.5).

---

## 📋 Backlog Prioritário
- [ ] `src/services/bug_fare_hunter.js` • `escanearCorredoresProativos` • Integrar padrão `proactive-agent` com Working Buffer de 24h, deduplicação de alertas e Z-score estatístico proativo.
- [ ] `src/public/app.js` • `renderizarRotas` • Adicionar ordenação rápida por maior economia em relação ao teto e sparklines em SVG puro ultraleve (`smart-charts`).
- [ ] `src/services/flight_scanner.js` • `executarCicloVarredura` • Implementar detecção de deltas com threshold de Z-Score e supressão de ruído para oscilações normais de mercado.
- [ ] `src/services/providers/scrapling_client.js` • `extrairPrecoCheapestTab` • Adicionar 4ª camada de extração via decode base64url do parâmetro `tfu` da URL de resposta para capturar preços em respostas AJAX sem corpo HTML.

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Integração com API de milhas (Smiles, LATAM Pass, TudoAzul) para cálculo de paridade pontos vs reais.
2. Visualização de rotas com arcos ortodrômicos geodésicos SVG (`remotion-maps`) no Cockpit PWA.
3. Notificação Push nativa no navegador (Web Push API com VAPID).
4. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.
5. Gráfico de dispersão de preços históricos por época do ano no Cockpit PWA.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
