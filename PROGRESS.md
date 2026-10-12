# 🚀 Progresso do Projeto: Radar de Voos (v2.2.1)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.2.1 operacional, 100% autônomo (45/45 testes passando), com telemetria SSE, Cockpit PWA corrigido (renderização e métricas ativas), pool de chaves blindado e agendador 24/7 resiliente.
- **Diretriz Prioritária**: Monitoramento proativo 24/7 de tarifas e oportunidades aéreas no GDS com custo zero e zero atraso de blogs externos.
- **Última Tarefa Concluída**: Resolução do bug de exibição de rotas no Cockpit PWA (`src/public/app.js` corrigindo `r.preco_alvo`), implementação de `temChaveDisponivel()` no pool SerpAPI (`src/services/serpapi_pool.js`) e blindagem de exceções no agendador (`src/services/scheduler.js`), garantindo que todas as 8 rotas salvas no SQLite sejam renderizadas com precisão.

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `Dockerfile` e `docker-compose.yml`
- **Função/Componente/Seletor**: Configuração de deploy em produção e persistência de volume SQLite
- **Comportamento Esperado / Critério de Aceite**: Garantir que o contêiner suba na porta 3333 com o volume `./data` persistente em modo WAL sem permissões travadas.

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
