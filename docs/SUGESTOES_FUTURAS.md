# 💡 Catálogo de Sugestões de Evolução Futura: Radar de Voos

Este documento armazena o histórico e oportunidades de melhorias identificadas para evolução contínua do Radar de Voos.

---

### 1. Visualização Cartográfica e Gráfica Leve
- **Visualização de Rotas Ortodrômicas (`remotion-maps`)**:
  - Arcos geodésicos Great Circle em SVG puro renderizados entre coordenadas IATA de origem e destino.
  - Indicadores dinâmicos de escala com visualização de tempo de conexão em cada aeroporto intermediário.
- **Gráficos de Histórico e Frequência Tarifária (`smart-charts`)**:
  - Histogramas de distribuição tarifária e sparklines ultra-leves sem dependências externas.

### 2. Notificações Avançadas
- **Web Push API no Cockpit PWA**:
  - Suporte a notificações de sistema operando em background via VAPID keys no Service Worker do navegador.
- **Alertas Personalizados por Faixa de Preço no Telegram**:
  - Possibilidade de definir alertas por teto customizado e por nível de desconto em relação à média histórica.

### 3. Análise de Dados e Exportação
- **Exportação Executiva (CSV e JSON)**:
  - Download das séries históricas de cotação para planejamento financeiro de viagens.
- **Previsão de Tendência com Estatística Leve**:
  - Algoritmo de média móvel e regressão para estimar a melhor janela de compra com base nos dias restantes até o embarque (*advance purchase window*).
