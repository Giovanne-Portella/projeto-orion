Robbu APIs
API Send Message
Este documento traz as especificações técnicas para chamada da API SendMessage que faz disparos de mensagens via Invenio, independente do canal.

A API SendMessage é o recurso que permite disparar mensagens pela plataforma Invenio de forma unificada, independentemente do canal utilizado. Com ela, sua empresa pode enviar mensagens por WhatsApp, SMS e E-mail, incluindo o uso de templates HSM, textos livres e arquivos. Esse endpoint foi desenvolvido para facilitar a automação da comunicação, tornando possível integrar outros sistemas ao Invenio e centralizar a gestão de envios.
​
Autenticação
Antes de realizar o envio de mensagens pela API, é necessário obter um token de acesso (access_token). Esse token é solicitado na rota de login e deve ser utilizado na chamada da API SendMessage como um Bearer Token, funcionando como a autorização para que o disparo seja concluído com sucesso.
⚠️ Importante:
Caso o token não seja informado, ou esteja expirado, a API retornará o erro 401 Unauthorized impedindo o envio da mensagem.
O usuário utilizado na requisição de login precisa ser do tipo API, garantindo a segurança e o correto funcionamento da integração.
Acesse a documentação sobre Usuários
​
Endpoint de Login
Para realizar a autenticação preencha a requisição conforme o exemplo abaixo:
Método: POST
URL: https://api.robbu.global/v1/login
Company ➜ Nome da empresa no Invenio Center
Username ➜ Nome do usuário API
Password ➜ Senha do usuário API
Body:
    {
  "Company": "#####",
  "Username": "#####",
  "Password": "#####"
    }

Exemplo de response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5...",
  "expires_in": 287971200,
  "refresh_token": "",
  "token_type": "bearer"
}

