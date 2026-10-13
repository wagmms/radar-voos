# 🚀 Progresso do Projeto: Radar de Voos (v2.12.0)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.12.0 100% operacional com 316/316 testes JS e 10/10 testes Python aprovados. Cockpit PWA aprimorado com botão de cópia rápida do link do Google Flights (`.btn-copy-link`) com feedback toast de 2s ("Link copiado! ✓"), animação fade-out suave e fallback gracioso de área de transferência.
- **Diretriz Prioritária**: Aumentar a precisão de extração e parametrização de voos do Google Flights e refinamento das badges visuais do Cockpit PWA.
- **Última Tarefa Concluída**: `src/public/js/card_rota.js` e `src/public/app.js` · `criarCardRota` & `copiarLinkGoogleFlights` · Adicionado botão de cópia rápida do link do Google Flights no card de rota do Cockpit PWA com toast animado temporário (2s) e feedback tátil. 12 novos testes unitários (316/316 verdes).

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/services/flight_scanner.js`
- **Função/Componente/Seletor**: `executarCicloVarredura`
- **Comportamento Esperado / Critério de Aceite**: Suporte à passagem de moeda configurada pelo usuário (`moeda` ou `curr`, ex: 'BRL', 'USD', 'EUR') nas checagens de rota enviadas aos provedores de busca, garantindo consistência em cotações multimoeda.

---

## 📋 Backlog Prioritário
- [ ] `src/services/flight_scanner.js` • `executarCicloVarredura` • Suporte à passagem de moeda configurada pelo usuário nas checagens de rota.
- [ ] `src/public/js/card_rota.js` • `criarCardRota` • Exibir badge informativa de emissão em milhas estimadas calculadas pela paridade configurada da rota.
- [ ] `src/services/notifier_telegram.js` • `formatarAlertaTelegram` • Adicionar mini-tabela com histórico dos últimos 3 preços registrados da rota no corpo do alerta.

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Integração com API de milhas (Smiles, LATAM Pass, TudoAzul) para cálculo de paridade pontos vs reais.
2. Visualização de rotas com arcos ortodrômicos geodésicos SVG (`remotion-maps`) no Cockpit PWA.
3. Notificação Push nativa no navegador (Web Push API com VAPID).
4. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.
5. Gráfico de dispersão de preços históricos por época do ano no Cockpit PWA.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
