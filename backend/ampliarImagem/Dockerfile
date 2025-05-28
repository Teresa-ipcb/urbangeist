FROM mcr.microsoft.com/azure-functions/node:4-node18

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true

# Instala dependências necessárias para o sharp funcionar
RUN apt-get update && \
    apt-get install -y libvips-dev

# Copia apenas a função ampliarImagem
COPY . /home/site/wwwroot/ampliarImagem

# Vai para a pasta da função e instala as dependências
RUN cd /home/site/wwwroot/ampliarImagem && \
    npm install --omit=dev --include=optional
