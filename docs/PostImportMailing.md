# API - Post Import Mailing

## Descrição
Endpoint para importar mailing através de proxy para a API externa do Invenio Center. Permite envio de arquivos e parâmetros configuráveis relacionados à carteira, verificações e LGPD.

## Informações Gerais

- **Endpoint**: `POST /mailing`
- **Content-Type**: `multipart/form-data`
- **Autenticação**: Bearer Token (obrigatório)

---

## Headers

| Header | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| Authorization | string | Sim | Token de autenticação (formato: `Bearer {token}`) |
| Content-Type | string | Sim | Deve ser `multipart/form-data` |

---

## Parâmetros (Form Data)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| description | string | Não | Descrição do mailing |
| wallet_id | string | Não | ID da carteira |
| wallet_unique_confirmation | string | Não | Confirmação única da carteira |
| clear_hashtag | string | Não | Limpar hashtag |
| robbu_verify | string | Não | Verificação Robbu |
| verify_options | string | Não | Opções de verificação |
| lgpd_type | string | Não | Tipo de LGPD |
| file | file | Não | Arquivo a ser enviado (CSV, Excel, etc.) |

---

## Exemplos de Requisição

### 1. Usando cURL (sem arquivo)

```bash
curl -X POST https://seu-dominio.com/mailing \
  -H "Authorization: Bearer seu-token-aqui" \
  -F "description=Campanha de Natal 2024" \
  -F "wallet_id=12345" \
  -F "wallet_unique_confirmation=true" \
  -F "lgpd_type=consent"
```

### 2. Usando cURL (com arquivo)

```bash
curl -X POST https://seu-dominio.com/mailing \
  -H "Authorization: Bearer seu-token-aqui" \
  -F "description=Importação de Contatos" \
  -F "wallet_id=12345" \
  -F "file=@/caminho/para/arquivo.csv"
```

### 3. Usando JavaScript (Fetch API)

```javascript
async function importMailing(token, formData) {
  const response = await fetch('https://seu-dominio.com/mailing', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

// Exemplo de uso - sem arquivo
const formData = new FormData();
formData.append('description', 'Campanha de Natal 2024');
formData.append('wallet_id', '12345');
formData.append('wallet_unique_confirmation', 'true');
formData.append('lgpd_type', 'consent');

importMailing('seu-token-aqui', formData)
  .then(data => console.log('Sucesso:', data))
  .catch(error => console.error('Erro:', error));
```

### 4. Usando JavaScript com Arquivo

```javascript
// Obtendo arquivo do input
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];

const formData = new FormData();
formData.append('description', 'Importação de Contatos Q1 2024');
formData.append('wallet_id', '12345');
formData.append('robbu_verify', 'true');
formData.append('verify_options', 'email,phone');
formData.append('lgpd_type', 'consent');
formData.append('file', file);

fetch('https://seu-dominio.com/mailing', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer seu-token-aqui'
  },
  body: formData
})
.then(response => response.json())
.then(data => console.log('Sucesso:', data))
.catch(error => console.error('Erro:', error));
```

### 5. Usando Axios

```javascript
import axios from 'axios';

async function importMailingWithAxios(token, data, file = null) {
  const formData = new FormData();
  
  // Adicionar campos
  if (data.description) formData.append('description', data.description);
  if (data.wallet_id) formData.append('wallet_id', data.wallet_id);
  if (data.wallet_unique_confirmation) formData.append('wallet_unique_confirmation', data.wallet_unique_confirmation);
  if (data.clear_hashtag) formData.append('clear_hashtag', data.clear_hashtag);
  if (data.robbu_verify) formData.append('robbu_verify', data.robbu_verify);
  if (data.verify_options) formData.append('verify_options', data.verify_options);
  if (data.lgpd_type) formData.append('lgpd_type', data.lgpd_type);
  
  // Adicionar arquivo se fornecido
  if (file) {
    formData.append('file', file);
  }

  try {
    const response = await axios.post('https://seu-dominio.com/mailing', formData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Erro na requisição:', error.response?.data || error.message);
    throw error;
  }
}

// Exemplo de uso
const data = {
  description: 'Campanha Black Friday',
  wallet_id: '12345',
  wallet_unique_confirmation: 'true',
  lgpd_type: 'consent',
  robbu_verify: 'true',
  verify_options: 'email,phone'
};

importMailingWithAxios('seu-token-aqui', data)
  .then(result => console.log('Importação realizada:', result))
  .catch(error => console.error('Falha na importação:', error));
```

