# 🚀 Progresso do Projeto: Radar de Voos (v3.8.0)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 **Blindagem de Point of Sale Brasil (POS-Guard) Entregue e Validada em Produção (v3.8.0)!** Implementado o módulo `pos_guard.js` com detecção de ágio internacional e rejeição de moedas estrangeiras, sincronização soberana no boot, normalização compulsória de links de saída do Google Flights com `hl=pt-BR&gl=BR&curr=BRL` e selo visual `🇧🇷 Tarifa Brasil` em todos os cards do Cockpit PWA. Suíte 100% verde com 476/476 testes aprovados. Deploy ativo no Render e notificação confirmada no Telegram IA HUB.
- **Camadas Entregues & Verificadas**:
  - `src/domain/pos_guard.js`: Validador canônico de Point of Sale (POS-Brasil), rejeição de sobretaxas de IP estrangeiro (1.18x-1.35x) e normalização de URLs.
  - `src/db.js`: `atualizarResultadoChecagem` com auditoria POS-Guard antes da persistência.
  - `src/services/rotas_sync.js`: Sincronização soberana do catálogo corrigindo o SQLite no boot.
  - `src/public/js/card_rota.js` & `index.html`: Badge `🇧🇷 Tarifa Brasil` com design aero minimalista.
  - `src/public/sw.js`: Service Worker v3.8.0 com purga imediata de caches legados.
- **Diretriz Prioritária**: Implementar a matriz de datas flexíveis (`search_dates`) e expor servidor MCP nativo do RadarVoos.
- **Última Tarefa Concluída**: feat(pos): blindagem definitiva de Point of Sale Brasil (POS-Guard), selo visual no cockpit PWA e deploy em produção no Render.

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/services/providers/google_flights_direct_provider.js`
- **Função/Componente/Seletor**: `buscarMatrizDatasFlexiveis`
- **Comportamento Esperado / Critério de Aceite**: Implementar endpoint/método de busca em matriz de calendário (`search_dates`), permitindo escanear o menor preço de até 60 dias em 1 único request HTTP.

---

## 📋 Backlog Prioritário
- [ ] `src/services/providers/google_flights_direct_provider.js` • `buscarMatrizDatasFlexiveis` • Implementar busca de menor tarifa por dia em janela de 30-60 dias em 1 único request HTTP.
- [ ] `src/server/routes/mcp.js` • `registrarServidorMcpRadarVoos` • Expor servidor MCP nativo com tools `search_flights`, `get_price_history` e `create_watch_rule`.
- [ ] `src/public/js/card_rota.js` • `renderizarSparklineSvg` • Desenhar sparkline em SVG puro para o histórico de preços dos últimos 10 checks na rota.

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Visualização de rotas com arcos ortodrômicos geodésicos SVG (`remotion-maps`).
2. Notificação Push nativa no navegador (Web Push API com VAPID).
3. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.
4. Gráfico de dispersão de preços históricos por época do ano (`smart-charts`).
5. Exportação de dados de histórico tarifário em formato CSV/JSON via API.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
