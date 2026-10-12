# 🚀 Progresso do Projeto: Radar de Voos (v2.6.2)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.6.2 operacional (68/68 testes passando). Implementada geração canônica de Protobuf `tfs` e parâmetro de interface `tfu=EgoIABAAGAAgAigD`, forçando o Google Flights a renderizar diretamente a aba **Cheapest** (Mais Baratos). A rota Rio de Janeiro ➔ Ribeirão Preto está confirmada e persistida em **R$ 587** (Azul com 1 parada, 3h 40min).
- **Diretriz Prioritária**: Priorizar estritamente a menor tarifa real ("Cheapest") que respeite os critérios do usuário (duração máxima e datas) em vez da opção "Best" padrão do Google.
- **Última Tarefa Concluída**: Implementação de `gerarTfs` e `gerarLinkGoogleFlightsCheapest` em `src/domain/rotas.js`, integração em `src/services/providers/google_flights_direct_provider.js`, aumento de timeout de booking para 25s em `src/services/providers/serpapi_provider.js` e validação da rota RIO ➔ RAO em R$ 587.

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/public/app.js`
- **Função/Componente/Seletor**: `renderizarRotas`
- **Comportamento Esperado / Critério de Aceite**: Adicionar tag visual destacando tarifas obtidas pela aba "Cheapest" ou parceiros no card da rota no Cockpit Web.

---

## 📋 Backlog Prioritário
- [ ] `src/public/app.js` • `renderizarRotas` • Adicionar tag visual destacando tarifas obtidas pela aba "Cheapest" ou parceiros no card da rota no Cockpit Web.
- [ ] `src/services/providers/google_flights_direct_provider.js` • `buscarOfertas` • Expandir parser de tarifas para extrair conexões detalhadas e bagagens diretamente dos blocos de resultados do Google Flights.
- [ ] `src/public/app.js` • `renderizarRotas` • Adicionar filtro por faixa de temperatura climática no Cockpit (ex: destinos quentes >25°C vs frios <15°C).
- [ ] `src/services/notifier_telegram.js` • `processarComando` • Adicionar comando `/paridade` para conversão de milhas aéreas (Smiles/Latam Pass) em valor equivalente em reais.

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Integração com API de milhas (Smiles, LATAM Pass, TudoAzul) para cálculo de paridade pontos vs reais.
2. Exportação de histórico de preços para CSV ou PDF executivo.
3. Notificação Push nativa no navegador (Web Push API com VAPID).
4. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.
5. Gráfico de dispersão de preços históricos por época do ano no Cockpit PWA.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
