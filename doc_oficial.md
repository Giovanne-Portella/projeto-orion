🌌 Documentação Oficial: Projeto Órion
1. Visão Geral do Projeto
O Projeto Órion é uma plataforma frontend em React desenvolvida para atuar como um orquestrador multi-tenant (múltiplos clientes) de campanhas e disparos massivos de mensagens via WhatsApp utilizando a infraestrutura da Robbu / Invenio.

A aplicação permite:

Gerenciar múltiplos clientes em uma única interface.

Importar e higienizar bases de contatos (mailings).

Configurar dinamicamente o payload da API SendMessage.

Criar e gerenciar filas de disparo com roteamento automático de blocos (BMs e Linhas) com base em capacidade percentual.

Simular disparos (Ambiente HML) com degradação de templates e banimento de números.

Executar disparos reais (Ambiente Produção) de forma assíncrona.

2. Arquitetura e Tecnologias
Frontend: React (Vite)

Roteamento: react-router-dom

Estilização: Tailwind CSS + Lucide React (Ícones)

Requisições HTTP: Axios + API Fetch Nativa

Gerenciamento de Estado: useState, useEffect, useRef, Context API (SimulationContext)

Persistência de Dados: localStorage (isolado dinamicamente por ID de cliente)

Manipulação de CSV: Parser customizado (csvParser.js) rodando no client-side via FileReader.

3. Autenticação e Segurança
O sistema requer login para acessar as ferramentas.

Endpoint: POST https://api-accounts.robbu.global/v1/login

Payload: { company, username, password, origin: null }

Comportamento: O response retorna um objeto com access_token. A aplicação intercepta esse token e o salva no localStorage com a chave orion_token.

Axios Interceptor (api.js): Todas as requisições para a API Invenio (exceto o próprio login e o disparo final) passam por um interceptor que injeta Authorization: Bearer <orion_token>.

4. Estrutura de Navegação e Painel Global (Multi-Tenant)
O acesso após o login se divide em:

/welcome: Tela inicial amigável.

/dashboard (index.jsx): Painel Geral de Clientes (Command Center).

/dashboard/:clientId (QueueManager.jsx): O Workspace exclusivo de cada cliente.

4.1. Painel Global de Clientes (Dashboard/index.jsx)
Exibe cards para cada cliente cadastrado (salvos no localStorage sob a chave orion_clients).

Cálculo de Saúde Visual (Kanban): Um setInterval roda a cada 1 segundo cruzando os dados do SimulationContext (HML) e do localStorage (PROD) de cada cliente.

🟩 Verde (Saudável): Tem filas rodando, sem erros.

🟨 Amarelo (Atenção): Tem denúncias de spam, mas não bloqueou.

🟥 Vermelho (Crítico): Filas bloqueadas ou limite de spam extrapolado.

⬜ Branco/Cinza (Aguardando): Nenhuma fila ativa no momento.

5. Workspace do Cliente (QueueManager.jsx)
É o coração do sistema. Os dados são isolados via parâmetros na URL (clientId). As chaves de armazenamento são dinâmicas: orion_queues_{clientId}, orion_mailings_{clientId}, etc.
Possui 3 abas principais: Bases / Mailings, Produção e Homologação.

5.1. Aba Bases / Mailings
Responsável por orquestrar a jornada do público antes do disparo.
Existem 3 etapas obrigatórias para um Mailing se tornar "Pronto":

Etapa A: Importação (Upload Invenio)
Ocorre comunicação multipart/form-data com a Invenio seguindo os parâmetros rígidos de LGPD e Propensão.

Endpoint: POST https://inveniocenterapi.robbu.global/v1/mailings

Campos enviados (FormData): description, wallet_id, file (CSV), wallet_unique_confirmation, clear_hashtag, robbu_verify, lgpd_type (1 a 7), verify_options (se Verify ativado).

Rotina de Polling: Ao fazer o upload, a API devolve o ID do mailing. Um loop inicia chamadas a GET /mailings/status?items[]={id} a cada 3 segundos até que o status mude para "I" (Imported) ou "E" (Error).

Sucesso: Salva localmente os download_results (links dos arquivos originais, rejeições e verify gerados pela Invenio).

Etapa B: Validação e Limpeza (Validator Local)
A plataforma exige que o usuário higienize a base. O modal pede o arquivo CSV de "Rejeição" (baixado dos links acima) e o cruza com o arquivo CSV original recém-importado.

Lógica: Extrai o "Número da Linha" do CSV de rejeição. Subtrai 2 (para compensar cabeçalho e indexação 0). Remove exatamente esses índices da base original (client-side). A base resultante é salva como "Base Limpa".

Etapa C: Configuração do Payload SendMessage (Setup API JSON)
Permite construir a estrutura JSON dinâmica que o motor utilizará.

Define a Coluna de Telefone (Destination).

Ativa e mapeia o bloco Contact (Nome, Documento, Tag, CustomCode e 5 posições fixas de Jokers/Coringas exigidas pela API).

Ativa o bloco DiscardSettings e InAttendance.

Mapeia os Template Parameters (Variáveis do HSM) atrelando as colunas do CSV às variáveis correspondentes.

5.2. Aba Produção (Motor de Disparo Real)
Permite criar filas e atrelá-las às bases preparadas.

Fluxo de Criação e Configuração:
O usuário cria uma fila e seleciona uma "Base Pronta".

O usuário adiciona "Blocos" na fila.

Para cada bloco, a aplicação busca as WABAs (GET /settings/channels/whatsapp-accounts), as Linhas (GET /settings/channels/whatsapp) e os Templates vinculados a essa WABA (configService.getTemplates).

