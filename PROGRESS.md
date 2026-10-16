# 🚀 Progresso do Projeto: Radar de Voos (v3.7.0)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Hard Guard arquitetural implementado via Gemini 4 Argon, bloqueando definitivamente vazamento de rotas de teste para GitHub/deploy. Rotas genéricas expurgadas do repositório remoto. 100% de aprovação (446/446 testes passando no `./validate.sh fast`).
- **Camadas Entregues & Verificadas**:
  - `src/services/rotas_sync.js`: função `isExecucaoOficialAutorizada()` impedindo escrita em `data/rotas.json` e sync com GitHub fora do banco oficial de produção.
  - `tests/routes.test.js`: isolamento estrito contra o GitHub token e runner de testes.
  - `data/rotas.json`: restaurado canonicamente com as 4 rotas reais do usuário em `main` e `autoloop/dev`.
  - **Suíte de Testes**: 446/446 testes aprovados (100% de sucesso).
- **Diretriz Prioritária**: Implementar sparklines SVG de histórico nos cards e visualização ortodrômica de rotas no Cockpit PWA.
- **Última Tarefa Concluída**: Expugo de todas as rotas mock/genéricas injetadas via testes no GitHub remoto e implementação do Hard Guard em `rotas_sync.js` bloqueando para sempre qualquer escrita ou sync em testes.

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/public/js/card_rota.js`
- **Função/Componente/Seletor**: `renderizarSparklineSvg`
- **Comportamento Esperado / Critério de Aceite**: Desenhar sparkline em SVG puro leve para o histórico de preços dos últimos 10 checks no card da rota.

---

## 📋 Backlog Prioritário
- [ ] `src/public/js/card_rota.js` • `renderizarSparklineSvg` • Desenhar sparkline em SVG puro para o histórico de preços dos últimos 10 checks na rota.
- [ ] `src/public/sw.js` • Service Worker Push • Adicionar handler de notificações Web Push nativas para alertar oportunidades e bug fares com o app fechado.

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Visualização de rotas com arcos ortodrômicos geodésicos SVG (`remotion-maps`).
2. Notificação Push nativa no navegador (Web Push API com VAPID).
3. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.
4. Gráfico de dispersão de preços históricos por época do ano (`smart-charts`).
5. Exportação de dados de histórico tarifário em formato CSV/JSON via API.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
