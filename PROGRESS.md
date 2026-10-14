# 🚀 Progresso do Projeto: Radar de Voos (v3.4.1)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Blindagem cambial estrita em Reais (`BRL`) implementada em 100% da cadeia de scraping, requisições HTTP/TLS, parsing de `script.ds:1` e detecção de Bug Fares, com 422/422 testes aprovados (100% de sucesso).
- **Camadas Entregues & Verificadas**:
  - `src/domain/rotas.js`: URLs de busca e aba Cheapest (`gerarLinkGoogleFlights`, `gerarLinkGoogleFlightsCheapest` e `gerarTfs`) forçam `curr=BRL&gl=BR&hl=pt-BR` e sincronizam o teto de preço (`maxPrice`) na moeda BRL.
  - `src/services/providers/scrapling_client.js`: Headers com `Accept-Language: pt-BR,pt;q=0.9`; conversão de tupla `fare` no `script.ds:1` de `USD` para `BRL` via `USD_BRL_RATE` (padrão `5.80`), convertendo `preco`, `priceInsights`, `decodificarPrecoDoTfu` e alimentando `topOfertas` e `melhorOpcaoDiretaOuRapida` já em Reais; fallback HTML com priorização de `R$` e conversão de `US$` com negative lookbehind `(?<!R)\$`.
  - `src/services/providers/tls_impersonate_client.js`: Injeção de `Accept-Language: pt-BR,pt;q=0.9` na sessão do cliente TLS primp.
  - `src/domain/bug_fares.js`: Função exportada `extrairPrecoEmBrl(texto, taxaCambio)` com negative lookbehind `(?<!R)\$` para evitar falsos bug fares gerados por confusão cambial de USD com BRL.
  - **Suíte de Testes**: 422/422 testes aprovados (100% de sucesso no `./validate.sh fast`).
- **Diretriz Prioritária**: Implementar telemetria em tempo real com Server-Sent Events (SSE) e sparkline SVG de histórico no Cockpit PWA.
- **Última Tarefa Concluída**: Blindagem cambial estrita em Reais (`BRL`) em URLs, headers TLS, parser `script.ds:1`, HTML fallback e `BugFareHunter`.

---

## 🎯 Próxima Tarefa em Andamento (Turno 4C)
- **Arquivo/Módulo Alvo**: `src/public/js/card_rota.js` & `src/server/routes/monitor_routes.js`
- **Função/Componente/Seletor**: `renderizarSparklineSvg` e rota `/api/stream/telemetria`
- **Comportamento Esperado / Critério de Aceite**: Desenhar sparkline em SVG puro para o histórico de preços dos últimos 10 checks na rota e transmitir eventos SSE para atualização em tempo real sem reload manual.

---

## 📋 Backlog Prioritário
- [ ] `src/public/js/card_rota.js` • `renderizarSparklineSvg` • Desenhar sparkline em SVG puro para o histórico de preços dos últimos 10 checks na rota.
- [ ] `src/server/routes/monitor_routes.js` • Rota `/api/stream/telemetria` • Transmitir eventos SSE em tempo real para atualização automática dos cards no Cockpit PWA sem reload manual.
- [ ] `src/public/sw.js` • Service Worker Push • Adicionar handler de notificações Web Push nativas para alertar oportunidades e bug fares com o app fechado.

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Visualização de rotas com arcos ortodrômicos geodésicos SVG (`remotion-maps`).
2. Notificação Push nativa no navegador (Web Push API com VAPID).
3. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.
4. Gráfico de dispersão de preços históricos por época do ano (`smart-charts`).
5. Exportação de dados de histórico tarifário em formato CSV/JSON via API.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
