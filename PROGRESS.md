# 🚀 Progresso do Projeto: Radar de Voos (v2.8.0)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.8.0 100% operacional com 114/114 testes JS e 10/10 testes Python aprovados. Implementado autoloop híbrido dual-mode (`--modo {alternado,builder,qa}`) alternando entre desenvolvimento de recursos e QA adversarial/testador de estresse. Alertas no Telegram enriquecidos com botões inline (`[🎯 Alterar Teto]`, `[🔍 Checar Agora]`) e destaque de economia real (R$ e %).
- **Diretriz Prioritária**: Desenvolver o motor de scraping resiliente (`scrapling`) para captura de tarifas da aba Cheapest e caçador proativo de Bug Fares (`proactive-agent`) com alertas por exceção e Z-Score estatístico.
- **Última Tarefa Concluída**: Autoloop Dual-Mode (Builder vs QA Adversarial) com alternância cíclica e flags CLI em `scripts/autoloop_radarvoos.py`; botões inline interativos com atalho de teto e cálculo de economia real em `src/services/notifier_telegram.js`; 114 testes JS e 10 testes Python 100% verdes.

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
