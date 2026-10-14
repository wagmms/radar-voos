# 🚀 Progresso do Projeto: Radar de Voos (v3.5.1)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Auditoria de Resiliência e Correção dos 4 Bugs Críticos concluída com 100% de aprovação (438/438 testes passando no `./validate.sh fast`). Rotas de Ida e Volta agora possuem round-trip garantido nos links e no scanner, cotações espúrias no teto da meta eliminadas, badge flexível sem `()` vazio e subtítulos precisos no Cockpit PWA.
- **Camadas Entregues & Verificadas**:
  - `src/domain/rotas.js`: `rotaEhSoIda` e `obterDatasEfetivasRota` com cálculo automático de `data_volta` via `dias_estadia` e `somarDiasData` para rotas sem marcação explícita de só-ida.
  - `src/services/flight_scanner.js`: desvinculação de `maxPrice: rota.preco_alvo` dos filtros Protobuf `tfs` do Google Flights (eliminando leitura de sliders no teto), varreduras flexíveis e regionais com datas de volta reais, links round-trip no Telegram e eliminação de rótulo vazio no termômetro.
  - `src/db.js`: `rotasRepo.criar` e `atualizar` blindados contra links one-way em rotas de Ida e Volta; método `rotasRepo.sanitizarRotasIdaEVolta` na inicialização para expurgar cotações espúrias pré-existentes.
  - `src/public/js/card_rota.js`: sanitização regex contra `()` vazios, helpers `ehRotaSoIdaVisual` e `calcularDataVoltaSegura` e subtítulo `periodoTexto` exibindo intervalo completo de Ida e Volta (`data_ida ➔ data_volta (${dias}d)`).
  - **Suíte de Testes**: 438/438 testes aprovados (100% de sucesso).
- **Diretriz Prioritária**: Implementar telemetria em tempo real com Server-Sent Events (SSE) e sparkline SVG de histórico no Cockpit PWA.
- **Última Tarefa Concluída**: Bugfix & Auditoria de Resiliência: Round-Trip Obrigatório, Eliminação de Cotações Espúrias no Teto e Correção de Subtítulos no Cockpit PWA.

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
