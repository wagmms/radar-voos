# 🚀 Progresso do Projeto: Radar de Voos (v2.6.0)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.6.0 operacional (67/67 testes passando), com caçador proativo global de Bug Fares a custo zero de API (`BugFareHunter`), inteligência multi-cabine (Econômica, Premium e Executiva), detecção de anomalias por Z-Score no SQLite, ingestão de feeds de viagem anti-marketing (`BugFareFeedWatcher`), correção completa de renderização no Cockpit PWA e novos comandos `/varrerbugs` no Telegram.
- **Diretriz Prioritária**: Caçada proativa contínua de erros de tarifa genuínos nos eixos mundiais sem gerar custos de API ou poluição de marketing.
- **Última Tarefa Concluída**: Implementação do pacote completo da Pesquisadora de Bug Fares em `src/services/bug_fare_hunter.js`, `src/services/bug_fare_feed_watcher.js`, `src/domain/bug_fares.js`, `src/db.js`, `src/public/app.js` e `src/server/routes/bug_fares_routes.js` com suíte de testes expandida para 67 testes aprovados.

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
