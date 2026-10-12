# 🚀 Progresso do Projeto: Radar de Voos (v2.6.3)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.6.3 operacional (68/68 testes passando). Implementada estratégia híbrida em `FlightProviderManager`: quando o provedor direto no ambiente de nuvem (Render) recebe apenas a tarifa oficial da cia aérea (R$ 741), a SerpAPI com proxy residencial é acionada complementarmente para desvendar as tarifas de parceiros e OTAs (R$ 587 a R$ 593).
- **Diretriz Prioritária**: Garantir que o menor preço absoluto da rota seja eleito e refletido no Cockpit PWA e alertas.
- **Última Tarefa Concluída**: Integração de eleição de menor tarifa entre provedores no `FlightProviderManager`, garantindo captura de OTAs em nuvem e link direto para a aba Cheapest.

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
