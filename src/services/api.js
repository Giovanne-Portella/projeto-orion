import axios from 'axios';

export const api = axios.create({
  baseURL: 'https://inveniocenterapi.robbu.global/v1',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('orion_token');
  if (config.headers['Custom-Auth']) {
    config.headers.Authorization = config.headers['Custom-Auth'];
    delete config.headers['Custom-Auth'];
  } else if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// NOVA FUNÇÃO AUXILIAR: Pega o header específico do ambiente (card)
const getTenantHeaders = (clientId) => {
  const token = localStorage.getItem(`orion_tenant_token_${clientId}`);
  return token ? { 'Custom-Auth': `Bearer ${token}` } : {};
};

export const authService = {
  login: async (company, username, password) => {
    const AUTH_URL = 'https://api-accounts.robbu.global/v1/login';
    
    const { data } = await axios.post(AUTH_URL, { 
      company, 
      username, 
      password, 
      origin: null 
    }, { 
      headers: { 'Content-Type': 'application/json' } 
    });

    if (data.access_token) {
      localStorage.setItem('orion_token', data.access_token);
      
      localStorage.setItem('orion_user', JSON.stringify({ 
        name: username, 
        company: company 
      }));
      
      if (!localStorage.getItem('orion_avatar_seed')) {
        localStorage.setItem('orion_avatar_seed', username);
      }
    }
    return data;
  },

  logout: () => {
    localStorage.removeItem('orion_token');
    localStorage.removeItem('orion_user');
    window.location.href = '/login';
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('orion_token');
  },
  
  getUser: () => {
    const userStr = localStorage.getItem('orion_user');
    return userStr ? JSON.parse(userStr) : null;
  }
};

export const mailingService = {
  getSegments: async (page = 1, clientId) => {
    const { data } = await api.get(`/wallets?page=${page}`, { 
      headers: getTenantHeaders(clientId) 
    });
    return data.data;
  },
  uploadMailing: async (formData, clientId) => {
    const { data } = await api.post('/mailings', formData, {
      headers: { 
        'Content-Type': 'multipart/form-data',
        ...getTenantHeaders(clientId)
      }
    });
    return data;
  },
  checkStatus: async (mailingIds, clientId) => {
    let queryString = '';
    if (Array.isArray(mailingIds)) {
        const params = new URLSearchParams();
        mailingIds.forEach(id => params.append('items[]', id));
        queryString = `?${params.toString()}`;
    } else {
        queryString = `/${mailingIds}/status`; 
    }
    
    const { data } = await api.get(`/mailings/status${queryString}`, { 
      headers: getTenantHeaders(clientId) 
    });
    return data.data;
  }
};

export const configService = {
  getWABAs: async (clientId) => {
    const { data } = await api.get('/settings/channels/whatsapp-accounts', { 
      headers: getTenantHeaders(clientId) 
    });
    return data.data;
  },
  getLines: async (wabaId, clientId) => {
    const { data } = await api.get(`/settings/channels/whatsapp?whatsapp_account_id=${wabaId}&prospect=false`, { 
      headers: getTenantHeaders(clientId) 
    });
    return data.data;
  },
  getSettings: async (clientId) => {
    const { data } = await api.get('/settings', { 
      headers: getTenantHeaders(clientId) 
    });
    return data.data;
  },
  getTemplates: async (wabaId, clientId) => {
    const { data } = await api.get(`/campaigns/whatsapp/templates?whatsapp_account_id=${wabaId}`, { 
      headers: getTenantHeaders(clientId) 
    });
    return data.data;
  }
};