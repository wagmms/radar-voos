# 🚀 Progresso do Projeto: Radar de Voos (v2.21.0)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.21.0 100% operacional com 439/439 testes JS aprovados. Motor de TLS Impersonation com spoofing Chrome 145 (padrão primp) ativo e serializador Protobuf canônico puro do Google Flights validado.
- **Diretriz Prioritária**: Aumentar a precisão de extração e parametrização de voos do Google Flights e refinamento das badges visuais do Cockpit PWA.
- **Última Tarefa Concluída**: `src/services/providers/tls_impersonate_client.js` e `src/domain/rotas.js` · `fetchComPrimpTls` / `gerarTfs` · Implementada engine de TLS Impersonation via primp (Chrome 145 sobre macOS/Linux) integrada ao ScraplingProvider; serializador Protobuf reestruturado conforme especificação pura `flights.proto` do fast-flights, garantindo hidratação SSR instantânea de voos tanto para Só Ida quanto para Ida e Volta (3 novos testes, 439/439 verdes).

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