O usuário configura o Bloco estipulando sua Capacidade total (ex: 10.000) e a % de uso.

O Motor de Disparo (runProductionQueue + messageEngine.js)
Quando o usuário clica em Play:

Busca o Token Global Privado (GET /settings -> private_token).

Verifica se o orion_token (Bearer) está no localStorage.

Inicia um while loop assíncrono que varre o CSV limpo.

Constrói o Payload através do buildMessagePayload(contact, dynamicPayloadOptions). Ele lê o contact (linha do CSV atual) e substitui as colunas mapeadas.

Endpoint de Disparo: POST https://api.robbu.global/v1/sendmessage (Usa fetch nativo com Authorization: Bearer <orion_token>).

Controle de Rate Limit: Possui um await new Promise(res => setTimeout(res, 1000)) no loop para enviar 1 req/seg.

Rodízio de Blocos: O motor lê activeBlock.config.bmCapacity * (maxPercentage / 100). Se a quantidade de disparos atingir este limite, ele avança a fila para o próximo Bloco automaticamente (activeBlockIndex++).

Atualiza o status visual (processed incrementa na tela em tempo real).

Tratamento de erro (401 pausa a fila, falhas lógicas marcam como report).

5.3. Aba Homologação (Simulador)
Utilizada para testar estratégias de roteamento sem gastar disparos reais. É movida pelo SimulationContext.

Motor Global: Um setInterval que roda a cada 1000ms a nível de raiz da aplicação (main.jsx).

Comportamento Simulado:

Gera processamento fake (Math.random()).

Simula "Denúncias de Spam" da Meta.

Simula "Degradação de Templates" (Muda a qualidade de GREEN para YELLOW para RED).

Implementa "Auto-Recuperação" (se um template fica RED, o sistema troca para outro GREEN da mesma piscina automaticamente).

Se tomar 3 denúncias de spam, a Fila e a BM são BLOQUEADAS.

6. Referência das Chamadas de API (Endpoints Utilizados)
Login:

POST https://api-accounts.robbu.global/v1/login

Retorna o access_token essencial para o resto do sistema.

Upload Invenio Center (Importação):

POST https://inveniocenterapi.robbu.global/v1/mailings

Exige multipart/form-data. Usa as regras e checkboxes do painel para determinar as ações no servidor.

Status do Invenio (Polling):

GET https://inveniocenterapi.robbu.global/v1/mailings/status?items[]={mailing_id}

Retorna metadados cruciais como download_results e status (P, I, E).

Busca de WABAs, Linhas e Templates:

GET /v1/settings/channels/whatsapp-accounts (Busca Contas).

GET /v1/settings/channels/whatsapp?whatsapp_account_id={id} (Busca Linhas).

Nota: Na versão final, templates mockados são injetados, mas o serviço de configuração já tem estrutura para receber a listagem da API.

Busca de Token Privado (Envio):

GET https://inveniocenterapi.robbu.global/v1/settings

Extrai a chave private_token, que compõe o payload da SendMessage.

Envio Real de Mensagem:

POST https://api.robbu.global/v1/sendmessage

Endpoint centralizado de mensageria da Robbu.

Headers: Authorization: Bearer <orion_token>

Body JSON estritamente tipado (com invenioPrivateToken, text, channel: 3, source, destination, templateName, templateParameters, e opcionalmente contact e discardSettings).

7. Modelagem de Dados Chave (Data Structures)
Objeto Mailing (mailings)
JSON
{
  "id": "190027C43EF2892C",
  "name": "layout_vendas.csv",
  "uploadDate": "19/02/2026 17:48:06",
  "count": 14000,
  "data": [{ "telefone": "5511999...", "nome": "João" }],
  "serverData": { "download_results": [...] },
  "isCleaned": true,
  "apiConfig": {
    "include": { "text": true, "contact": true, "discardSettings": true, "templateParameters": true },
    "values": { "phoneColumn": "telefone", "text": "Olá", "attendantUserName": "bot_vendas" },
    "templateParams": [{ "name": "var1", "column": "nome" }],
    "jokers": [{ "name": "CORINGA1", "column": "tag_cli" }, ...]
  }
}
Objeto Fila (queues)
JSON
{
  "id": "q-17083049182",
  "name": "Campanha Feirão",
  "mailingId": "190027C43EF2892C",
  "status": "running", // paused, completed, blocked
  "activeBlockIndex": 0,
  "processed": 450,
  "spamAlerts": 0,
  "blocks": [
    {
      "id": "b-1",
      "waba": { "description": "BM Oficial" },
      "line": { "phone": "5511...", "quality": "GREEN" },
      "template": { "name": "oferta_feirao" },
      "config": { "bmCapacity": 10000, "maxPercentage": 50, "reportLimit": 100 },
      "processed": 450,
      "currentReports": 0
    }
  ]
}
8. Notas Importantes para Desenvolvimentos Futuros
Engine de Mensagem Acoplada: O processo de enviar requisições (fetch) ocorre no componente e não em um Worker. Ao sair da tela de um cliente (QueueManager desmontado), o envio das filas de Produção é pausado, por isso, o useRef(activeRuns) foi implementado para sinalizar e matar o loop preventivamente se o componente morrer. O HML, no entanto, continua rodando em segundo plano no SimulationContext.

Campos Obrigatórios da API: A API SendMessage exige que a chave text seja enviada (mesmo que com uma string vazia ""), e que o array de jokers do bloco contact tenha exatamente 5 posições em formato de Array de Strings.

Erros 401: Sempre tratados com prioridade máxima. Se ocorrer um 401 na hora do disparo, significa que o token de login expirou e a fila entrará em estado "paused" imediatamente.