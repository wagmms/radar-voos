# 🚀 Progresso do Projeto: Radar de Voos (v2.17.0)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.17.0 100% operacional com 364/364 testes JS e 10/10 testes Python aprovados. Widget de edição inline de `paridade_milhas` e `programa_milhas` implementado nos cards do Cockpit PWA com migração SQLite defensiva e endpoint PATCH dedicado.
- **Diretriz Prioritária**: Aumentar a precisão de extração e parametrização de voos do Google Flights e refinamento das badges visuais do Cockpit PWA.
- **Última Tarefa Concluída**: `src/public/js/card_rota.js` · `renderizarBadgeMilhas` + `salvarMilhasInline` · Widget de edição inline com toggle ✏️, select de programa, input numérico de cotação e persistência via PATCH `/api/rotas/:id/milhas`; migração SQLite + 21 novos testes (364/364 verdes).

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/services/flight_scanner.js`
- **Função/Componente/Seletor**: `calcularMilhasRota` (nova função) + `escanearRota`
- **Comportamento Esperado / Critério de Aceite**: Ao varredura da rota, calcular automaticamente `milhas_estimadas` usando `paridade_milhas` e `programa_milhas` do registro da rota (via `calcularMilhasEstimadas` do `card_rota.js`) e incluir o campo no objeto de resultado retornado por `escanearRota`, permitindo exibição direta no Telegram e Cockpit sem recalcular no cliente.

---

## 📋 Backlog Prioritário
- [ ] `src/services/flight_scanner.js` • `calcularMilhasRota` • Suporte ao recálculo automático de economia em milhas utilizando a paridade e programa customizados da rota.
- [ ] `src/server/routes/rotas_routes.js` • Rota `GET /api/rotas` • Incluir `paridade_milhas` e `programa_milhas` no payload de resposta quando `rotasRepo.listarTodas()` retornar rotas (já presentes no SQLite, garantir serialização).
- [ ] `src/public/app.js` • `abrirEdicaoRota` • Pré-preencher `paridade_milhas` e `programa_milhas` no modal de edição de rota existente (campos adicionais ao modal).

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Integração com API de milhas (Smiles, LATAM Pass, TudoAzul) para cálculo de paridade pontos vs reais em tempo real.
2. Visualização de rotas com arcos ortodrômicos geodésicos SVG (`remotion-maps`) no Cockpit PWA.
3. Notificação Push nativa no navegador (Web Push API com VAPID).
4. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.
5. Gráfico de dispersão de preços históricos por época do ano no Cockpit PWA.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
