# 🚀 Progresso do Projeto: Radar de Voos (v2.9.9)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.9.9 100% operacional com 230/230 testes JS e 10/10 testes Python aprovados. Persistência atômica do Working Buffer do BugFareHunter implementada em disco (`data/working_buffer.json`) com restauração automática no boot da classe.
- **Diretriz Prioritária**: Aumentar a precisão de extração de companhias aéreas e tarifas no Google Flights e refinamento das badges visuais do Cockpit PWA.
- **Última Tarefa Concluída**: `src/services/bug_fare_hunter.js` · `salvarWorkingBufferDisco` & `carregarWorkingBufferDisco` · Implementada persistência atômica do cache do Working Buffer em disco (`data/working_buffer.json`) via escrita em arquivo temporário e `fs.renameSync`, com recarregamento no boot e invocação ao final de `escanearCorredoresProativos`. 7 novos testes adicionados (230/230 verdes).

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/services/providers/scrapling_client.js`
- **Função/Componente/Seletor**: `extrairVoosDoHtml`
- **Comportamento Esperado / Critério de Aceite**: Adicionar fallback defensivo de extração de companhia aérea por código IATA de 2 letras (ex: G3, LA, AD, TP, AF) diretamente da matriz de voos e atributos data-* do Google Flights quando os nomes extensos não estiverem presentes nos seletores de texto ou aria-labels.

---

## 📋 Backlog Prioritário
- [ ] `src/public/app.js` • `renderizarRotas` • Refinar renderização de badges de conexões com exibição de escala noturna / stopover em cards móveis.
- [ ] `src/domain/calculadora.js` • `avaliarCustoDestinoComTotal` • Suporte a moedas dinâmicas e conversão de diárias internacionais para destinos fora do dicionário base.
- [ ] `src/domain/rotas.js` • `gerarLinkGoogleFlightsCheapest` • Suporte a múltiplos passageiros e seleção de cabine (Premium Economy / Business) no payload tfs.
- [ ] `src/services/notifier_telegram.js` • `enviarAlertaBugFare` • Adicionar botão inline com atalho de consulta direta de regras de bagagem da rota.

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Integração com API de milhas (Smiles, LATAM Pass, TudoAzul) para cálculo de paridade pontos vs reais.
2. Visualização de rotas com arcos ortodrômicos geodésicos SVG (`remotion-maps`) no Cockpit PWA.
3. Notificação Push nativa no navegador (Web Push API com VAPID).
4. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.
5. Gráfico de dispersão de preços históricos por época do ano no Cockpit PWA.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
