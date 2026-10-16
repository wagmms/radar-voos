# 🚀 Progresso do Projeto: Radar de Voos (v3.8.0)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 **Auditoria Gemini 4 Argon Concluída com Sucesso!** Identificada e eliminada a causa raiz da divergência de preços exibidos no PWA vs Google Flights: split-brain de dados do Render efêmero resolvido com persistência de snapshot completo em `data/rotas.json`, restauração atômica no boot do SQLite em `src/db.js`, injeção obrigatória de `Cache-Control: no-store` nas rotas da API (`src/server/app.js`), desativação de fallback defasado e elevação do Service Worker para `v3.6.0` (`src/public/sw.js`). Preços aferidos em tempo real: Belém R$ 1.012, Ribeirão Preto R$ 580, Lima R$ 954. 467/467 testes aprovados (100% verde no `./validate.sh fast`).
- **Camadas Entregues & Verificadas**:
  - `src/services/rotas_sync.js`: `salvarArquivoRotas` com persistência de snapshot (`preco_atual`, `ranking_destinos_regionais`, `top_ofertas`, `ultima_checagem`).
  - `src/db.js`: `rotasRepo.criar` com suporte a restauração imediata de campos de preço e metadados no boot inicial do banco.
  - `src/server/app.js`: Hook `onSend` com headers `no-store, no-cache, must-revalidate` para todas as requisições `/api/`.
  - `src/public/app.js`: `fetch('/api/rotas')` com cache `no-store` e query param `_t` anti-cache.
  - `src/public/sw.js`: Versão elevada para `v3.6.0` com Network-First estrito para `/api/` e purga imediata de caches legados.
  - `data/rotas.json`: Sincronizado com os preços reais consolidados das 4 rotas canônicas.
- **Diretriz Prioritária**: Implementar a matriz de datas flexíveis (`search_dates`) e expor servidor MCP nativo do RadarVoos.
- **Última Tarefa Concluída**: Resolução arquitetural definitiva da persistência de preços pós-reboot e invalidação de cache no Cockpit PWA via Gemini 4 Argon.

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
