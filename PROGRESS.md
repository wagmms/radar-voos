# 🚀 Progresso do Projeto: Radar de Voos (v2.5.0)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.5.0 operacional e 100% autônomo (60/60 testes passando), com Sincronização Bidirecional Real (Two-Way Sync: Web/Produção ↔ Local): qualquer modificação feita no Cockpit Web do Render é automaticamente refletida no ambiente local e no banco SQLite, e os deploys nunca mais sobrescrevem as rotas do usuário.
- **Diretriz Prioritária**: Monitoramento proativo 24/7 de tarifas e oportunidades aéreas no GDS com custo zero, paridade total entre ambientes e zero spam de notificações.
- **Última Tarefa Concluída**: Implementação do Two-Way Sync Bidirecional em `src/services/rotas_sync.js` (`puxarDoGitHub`, `sincronizarRotasComBanco`, `sincronizarNoStartup`), integração no startup de `src/index.js`, rota `POST /api/rotas/sync-pull` em `src/server/routes/rotas_routes.js`, sincronização em tempo real no Cockpit PWA `src/public/app.js`, blindagem contra sobrescrita de `data/rotas.json` em testes e criação da suíte `tests/rotas_sync.test.js`.

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/services/providers/google_flights_direct_provider.js`
- **Função/Componente/Seletor**: `buscarOfertas`
- **Comportamento Esperado / Critério de Aceite**: Expandir parser de tarifas para extrair conexões detalhadas e bagagens diretamente dos blocos de resultados do Google Flights com zero custo de API.

---

## 📋 Backlog Prioritário
- [ ] `src/services/providers/google_flights_direct_provider.js` • `buscarOfertas` • Expandir parser de tarifas para extrair conexões detalhadas e bagagens diretamente dos blocos de resultados do Google Flights.
- [ ] `src/public/app.js` • `renderizarRotas` • Adicionar filtro por faixa de temperatura climática no Cockpit (ex: destinos quentes >25°C vs frios <15°C).
- [ ] `src/services/notifier_telegram.js` • `processarComando` • Adicionar comando `/paridade` para conversão de milhas aéreas (Smiles/Latam Pass) em valor equivalente em reais.

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Integração com API de milhas (Smiles, LATAM Pass, TudoAzul) para cálculo de paridade pontos vs reais.
2. Exportação de histórico de preços para CSV ou PDF executivo.
3. Notificação Push nativa no navegador (Web Push API com VAPID).

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
