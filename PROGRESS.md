# 🚀 Progresso do Projeto: Radar de Voos (v2.14.0)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.14.0 100% operacional com 331/331 testes JS e 10/10 testes Python aprovados. Badge de milhas estimadas integrada no Cockpit PWA — exibe estimativa de milhas necessárias por programa de fidelidade (Smiles, LATAM, Livelo, Azul, Iberia, TAP) diretamente no card de rota com fallback defensivo e zero ruído.
- **Diretriz Prioritária**: Aumentar a precisão de extração e parametrização de voos do Google Flights e refinamento das badges visuais do Cockpit PWA.
- **Última Tarefa Concluída**: `src/public/js/card_rota.js` · `criarCardRota` + `calcularMilhasEstimadas` + `renderizarBadgeMilhas` · Badge de milhas estimadas calculada pela paridade configurada da rota (`paridade_milhas` + `programa_milhas`) com `COTACOES_MILHA_MILHEIRO` canônico e 5 novos testes (331/331 verdes).

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/services/notifier_telegram.js`
- **Função/Componente/Seletor**: `formatarAlertaTelegram`
- **Comportamento Esperado / Critério de Aceite**: Adicionar mini-tabela HTML com os últimos 3 preços registrados da rota (data + valor) no corpo do alerta de Bug Fare/Oportunidade, obtidos de `rota.historico_recente` ou `historico_precos` SQLite, garantindo que alertas vazios sem histórico não exibam a seção.

---

## 📋 Backlog Prioritário
- [ ] `src/services/weather_service.js` • `obterClimaDestino` • Cache local defensivo de 6h para previsões meteorológicas evitando chamadas repetidas à Open-Meteo.
- [ ] `src/public/js/card_rota.js` • `criarCardRota` • Exibir campo de edição inline de `paridade_milhas` e `programa_milhas` por rota diretamente no card (seletor de programa + campo numérico de cotação).
- [ ] `src/server/routes_api.js` • Rota `PATCH /api/rotas/:id` • Persistir `paridade_milhas` e `programa_milhas` no SQLite ao editar rota.

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Integração com API de milhas (Smiles, LATAM Pass, TudoAzul) para cálculo de paridade pontos vs reais em tempo real.
2. Visualização de rotas com arcos ortodrômicos geodésicos SVG (`remotion-maps`) no Cockpit PWA.
3. Notificação Push nativa no navegador (Web Push API com VAPID).
4. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.
5. Gráfico de dispersão de preços históricos por época do ano no Cockpit PWA.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
