import { api } from './api';
import axios from 'axios';

// Instância de API dedicada para o sendMessage, que usa uma URL base diferente.
const sendMessageApi = axios.create({
  baseURL: 'https://api.robbu.global/v1',
});

// ATUALIZADO: Interceptor agora respeita o token do ambiente (card) se ele for passado
sendMessageApi.interceptors.request.use(async config => {
  if (config.headers['Custom-Auth']) {
    config.headers.Authorization = config.headers['Custom-Auth'];
    delete config.headers['Custom-Auth'];
  } else {
    // Fallback para o token global caso não seja uma requisição específica de um card
    const token = localStorage.getItem('orion_token'); 
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

/**
 * Substitui placeholders em uma string ou objeto por valores de uma linha de contato.
 * Ex: "Olá, [NOME_CLIENTE]" com contactRow.NOME_CLIENTE = "Ana" se torna "Olá, Ana".
 * @param {any} value - O valor que pode conter placeholders.
 * @param {object} contactRow - O objeto com os dados do contato.
 * @returns {any} O valor com os placeholders substituídos.
 */
const resolvePlaceholders = (value, contactRow) => {
  if (typeof value !== 'string') return value;

  // Mapeia placeholders para chaves do objeto de contato
  const placeholders = {
    '[NOME_CLIENTE]': contactRow.NOME_CLIENTE,
    '[CPFCNPJ]': contactRow.CPFCNPJ,
    '[CODCLIENTE]': contactRow.CODCLIENTE,
    '[TAG]': contactRow.TAG,
    '[CORINGA1]': contactRow.CORINGA1,
    '[CORINGA2]': contactRow.CORINGA2,
    '[CORINGA3]': contactRow.CORINGA3,
    '[CORINGA4]': contactRow.CORINGA4,
    '[CORINGA5]': contactRow.CORINGA5,
    '[PRIORIDADE]': contactRow.PRIORIDADE,
    '[TELEFONE]': contactRow.TELEFONE || contactRow.VALOR_DO_REGISTRO,
    '[EMAIL]': contactRow.EMAIL,
  };

  let resolvedValue = value;
  for (const placeholder in placeholders) {
    if (placeholders[placeholder] !== undefined) {
      resolvedValue = resolvedValue.replace(new RegExp(placeholder.replace(/\[/g, '\\[').replace(/\]/g, '\\]'), 'g'), placeholders[placeholder]);
    }
  }
  return resolvedValue;
};


export const buildMessagePayload = (contactRow, payloadOptions) => {
  const { include, values } = payloadOptions;
  const payload = {};

  // Token privado é sempre necessário (agora virá do state/localStorage do ambiente)
  payload.invenioPrivateToken = values.invenioPrivateToken;

  // Tratamento do Telefone
  let rawPhone = contactRow.VALOR_DO_REGISTRO || contactRow.TELEFONE || "";
  const cleanPhone = rawPhone.replace(/\D/g, ''); 
  const finalPhone = cleanPhone.length > 11 ? cleanPhone.substring(2) : cleanPhone;

  // --- Construção dinâmica do Payload ---

  // Prioriza a coluna MENSAGEM do CSV, se existir. Caso contrário, usa o texto da UI.
  if (contactRow.MENSAGEM) {
    payload.text = resolvePlaceholders(contactRow.MENSAGEM, contactRow);
  } else if (include.text) {
    payload.text = resolvePlaceholders(values.text, contactRow);
  }
  // O campo 'text' é obrigatório na API, mesmo que vazio.
  if (payload.text === undefined) payload.text = "";

  if (include.emailSubject) payload.emailSubject = resolvePlaceholders(values.emailSubject, contactRow);
  if (include.channel) payload.channel = values.channel;
  if (include.templateName) payload.templateName = values.templateName;
  if (include.attendantUserName) payload.attendantUserName = values.attendantUserName;

  if (include.templateParameters && values.templateParameters?.length > 0) {
    payload.templateParameters = values.templateParameters
      .filter(p => p.parameterName)
      .map(p => ({
        parameterName: p.parameterName,
        parameterValue: resolvePlaceholders(p.parameterValue, contactRow)
      }));
  }

  if (include.source) {
    payload.source = { ...values.source };
  }

  if (include.destination) {
    payload.destination = { ...values.destination };
    // Preenche dinamicamente com dados do contato
    if (payload.destination.phoneNumber !== undefined) payload.destination.phoneNumber = finalPhone;
    if (payload.destination.email !== undefined) payload.destination.email = contactRow.EMAIL || '';
  }

  if (include.discardSettings) {
    payload.discardSettings = { ...values.discardSettings };
  }

  if (include.contact) {
    // Mapeamento automático dos dados do contato a partir das colunas do CSV.
    payload.contact = {
      name: contactRow.NOME_CLIENTE || '',
      customCode: contactRow.CODCLIENTE || '',
      id: contactRow.CPFCNPJ || '',
      tag: contactRow.TAG || '',
      jokers: [
        contactRow.CORINGA1 || '',
        contactRow.CORINGA2 || '',
        contactRow.CORINGA3 || '',
        contactRow.CORINGA4 || '',
        contactRow.CORINGA5 || '',
      ],
      // Campos que ainda podem ser configurados pela UI
      walletClientCode: values.contact.walletClientCode || '',
      updateIfExists: values.contact.updateIfExists !== undefined ? values.contact.updateIfExists : true,
    };
  }

  if (include.voiceSettings) {
    payload.voiceSettings = { ...values.voiceSettings };
  }

  if (include.files && values.files?.length > 0) {
    payload.files = values.files.filter(f => f.name);
  }

  return payload;
};

// ATUALIZADO: Recebe o clientId para injetar o token correto do ambiente
export const sendSingleMessage = async (payload, clientId) => {
  try {
    // Busca o token específico deste cliente/card no localStorage
    const tenantToken = localStorage.getItem(`orion_tenant_token_${clientId}`);
    
    // Configura o header customizado se o token existir
    const headers = tenantToken ? { 'Custom-Auth': `Bearer ${tenantToken}` } : {};

    const { data } = await sendMessageApi.post('/sendmessage', payload, { headers });
    return { success: true, data: data };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.message || error.message 
    };
  }
};