Não é necessário gerar um novo token a cada envio. O campo expires_in define sua validade em segundos e, por padrão, pode ser considerado válido por até 3333 dias. É importante lembrar que, caso a rota de login seja executada novamente, o token anterior será invalidado. Por isso, a recomendação é armazená-lo e solicitar um novo apenas quando a requisição de envio retornar 401 Unauthorized.
​
Endpoint de Envio de Mensagens
Com o token em mãos, basta utilizar a rota de envio para realizar o disparo das mensagens.
Método: POST
URL: https://api.robbu.global/v1/sendmessage
O envio deve incluir no cabeçalho a autenticação no formato: Authorization: Bearer {access_token}
Exemplo de request (completo)
POST https://api.robbu.global/v1/sendmessage
{
  "invenioPrivateToken": "xxxxxx-xxxxxxx-xxxxxxxx-xxxxxxxx",
  "text": "olá usuário",
  "emailSubject": "",
  "channel": 3,
  "templateName": "template1",
  "attendantUserName": "Usuário 1",
  "templateParameters": [
    {
      "parameterName": "PrimeiroNome",
      "parameterValue": "Nome alternativo"
    },
    {
      "parameterName": "Coringa1",
      "parameterValue": "01/01/1993"
    }
  ],
  "source": {
    "countryCode": 55,
    "phoneNumber": 11999999999,
    "prospect": false
  },
  "destination": {
    "countryCode": 55,
    "phoneNumber": 1199999999,
    "email": ""
  },
  "discardSettings": {
    "recentContactLastHours": 0,
    "InAttendance": true
  },
  "contact": {
    "name": "Ana da Silva",
    "customCode": "5150",
    "id": "78905678908",
    "tag": "nometag",
    "jokers": [
      "coringa1",
      "coringa2",
      "coringa3",
      "coringa4",
      "coringa5"
    ],
    "walletClientCode": "CodDefault",
    "updateIfExists": true
  },
  "voiceSettings": {
    "callId": "123123"
  },
  "files": [
    {
      "address": "https://robbublob.blob/download/boletoteste.pdf",
      "base64": "...u5y3i4y5iu345yu345yu345y5y4...",
      "name": "seuboleto.pdf"
    }
  ]
}
​
Detalhamento dos Campos
​
Parâmetros da Requisição SendMessage
Campo	Descrição
InvenioPrivateToken	Obtido no ambiente administrativo do Invenio Center em Configurações > Conta. Obrigatório para que a chamada seja aceita.
Text	Conteúdo da mensagem em texto livre. Ignorado quando o envio utiliza template HSM. Só pode ser usado em contatos com janela de 24h aberta (saiba mais).
EmailSubject	Usado apenas em mensagens enviadas por e-mail, deve ser preenchido com o título do e-mail.
Channel	Define o canal de envio: 1 = E-mail, 2 = SMS, 3 = WhatsApp.
attendantUserName	Se preenchido, irá definir qual usuário estará fidelizado ao contato.
TemplateName	Quando o envio é feito via HSM, deve ser preenchido com o nome do template.
TemplateParameters	Personalização dos templates com variáveis dinâmicas. Veja abaixo.
Source	Informações da origem da mensagem (linha de disparo). Veja abaixo.
Destination	Informações do destinatário da mensagem. Veja abaixo.
DiscardSettings	Evita disparos desnecessários quando já houve contato recente ou atendimento ativo. Veja abaixo.
Contact	Dados adicionais do contato que podem ser atualizados no disparo. Veja abaixo.
WalletClientCode	Código cliente do segmento definido no Invenio, garantindo vínculo com a carteira escolhida.
UpdateIfExists	Define se as informações do contato devem ser atualizadas (true ou false).
VoiceSettings	Deve ser preenchido com o Call ID de voz nos fluxos do canal de voz.
Files	Permite o envio de arquivos anexados. Veja abaixo.
⚠️ Importante:
O parâmetro text é responsável pelo envio de mensagens livres aos contatos. Mesmo em cenários em que ele não é utilizado, como no disparo de templates por exemplo, esse campo é obrigatório e não deve ser removido do body da requisição.
Para esses cenários ele deve permanecer presente, ainda que vazio. Caso o parâmetro seja excluído, a API retornará o erro:
“message”: “Object reference not set to an instance of an object.”
​
TemplateParameters (Parâmetros de template)
Campo	Descrição
ParameterName	Nome da variável conforme definido no template.
ParameterValue	Valor que substituirá a variável no envio.
​
Source (Origem da Mensagem)
Campo	Descrição
CountryCode	Código do país da linha de origem.
PhoneNumber	Número de telefone (com DDD) da linha que realizará o disparo.
Prospect	Define a aleatorização das linhas prospect.
- false: a mensagem sairá exatamente da linha configurada.
- true: pode ser enviada por outra linha prospect elegível.
Saiba mais sobre aleatorização.
​
Destination (Destino da Mensagem)
Campo	Descrição
CountryCode	Código do país do contato que receberá a mensagem.
PhoneNumber	Número de telefone (com DDD) do contato destinatário.
Email	Endereço de e-mail do destinatário (quando o canal for e-mail).
​
DiscardSettings (Descartes)
Campo	Descrição
RecentContactLastHours	Quantidade de horas a considerar para descartar o envio.
InAttendance	true: descarta contatos em atendimento.
false: envia mesmo que o contato esteja em atendimento.
⚠️ Importante:
Os parâmetros DiscardSettings e attendantUserName possuem uma relação direta e devem ser configurados de forma alinhada para evitar bloqueios no envio de mensagens. A condição de descarte definida em DiscardSettings, especificamente o parâmetro InAttendance, atua como uma barreira de envio sempre que o sistema identifica que aquele contato está fidelizado a um operador em um determinado período de tempo.
Por sua vez, o parâmetro attendantUserName é justamente o responsável por realizar essa fidelização do contato a um operador específico. Ou seja, ao definir um nome de operador em attendantUserName, o contato passa a ser reconhecido como estando em operação/atendimento.
Dessa forma, sempre que attendantUserName for utilizado, é necessário garantir que, na configuração de DiscardSettings, o parâmetro InAttendance seja marcada como false. Caso essa condição permaneça como true, o envio será bloqueado e a API retornará o erro:
message not sent: contact in attendance
​
Contact (Contato)
Campo	Descrição
Name	Atualiza o nome do contato no Invenio.
CustomCode	Código personalizado usado pela empresa para categorizar contatos.
Id	Atualiza o CPF/CNPJ do contato.
Tag	Categoriza contatos para facilitar a busca (saiba mais).
Jokers	Coringas dinâmicos utilizados no disparo.
- Joker 1 a 4: até 300 caracteres.
- Joker 5: até 3000 caracteres.
​
Files (Anexos)
Campo	Descrição
Address	URL da mídia a ser enviada.
Base64	Código em base64 da mídia.
Name	Nome do arquivo com extensão (ex.: boleto.pdf).
ℹ️ Observação:
Em templates (HSM) só é permitido 1 arquivo por disparo.
Em mensagens livres, é possível enviar múltiplos arquivos (ex.: ZIP).
Apesar de permitido, o envio em ZIP pode não ser compatível com todos os modelos de celulares.
​
Responses API Send Message
Ao realizar uma chamada à API, diferentes códigos de status podem ser retornados, indicando o resultado do disparo. A seguir, listamos os principais responses que podem ser encontrados, juntamente com seu significado, para auxiliar no monitoramento e tratamento de respostas:
Código	Descrição
200 OK	Mensagem enviada corretamente.
400 Bad Request	Preenchimento incorreto ou incompleto de parâmetros.
401 Unauthorized	Token inválido ou expirado.
404 Not Found	URL incorreta.
500 Internal Server Error	Erro interno da API.
ℹ️ Observação:
É importante observar que a API não retorna mensagens de erro detalhadas em casos de falha de envio nos canais externos (como erros da Meta). Nesses casos, a validação deve ser feita diretamente no Invenio Center, onde estão disponíveis os logs e relatórios de entrega.
​
Exemplos de Requisições
Preenchimento com parâmetros de templates

