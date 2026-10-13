# 🚀 Progresso do Projeto: Radar de Voos (v2.10.2)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.10.2 100% operacional com 266/266 testes JS e 10/10 testes Python aprovados. Badges visuais de conexões e stopover noturno implementadas no Cockpit PWA com detecção de 5 modalidades de escala.
- **Diretriz Prioritária**: Aumentar a precisão de extração de dados de voos do Google Flights e refinamento das badges visuais do Cockpit PWA.
- **Última Tarefa Concluída**: `src/public/js/conexao_badges.js` & `src/public/app.js` · `renderizarRotas` & `conexao_badges` · Implementado módulo de badges visuais de conexões e stopover com detecção de 5 modalidades (Voo Direto, Conexão Rápida <=3h, Conexão Moderada, Escala Prolongada >8h e Escala Noturna/Pernoite), com tags no cabeçalho e callout de stopover 2-em-1 responsivo para cards móveis. 19 novos testes dedicados (266/266 verdes).

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/domain/calculadora.js`
- **Função/Componente/Seletor**: `avaliarCustoDestinoComTotal`
- **Comportamento Esperado / Critério de Aceite**: Adicionar suporte a moedas dinâmicas e conversão de diárias internacionais para destinos fora do dicionário base, garantindo fallback defensivo e estimativa realista de custo total da viagem.

---

## 📋 Backlog Prioritário
- [ ] `src/domain/rotas.js` • `gerarLinkGoogleFlightsCheapest` • Suporte a múltiplos passageiros e seleção de cabine (Premium Economy / Business) no payload tfs.
- [ ] `src/services/notifier_telegram.js` • `enviarAlertaBugFare` • Adicionar botão inline com atalho de consulta direta de regras de bagagem da rota.
- [ ] `src/public/app.js` • `criarCardRota` • Adicionar botão de cópia rápida do link do Google Flights para a área de transferência com feedback toast.

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Integração com API de milhas (Smiles, LATAM Pass, TudoAzul) para cálculo de paridade pontos vs reais.
2. Visualização de rotas com arcos ortodrômicos geodésicos SVG (`remotion-maps`) no Cockpit PWA.
3. Notificação Push nativa no navegador (Web Push API com VAPID).
4. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.
5. Gráfico de dispersão de preços históricos por época do ano no Cockpit PWA.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
