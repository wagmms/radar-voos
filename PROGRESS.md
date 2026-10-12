# 🚀 Progresso do Projeto: Radar de Voos (v2.7.1)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.7.1 operacional (76/76 testes passando). Módulo `tarifa_tags.js` homologado com detecção cirúrgica da aba "Cheapest" e agências parceiras/OTAs (Decolar, MyTrip, Gotogate, etc.). Cards do Cockpit PWA ganharam tags pills contextuais, banners informativos translúcidos e novo filtro `⚡ Cheapest / OTAs` na toolbar.
- **Diretriz Prioritária**: Aprimorar continuamente a precisão de busca do Google Flights (aba cheapest, conexões, bagagens), detecção de Bug Fares e refinamento de interface PWA via turnos autônomos orientados a skills.
- **Última Tarefa Concluída**: Adicionadas tags visuais e banners informativos para tarifas obtidas pela aba "Cheapest" ou parceiros no card da rota no Cockpit Web, com módulo `src/public/js/tarifa_tags.js`, estilização anti-ui-slop e 100% de cobertura com 6 novos testes automatizados.

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/services/providers/google_flights_direct_provider.js`
- **Função/Componente/Seletor**: `buscarOfertas`
- **Comportamento Esperado / Critério de Aceite**: Expandir parser de tarifas para extrair conexões detalhadas (escalas) e bagagens diretamente dos nós e atributos dos blocos de resultados do Google Flights.

---

## 📋 Backlog Prioritário
- [ ] `src/services/providers/google_flights_direct_provider.js` • `buscarOfertas` • Expandir parser de tarifas para extrair conexões detalhadas (escalas) e bagagens diretamente dos blocos de resultados do Google Flights.
- [ ] `src/public/app.js` • `renderizarRotas` • Adicionar filtro por faixa de temperatura climática no Cockpit (ex: destinos quentes >25°C vs frios <15°C).
- [ ] `src/services/notifier_telegram.js` • `processarComando` • Adicionar comando `/paridade` para conversão de milhas aéreas (Smiles/Latam Pass) em valor equivalente em reais.
- [ ] `src/services/bug_fare_hunter.js` • `escanearCorredoresProativos` • Adicionar suporte a parâmetros de cabine (Premium Economy e Executiva) na varredura autônoma global.

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Integração com API de milhas (Smiles, LATAM Pass, TudoAzul) para cálculo de paridade pontos vs reais.
2. Exportação de histórico de preços para CSV ou PDF executivo.
3. Notificação Push nativa no navegador (Web Push API com VAPID).
4. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.
5. Gráfico de dispersão de preços históricos por época do ano no Cockpit PWA.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
