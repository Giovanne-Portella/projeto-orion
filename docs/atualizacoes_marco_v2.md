# 🌌 Projeto Órion - Documentação de Atualizações
**Data:** Março de 2026
**Módulo:** Motor de Disparo, UI e Integração Invenio

Esta documentação detalha as implementações de filtros avançados, otimização de performance e a reestruturação do motor de disparos para processamento concorrente.

## 1. Inteligência de Dados: Integração Robbu Verify
- **Merge Automático de Bases:** O modal de inserção de base limpa (`MailingUploadCleanModal`) agora identifica automaticamente a presença do relatório "Robbu Verify" via API. Ele realiza o download em background e cruza os dados (telefone/CPF), injetando a coluna `Robbu Verify` na base final sem intervenção manual.
- **Filtro de Propensão Multi-escolha:** Implementação de seleção múltipla (Checkboxes) para as propensões tanto na etapa de Upload quanto na configuração do Bloco. 
- **Preservação de Base:** Contatos que não correspondem ao filtro do bloco não são descartados nem consumidos. Eles são pulados (Skipped), permitindo que a mesma base seja utilizada posteriormente para outras propensões.

## 2. Otimização de UI e Performance
- **Correção de Stacking Context (Z-Index):** Adoção de **React Portals** (`createPortal`) em todos os modais. Isso teletransporta a renderização dos modais direto para o `<body>`, corrigindo o bug onde o Header/Sidebar sobrepunha o fundo escuro do modal.
- **Paginação Server-Side de Templates:** O `TemplatePickerModal` foi reescrito. Em vez de carregar milhares de templates de uma vez ao selecionar a WABA (causando travamentos), o modal agora faz paginação dinâmica (20 por página) diretamente na API da Invenio (`/campaigns/whatsapp/templates`).
- **Busca com Debounce:** Inclusão de um sistema de busca em tempo real com atraso de 600ms (Debounce) para evitar sobrecarga de requisições (Rate Limit) na API da Robbu.

## 3. Gestão Avançada de Relatórios
- **Rastreabilidade Total:** O relatório do bloco foi atualizado para registrar não apenas os sucessos/erros, mas também os contatos "Ignorados pelo Filtro".
- **Novas Colunas:** Adição das colunas visuais e no CSV de Exportação: `Ação` (Disparado / Não Disparado) e `Propensão` (Alta, Média, Baixa, etc).
- **Métricas Visuais:** Novos painéis de contagem no modal de relatórios indicando claramente os contatos ignorados.

## 4. Novo Motor de Disparo Concorrente (Load Balancing)
- **Play/Pause Individual de Blocos:** Quebra do processamento linear. Agora, os blocos dentro de uma fila possuem seus próprios controles de Play/Pause.
- **Round-Robin Assíncrono:** O motor central (`QueueManager/index.jsx`) foi refatorado para ler todos os blocos ativos e distribuir a fila de contatos de forma intercalada (um para o Bloco A, um para o Bloco B, repetindo sucessivamente).
- **Memória de Consumo Global (`consumed`):** Implementada uma memória de estado na fila para garantir que dois blocos processando simultaneamente nunca enviem mensagem para o mesmo contato.
- **Ponteiros Independentes:** Cada bloco varre o CSV no seu próprio ritmo (`currentIndex`), e a fila só ganha o status "Finalizada" (Verde) quando não restam mais contatos válidos ou todos os blocos esgotaram suas cotas/status.