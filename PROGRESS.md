# 🚀 Progresso do Projeto: Radar de Voos (v3.9.2)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 **Super-Clusters SAO e Destaque Estelar do Menor Preço Entregues e Validados (v3.9.2)!** Todos os 8 Super-Clusters continentais multi-IATA foram migrados exclusivamente para a origem São Paulo (`SAO`), eliminando rotas com saída do Rio de Janeiro. No frontend, o componente `card_rota.js` foi blindado para calcular `menorPrecoEfetivo = Math.min(precoAtual, menorHist)`, assegurando que o menor preço comprovado (ex: Madri R$ 3.579 e Lima R$ 954) seja o número estelar gigante em destaque e sincronizado com o 1º colocado do ranking regional, com supressão de dias vizinhos mais caros e fallback defensivo `Último check: R$ ...`. Suíte 100% verde com **487/487 testes aprovados** no `./validate.sh fast`.
- **Camadas Entregues & Verificadas**:
  - `src/services/bug_fare_hunter.js`: 8 Super-Clusters multi-IATA com `origem: 'SAO'`.
  - `src/public/js/card_rota.js`: Cálculo de `menorPrecoEfetivo`, `precoDestaque` no ranking regional e callout de dias alternativos.
  - `src/db.js`: Reconciliação retroativa no boot para Madri (R$ 3.579) e Lima (R$ 954).
  - `src/public/sw.js`: Versão de cache atualizada para `radar-voos-v3.9.2`.
  - `tests/card_rota.test.js`: Cobertura automatizada para ranking sincronizado e menor preço estelar.
- **Diretriz Prioritária**: Implementar a matriz de datas flexíveis (`search_dates`) e expor servidor MCP nativo do RadarVoos.
- **Última Tarefa Concluída**: feat(cockpit): super-clusters SAO exclusivos e menor preco historico comprovado em destaque estelar.

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
