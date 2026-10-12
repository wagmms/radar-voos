# 🚀 Progresso do Projeto: Radar de Voos (v2.7.2)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.7.2 operacional (81/81 testes passando). Parser do `google_flights_direct_provider.js` expandido com extração cirúrgica de escalas/conexões (direto, número de paradas, aeroporto IATA e tempo de layover), modalidades de bagagem (mão, despachada, taxa adicional, item pessoal), sanitização de nomes de companhias aéreas e parsing monetário com separadores de milhar.
- **Diretriz Prioritária**: Aprimorar continuamente a precisão de busca do Google Flights (aba cheapest, conexões, bagagens), detecção de Bug Fares e refinamento de interface PWA via turnos autônomos orientados a skills.
- **Última Tarefa Concluída**: Expandido parser de tarifas em `src/services/providers/google_flights_direct_provider.js` para extrair conexões detalhadas (escalas) e bagagens diretamente dos nós e atributos aria-label e blocos HTML do Google Flights, com 5 novos testes automatizados (81/81 testes aprovados).

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/public/app.js`
- **Função/Componente/Seletor**: `renderizarRotas`
- **Comportamento Esperado / Critério de Aceite**: Adicionar filtro por faixa de temperatura climática no Cockpit PWA (ex: destinos quentes >25°C vs amenos 15-25°C vs frios <15°C) integrando dados de `clima_temp_media`.

---

## 📋 Backlog Prioritário
- [ ] `src/public/app.js` • `renderizarRotas` • Adicionar filtro por faixa de temperatura climática no Cockpit PWA (ex: destinos quentes >25°C vs frios <15°C).
- [ ] `src/services/notifier_telegram.js` • `processarComando` • Adicionar comando `/paridade` para conversão de milhas aéreas (Smiles/Latam Pass) em valor equivalente em reais.
- [ ] `src/services/bug_fare_hunter.js` • `escanearCorredoresProativos` • Adicionar suporte a parâmetros de cabine (Premium Economy e Executiva) na varredura autônoma global.
- [ ] `src/services/flight_scanner.js` • `escanearRota` • Registrar histórico de escalas e bagagens em colunas dedicadas de telemetria no SQLite.

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Integração com API de milhas (Smiles, LATAM Pass, TudoAzul) para cálculo de paridade pontos vs reais.
2. Exportação de histórico de preços para CSV ou PDF executivo.
3. Notificação Push nativa no navegador (Web Push API com VAPID).
4. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.
5. Gráfico de dispersão de preços históricos por época do ano no Cockpit PWA.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
