# 🚀 Progresso do Projeto: Radar de Voos (v3.5.0)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Motor de Exploração Multi-Hub por Região/Continente implementado com catálogo canônico (`EUR`, `SAM`, `NEB`, `USA`, `CAR`, `SAO`), varredura automatizada dos hubs, ranking de menores tarifas em R$, fallback seguro no Protobuf `tfs`, exibição no Cockpit PWA e alertas no Telegram, com 429/429 testes aprovados (100% de sucesso).
- **Camadas Entregues & Verificadas**:
  - `src/domain/dicionarios.js` & `src/domain/rotas.js`: Catálogo `REGIOES_HUBS_IATA` com múltiplos hubs por continente/região, helpers `ehCodigoRegional` e `expandirDestinoOuOrigemRegional`, catálogo `CODIGOS_IATA_CONHECIDOS`, mapa de nomes `NOMES_CIDADES_IATA`, resolução canônica em `resolverCodigoIata` e guardrail de fallback para o 1º hub físico no Protobuf `gerarTfs`.
  - `src/services/flight_scanner.js`: Varredura multi-hub com isolamento `try/catch` por aeroporto, controle de rate-limit (apenas data base `offset === 0` por hub), consolidação do `rankingDestinosRegionais` ordenado por menor preço em R$ e eleição do hub vencedor com voo real no `linkCanonicoRota`.
  - `src/db.js` & `src/server/routes/rotas_routes.js`: Coluna `ranking_destinos_regionais TEXT` persistida no SQLite via migração idempotente `ALTER TABLE` e desserializada com `safeJsonParse` nas rotas Fastify.
  - `src/public/js/card_rota.js` & `src/services/notifier_telegram.js`: Renderização de destaque do vencedor e mini-ranking (top 3 a 5) com links seguros (`ehUrlSegura`) e blindagem XSS estrita no Cockpit PWA e no Telegram.
  - **Suíte de Testes**: 429/429 testes aprovados (100% de sucesso no `./validate.sh fast`).
- **Diretriz Prioritária**: Implementar telemetria em tempo real com Server-Sent Events (SSE) e sparkline SVG de histórico no Cockpit PWA.
- **Última Tarefa Concluída**: Motor de Exploração Multi-Hub por Região/Continente (Multi-Airport Routing) com ranking de tarifas e guardrail Protobuf.

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