POST https://api.robbu.global/v1/sendmessage
{
  "invenioPrivateToken": "af5addfsdf52-a5dfsc-44fdf6-80bc-eda1d2af8",
  "text": "",
  "emailSubject": "",
  "channel": 3,
  "templateName": "comercial_av",
  "attendantUserName": "",
  "templateParameters": [
      {
          "parameterName": "Cliente",
          "parameterValue": "Roberto"
      },
      {
          "parameterName": "Site",
          "parameterValue": "https://docs.robbu.global/"
      }
  ],
  "source": {
      "countryCode": 55,
      "phoneNumber": 11999999999,
      "prospect": false
  },
  "destination": {
      "countryCode": 55,
      "phoneNumber": 11999999999,
      "email": ""
  },
  "discardSettings": {
      "recentContactLastHours": 0,
      "InAttendance": false
  },
  "contact": {
      "name": "",
      "customCode": "",
      "id": "",
      "tag": "",
      "jokers": [
          "",
          "",
          "",
          "",
          ""
      ],
      "walletClientCode": "comercial",
      "updateIfExists": true
  }
}
Template configurado no Invenio Center

Envio de texto livre com dois arquivos

POST https://api.robbu.global/v1/sendmessage

  {
  "invenioPrivateToken": "c8881dhjg0a-1c13-4407hj4-a26d-8dty8i7t8gg7g",
  "text": "Segue os arquivos do ultimo evento",
  "emailSubject": "",
  "channel": 3,
  "templateName": "",
  "attendantUserName": "Operador",
  "templateParameters": [
      {
          "parameterName": "",
          "parameterValue": ""
      },
      {
          "parameterName": "",
          "parameterValue": ""
      }
  ],
  "source": {
      "countryCode": 55,
      "phoneNumber": 11999999999,
      "prospect": false
  },
  "destination": {
      "countryCode": 55,
      "phoneNumber": 11999999999,
      "email": ""
  },
  "discardSettings": {
      "recentContactLastHours": 0,
      "InAttendance": false
  },
  "contact": {
      "name": "Cliente",
      "customCode": "",
      "id": "2133125456725",
      "tag": "",
      "jokers": [
          "",
          "",
          "",
          "",
          ""
      ],
      "walletClientCode": "financeiro",
      "updateIfExists": true
  },
  "files": [
  {
    "address": "",
    "base64": "JVBERi0xLjMKJcTl8uXrp....",
    "name": "seuboleto.pdf"

  },
  
  {
    "address": "",
    "base64": "aoijdpisjapsijjsjjsker03nfdikds.....",
    "name": "seuboleto2.pdf"
  }

]

}
Arquivos recebidos em uma conversa

Envio com preenchimento de coringas

POST https://api.robbu.global/v1/sendmessage

  {
"invenioPrivateToken": "af5addfsdf52-a5dfsc-44fdf6-80bc-eda1d2af8",
"text": "",
"emailSubject": "",
"channel": 3,
"templateName": "comercial_av",
"attendantUserName": "",
"templateParameters": [
],
"source": {
    "countryCode": 55,
    "phoneNumber": 11999999999,
    "prospect": false
},
"destination": {
    "countryCode": 55,
    "phoneNumber": 11999999999,
    "email": ""
},
"discardSettings": {
    "recentContactLastHours": 0,
    "InAttendance": false
},
"contact": {
    "name": "",
    "customCode": "",
    "id": "",
    "tag": "",
    "jokers": [
        "Roberto",
        "https://docs.robbu.global/",
        "",
        "",
        ""
    ],
    "walletClientCode": "comercial",
    "updateIfExists": false
}
} 

Prenchimento em disparo no Invenio Center

Envio para e-mail

