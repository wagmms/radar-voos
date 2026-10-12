# 🚀 Progresso do Projeto: Radar de Voos (v2.2)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.2 operacional, 100% autônomo (44/44 testes passando), com telemetria SSE, matriz de flexibilidade de datas (±0 a ±7 dias), alerta sonoro de cabine Web Audio API e motor estatístico de detecção de Bug Fares no GDS com zero dependência de RSS.
- **Diretriz Prioritária**: Monitoramento proativo 24/7 de tarifas e oportunidades aéreas no GDS com custo zero e zero atraso de blogs externos.
- **Última Tarefa Concluída**: Implementação da Matriz de Flexibilidade de Datas (±0 a ±7 dias), detecção estatística de Bug Fares (pisos regionais Europa/EUA/América do Sul/Ásia e quedas >50%), eliminação do RSS e inclusão do Chime de cabine via Web Audio API.

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
