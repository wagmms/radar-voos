# 🚀 Progresso do Projeto: Radar de Voos (v2.10.5)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.11.0 100% operacional com 300/300 testes JS e 10/10 testes Python aprovados. Suporte a múltiplos passageiros (adultos, crianças) e classes de cabine (Economy / Premium Economy / Business / First) na construção dinâmica do payload Protobuf `tfu` do Google Flights.
- **Diretriz Prioritária**: Aumentar a precisão de extração e parametrização de voos do Google Flights e refinamento das badges visuais do Cockpit PWA.
- **Última Tarefa Concluída**: `src/domain/rotas.js` · `construirTfu` + `gerarLinkGoogleFlightsCheapest` · Implementada função `construirTfu(adultos, criancas, bebes, classeViagem)` que gera payload binário tfu dinâmico (base64url, Protobuf Google Flights) com sanitização defensiva e encoding correto de adultos extras, crianças, bebês e cabine (field 0x30). A assinatura de `gerarLinkGoogleFlightsCheapest` foi ampliada com `adultos`, `criancas` e `classeViagem` mantendo retrocompatibilidade total. 22 novos testes dedicados (300/300 verdes).

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/services/notifier_telegram.js`
- **Função/Componente/Seletor**: `enviarAlertaBugFare`
- **Comportamento Esperado / Critério de Aceite**: Adicionar botão inline `[🧳 Ver Regras de Bagagem]` com atalho de consulta direta das regras de bagagem da rota (URL parametrizada com IATA origem/destino), vinculado ao card de alerta de Bug Fare no Telegram.

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
