# 🚀 Progresso do Projeto: Radar de Voos (v2.13.0)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.13.0 100% operacional com 321/321 testes JS e 10/10 testes Python aprovados. Suporte completo a cotações multimoeda ('BRL', 'USD', 'EUR') em `executarCicloVarredura`, `escanearRota`, persistência SQLite nativa, provedores de voo (Scrapling, Direct, SerpAPI) e links canônicos do Google Flights.
- **Diretriz Prioritária**: Aumentar a precisão de extração e parametrização de voos do Google Flights e refinamento das badges visuais do Cockpit PWA.
- **Última Tarefa Concluída**: `src/services/flight_scanner.js` · `executarCicloVarredura` & Provedores · Suporte à passagem de moeda configurada pelo usuário (`moeda` ou `curr`, ex: 'BRL', 'USD', 'EUR') nas checagens de rota enviadas aos provedores de busca, garantindo consistência em cotações multimoeda e links canônicos do Google Flights. 5 novos testes unitários (321/321 verdes).

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/public/js/card_rota.js`
- **Função/Componente/Seletor**: `criarCardRota`
- **Comportamento Esperado / Critério de Aceite**: Exibir badge informativa de emissão em milhas estimadas calculadas pela paridade configurada da rota no card de voo do Cockpit PWA.

---

## 📋 Backlog Prioritário
- [ ] `src/public/js/card_rota.js` • `criarCardRota` • Exibir badge informativa de emissão em milhas estimadas calculadas pela paridade configurada da rota.
- [ ] `src/services/notifier_telegram.js` • `formatarAlertaTelegram` • Adicionar mini-tabela com histórico dos últimos 3 preços registrados da rota no corpo do alerta.
- [ ] `src/services/weather_service.js` • `obterClimaDestino` • Cache local defensivo de 6h para previsões meteorológicas evitando chamadas repetidas à Open-Meteo.

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Integração com API de milhas (Smiles, LATAM Pass, TudoAzul) para cálculo de paridade pontos vs reais.
2. Visualização de rotas com arcos ortodrômicos geodésicos SVG (`remotion-maps`) no Cockpit PWA.
3. Notificação Push nativa no navegador (Web Push API com VAPID).
4. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.
5. Gráfico de dispersão de preços históricos por época do ano no Cockpit PWA.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
