# 🚀 Progresso do Projeto: Radar de Voos (v3.4.0)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Termômetro de Preços nativo (`priceInsights`), Janela de Datas Flexíveis (`dias_flexiveis`), Dica de Data Alternativa (`melhorDataAlternativa`) e Mini-Gráfico SVG acessível (`calendarioPrecos`) implementados no Cockpit PWA e no Telegram com 411/411 testes aprovados (100% de sucesso).
- **Camadas Entregues & Verificadas**:
  - `src/services/flight_scanner.js`: Propagação integrada de `priceInsights` e `melhorDataAlternativa` ao notificador do Telegram.
  - `src/services/notifier_telegram.js`: Renderização de badges do termômetro com faixa típica, callout de dia vizinho mais barato com economia em R$, botão inline e sanitização restrita contra injeção de links maliciosos (`ehUrlSegura`).
  - `src/public/index.html` & `src/public/app.js`: Seletor de flexibilidade de datas (0 a 3 dias) com blindagem de falsy (`dias_flexiveis === 0`) e estilização Aero Dark Mode.
  - `src/public/js/card_rota.js`: Compatibilidade dual snake_case/camelCase, badges de termômetro e janela flexível, callout de economia e helper puro `renderizarGraficoCalendarioSvg` com imunidade matemática a divisão por zero e datas formatadas sem recuo de fuso horário (`DD/MM`).
  - **Suíte de Testes**: 411/411 testes aprovados (100% de sucesso no `./validate.sh fast`).
- **Diretriz Prioritária**: Implementar telemetria em tempo real com Server-Sent Events (SSE) e sparkline SVG de histórico no Cockpit PWA.
- **Última Tarefa Concluída**: Turno 4B — Cockpit PWA (seletor flexível, badges, callout e gráfico SVG acessível sem NaN) e Notifier Telegram (termômetro e dia vizinho com blindagem anti-XSS e fuso-imune).

---

## 🎯 Próxima Tarefa em Andamento (Turno 4C)
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
