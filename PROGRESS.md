# 🚀 Progresso do Projeto: Radar de Voos (v2.9.5)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.9.5 100% operacional com 211/211 testes JS e 10/10 testes Python aprovados. Detecção de deltas com Z-Score implementada no FlightScanner com supressão de ruído para oscilações normais (INFO) em `alertasRepo` e orquestração modular de varredura em `FlightScanner.executarCicloVarredura`.
- **Diretriz Prioritária**: Aumentar a taxa de sucesso de extração da aba Cheapest do Google Flights via decodificação de payload `tfu` e persistência do Working Buffer.
- **Última Tarefa Concluída**: `src/services/flight_scanner.js` · `executarCicloVarredura` & `src/domain/calculadora.js` · `classificarDeltaPreco` · Detecção de deltas estatísticos com Z-Score, supressão de ruído INFO em rotas monitoradas e orquestração limpa de ciclo de varredura LRU integrada ao scheduler. 6 novos testes (211/211 verdes).

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/services/providers/scrapling_client.js`
- **Função/Componente/Seletor**: `extrairPrecoCheapestTab` (motor de extração de tarifas da aba Cheapest)
- **Comportamento Esperado / Critério de Aceite**: Adicionar 4ª camada de extração via decode base64url do parâmetro canônico `tfu` da URL de resposta para capturar tarifas mínimas em respostas AJAX de redirecionamento que retornam sem corpo HTML rico, prevenindo perda de ofertas baratas.

---

## 📋 Backlog Prioritário
- [ ] `src/services/bug_fare_hunter.js` • `escanearCorredoresProativos` • Persistir Working Buffer em `data/working_buffer.json` para sobreviver a reinicializações do processo (volatilidade zero após restart).
- [ ] `src/services/providers/scrapling_client.js` • `extrairVoosDoHtml` • Adicionar fallback de extração de companhia aérea por código IATA de 2 letras diretamente da matriz de voos do Google Flights.
- [ ] `src/public/app.js` • `renderizarRotas` • Refinar renderização de badges de conexões com exibição de escala noturna / stopover em cards móveis.
- [ ] `src/domain/calculadora.js` • `avaliarCustoDestinoComTotal` • Suporte a moedas dinâmicas e conversão de diárias internacionais para destinos fora do dicionário base.

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Integração com API de milhas (Smiles, LATAM Pass, TudoAzul) para cálculo de paridade pontos vs reais.
2. Visualização de rotas com arcos ortodrômicos geodésicos SVG (`remotion-maps`) no Cockpit PWA.
3. Notificação Push nativa no navegador (Web Push API com VAPID).
4. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.
5. Gráfico de dispersão de preços históricos por época do ano no Cockpit PWA.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
