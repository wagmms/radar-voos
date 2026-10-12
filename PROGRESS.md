# 🚀 Progresso do Projeto: Radar de Voos (v2.6.1)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.6.1 operacional (67/67 testes passando). Corrigida chamada de atualização pós-varredura proativa no Cockpit PWA (`carregarDadosCompletos`), adicionados aliases defensivos no escopo global e invalidado o cache do Service Worker para `radar-voos-v2.6.1`.
- **Diretriz Prioritária**: Caçada proativa contínua de erros de tarifa genuínos nos eixos mundiais sem gerar custos de API ou poluição de marketing.
- **Última Tarefa Concluída**: Correção cirúrgica de `carregarDadosCompletos` em `src/public/app.js`, invalidação de cache em `src/public/sw.js` (v2.6.1) e tratamento defensivo com `try/catch` em `src/server/routes/bug_fares_routes.js`.

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/public/app.js`
- **Função/Componente/Seletor**: `renderizarRotas`
- **Comportamento Esperado / Critério de Aceite**: Adicionar tag visual destacando tarifas obtidas pela aba "Cheapest" ou parceiros no card da rota no Cockpit Web.

---

## 📋 Backlog Prioritário
- [ ] `src/public/app.js` • `renderizarRotas` • Adicionar tag visual destacando tarifas obtidas pela aba "Cheapest" ou parceiros no card da rota no Cockpit Web.
- [ ] `src/services/providers/google_flights_direct_provider.js` • `buscarOfertas` • Expandir parser de tarifas para extrair conexões detalhadas e bagagens diretamente dos blocos de resultados do Google Flights.
- [ ] `src/public/app.js` • `renderizarRotas` • Adicionar filtro por faixa de temperatura climática no Cockpit (ex: destinos quentes >25°C vs frios <15°C).
- [ ] `src/services/notifier_telegram.js` • `processarComando` • Adicionar comando `/paridade` para conversão de milhas aéreas (Smiles/Latam Pass) em valor equivalente em reais.

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Integração com API de milhas (Smiles, LATAM Pass, TudoAzul) para cálculo de paridade pontos vs reais.
2. Exportação de histórico de preços para CSV ou PDF executivo.
3. Notificação Push nativa no navegador (Web Push API com VAPID).
4. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.
5. Gráfico de dispersão de preços históricos por época do ano no Cockpit PWA.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
