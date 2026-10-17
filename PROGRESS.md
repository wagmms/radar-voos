# 🚀 Progresso do Projeto: Radar de Voos (v3.9.0)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 **Arquitetura de Detecção Ultrarrápida Entregue e Validada em Produção (v3.9.0)!** Implementado o agendador multi-tier com 3 pistas desacopladas (Feeds RSS a cada 3 min, Scanner LRU em micro-lotes a cada 8 min e Hunter de corredores a cada 15 min), 8 Super-Clusters continentais multi-IATA cobrindo mais de 35 aeroportos mundiais com rotação de 30 min (queda drástica de 27h para 30 min) e executor com concorrência controlada $N=2$ e stagger defensivo (300ms) reduzindo o tempo de resposta em rotas flexíveis em ~45%. Suíte 100% verde com **485/485 testes aprovados** no `./validate.sh fast`. Deploy ativo no Render e notificação confirmada no Telegram IA HUB.
- **Camadas Entregues & Verificadas**:
  - `src/services/scheduler.js`: Agendador com 3 timers independentes e flags de concorrência (`executandoFeeds`, `executandoHunter`, `executandoScanner`), eliminando filas bloqueantes.
  - `src/config.js` & `.env`: `SCAN_INTERVAL_MINUTES` calibrado para 8 min com suporte a `FEEDS_INTERVAL_MINUTES` (3 min) e `HUNTER_INTERVAL_MINUTES` (15 min).
  - `src/services/bug_fare_hunter.js`: 8 Super-Clusters Macro cobrindo Europa, EUA, América do Sul, Caribe, Ásia e Oriente Médio.
  - `src/services/flight_scanner.js`: Função utilitária `executarComConcorrenciaLimitada` ($N=2$ com stagger) integrada nas buscas de `hubsDestino`, `janelas` (`sem_data`) e `paresJanela` (`diasFlex`).
  - `tests/scheduler_performance.test.js`: 5 testes automatizados cobrindo paralelismo, tolerância a falhas e gerenciamento de timers.
- **Diretriz Prioritária**: Implementar a matriz de datas flexíveis (`search_dates`) e expor servidor MCP nativo do RadarVoos.
- **Última Tarefa Concluída**: feat(speed): arquitetura multi-tier, super-clusters multi-iata e concorrência N=2 para detecção ultrarrápida.

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
