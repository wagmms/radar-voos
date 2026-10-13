# 🚀 Progresso do Projeto: Radar de Voos (v2.8.2)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.8.2 100% operacional com 123/123 testes JS e 10/10 testes Python aprovados. Restaurada com sucesso a busca continental abrangente de macrorregiões com KGMIDs (`/m/06_1`, `/m/02j9z`, `/m/02j1x`, `/m/09c7w0`), garantindo que o Radar busque em todos os países da região e resolva dinamicamente o aeroporto concreto pousado nos alertas e links.
- **Diretriz Prioritária**: Desenvolver o motor de scraping resiliente (`scrapling`) para captura de tarifas da aba Cheapest e caçador proativo de Bug Fares (`proactive-agent`) com alertas por exceção e Z-Score estatístico.
- **Última Tarefa Concluída**: Restauração de KGMIDs em `data/rotas.json`, calibração de `resolverCodigoParaLink` e `gerarLinkGoogleFlightsCheapest` em `src/domain/rotas.js`, priorização de `codigoDestinoReal` em `src/domain/aeroportos.js`, enriquecimento de corredores em `bug_fare_hunter.js`, sanitização de gradientes SVG e coordenadas climáticas de macrorregiões (123 testes 100% verdes).

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/services/providers/scrapling_client.js`
- **Função/Componente/Seletor**: `obterTarifasGoogleFlights`
- **Comportamento Esperado / Critério de Aceite**: Criar adaptador de scraping resiliente baseado no padrão da skill `scrapling` com evasão de detecção de bots, cabeçalhos HTTP realistas e extração de tarifas da aba "Cheapest" via Protobuf `tfs`, integrando com failover defensivo para os provedores existentes.

---

## 📋 Backlog Prioritário
- [ ] `src/services/providers/scrapling_client.js` • `obterTarifasGoogleFlights` • Adaptador de scraping resiliente com cabeçalhos dinâmicos e parsing da aba Cheapest via Protobuf tfs.
- [ ] `src/services/bug_fare_hunter.js` • `escanearCorredoresProativos` • Integrar padrão `proactive-agent` com Working Buffer de 24h, deduplicação de alertas e Z-score estatístico proativo.
- [ ] `src/public/app.js` • `renderizarRotas` • Adicionar ordenação rápida por maior economia em relação ao teto e sparklines em SVG puro ultraleve (`smart-charts`).
- [ ] `src/services/flight_scanner.js` • `executarCicloVarredura` • Implementar detecção de deltas com threshold de Z-Score e supressão de ruído para oscilações normais de mercado.

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Integração com API de milhas (Smiles, LATAM Pass, TudoAzul) para cálculo de paridade pontos vs reais.
2. Visualização de rotas com arcos ortodrômicos geodésicos SVG (`remotion-maps`) no Cockpit PWA.
3. Notificação Push nativa no navegador (Web Push API com VAPID).
4. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.
5. Gráfico de dispersão de preços históricos por época do ano no Cockpit PWA.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
