# Projeto Órion - Manual Técnico de Contexto

## 1. Visão Geral Técnica

O **Projeto Órion** é uma aplicação web Single-Page Application (SPA) construída com **React** e **Vite**. Seu principal objetivo é fornecer uma interface gráfica para o gerenciamento e automação de campanhas de mensageria, consumindo um conjunto de APIs da Robbu. A aplicação é dividida em duas áreas principais: um **Painel de Controle** para configuração da infraestrutura de envio (Filas e Blocos) e uma página de **Importação** para o gerenciamento do ciclo de vida das campanhas (upload, processamento e disparo).

A persistência de dados da interface (configuração de filas, estado de importação) é gerenciada via `localStorage` do navegador.

---

## 2. Estrutura de Dados e Persistência (`localStorage`)

A aplicação utiliza o `localStorage` para manter o estado entre sessões, garantindo que a configuração do usuário não seja perdida.

-   **`orion_dashboard_queues`**: Armazena um array de objetos, onde cada objeto representa uma **Fila de Disparo** criada no Painel de Controle.
    -   **Estrutura da Fila**:
        ```json
        {
          "id": "q-171588... ",
          "name": "Campanha de Boas-Vindas",
          "segmentId": "2B78BF6B2476E5A2",
          "segmentName": "Nome do Segmento",
          "status": "paused" | "running",
          "activeBlockIndex": 0,
          "blocks": [ ... ] // Array de objetos de Bloco
        }
        ```
    -   **Estrutura do Bloco**:
        ```json
        {
          "id": "b-171588...",
          "waba": { "id": "9301E1A161C2658A", "description": "HELPROBBU - waba Robbu" },
          "line": { "id": "E939248042765722", "phone": "+5511957245070", "quality": "GREEN" },
          "template": { "id": "6AFABD7276D90680", "name": "acabate", "quality": "UNKNOWN" },
          "config": { "reportLimit": 1000 },
          "currentReports": 0
        }
        ```

-   **`orion_dashboard_stats`**: Armazena um objeto com estatísticas globais, como o total de mensagens enviadas.

-   **`orion_flow_v8_final`**: Salva o estado da página de importação, permitindo que o usuário continue um processo de upload mesmo que feche a aba.

-   **`orion_token` / `orion_user`**: Armazenam o token de autenticação (`access_token`) e os dados do usuário logado, respectivamente.

---

## 3. Módulos de Serviço (API & Lógica)

Toda a comunicação com as APIs e a lógica de negócio principal estão encapsuladas em serviços.

### 3.1. `src/services/api.js`

Este arquivo centraliza a configuração e as chamadas de API.

-   **Instâncias `axios`**:
    -   `api`: Configurada com `baseURL: 'https://inveniocenterapi.robbu.global/v1'`. Usada para a maioria das operações (mailings, configurações).
    -   `sendMessageApi`: Configurada com `baseURL: 'https://api.robbu.global/v1'`. Instância dedicada para o endpoint `/sendmessage`, que possui uma URL base diferente.
    -   Ambas as instâncias possuem um interceptor que injeta o `Authorization: Bearer {token}` em todas as requisições.

-   **`authService`**:
    -   `login`: Autentica o usuário no endpoint `https://api-accounts.robbu.global/v1/login` e salva o `access_token` e os dados do usuário no `localStorage`.
    -   `logout`: Remove os dados de autenticação do `localStorage`.

-   **`mailingService`**:
    -   `getSegments`: `GET /wallets` - Busca a lista de segmentos (carteiras).
    -   `uploadMailing`: `POST /mailings` - Envia o arquivo CSV e as configurações de processamento como `multipart/form-data`.
    -   `checkStatus`: `GET /mailings/status` - Utilizado para o polling do status de processamento do mailing.

-   **`configService`**:
    -   `getWABAs`: `GET /settings/channels/whatsapp-accounts` - Busca as BMs (WABAs) disponíveis.
    -   `getLines`: `GET /settings/channels/whatsapp` - Busca as linhas associadas a uma `whatsapp_account_id`.
    -   `getSettings`: `GET /settings` - Busca configurações gerais da conta, incluindo o `invenioPrivateToken`.
    -   `getTemplates`: `GET /campaigns/whatsapp/templates` - Busca os templates associados a uma `whatsapp_account_id`.

### 3.2. `src/services/messageEngine.js`

Este é o "cérebro" do disparo, responsável por montar o payload de cada mensagem.

-   **`buildMessagePayload(contactRow, payloadOptions)`**:
    -   **Input**: Recebe a linha de dados do contato (`contactRow` do CSV) e as configurações da UI (`payloadOptions`).
    -   **Lógica de Mapeamento Automático**:
        -   **`destination.phoneNumber`**: Extraído de `contactRow.VALOR_DO_REGISTRO` ou `contactRow.TELEFONE`.
        -   **`text`**: Prioriza o valor da coluna `contactRow.MENSAGEM`. Se estiver vazia, utiliza o texto configurado na UI.
        -   **`contact` (Objeto)**: É totalmente montado a partir das colunas do CSV:
            -   `name` ← `contactRow.NOME_CLIENTE`
            -   `id` ← `contactRow.CPFCNPJ`
            -   `customCode` ← `contactRow.CODCLIENTE`
            -   `tag` ← `contactRow.TAG`
            -   `jokers` (array) ← `contactRow.CORINGA1` a `contactRow.CORINGA5`
    -   **Lógica de Placeholders**: A função `resolvePlaceholders` substitui variáveis como `[NOME_CLIENTE]` nos campos de texto e parâmetros de template pelos valores correspondentes do `contactRow`.

