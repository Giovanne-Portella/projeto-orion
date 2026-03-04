Documentação Técnica - Atualizações Março 2026

Visão Geral

As atualizações de março de 2026 focaram na reestruturação arquitetural do motor de disparos (QueueManager) e na implementação de lógicas avançadas de controle de recursos (Rate Limit) e automação de operação (Agendamento de Filas).

A transição de um código monolítico para um formato componentizado garante escalabilidade para as próximas funcionalidades (como a futura aba de Arquivados) sem comprometer a estabilidade do orquestrador.

1. Refatoração Arquitetural: Modularização do QueueManager

O arquivo monolítico QueueManager.jsx (que possuía mais de 1.100 linhas) foi fatiado utilizando padrões modernos do React, preservando 100% da regra de negócio original.

Nova Estrutura de Pastas

src/pages/Dashboard/QueueManager/
├── index.jsx                 # Orquestrador Central (Motor de Disparo e Estados Globais)
├── components/
│   └── Cards.jsx             # UI: StatCard, QueueCard, BlockCard e CreateQueueForm
└── modals/
    ├── QueueModals.jsx       # UI: AuthModal, AddBlockModal, BlockDetailModal e TemplatePickerModal
    └── MailingModals.jsx     # UI: InvenioUploadModal, MailingUploadCleanModal, SendMessageConfigModal
src/utils/
└── reportUtils.js            # Lógica extraída de persistência (localStorage) e Constantes


Impactos Positivos

Isolamento de Erros: O Crash de um modal não derruba o fluxo do Thread Lock (useRef(activeRuns)).

Prop Drilling Seguro: Funções de salvamento (onSaveBlock) são passadas de forma explícita para manter a centralização de estados no orquestrador (index.jsx).

2. Automação: Agendamento de Filas via Cronjob Local

Foi implementado um sistema de disparo autônomo sem necessidade de intervenção do operador para o momento exato do disparo.

UI (Cards.jsx): Adicionado checkbox opcional no CreateQueueForm que exibe um input datetime-local e repassa o valor scheduledAt para o Orquestrador.

Status Visual: Filas agendadas ganham o status roxo (scheduled) com o ícone de relógio e a data de início programada.

Cronjob Local (index.jsx):

Utiliza um useEffect contendo um setInterval de 5 segundos.

Verifica todas as filas salvas no localStorage. Se a data atual new Date() for maior ou igual ao scheduledAt, a fila inicia automaticamente.

Segurança Pré-Disparo: O cronjob checa antes se a base está limpa, se o payload está configurado e se a fila possui blocos. Em caso negativo, a fila vai para o status de erro (paused + hasError).

Intervenção manual: Se o usuário clicar no botão "Play" manualmente antes da hora, o agendamento é limpo (scheduledAt: null) e a fila roda imediatamente.

3. Rate Limit Avançado: Cálculo Global e Devolução de Saldo

A regra de consumo de capacidade da Linha WABA (bmCapacity) foi reconstruída para refletir a utilização real, evitando "sequestro" de cota.

Leitura Dinâmica: O AddBlockModal agora lê o objeto exato da API (rate do número retornado no endpoint /settings/channels/whatsapp).

Bloqueio Global (Uso Concorrente): O componente varre todas as filas ativas no ambiente do cliente (allQueues) para calcular quanto daquela mesma linha já está alocado. O slider (maxPercentage) bloqueia o usuário caso não haja saldo.

Algoritmo de Devolução (Refund):
Se uma fila reserva 50% (ex: 500 mensagens) de uma linha, mas é finalizada tendo disparado apenas 10 mensagens:

O sistema detecta o status finalizado (block.status === 'completed' ou queue.status === 'completed').

Em vez de considerar a intenção (os 500), ele passa a somar na conta global apenas as mensagens de fato processadas (b.processed).

O saldo excedente (490 mensagens) volta a ficar disponível imediatamente no cálculo de "Rate Livre".

4. UX: Gestão de HSM via Template Picker Modal

Substituição do input <select> estático por um modal de navegação avançada.

Problema Resolvido: Contas com milhares de templates geravam lentidão de renderização e dificultavam a busca visual do template desejado.

TemplatePickerModal (QueueModals.jsx):

Abre "por cima" do modal de blocos.

Renderiza Cards visuais com paginação limite de 20 templates por página.

Busca em Tempo Real: Permite ao operador digitar um termo que filtra tanto o nome (t.name) quanto o conteúdo de texto do HSM (t.body).

Preview Visual: Caso o HSM contenha um cabeçalho de imagem (acessível via t.header_file.url que armazena os assets da Storage Robbu), a imagem é renderizada como thumbnail no card.

Tag de Qualidade: Identificador visual para templates marcados como APPROVED na listagem da API.

5. Bloqueio Lógico Pós-Processamento

Para manter a integridade dos relatórios, uma fila agora possui um ciclo de vida estrito e fechado:

Ocultação de Adição de Blocos: Modificação no QueueCard para que o botão de "Add Bloco" só seja renderizado caso a fila esteja nos status paused ou running (queue.status !== 'completed' && !queue.blocked).

Uma fila finalizada serve apenas como base de dados analítica, passível apenas da exclusão de relatórios antigos ou encaminhamento para um possível estado futuro de "Arquivamento".