# 🚀 Progresso do Projeto: Radar de Voos (v3.7.0)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Suporte pleno a "Apenas Ida" (One-Way) implementado no Cockpit PWA e no banco SQLite. Discrepâncias de preços de RJ ➔ Belém (R$ 1.281 vs R$ 914) e SP ➔ Santiago (R$ 1.029 vs R$ 989) diagnosticadas e resolvidas na raiz. 100% de aprovação (446/446 testes passando no `./validate.sh fast`).
- **Camadas Entregues & Verificadas**:
  - `src/public/index.html` e `src/public/app.js`: seletor de modalidade de viagem (`🔄 Ida e Volta` vs `➡️ Apenas Ida`) com desabilitação de volta e envio de `tipo_viagem`.
  - `src/db.js`: migração dinâmica da coluna `tipo_viagem`, regeneração bidirecional de links Google Flights e sanitização com blindagem cambial em BRL para América do Sul.
  - `src/public/js/card_rota.js`: eliminação da volta fantasma de 10 dias em rotas só ida.
  - `tests/routes.test.js`: testes de regressão de criação e alternância de tipo de viagem.
  - **Suíte de Testes**: 446/446 testes aprovados (100% de sucesso).
- **Diretriz Prioritária**: Implementar sparklines SVG de histórico nos cards e visualização ortodrômica de rotas no Cockpit PWA.
- **Última Tarefa Concluída**: Suporte a "Apenas Ida" no modal de criação/edição de rotas do Cockpit PWA, resolução das discrepâncias tarifárias de RJ ➔ Belém e SP ➔ Santiago, e regeneração canônica de links Google Flights one-way vs round-trip.

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
