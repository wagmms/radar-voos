# 🚀 Progresso do Projeto: Radar de Voos (v2.0)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Sistema autônomo concluído, testado (20/20 testes passando) e pronto para produção.
- **Diretriz Prioritária**: Manter monitoramento autônomo, Cockpit PWA e bot do Telegram integrados.
- **Última Tarefa Concluída**: Separação completa do repositório `Rotina`, criação do projeto `RadarVoos` em Node.js 24 + Fastify + SQLite nativo, PWA Cockpit e testes automatizados.

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/index.js` e `.env`
- **Função/Componente/Seletor**: Inicialização e monitoramento contínuo em produção
- **Comportamento Esperado / Critério de Aceite**: Execução autônoma em segundo plano ou via Docker com 100% de estabilidade.

---

## 📋 Backlog Prioritário
- [ ] `src/services/flight_scanner.js`: Adicionar suporte a múltiplos passageiros e seleção de cabine (econômica premium / executiva quando solicitada).
- [ ] `src/public/app.js`: Implementar visualização em mapa de calor geográfico para destinos monitorados.
- [ ] `src/services/notifier_telegram.js`: Implementar callback queries inline no Telegram para forçar verificação de rota com 1 clique direto no chat.

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Integração com API de milhas (Smiles, LATAM Pass, TudoAzul) para cálculo de paridade pontos vs reais.
2. Alerta sonoro de cabine de avião no PWA Cockpit quando um novo Bug Fare for detectado.
3. Exportação de histórico de preços para CSV ou PDF executivo.
