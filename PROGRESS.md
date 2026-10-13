# 🚀 Progresso do Projeto: Radar de Voos (v2.16.0)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.16.0 100% operacional com 343/343 testes JS e 10/10 testes Python aprovados. Cache defensivo de 6h em memória implementado no `WeatherService` para consultas à Open-Meteo com invalidação automática de registros obsoletos e métodos de expurgo atômico.
- **Diretriz Prioritária**: Aumentar a precisão de extração e parametrização de voos do Google Flights e refinamento das badges visuais do Cockpit PWA.
- **Última Tarefa Concluída**: `src/services/weather_service.js` · `obterClimaDestino` · Cache local defensivo de 6h em memória (`TTL_CACHE_CLIMA_MS = 21.600.000 ms`) com auto-invalidação ao expirar, métodos `limparCache`, `expurgarExpirados`, `obterTamanhoCache` e 5 novos testes (343/343 verdes).

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/public/js/card_rota.js`
- **Função/Componente/Seletor**: `criarCardRota`
- **Comportamento Esperado / Critério de Aceite**: Exibir campo de edição inline de `paridade_milhas` e `programa_milhas` por rota diretamente no card (seletor de programa + campo numérico de cotação defensivo com validação visual e persistência imediata).

---

## 📋 Backlog Prioritário
- [ ] `src/public/js/card_rota.js` • `criarCardRota` • Exibir campo de edição inline de `paridade_milhas` e `programa_milhas` por rota diretamente no card (seletor de programa + campo numérico de cotação).
- [ ] `src/server/routes_api.js` • Rota `PATCH /api/rotas/:id` • Persistir `paridade_milhas` e `programa_milhas` no SQLite ao editar rota.
- [ ] `src/services/flight_scanner.js` • `calcularMilhasRota` • Suporte ao recálculo automático de economia em milhas utilizando a paridade e programa customizados da rota.

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Integração com API de milhas (Smiles, LATAM Pass, TudoAzul) para cálculo de paridade pontos vs reais em tempo real.
2. Visualização de rotas com arcos ortodrômicos geodésicos SVG (`remotion-maps`) no Cockpit PWA.
3. Notificação Push nativa no navegador (Web Push API com VAPID).
4. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.
5. Gráfico de dispersão de preços históricos por época do ano no Cockpit PWA.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