POST https://api.robbu.global/v1/sendmessage

  {
"invenioPrivateToken": "af5addfsdf52-a5dfsc-44fdf6-80bc-eda1d2af8",
"text": "Caro @primeironome, hoje é dia de oferta especial. Acesse https://docs.robbu.global/ e saiba mais.",
"emailSubject": "Oferta Especial!!",
"channel": 1,
"templateName": "",
"attendantUserName": "",
"templateParameters": [
],
"source": {
    "countryCode": 55,
    "phoneNumber": 11999999999,
    "prospect": false
},
"destination": {
    "email": "help@robbu.global"
},
"discardSettings": {
    "recentContactLastHours": 0,
    "InAttendance": false
},
"contact": {
    "name": "",
    "customCode": "",
    "id": "",
    "tag": "",
    "jokers": [
        "",
        "",
        "",
        "",
        ""
    ],
    "walletClientCode": "Teste",
    "updateIfExists": false
}
}

⚠️Observação:
O envio será realizado pelo e-mail já configurado em Canais no Invenio Center.
Acesse e saiba mais: Contas de E-mail - Invenio Center
Envio de Carrossel

POST https://api.robbu.global/v1/sendmessage

  {
"invenioPrivateToken": "af5addfsdf52-a5dfsc-44fdf6-80bc-eda1d2af8",
"text": "",
"emailSubject": "",
"channel": 3,
"templateName": "carrosseloferta",
"attendantUserName": "",
"templateParameters": [
{
          "parameterName": "1",
          "parameterValue": "https://storage.robbu.global/v2/file/ECCFA721E503DB489CB5E2E09CC6A2D1.jpeg"
      },
      {
          "parameterName": "2",
          "parameterValue": "https://storage.robbu.global/v2/file/ECCFA721E503DB489CB5E2E09CC6A2D1.jpeg"
      }
],
"source": {
    "countryCode": 55,
    "phoneNumber": 11999999999,
    "prospect": false
},
"destination": {
    "countryCode": 55,
    "phoneNumber": 11999999999,
    "email": ""
},
"discardSettings": {
    "recentContactLastHours": 0,
    "InAttendance": false
},
"contact": {
    "name": "",
    "customCode": "",
    "id": "",
    "tag": "",
    "jokers": [
        "",
        "",
        "",
        "",
        ""
    ],
    "walletClientCode": "comercial",
    "updateIfExists": false
}
}

⚠️Observação:
No modelo de carrossel, a nomenclatura atribuída aos parâmetros não interfere no comportamento do componente, podendo ser definida livremente. As imagens serão preenchidas conforme a ordem em que forem inseridas. Já os valores dos parâmetros devem ser adicionados por meio da URL correspondente. Na seção de Mídias no Invenio Center, é possível copiar essa URL, sendo necessário incluir a extensão do arquivo ao final para garantir o correto processamento do recurso. Acesse e saiba mais: Biblioteca de Mídias - Invenio Center

Envio de Template de Autenticação

POST https://api.robbu.global/v1/sendmessage

  {
"invenioPrivateToken": "af5addfsdf52-a5dfsc-44fdf6-80bc-eda1d2af8",
"text": "",
"emailSubject": "",
"channel": 3,
"templateName": "codigoverificacao",
"attendantUserName": "",
"templateParameters": [
{
          "parameterName": "Code",
          "parameterValue": "xyzp42"
      }
],
"source": {
    "countryCode": 55,
    "phoneNumber": 11999999999,
    "prospect": false
},
"destination": {
    "countryCode": 55,
    "phoneNumber": 11999999999,
    "email": ""
},
"discardSettings": {
    "recentContactLastHours": 0,
    "InAttendance": false
},
"contact": {
    "name": "",
    "customCode": "",
    "id": "",
    "tag": "",
    "jokers": [
        "",
        "",
        "",
        "",
        ""
    ],
    "walletClientCode": "comercial",
    "updateIfExists": false
}
}

⚠️Observação:
Nesse caso, a única exigência é a utilização da variável @Code no botão, seja em um template de autenticação ou em um template tradicional que utilize a função de copiar e colar. No corpo do texto, é possível utilizar outras variáveis — como coringas, por exemplo — conforme sua preferência, sem impacto no funcionamento.

Envio de SMS

POST https://api.robbu.global/v1/sendmessage

  {
"invenioPrivateToken": "af5addfsdf52-a5dfsc-44fdf6-80bc-eda1d2af8",
"text": "Caro @primeironome, hoje é dia de oferta especial. Acesse https://docs.robbu.global/ e saiba mais.",
"emailSubject": "",
"channel": 2,
"templateName": "",
"attendantUserName": "",
"templateParameters": [
],
"destination": {
    "countryCode": 55,
    "phoneNumber": 11999999999,
    "prospect": false
},
"discardSettings": {
    "recentContactLastHours": 0,
    "InAttendance": false
},
"contact": {
    "name": "",
    "customCode": "",
    "id": "",
    "tag": "",
    "jokers": [
        "",
        "",
        "",
        "",
        ""
    ],
    "walletClientCode": "Teste",
    "updateIfExists": false
}
}

