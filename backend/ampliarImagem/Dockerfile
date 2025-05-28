# Imagem base com Node.js + ferramentas para o sharp
FROM node:18-slim

# Instalar dependências para compilar native modules (sharp)
RUN apt-get update && apt-get install -y \
  build-essential \
  python3 \
  libcairo2-dev \
  libjpeg-dev \
  libpango1.0-dev \
  libgif-dev \
  librsvg2-dev \
  && rm -rf /var/lib/apt/lists/*

# Diretório de trabalho
WORKDIR /app

# Copiar apenas package.json e instalar dependências
COPY package.json ./
RUN npm install

# Copiar o restante código
COPY . .

# Porta usada pelo Azure Functions custom handler
ENV PORT=80
EXPOSE 80

# Comando de arranque para o handler
CMD ["node", "index.js"]
