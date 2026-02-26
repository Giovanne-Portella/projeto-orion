# --- Estágio 1: Build da Aplicação React ---
# Usamos uma imagem Node.js como base. A tag 'alpine' resulta em uma imagem menor.
FROM node:20-alpine AS builder

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia o package.json e o package-lock.json (ou yarn.lock, etc.)
# Isso aproveita o cache do Docker, reinstalando dependências apenas se esses arquivos mudarem.
COPY package*.json ./

# Instala as dependências do projeto
RUN npm install

# Copia todo o resto do código-fonte da aplicação
COPY . .

# Roda o script de build (definido no seu package.json, geralmente 'vite build')
RUN npm run build

# --- Estágio 2: Servidor de Produção com Nginx ---
# Usamos uma imagem leve do Nginx
FROM nginx:stable-alpine

# Copia os arquivos estáticos gerados no estágio de build para o diretório padrão do Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copia o arquivo de configuração customizado do Nginx para lidar com o roteamento do React (SPA)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expõe a porta 80 para acesso externo
EXPOSE 80

# Comando para iniciar o Nginx em primeiro plano quando o container iniciar
CMD ["nginx", "-g", "daemon off;"]