### 6. Exemplo React Component

```jsx
import React, { useState } from 'react';

function MailingImportForm({ authToken }) {
  const [formData, setFormData] = useState({
    description: '',
    wallet_id: '',
    wallet_unique_confirmation: '',
    clear_hashtag: '',
    robbu_verify: '',
    verify_options: '',
    lgpd_type: ''
  });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const data = new FormData();
    
    Object.keys(formData).forEach(key => {
      if (formData[key]) {
        data.append(key, formData[key]);
      }
    });

    if (file) {
      data.append('file', file);
    }

    try {
      const response = await fetch('https://seu-dominio.com/mailing', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: data
      });

      const result = await response.json();
      
      if (response.ok) {
        setResult({ success: true, data: result });
      } else {
        setResult({ success: false, error: result });
      }
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Descrição:</label>
        <input
          type="text"
          name="description"
          value={formData.description}
          onChange={handleInputChange}
        />
      </div>

      <div>
        <label>Wallet ID:</label>
        <input
          type="text"
          name="wallet_id"
          value={formData.wallet_id}
          onChange={handleInputChange}
        />
      </div>

      <div>
        <label>LGPD Type:</label>
        <select
          name="lgpd_type"
          value={formData.lgpd_type}
          onChange={handleInputChange}
        >
          <option value="">Selecione...</option>
          <option value="consent">Consent</option>
          <option value="legitimate_interest">Legitimate Interest</option>
        </select>
      </div>

      <div>
        <label>Arquivo:</label>
        <input
          type="file"
          onChange={handleFileChange}
          accept=".csv,.xlsx,.xls"
        />
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Enviando...' : 'Importar Mailing'}
      </button>

      {result && (
        <div className={result.success ? 'success' : 'error'}>
          {result.success ? 'Importação realizada com sucesso!' : `Erro: ${JSON.stringify(result.error)}`}
        </div>
      )}
    </form>
  );
}

export default MailingImportForm;
```

---

## Respostas

### Sucesso

A resposta de sucesso varia de acordo com a API externa. O status code e o corpo da resposta são repassados diretamente.

**Status Code**: Variável (geralmente 200, 201)

```json
{
  // Estrutura depende da API externa do Invenio Center
  "id": "mailing-123456",
  "status": "processing",
  "message": "Mailing import started successfully"
}
```

### Erros

#### 401 - Unauthorized
```json
{
  "message": "Authorization header is required"
}
```

#### 400 - Bad Request
```json
{
  "message": "Request must be multipart/form-data"
}
```

#### 500 - Internal Server Error
```json
{
  "message": "Error proxying request",
  "error": "Detalhes do erro"
}
```

---

## Códigos de Status HTTP

| Código | Descrição |
|--------|-----------|
| 200/201 | Sucesso - Mailing importado com sucesso |
| 400 | Bad Request - Formato da requisição inválido |
| 401 | Unauthorized - Token de autenticação ausente ou inválido |
| 500 | Internal Server Error - Erro ao processar a requisição |

---

## Notas Importantes

1. **Autenticação Obrigatória**: Todas as requisições devem incluir o header `Authorization` com um token válido.

2. **Content-Type**: O endpoint aceita apenas `multipart/form-data`. Requisições com outros content types serão rejeitadas.

3. **Proxy**: Este endpoint funciona como um proxy para a API externa do Invenio Center (`https://inveniocenterapi.robbu.global/v1/mailings`). A resposta será repassada diretamente.

4. **Arquivo Opcional**: O envio de arquivo é opcional. Você pode enviar apenas os parâmetros textuais.

5. **Parâmetros Flexíveis**: Todos os parâmetros são opcionais. Envie apenas os necessários para seu caso de uso.

6. **Validação**: A validação dos dados é realizada pela API externa. Consulte a documentação do Invenio Center para regras específicas.

---

## Testes

### Postman/Insomnia

1. Crie uma nova requisição POST
2. URL: `https://seu-dominio.com/mailing`
3. Em Headers, adicione:
   - `Authorization`: `Bearer seu-token`
4. Em Body, selecione `form-data`
5. Adicione os campos desejados
6. Para arquivo, mude o tipo do campo de "Text" para "File"
7. Envie a requisição

---

## Suporte

Para dúvidas ou problemas relacionados à API externa do Invenio Center, consulte a documentação oficial ou entre em contato com o time responsável.

**Data de criação**: 2024  
**Versão da API**: 1.0
