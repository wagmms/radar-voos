# 🚀 Progresso do Projeto: Radar de Voos (v2.19.1)

> 📁 Histórico completo arquivado em [CHANGELOG.md](CHANGELOG.md)

---

## 📌 Status Atual
- **Estado Geral**: 🟢 Radar v2.19.1 100% operacional com 425/425 testes JS e 10/10 testes Python aprovados. Links de Ida e Volta agora abrem com ambos os trechos preservados via enum canônico `Trip = 1 (ROUND_TRIP)`.
- **Diretriz Prioritária**: Aumentar a precisão de extração e parametrização de voos do Google Flights e refinamento das badges visuais do Cockpit PWA.
- **Última Tarefa Concluída**: `src/domain/rotas.js` · `gerarTfs` · Corrigida codificação do enum `Trip` (ROUND_TRIP=1 vs ONE_WAY=2) conforme `flights.proto` canônico do Google Flights, removendo hardcode de só-ida nos bytes finais; links de ida e volta agora abrem com ambos os trechos preservados e tarifas combinadas corretas; 1 novo teste unitário (425/425 verdes).

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
1. Adotar extração nativa de voos via payload JSON `script.ds:1` (`AF_initDataCallback`) do Google Flights (padrão `fast-flights`), eliminando regexes frágeis em HTML.
2. Integração com API de milhas (Smiles, LATAM Pass, TudoAzul) para cálculo de paridade pontos vs reais em tempo real.
3. Visualização de rotas com arcos ortodrômicos geodésicos SVG (`remotion-maps`) no Cockpit PWA.
4. Notificação Push nativa no navegador (Web Push API com VAPID).
5. Configuração de alertas de Bug Fare por faixa de preço customizada no Telegram.

> 💡 Catálogo completo de sugestões arquivado em [docs/SUGESTOES_FUTURAS.md](docs/SUGESTOES_FUTURAS.md)
