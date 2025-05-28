# Imagem base do Azure Functions para Node.js
FROM mcr.microsoft.com/azure-functions/node:4-node18

# Diretório de trabalho padrão
WORKDIR /home/site/wwwroot

# Copiar todos os ficheiros da função (assumindo que estás na raiz e "ampliarImagem" contém a função)
COPY ./ampliarImagem .

# Instalar as dependências (incluindo 'sharp' com binário compatível)
RUN apt-get update && apt-get install -y libvips-dev \
    && npm install --omit=dev

# Porta padrão
EXPOSE 80
