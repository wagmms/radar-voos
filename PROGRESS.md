# 🚀 Progresso do Projeto: Radar de Voos (v2.4.0)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.4.0 operacional, 100% autônomo (50/50 testes passando), com persistência canônica e Two-Way Sync de rotas com GitHub e LocalStorage, eliminando a perda de rotas após novos deploys.
- **Diretriz Prioritária**: Monitoramento proativo 24/7 de tarifas e oportunidades aéreas no GDS com custo zero e zero atraso de blogs externos.
- **Última Tarefa Concluída**: Implementação da via de mão dupla de rotas: arquivo canônico versionado `data/rotas.json`, serviço `RotasSyncService` (`src/services/rotas_sync.js`) com auto-commit na GitHub Contents API, endpoints de backup/restauração (`GET /api/rotas/exportar`, `POST /api/rotas/importar`, `POST /api/rotas/sincronizar-github`) e botões com auto-contingência em LocalStorage no Cockpit PWA (`src/public/index.html`, `src/public/app.js`).

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