-   **`sendSingleMessage(payload)`**:
    -   Recebe o payload montado.
    -   Faz a chamada `POST /sendmessage` utilizando a instância `sendMessageApi`.

---

## 4. Componentes Principais (Frontend)

### 4.1. `Dashboard.jsx` (`/dashboard`)

-   **Gerenciamento de Estado**:
    -   `queues`: Array de objetos de Fila, lido e persistido no `localStorage` (`QUEUES_STORAGE_KEY`).
    -   `stats`: Objeto de estatísticas, lido e persistido no `localStorage` (`STATS_STORAGE_KEY`).
-   **Fluxo de Criação de Bloco (`AddBlockModal`)**:
    1.  O usuário seleciona uma **BM (WABA)** no primeiro dropdown.
    2.  O `useEffect` dispara chamadas em cascata: `configService.getLines(wabaId)` e `configService.getTemplates(wabaId)`.
    3.  Os resultados populam os dropdowns de Linha e o modal de seleção de Template.
    4.  Ao submeter, um novo objeto de Bloco é criado e adicionado à Fila correspondente no estado `queues`.

### 4.2. `ImportPage.jsx` (`/import`)

Gerencia o ciclo de vida de uma campanha de disparo.

-   **Máquina de Estados (`step`)**: O componente opera com base no estado `step`, que controla qual seção da UI é exibida:
    -   `'upload'`: Formulário inicial para upload do CSV e configurações.
    -   `'processing'`: Tela de "loading" enquanto a API processa o mailing (controlado por polling).
    -   `'results'`: Exibe o resumo do processamento e os links para download dos resultados.
    -   `'loading_audience'`: "Loading" enquanto o CSV higienizado é baixado e parseado.
    -   `'campaign'`: Tela final para vincular a campanha a uma Fila e configurar o disparo.

-   **Motor de Disparo (`startEngine`)**:
    -   É uma função `async` que opera em um loop `while`, processando um contato do array `contactsToSend` por iteração.
    -   **Busca de Fila**: No início, busca a Fila selecionada no `localStorage` para ter a configuração mais atualizada.
    -   **Lógica de Rotação de Bloco**:
        1.  Identifica o bloco ativo (`activeBlock = currentQueue.blocks[currentQueue.activeBlockIndex]`).
        2.  Verifica se `activeBlock.currentReports >= activeBlock.config.reportLimit`.
        3.  Se o limite for atingido, incrementa `currentQueue.activeBlockIndex`.
        4.  Se não houver mais blocos (`nextBlockIndex >= currentQueue.blocks.length`), a fila é pausada (`queues[queueIndex].status = 'paused'`) e o loop é interrompido.
    -   **Montagem Dinâmica do Payload**:
        1.  Cria uma cópia das `payloadOptions` da UI.
        2.  Sobrescreve `values.source.phoneNumber` e `values.templateName` com os dados do bloco ativo.
        3.  Força `include.templateName = true` para garantir que o template seja enviado.
        4.  Chama `buildMessagePayload(contact, dynamicPayloadOptions)` para montar o payload final.
    -   **Envio e Atualização**:
        1.  Chama `sendSingleMessage(payload)`.
        2.  Se sucesso, incrementa `runStatus.sent` e `queues[queueIndex].blocks[activeBlockIndex].currentReports`.
        3.  Atualiza o `localStorage` (`QUEUES_STORAGE_KEY` e `STATS_STORAGE_KEY`) a cada iteração para garantir a persistência do progresso.
        4.  Aguarda um `delayMs` calculado com base na velocidade configurada antes da próxima iteração.

---

## 5. Fluxo de Dados Completo (Exemplo de Disparo de 1 Mensagem)

1.  **Configuração**: No `Dashboard`, o usuário cria a "Fila A", que contém o "Bloco 1" (Linha: `(11) 9999...`, Template: `boas_vindas_v1`, Limite: 1000 reports). Esta configuração é salva em `localStorage`.

2.  **Upload**: Na `ImportPage`, o usuário envia um `contatos.csv`. A API de mailings processa e retorna um link para o arquivo higienizado.

3.  **Carregamento**: O usuário clica em "Carregar Audiência". O `downloadAndParseCSV` busca o arquivo higienizado e popula o estado `contactsToSend`. A UI avança para a `step='campaign'`.

4.  **Vinculação**: O usuário seleciona a "Fila A" no dropdown.

5.  **Início**: O usuário clica em "Iniciar Disparo". A função `startEngine` é chamada.

6.  **Loop (1ª iteração)**:
    -   `contact` = `contactsToSend[0]`.
    -   A "Fila A" é lida do `localStorage`.
    -   O bloco ativo é o "Bloco 1" (`activeBlockIndex` é 0).
    -   `currentReports` (0) é menor que `reportLimit` (1000). A rotação não ocorre.
    -   `dynamicPayloadOptions` é criado. `templateName` é definido como "boas_vindas_v1" e `source.phoneNumber` como "119999...".
    -   `buildMessagePayload` é chamado. Ele pega os dados do `contact` (ex: `NOME_CLIENTE`) e os mescla com as `dynamicPayloadOptions` para criar o payload final.
    -   `sendSingleMessage` envia o payload para `https://api.robbu.global/v1/sendmessage`.
    -   Após o `200 OK`, `currentReports` do "Bloco 1" é incrementado para 1.
    -   O estado da "Fila A" com o `currentReports` atualizado é salvo de volta no `localStorage`.
    -   O loop aguarda o delay e continua para o próximo contato.