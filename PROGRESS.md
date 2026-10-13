# 🚀 Progresso do Projeto: Radar de Voos (v2.10.5)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.10.5 100% operacional com 273/273 testes JS e 10/10 testes Python aprovados. Suporte a moedas dinâmicas e estimativas realistas para destinos internacionais fora do dicionário ativo.
- **Diretriz Prioritária**: Aumentar a precisão de extração e parametrização de voos do Google Flights e refinamento das badges visuais do Cockpit PWA.
- **Última Tarefa Concluída**: `src/domain/calculadora.js` · `avaliarCustoDestinoComTotal` · Implementado suporte a moedas dinâmicas (USD, EUR, GBP), cotações customizadas, diárias customizadas e estimativa de diárias para destinos fora do dicionário base via inferência geográfica de aeroportos/regiões e cidades nacionais (`DOMESTICO`), com função `converterMoeda` e blindagem de `ehSoIda` contra underscores (`SO_IDA`). 5 novos testes dedicados (273/273 verdes).

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/domain/rotas.js`
- **Função/Componente/Seletor**: `gerarLinkGoogleFlightsCheapest`
- **Comportamento Esperado / Critério de Aceite**: Adicionar suporte a múltiplos passageiros (adultos, crianças) e seleção de classe de cabine (Premium Economy / Business / First) na construção do payload Protobuf tfs do Google Flights, garantindo links canônicos navegáveis e coerentes.

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
