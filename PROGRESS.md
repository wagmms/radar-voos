# 🚀 Progresso do Projeto: Radar de Voos (v3.6.0)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Modernização de Scraping e Resiliência via Gemini 4 Argon concluída com 100% de aprovação (443/443 testes passando no `./validate.sh fast`). Links do Google Flights protegidos com RFC 4648 §5 base64url e resolução de hubs físicos, curto-circuito da SerpAPI preservando 100% da cota mensal, parser SSR `script.ds:1` robusto e Caçador de Bug Fares integrado ao Scrapling.
- **Camadas Entregues & Verificadas**:
  - `src/domain/rotas.js`: migração de `gerarTfs` e `construirTfu` para RFC 4648 §5 base64url (`-`, `_`), resolução canônica de hubs físicos (`resolverHubFisico`) evitando injeção de nomes regionais no Protobuf, e link canônico Cheapest com token canônico `EgoIABAAGAAgAigD`.
  - `src/services/providers/provider_manager.js`: curto-circuito em `FlightProviderManager` quando o scraping gratuito obtém ofertas válidas com preço, isolando a SerpAPI estritamente como failover de contingência (zero desperdício de cota).
  - `src/services/providers/scrapling_client.js`: parser resiliente para `script.ds:1` com `extrairArrayPayloadDs1`, extração de ofertas Cheapest em slots alternativos de `k[1]`, detecção de aeroportos e companhia aérea nos trechos, e eliminação de regex que capturava `$100` minificado.
  - `src/services/bug_fare_hunter.js`: migrado para `ScraplingProvider` com suporte a TLS Impersonation via `primp`, corredores continentais mapeados para IATAs reais e captura de cia aérea e destino real nos cards.
  - **Suíte de Testes**: 443/443 testes aprovados (100% de sucesso).
- **Diretriz Prioritária**: Implementar telemetria em tempo real com Server-Sent Events (SSE) e sparkline SVG de histórico no Cockpit PWA.
- **Última Tarefa Concluída**: Modernização de Scraping e Resiliência pelo Gemini 4 Argon: Links Seguros base64url, Curto-Circuito SerpAPI e Caçador de Bug Fares com Scrapling.

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
