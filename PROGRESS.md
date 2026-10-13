# 🚀 Progresso do Projeto: Radar de Voos (v2.20.0)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.20.0 100% operacional com 436/436 testes JS aprovados. Corrigida a extração de preços (extirpado falso R$ 486 de rodapé) e expandida a busca continental (América do Sul e Europa cobrindo todo o continente).
- **Diretriz Prioritária**: Aumentar a precisão de extração e parametrização de voos do Google Flights e refinamento das badges visuais do Cockpit PWA.
- **Última Tarefa Concluída**: `src/services/providers/scrapling_client.js` e `src/domain/dicionarios.js` · `extrairVoosDoHtml` / `DESTINOS_CONTINENTES` · Eliminada captura de sugestões de rodapé/FAQ (R$ 486 fantasma) via `PADROES_IGNORAR_RODAPE` e remoção da Camada C cega; implementada expansão continental abrangente para múltiplos aeroportos (América do Sul -> SCL R$ 1.655, Europa -> BCN/MAD R$ 3.624 em BRL); 5 novos testes unitários (436/436 verdes); deploy realizado em `main`.

---

## 🎯 Próxima Tarefa em Andamento
- **Arquivo/Módulo Alvo**: `src/public/app.js`
- **Função/Componente/Seletor**: `abrirEdicaoRota` — modal de edição de rota existente
- **Comportamento Esperado / Critério de Aceite**: Pré-preencher os campos `paridade_milhas` e `programa_milhas` no modal de edição quando a rota já tiver esses valores configurados; salvar via `PATCH /api/rotas/:id/milhas` ao confirmar; exibir `milhas_estimadas` atualizado em tempo real no card da rota sem reload da página.

---

## 📋 Backlog Prioritário
- [ ] `src/public/app.js` • `abrirEdicaoRota` • Pré-preencher `paridade_milhas` e `programa_milhas` no modal de edição de rota existente; salvar via PATCH e atualizar card inline sem reload.
- [ ] `src/services/notifier_telegram.js` • `enviarAlertaOportunidade` • Incluir seção "✈️ ~NNN milhas" no card de alerta usando `milhas_estimadas` do resultado de `escanearRota`.
- [ ] `src/public/js/card_rota.js` • `renderizarBadgesMilhas` • Consumir `milhas_estimadas` já calculado no payload do `GET /api/rotas` (sem recalcular no cliente), exibindo badge de milhas estimadas no card.

---

## 💡 Sugestões Futuras (Buffer Leve)
1. Integração com API de milhas (Smiles, LATAM Pass, TudoAzul) para cálculo de paridade pontos vs reais em tempo real.
2. Visualização de rotas com arcos ortodrômicos geodésicos SVG (`remotion-maps`) no Cockpit PWA.
3. Notificação Push nativa no navegador (Web Push API com VAPID).
4. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.
5. Gráfico de dispersão de preços históricos por época do ano no Cockpit PWA.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
