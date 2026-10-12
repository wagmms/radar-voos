# 🚀 Progresso do Projeto: Radar de Voos (v2.6.4)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.6.4 operacional (70/70 testes passando). Implementado seletor de tipo de viagem explícito (Ida e Volta vs Apenas Ida), indicador dinâmico de escopo de teto (`#badge-teto-escopo`) e caixa explicativa contextual (`#hint-teto-explicacao`) para voos de datas flexíveis e fixas no Cockpit PWA, cards de rotas e Telegram.
- **Diretriz Prioritária**: Fornecer máxima clareza ao usuário sobre para qual modalidade (Só Ida vs Ida e Volta) o teto de preço está sendo configurado e monitorado pelo radar.
- **Última Tarefa Concluída**: Implementação do seletor de tipo de viagem, indicador dinâmico contextual do teto no modal, exibição de teto nos cards e cobertura automatizada de testes para flexibilidade Só Ida vs Ida e Volta.

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
