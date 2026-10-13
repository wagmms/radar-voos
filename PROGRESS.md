# 🚀 Progresso do Projeto: Radar de Voos (v2.15.0)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.15.0 100% operacional com 338/338 testes JS e 10/10 testes Python aprovados. Mini-tabela de histórico de preços integrada nos alertas Telegram — exibe os últimos 3 preços registrados (data BR + valor + termômetro) no corpo do alerta de Oportunidade/Queda Relâmpago, omitida automaticamente quando histórico está vazio ou rotaId é nulo.
- **Diretriz Prioritária**: Aumentar a precisão de extração e parametrização de voos do Google Flights e refinamento das badges visuais do Cockpit PWA.
- **Última Tarefa Concluída**: `src/services/notifier_telegram.js` · `enviarAlertaOportunidade` · Mini-tabela HTML de histórico recente (últimos 3 preços via `rotasRepo.obterHistoricoRecente`) com omissão silenciosa defensiva quando histórico vazio/rotaId nulo e 3 novos testes (338/338 verdes).

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/services/weather_service.js`
- **Função/Componente/Seletor**: `obterClimaDestino`
- **Comportamento Esperado / Critério de Aceite**: Implementar cache local em memória com TTL de 6h para resultados de `obterClimaDestino`, evitando chamadas repetidas à API Open-Meteo para o mesmo destino durante o mesmo ciclo de monitoramento. Cache deve ser invalidado automaticamente após expiração e nunca retornar dados > 6h desatualizados.

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
