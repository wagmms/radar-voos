# 🚀 Progresso do Projeto: Radar de Voos (v3.8.0)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 **Etapas 1, 2 e 3 Concluídas com Sucesso!** Paridade total de engenharia reversa com `fast_flights` e `fli-js`. Parser JSPB robusto contra Sparse Times (`[8]`, `[null, 31]`), encoder Protobuf `tfs` com blindagem contra auto-transferência (`hideSeparateAndSelfTransfer = true`), exclusão de Basic Economy, fingerprint stealth Chrome 145, e alertas ricos no Telegram e PWA com aeronaves, dias extras (`+1d`) e CO₂. 100% de aprovação (467/467 testes passando no `./validate.sh fast`).
- **Camadas Entregues & Verificadas**:
  - `src/services/providers/scrapling_client.js`: `extrairHoraMinutoTrecho`, `formatarHorarioTrecho`, `formatarDataTrecho`, `calcularDiasExtrasChegada`, `extrairEmissoesCarbono` e `calcularTempoConexaoTrechos`.
  - `src/domain/rotas.js`: `ehRotaIntercontinental`, padrão defensivo `hideSeparateAndSelfTransfer = true`, `excludeBasicEconomy` e `Baggage`.
  - `src/services/providers/google_flights_direct_provider.js`: `USER_AGENTS_STEALTH` Chrome 145 e suporte a `opcoesAvancadas`.
  - `src/services/notifier_telegram.js`: `formatarSufixoDiasExtras` e `formatarMetadadosVooTelegram` integrados aos alertas.
  - `src/public/js/card_rota.js`: Renderização de `+1d` e modelo de aeronave no card do PWA.
  - `src/domain/bug_fares.js`: `ehAeronaveWidebody` e bônus de Widebody em rotas sul-americanas/domésticas.
  - **Suíte de Testes**: 467/467 testes aprovados (100% de sucesso em 64 suítes).
- **Diretriz Prioritária**: Implementar a matriz de datas flexíveis (`search_dates`) e expor servidor MCP nativo do RadarVoos.
- **Última Tarefa Concluída**: Implementação completa das Etapas 1, 2 e 3 de engenharia reversa do Google Flights com 467 testes automatizados aprovados.

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
