# 🚀 Progresso do Projeto: Radar de Voos (v3.8.1)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 **Sincronização Atômica de Calendário Flexível e Alinhamento R$ 1.009 no Ar (v3.8.1)!** Auditoria Gemini 4 Argon implementou `sanitizarPayloadPosBrasil` reconciliando compulsoriamente os objetos acessórios da rota (offset 0 do calendário, eliminação de falso callout de dia vizinho mais barato e supressão de ofertas contaminadas). O preço de Rio de Janeiro ➔ Belém foi alinhado ao Google Flights em R$ 1.009 (Gol G3 2006 direto). Suíte completa com 480/480 testes aprovados (100% verde no `./validate.sh fast`). Deploy ativo no Render e notificação confirmada no Telegram IA HUB.
- **Camadas Entregues & Verificadas**:
  - `src/domain/pos_guard.js`: Função `sanitizarPayloadPosBrasil` com reconciliação estrita de calendário e melhor opção flexível contra o preço auditado.
  - `src/db.js`: `atualizarResultadoChecagem` integrado com saneamento atômico e reconciliação retroativa no boot do SQLite.
  - `src/public/js/card_rota.js`: `renderizarGraficoCalendarioSvg` forçando offset 0 igual ao preço auditado da rota; `renderizarCalloutDataAlternativa` suprimido quando preço do vizinho for maior ou igual ao preço base.
  - `data/rotas.json`: Rio de Janeiro ➔ Belém atualizado com tarifa de R$ 1.009 e calendário coerente.
  - `src/public/sw.js`: Bump para `radar-voos-v3.8.1` para purga imediata de cache nos navegadores.
  - `tests/pos_guard_calendario_sync.test.js`: 4 novos testes cobrindo saneamento de payload e renderização do cockpit.
- **Diretriz Prioritária**: Implementar a matriz de datas flexíveis (`search_dates`) e expor servidor MCP nativo do RadarVoos.
- **Última Tarefa Concluída**: feat(pos): sincronizar atomicamente calendário flexível, callouts e R$ 1.009 para Rio-Belém via Gemini 4 Argon.

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
