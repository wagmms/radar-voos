# 🚀 Progresso do Projeto: Radar de Voos (v2.7.9)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.7.9 100% operacional com 114/114 testes passando. Blindados links do Google Flights com resolução canônica de destinos (eliminando links que caem na home), alertas de Bug Fares enriquecidos obrigatoriamente com aeroporto IATA de chegada, país e datas completas da viagem, e cálculo de economia percentual em relação ao teto no Telegram.
- **Diretriz Prioritária**: Desenvolver o motor de scraping resiliente (`scrapling`) para captura de tarifas da aba Cheapest e caçador proativo de Bug Fares (`proactive-agent`) com alertas por exceção e Z-Score estatístico.
- **Última Tarefa Concluída**: Blindagem de links do Google Flights via Protobuf `tfs` e `returning` canônico; criação do módulo `src/domain/aeroportos.js` com catálogo e `resolverDestinoConcreto()`; migrações SQLite na tabela `bug_fares` para aeroporto de chegada, país e datas; enriquecimento de alertas no Telegram e chips visuais no Cockpit PWA. Suíte automatizada com 114/114 testes aprovados.

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
