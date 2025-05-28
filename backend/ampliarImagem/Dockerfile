# Imagem base oficial do Azure Functions para Node.js
FROM mcr.microsoft.com/azure-functions/node:4-node18

# Diretório de trabalho da Function
WORKDIR /home/site/wwwroot/ampliarImagem

# Copiar os ficheiros da função
COPY . .

# Instalar as dependências (incluindo 'sharp' com binário compatível)
RUN apt-get update && apt-get install -y libvips-dev \
    && npm install --omit=dev

# Expõe a porta (obrigatório para Azure Functions em container)
EXPOSE 80
