# 🚀 Progresso do Projeto: Radar de Voos (v2.17.0)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.18.0 100% operacional com 376/376 testes JS e 10/10 testes Python aprovados. `calcularMilhasRota` implementada no backend com estimativa automática de milhas no retorno de `escanearRota`.
- **Diretriz Prioritária**: Aumentar a precisão de extração e parametrização de voos do Google Flights e refinamento das badges visuais do Cockpit PWA.
- **Última Tarefa Concluída**: `src/services/flight_scanner.js` · `calcularMilhasRota` + `escanearRota` (step 6) · Função pura exportada que calcula milhas estimadas a partir de `paridade_milhas` e `programa_milhas` da rota; campo `milhas_estimadas` incluído no payload de retorno de `escanearRota`; 12 novos testes (376/376 verdes).

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/server/routes/rotas_routes.js`
- **Função/Componente/Seletor**: Rota `GET /api/rotas` — `rotasRepo.listarTodas()` + `map` de `rotasCompletas`
- **Comportamento Esperado / Critério de Aceite**: Garantir que `paridade_milhas` e `programa_milhas` estejam sempre presentes e serializados no payload de resposta (`rotas[].paridade_milhas` e `rotas[].programa_milhas`); adicionar `milhas_estimadas` calculado via `calcularMilhasRota` no objeto de cada rota retornada, permitindo exibição direta no Cockpit PWA sem chamada adicional ao servidor.

---

## 📋 Backlog Prioritário
- [ ] `src/server/routes/rotas_routes.js` • Rota `GET /api/rotas` • Incluir `paridade_milhas`, `programa_milhas` e `milhas_estimadas` (via `calcularMilhasRota`) no payload de resposta de cada rota.
- [ ] `src/public/app.js` • `abrirEdicaoRota` • Pré-preencher `paridade_milhas` e `programa_milhas` no modal de edição de rota existente (campos adicionais ao modal).
- [ ] `src/services/notifier_telegram.js` • `enviarAlertaOportunidade` • Incluir seção "✈️ ~NNN milhas" no card de alerta usando `milhas_estimadas` do resultado de `escanearRota`.

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Integração com API de milhas (Smiles, LATAM Pass, TudoAzul) para cálculo de paridade pontos vs reais em tempo real.
2. Visualização de rotas com arcos ortodrômicos geodésicos SVG (`remotion-maps`) no Cockpit PWA.
3. Notificação Push nativa no navegador (Web Push API com VAPID).
4. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.
5. Gráfico de dispersão de preços históricos por época do ano no Cockpit PWA.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
