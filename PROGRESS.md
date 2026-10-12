# 🚀 Progresso do Projeto: Radar de Voos (v2.7.3)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.7.3 operacional (102/102 testes passando). Cockpit PWA enriquecido com filtro por faixas de temperatura climática (`src/public/js/clima_filtro.js`), chips rápidos na toolbar (☀️ Quente >25°C, ⛅ Ameno 15-25°C, ❄️ Frio <15°C) e badges dinâmicos contextualizados com dados de `clima_temp_media`.
- **Diretriz Prioritária**: Aprimorar continuamente a precisão de busca do Google Flights (aba cheapest, conexões, bagagens), detecção de Bug Fares e refinamento de interface PWA via turnos autônomos orientados a skills.
- **Última Tarefa Concluída**: Implementado filtro por faixas de temperatura climática no Cockpit PWA (`src/public/js/clima_filtro.js`, `src/public/app.js`, `src/public/index.html` e `src/public/styles.css`), com chips rápidos de seleção e badges meteorológicos enriquecidos com micro-tags de faixa, com 21 novos testes automatizados (102/102 testes aprovados).

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/services/notifier_telegram.js`
- **Função/Componente/Seletor**: `processarComando`
- **Comportamento Esperado / Critério de Aceite**: Adicionar comando interativo `/paridade [milhas] [programa]` para cálculo de paridade monetária de milhas aéreas (Smiles a R$ 17,50/milheiro, Latam Pass a R$ 24,00/milheiro, Livelo a R$ 35,00/milheiro) retornando o valor de referência equivalente em reais com resposta formatada em HTML seguro e validação defensiva de argumentos.

---

## 📋 Backlog Prioritário
- [ ] `src/services/notifier_telegram.js` • `processarComando` • Adicionar comando `/paridade` para conversão de milhas aéreas (Smiles/Latam Pass/Livelo) em valor equivalente em reais.
- [ ] `src/services/bug_fare_hunter.js` • `escanearCorredoresProativos` • Adicionar suporte a parâmetros de cabine (Premium Economy e Executiva) na varredura autônoma global.
- [ ] `src/services/flight_scanner.js` • `escanearRota` • Registrar histórico de escalas e bagagens em colunas dedicadas de telemetria no SQLite.
- [ ] `src/public/app.js` • `renderizarRotas` • Adicionar ordenação rápida por maior economia em relação ao teto configurado.

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Integração com API de milhas (Smiles, LATAM Pass, TudoAzul) para cálculo de paridade pontos vs reais.
2. Exportação de histórico de preços para CSV ou PDF executivo.
3. Notificação Push nativa no navegador (Web Push API com VAPID).
4. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.
5. Gráfico de dispersão de preços históricos por época do ano no Cockpit PWA.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
