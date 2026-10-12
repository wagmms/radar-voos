# 🚀 Progresso do Projeto: Radar de Voos (v2.5.1)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.5.1 operacional (60/60 testes passando), com motor stealth multicamada de extração direta do Google Flights em custo zero, failover instantâneo para o pool SerpAPI e Two-Way Sync bidirecional com GitHub ativo.
- **Diretriz Prioritária**: Monitoramento proativo 24/7 de tarifas aéreas com custo zero de API, evasão stealth e paridade total de dados.
- **Última Tarefa Concluída**: Implementação do parser multicamada stealth em `src/services/providers/google_flights_direct_provider.js` extraindo voos completos, companhias aéreas, durações e preços em Reais diretamente dos atributos `aria-label` do Google Flights sem gastar cotas da SerpAPI.

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/services/providers/google_flights_direct_provider.js`
- **Função/Componente/Seletor**: `buscarOfertas`
- **Comportamento Esperado / Critério de Aceite**: Expandir parser de tarifas para extrair conexões detalhadas e bagagens diretamente dos blocos de resultados do Google Flights com zero custo de API.

---

## 📋 Backlog Prioritário
- [ ] `src/services/providers/google_flights_direct_provider.js` • `buscarOfertas` • Expandir parser de tarifas para extrair conexões detalhadas e bagagens diretamente dos blocos de resultados do Google Flights.
- [ ] `src/public/app.js` • `renderizarRotas` • Adicionar filtro por faixa de temperatura climática no Cockpit (ex: destinos quentes >25°C vs frios <15°C).
- [ ] `src/services/notifier_telegram.js` • `processarComando` • Adicionar comando `/paridade` para conversão de milhas aéreas (Smiles/Latam Pass) em valor equivalente em reais.

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Integração com API de milhas (Smiles, LATAM Pass, TudoAzul) para cálculo de paridade pontos vs reais.
2. Exportação de histórico de preços para CSV ou PDF executivo.
3. Notificação Push nativa no navegador (Web Push API com VAPID).

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
