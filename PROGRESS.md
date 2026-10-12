# 🚀 Progresso do Projeto: Radar de Voos (v2.3.0)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.3.0 operacional, 100% autônomo (48/48 testes passando), com recurso de Voo Flexível Sem Data Fixa (Best Price Explorer / Anytime), telemetria SSE, Cockpit PWA com chip de filtro flexível e agendador 24/7 resiliente.
- **Diretriz Prioritária**: Monitoramento proativo 24/7 de tarifas e oportunidades aéreas no GDS com custo zero e zero atraso de blogs externos.
- **Última Tarefa Concluída**: Implementação completa da opção de voo flexível sem data fixa movida a menor preço (`sem_data: 1`), gerador de janelas estratégicas multi-mês (`src/domain/rotas.js`), eleição da menor tarifa (`src/services/flight_scanner.js`), endpoints REST (`src/server/routes/rotas_routes.js`), alertas do Telegram (`src/services/notifier_telegram.js`) e interface PWA (`src/public/index.html`, `src/public/app.js`, `src/public/styles.css`).

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
