# 🚀 Progresso do Projeto: Radar de Voos (v2.7.6)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.7.6 operacional com 108/108 testes passando (100%). Destinos genéricos eliminados dos Bug Fares (exibindo obrigatoriamente aeroporto de chegada IATA/nome, país de destino e datas). Links para o Google Flights blindados com sintaxe canônica `returning` e Protobuf `tfs` (aba Cheapest), eliminando redirecionamentos indevidos para a página inicial.
- **Diretriz Prioritária**: Desenvolver o motor de scraping resiliente (`scrapling`) para captura de tarifas da aba Cheapest e caçador proativo de Bug Fares (`proactive-agent`) com alertas por exceção e Z-Score estatístico.
- **Última Tarefa Concluída**: Criado módulo `src/domain/aeroportos.js` com catálogo de aeroportos e resolução de destinos concretos (`resolverDestinoConcreto`, `montarCardBugFare`). Corrigida a geração de links em `src/domain/rotas.js` (eliminando a palavra `through` e KGMIDs soltos). Atualizado o Cockpit PWA (`src/public/app.js` e `src/public/styles.css`) e o bot do Telegram (`src/services/notifier_telegram.js`) com badges de aeroporto, país e datas. Criados 6 testes em `tests/aeroportos_bug_fares.test.js`.

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/services/providers/scrapling_client.js`
- **Função/Componente/Seletor**: `obterTarifasGoogleFlights`
- **Comportamento Esperado / Critério de Aceite**: Criar adaptador de scraping resiliente baseado no padrão da skill `scrapling` com evasão de detecção de bots, cabeçalhos HTTP realistas e extração de tarifas da aba "Cheapest" via Protobuf `tfs`, integrando com failover defensivo para os provedores existentes.

---

## 📋 Backlog Prioritário
- [ ] `src/services/providers/scrapling_client.js` • `obterTarifasGoogleFlights` • Adaptador de scraping resiliente com cabeçalhos dinâmicos e parsing da aba Cheapest via Protobuf tfs.
- [ ] `src/services/bug_fare_hunter.js` • `escanearCorredoresProativos` • Integrar padrão `proactive-agent` com Working Buffer de 24h, deduplicação de alertas e Z-score estatístico proativo.
- [ ] `src/services/notifier_telegram.js` • `processarComando` • Adicionar comando interativo `/paridade` para conversão de milhas aéreas (Smiles/Latam Pass/Livelo) com formatação HTML segura (`telegram-compose`).
- [ ] `src/public/app.js` • `renderizarRotas` • Adicionar ordenação rápida por maior economia em relação ao teto e sparklines em SVG puro ultraleve (`smart-charts`).

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Integração com API de milhas (Smiles, LATAM Pass, TudoAzul) para cálculo de paridade pontos vs reais.
2. Visualização de rotas com arcos ortodrômicos geodésicos SVG (`remotion-maps`) no Cockpit PWA.
3. Notificação Push nativa no navegador (Web Push API com VAPID).
4. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.
5. Gráfico de dispersão de preços históricos por época do ano no Cockpit PWA.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
