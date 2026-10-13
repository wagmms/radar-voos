# 🚀 Progresso do Projeto: Radar de Voos (v2.10.0)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.10.0 100% operacional com 246/246 testes JS e 10/10 testes Python aprovados. Fallback defensivo de extração de companhias aéreas por código IATA de 2 letras implementado e verificado no ScraplingClient.
- **Diretriz Prioritária**: Aumentar a precisão de extração de dados de voos do Google Flights e refinamento das badges visuais do Cockpit PWA.
- **Última Tarefa Concluída**: `src/services/providers/scrapling_client.js` · `extrairVoosDoHtml` & `extrairCiaIataDoTrecho` · Adicionado fallback defensivo multicamada de extração e mapeamento de código IATA de 2 letras (G3, LA, AD, TP, AF, etc.) a partir de atributos data-*, caminhos de logos, matrizes JSON e números de voo no DOM do Google Flights. 16 novos testes dedicados (246/246 verdes).

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/public/app.js`
- **Função/Componente/Seletor**: `renderizarRotas`
- **Comportamento Esperado / Critério de Aceite**: Refinar renderização de badges de conexões com exibição de escala noturna / stopover em cards móveis, garantindo distinção visual entre conexões curtas e escalas prolongadas (>8h).

---

## 📋 Backlog Prioritário
- [ ] `src/domain/calculadora.js` • `avaliarCustoDestinoComTotal` • Suporte a moedas dinâmicas e conversão de diárias internacionais para destinos fora do dicionário base.
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
