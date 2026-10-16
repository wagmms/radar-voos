# 🚀 Progresso do Projeto: Radar de Voos (v3.6.1)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Segunda Rodada de Otimização via Gemini 4 Argon concluída com 100% de aprovação (443/443 testes passando no `./validate.sh fast`). Transações atômicas `BEGIN IMMEDIATE` no SQLite, eliminação do ponto cego na janela flexível, separação cirúrgica entre avaliação e gravação física de alertas no Telegram, blindagem cambial multi-moeda (EUR, USD, GBP) e resiliência a rate limit com AbortSignal.
- **Camadas Entregues & Verificadas**:
  - `src/db.js`: `alertasRepo.deveDisparar` com suporte a `options.apenasAvaliar` e normalização case-insensitive de `nivelPreco`; transações imediatas e deduplicação de histórico de preços idênticos (< 6h) em `rotasRepo.atualizarResultadoChecagem` para preservar o Z-Score.
  - `src/services/flight_scanner.js`: varredura de dias flexíveis vizinhos mesmo se a data central falhar nos filtros; persistência do disparo em `alertas_disparados` delegada para após confirmação HTTP do Telegram, prevenindo perda silenciosa de oportunidades.
  - `src/services/providers/scrapling_client.js`: conversão de moedas estrangeiras (EUR, USD, GBP) para BRL em `extrairVoosDoPayloadJs`, eliminando disparos espúrios de Bug Fare por descompasso cambial.
  - `src/services/notifier_telegram.js`: inclusão de timeouts com `AbortSignal.timeout(10000)` e limitação estrita de 3 retries em HTTP 429 com teto de 30s.
  - **Suíte de Testes**: 443/443 testes aprovados (100% de sucesso).
- **Diretriz Prioritária**: Implementar telemetria em tempo real com Server-Sent Events (SSE) e sparkline SVG de histórico no Cockpit PWA.
- **Última Tarefa Concluída**: Segunda Rodada de Otimização pelo Gemini 4 Argon: Transações Atômicas SQLite, Ponto Cego Flexível, Blindagem Cambial Multi-Moeda e Resiliência HTTP Telegram.

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/public/js/card_rota.js` & `src/server/routes/monitor_routes.js`
- **Função/Componente/Seletor**: `renderizarSparklineSvg` e rota `/api/stream/telemetria`
- **Comportamento Esperado / Critério de Aceite**: Desenhar sparkline em SVG puro para o histórico de preços dos últimos 10 checks na rota e transmitir eventos SSE para atualização em tempo real sem reload manual.

---

## 📋 Backlog Prioritário
- [ ] `src/public/js/card_rota.js` • `renderizarSparklineSvg` • Desenhar sparkline em SVG puro para o histórico de preços dos últimos 10 checks na rota.
- [ ] `src/server/routes/monitor_routes.js` • Rota `/api/stream/telemetria` • Transmitir eventos SSE em tempo real para atualização automática dos cards no Cockpit PWA sem reload manual.
- [ ] `src/public/sw.js` • Service Worker Push • Adicionar handler de notificações Web Push nativas para alertar oportunidades e bug fares com o app fechado.

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Visualização de rotas com arcos ortodrômicos geodésicos SVG (`remotion-maps`).
2. Notificação Push nativa no navegador (Web Push API com VAPID).
3. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.
4. Gráfico de dispersão de preços históricos por época do ano (`smart-charts`).
5. Exportação de dados de histórico tarifário em formato CSV/JSON via API.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
