# 🚀 Progresso do Projeto: Radar de Voos (v3.6.2)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Blindagem Doméstica 100% BRL e Eliminação de Distorção Cambial na rota Rio ➔ Belém concluída com sucesso via Gemini 4 Argon. 100% de aprovação (443/443 testes passando no `./validate.sh fast`). O radar capturou com exatidão a tarifa real de R$ 1.727 da Azul (eliminando a inflação indevida de > R$ 2.000 gerada por contaminação de EUR).
- **Camadas Entregues & Verificadas**:
  - `src/domain/rotas.js`: catálogo `CODIGOS_AEROPORTOS_BRASIL` (43 aeroportos), função `ehRotaDomesticaBrasil` e forçamento estrito de `curr=BRL` nos geradores de links do Google Flights.
  - `src/services/flight_scanner.js`: verificação de rotas domésticas em `escanearRota` e `atualizarResultadoChecagem` cravando `moedaEfetiva = 'BRL'`.
  - `src/services/providers/scrapling_client.js`: `construirUrlCheapest` com blindagem para rotas nacionais.
  - `src/db.js`: sanitização automática na inicialização para recuperar rotas contaminadas e guardrails em `criar` e `atualizar`.
  - **Suíte de Testes**: 443/443 testes aprovados (100% de sucesso).
- **Diretriz Prioritária**: Implementar telemetria em tempo real com Server-Sent Events (SSE) e sparkline SVG de histórico no Cockpit PWA.
- **Última Tarefa Concluída**: Blindagem Doméstica 100% BRL e Eliminação de Distorção Cambial na Rota Rio ➔ Belém via Gemini 4 Argon.

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
