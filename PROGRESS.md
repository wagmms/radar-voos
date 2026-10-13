# 🚀 Progresso do Projeto: Radar de Voos (v2.7.5)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.7.5 operacional (102/102 testes JS + 8/8 testes Python passando). Diretrizes de engenharia consolidadas no `AGENTS.md` e integradas ao autoloop. Autoloop blindado contra travamentos (timeout estrito de 15m / 900s, limpeza automática de travas residuais do Git, auto-kill com `stop_process_group` e auto-rollback defensivo). Notificações no Telegram calibradas para alertar exclusivamente novas funcionalidades (`feat:`), silenciando commits secundários com cooldown de 5 min.
- **Diretriz Prioritária**: Desenvolver o motor de scraping resiliente (`scrapling`) para captura de tarifas da aba Cheapest e caçador proativo de Bug Fares (`proactive-agent`) com alertas por exceção e Z-Score estatístico.
- **Última Tarefa Concluída**: Criado `AGENTS.md` canônico na raiz do repositório definindo padrões de arquitetura (Fastify 4, SQLite WAL, Scrapling, PWA anti-slop); blindado o autoloop (`scripts/autoloop_radarvoos.py`, `autoloop-radarvoos` e `tests/test_autoloop_radarvoos_throttling.py`) contra travamentos com timeout rígido de 15 minutos (900s), limpeza automática de travas residuais (`.git/index.lock`), injeção dinâmica do `AGENTS.md` no prompt e filtro cirúrgico que envia relatórios no Telegram apenas para commits com prefixo `feat:` (8 testes unitários aprovados).

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
