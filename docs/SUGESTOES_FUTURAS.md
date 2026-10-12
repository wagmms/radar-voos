# 💡 Catálogo de Sugestões de Evolução Futura: Radar de Voos

Este documento armazena o histórico e oportunidades de melhorias identificadas para evolução contínua do Radar de Voos.

---

### 1. Inteligência de Milhas & Pontos
- **Conversão de Paridade Pontos vs Reais**:
  - Integração com programas Smiles, LATAM Pass e Azul Fidelidade.
  - Cálculo do Custo por Milheiro (CPM) em comparação direta com a tarifa pagante em dinheiro.
  - Alerta quando a emissão em pontos for mais vantajosa que a tarifa em reais.

### 2. Notificações Avançadas
- **Web Push API no Cockpit PWA**:
  - Suporte a notificações de sistema operando em background via VAPID keys no Service Worker do navegador.
- **Integração com WhatsApp / Discord**:
  - Canais alternativos de notificação para grupos familiares de viagem.

### 3. Análise de Dados e Exportação
- **Exportação Executiva (CSV e PDF)**:
  - Download das séries históricas de cotação para planejamento financeiro de férias.
- **Previsão de Tendência com Machine Learning Leve**:
  - Algoritmo de regressão linear simples para estimar o melhor momento de compra com base nos dias restantes até o embarque (*advance purchase window*).
