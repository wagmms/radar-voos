# 🚀 Progresso do Projeto: Radar de Voos (v2.11.1)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.11.1 100% operacional com 304/304 testes JS e 10/10 testes Python aprovados. Botão contextual de regras de bagagem (`🧳 Ver Regras de Bagagem`) adicionado ao card de alerta de Bug Fare no Telegram, com URL parametrizada pelos IATAs da rota e degradação graciosa quando IATAs não disponíveis.
- **Diretriz Prioritária**: Aumentar a precisão de extração e parametrização de voos do Google Flights e refinamento das badges visuais do Cockpit PWA.
- **Última Tarefa Concluída**: `src/services/notifier_telegram.js` · `enviarAlertaBugFare` · Adicionado botão inline `🧳 Ver Regras de Bagagem` com URL parametrizada por IATAs da rota. `montarCardBugFare` em `src/domain/aeroportos.js` agora expõe `iata_origem` e `iata_destino`. 3 novos testes (304/304 verdes).

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/public/app.js`
- **Função/Componente/Seletor**: `criarCardRota`
- **Comportamento Esperado / Critério de Aceite**: Adicionar botão de cópia rápida do link do Google Flights para a área de transferência (via `navigator.clipboard.writeText`) com feedback toast visual temporário ("Link copiado! ✓") que aparece 2s e desaparece com animação, integrado ao card de rota no Cockpit PWA.

---

## 📋 Backlog Prioritário
- [ ] `src/services/notifier_telegram.js` • `enviarAlertaBugFare` • Adicionar botão inline com atalho de consulta direta de regras de bagagem da rota.
- [ ] `src/public/app.js` • `criarCardRota` • Adicionar botão de cópia rápida do link do Google Flights para a área de transferência com feedback toast.
- [ ] `src/services/flight_scanner.js` • `executarCicloVarredura` • Suporte à passagem de moeda configurada pelo usuário nas checagens de rota.

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Integração com API de milhas (Smiles, LATAM Pass, TudoAzul) para cálculo de paridade pontos vs reais.
2. Visualização de rotas com arcos ortodrômicos geodésicos SVG (`remotion-maps`) no Cockpit PWA.
3. Notificação Push nativa no navegador (Web Push API com VAPID).
4. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.
5. Gráfico de dispersão de preços históricos por época do ano no Cockpit PWA.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
