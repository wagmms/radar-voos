# 🚀 Progresso do Projeto: Radar de Voos (v2.9.7)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.9.7 100% operacional com 222/222 testes JS e 10/10 testes Python aprovados. Decodificação de payload Protobuf `tfu` (Base64URL) implementada no ScraplingProvider com extração multicamada (4ª camada) cobrindo respostas AJAX e URLs de redirecionamento para a aba Cheapest do Google Flights.
- **Diretriz Prioritária**: Aumentar a taxa de sucesso de extração da aba Cheapest do Google Flights via decodificação de payload `tfu` e persistência do Working Buffer.
- **Última Tarefa Concluída**: `src/services/providers/scrapling_client.js` · `extrairPrecoCheapestTab` & `decodificarPrecoDoTfu` · Implementada 4ª camada de extração via decode Base64URL do payload Protobuf canônico `tfu` (moeda e escala de centavos), capturando tarifas mínimas em respostas AJAX e URLs de redirecionamento sem corpo HTML rico. 10 novos testes adicionados (222/222 verdes).

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/services/bug_fare_hunter.js`
- **Função/Componente/Seletor**: `escanearCorredoresProativos` (com métodos auxiliares `salvarWorkingBufferDisco` / `carregarWorkingBufferDisco`)
- **Comportamento Esperado / Critério de Aceite**: Persistir o cache do Working Buffer em disco (`data/working_buffer.json`) de forma atômica após cada ciclo de varredura e recarregá-lo no boot da classe, garantindo retenção de memória e volatilidade zero após reinicializações do processo.

---

## 📋 Backlog Prioritário
- [ ] `src/services/providers/scrapling_client.js` • `extrairVoosDoHtml` • Adicionar fallback de extração de companhia aérea por código IATA de 2 letras diretamente da matriz de voos do Google Flights.
- [ ] `src/public/app.js` • `renderizarRotas` • Refinar renderização de badges de conexões com exibição de escala noturna / stopover em cards móveis.
- [ ] `src/domain/calculadora.js` • `avaliarCustoDestinoComTotal` • Suporte a moedas dinâmicas e conversão de diárias internacionais para destinos fora do dicionário base.
- [ ] `src/domain/rotas.js` • `gerarLinkGoogleFlightsCheapest` • Suporte a múltiplos passageiros e seleção de cabine (Premium Economy / Business) no payload tfs.

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Integração com API de milhas (Smiles, LATAM Pass, TudoAzul) para cálculo de paridade pontos vs reais.
2. Visualização de rotas com arcos ortodrômicos geodésicos SVG (`remotion-maps`) no Cockpit PWA.
3. Notificação Push nativa no navegador (Web Push API com VAPID).
4. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.
5. Gráfico de dispersão de preços históricos por época do ano no Cockpit PWA.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
