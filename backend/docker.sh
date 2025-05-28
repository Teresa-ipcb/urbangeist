#!/bin/bash

# Variáveis de configuração
IMAGE_NAME="ampliarimagem"
ACR_NAME="urbangeistregistry"
RESOURCE_GROUP="urbangeist-rg"
FUNCTION_APP_NAME="urbangeist-ampliarimagem"
STORAGE_ACCOUNT_NAME="urbangeiststorage"
PLAN_NAME="urbangeist-plan"
LOCATION="westeurope"

# Verificar se o diretório ampliarImagem existe
if [ ! -d "./ampliarImagem" ]; then
  echo "Erro: Diretório ampliarImagem não encontrado."
  echo "Execute este script do diretório pai (onde a pasta ampliarImagem está localizada)."
  exit 1
fi

# 1. Criar App Service Plan (se não existir)
if ! az appservice plan show --name $PLAN_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
  echo "Criando App Service Plan..."
  az appservice plan create \
    --name $PLAN_NAME \
    --resource-group $RESOURCE_GROUP \
    --location $LOCATION \
    --sku B1 \
    --is-linux
fi

# 2. Criar ACR (se não existir)
if ! az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
  echo "Criando Azure Container Registry..."
  az acr create \
    --name $ACR_NAME \
    --resource-group $RESOURCE_GROUP \
    --sku Basic \
    --admin-enabled true
fi

# 3. Construir e fazer push da imagem
echo "Construindo imagem diretamente no ACR..."
az acr build \
  --registry $ACR_NAME \
  --image $IMAGE_NAME \
  --file ./ampliarImagem/Dockerfile \
  ./ampliarImagem

# 4. Obter informações do ACR
REGISTRY=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer --output tsv)

# 5. Criar/Atualizar Function App
if ! az functionapp show --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
  echo "Criando Function App..."
  az functionapp create \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --storage-account $STORAGE_ACCOUNT_NAME \
    --plan $PLAN_NAME \
    --functions-version 4 \
    --runtime node \
    --runtime-version 20 \  # Atualizado para versão LTS atual
    --image $REGISTRY/$IMAGE_NAME:latest \
    --assign-identity '[system]'
  
  # Verificar se a criação foi bem-sucedida
  if [ $? -ne 0 ]; then
    echo "Erro ao criar Function App. Verifique os detalhes acima."
    exit 1
  fi
else
  echo "Atualizando Function App..."
  az functionapp config container set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --docker-custom-image-name $REGISTRY/$IMAGE_NAME:latest
fi

# 6. Verificar e mostrar URL
FUNCTION_URL=$(az functionapp show --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --query defaultHostName --output tsv 2>/dev/null)

if [ -z "$FUNCTION_URL" ]; then
  echo "Erro: Não foi possível obter a URL da Function App. Verifique se a implantação foi bem-sucedida."
  exit 1
else
  echo "Deploy completo!"
  echo "URL da Function App: https://$FUNCTION_URL"
fi
