# 🚀 Progresso do Projeto: Radar de Voos (v3.9.3)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 **Redesign do Modo Flexível e Duração de Viagem em Dias Entregues (v3.9.3)!** O modo flexível foi reformulado: campos de datas fixas (`Data de Ida` e `Data de Volta`) e seletor `±dias` são completamente ocultados quando o modo flexível está ativo, eliminando confusões e datas aleatórias/fantasmas no formulário. Adicionado bloco dedicado com input numérico de **Duração da Viagem no Destino (dias)** com pills de atalho direto (7, 10, 14, 21, 30 dias). No backend (`rotas_routes.js`) e no scanner (`flight_scanner.js`), `dias_estadia` agora é persistido compulsoriamente no SQLite e respeitado com prioridade máxima, sem mais resetar para 10 dias. Suíte 100% verde com **488/488 testes aprovados** no `./validate.sh fast`.
- **Camadas Entregues & Verificadas**:
  - `src/public/index.html`: Novo design do bloco flexível Aero Dark com input de estadia e pills de atalho.
  - `src/public/app.js`: Sincronização dinâmica de formulário, limpeza de datas fantasmas e salvamento de `dias_estadia`.
  - `src/server/routes/rotas_routes.js`: Extração e persistência estrita de `dias_estadia` no POST e PUT.
  - `src/services/flight_scanner.js`: Scanner prioriza `rota.dias_estadia` para janelas de ida e volta.
  - `src/public/sw.js`: Bump para `radar-voos-v3.9.3`.
  - `tests/routes.test.js`: Teste automatizado de persistência de `dias_estadia` (14 e 21 dias).
- **Diretriz Prioritária**: Implementar a matriz de datas flexíveis (`search_dates`) e expor servidor MCP nativo do RadarVoos.
- **Última Tarefa Concluída**: feat(cockpit): redesign do modo flexivel com duracao em dias e eliminacao de datas aleatorias.

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
