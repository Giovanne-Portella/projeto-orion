Documentação de Atualizações Recentes - Projeto Órion
Data das atualizações: Fevereiro de 2026
Objetivo: Registrar as refatorações e novas funcionalidades implementadas no motor de disparo e na gestão de filas para servir de contexto em manutenções futuras.

1. Isolamento de Autenticação por Ambiente (Multi-Tenant)
O Problema Anterior: O sistema utilizava o token de login do usuário logado globalmente para todas as requisições, o que impedia o isolamento correto dos limites e acessos de diferentes clientes (cards).

A Solução: * Foi criado um botão "Autenticar Ambiente" no cabeçalho do QueueManager.jsx.

Este botão abre um modal para inserir Company, Username e Password, fazendo uma requisição para a rota /login da Robbu.

O access_token e o private_token retornados são salvos no localStorage vinculados ao ID do cliente (ex: orion_tenant_token_{clientId}).

O arquivo src/services/api.js foi refatorado para receber o clientId nas funções (ex: uploadMailing(form, clientId)) e injetar o token isolado através do header Custom-Auth.

2. Remoção Total do Ambiente de Homologação (HML)
O Problema Anterior: O sistema possuía uma lógica complexa de bifurcação (isHml) e um SimulationContext que poluía o código de produção e trazia riscos de impactar disparos reais.

A Solução:

O SimulationContext e a aba "Homologação" foram integralmente removidos.

O código do QueueManager.jsx agora é estritamente focado no ambiente de Produção, simplificando a manutenção do motor de disparo.

3. Correção do Erro 400 e Automação do Payload (SendMessage)
O Problema Anterior: A API de disparo estava retornando erro 400 (Bad Request) devido ao envio fixo do campo walletClientCode: "comercial". Além disso, o operador precisava mapear manualmente as colunas do CSV para o Payload toda vez.

A Solução:

O campo walletClientCode passou a ser enviado como "" (vazio) por padrão, o que resolveu o Erro 400.

Mapeamento Automático: O modal de configuração da API foi enxugado. O motor de disparo (runProductionQueue) agora busca os dados diretamente das colunas padronizadas do CSV (VALOR_DO_REGISTRO, NOME_CLIENTE, CPFCNPJ, CODCLIENTE, TAG e CORINGA1 a CORINGA5).

A prioridade do texto da mensagem agora é a coluna MENSAGEM do CSV; se estiver vazia, ele faz o fallback para o texto fixo configurado na UI.

4. Correção do Bug de Duplo Disparo (Race Condition / Strict Mode)
O Problema Anterior: Ao iniciar uma fila, o React Strict Mode (no ambiente de desenvolvimento) disparava a atualização de estado duas vezes, o que abria duas "threads" paralelas no motor while, enviando mensagens duplicadas para o mesmo número.

A Solução:

Foi implementada uma Trava de Segurança (Thread Lock) utilizando useRef (activeRuns.current[queueId]).

A função setTimeout(() => runProductionQueue(queueId), 0) foi movida para fora da função setState (setProdQueues), garantindo que o motor seja acionado apenas uma vez por clique.

Forçamos o salvamento síncrono no localStorage antes da thread ler o status, evitando problemas de dessincronização de cache.

5. Feedback Visual, Logs e Relatórios em Tempo Real
O Problema Anterior: Não havia como saber quais contatos falharam durante o envio, nem baixar um relatório da campanha.

A Solução:

Logs no Motor: O bloco try/catch do fetch da SendMessage agora captura o Status HTTP exato (200, 400, 401, 500) e o Response completo da API.

Storage de Relatórios: Esses dados são salvos imediatamente no localStorage via função saveBlockReport atrelados ao ID do Bloco.

Cores Inteligentes (UI): * Blocos/Filas que apresentam erro de API ficam vermelhos (e a Fila pisca em vermelho se ainda estiver rodando).

Blocos que terminam 100% lisos ficam verdes.

Modal de Relatório do Bloco: Ao clicar em um Bloco, o operador visualiza um resumo (Sucesso vs Falhas), os últimos logs processados, e botões para Excluir Logs ou Baixar CSV detalhado.

6. Módulo de Retentativa Automática
A Solução: Adicionada uma funcionalidade dentro do Modal de Relatório do Bloco.

O sistema lista todos os "Erros Únicos" que ocorreram no bloco (Ex: 400, 500).

O operador pode selecionar as checkboxes dos erros e clicar em "Criar Nova Base de Retentativa".

O sistema extrai os contatos originais que sofreram aquele erro específico e gera dinamicamente uma nova "Base Limpa" na aba "Bases / Mailings", pronta para ser vinculada a uma nova fila.

7. Mock de Base Padrão Injetado
O Problema Anterior: Testar o disparo requeria fazer upload de um CSV manualmente toda vez que um novo cliente era aberto.

A Solução:

Um array chamado MOCK_MAILING contendo contatos pré-definidos (baseado no layout padrão da Invenio) foi hardcoded no código.

Na inicialização do estado mailings, o sistema verifica se essa base mockada já existe naquele cliente. Se não existir, ela é injetada automaticamente, nascendo com o status de "Base Limpa" e "Configurada", pronta para vincular a uma fila e testar o disparo imediatamente.

Arquivos Principais Modificados:
src/pages/Dashboard/QueueManager.jsx: Arquivo mais alterado, onde residem a UI, o Motor de Disparo Integrado, Modais e a Lógica de Armazenamento de Relatórios.

src/services/api.js: Atualizado para suportar o clientId em todos os endpoints (mailingService e configService), aplicando o header customizado correto.