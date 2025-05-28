#!/bin/bash

# Configurações
IMAGE_NAME="ampliarimagem"
ACR_NAME="urbangeistregistry"
RESOURCE_GROUP="urbangeist-rg"
FUNCTION_APP_NAME="urbangeist-ampliarimagem"
STORAGE_ACCOUNT_NAME="urbangeiststorage"
PLAN_NAME="urbangeist-plan"
LOCATION="francecentral"
DOCKERFILE_PATH="./ampliarImagem/Dockerfile"
CONTEXT_PATH="./ampliarImagem"

# Verifica se diretório da função existe
if [ ! -d "$CONTEXT_PATH" ]; then
  echo "Erro: Diretório $CONTEXT_PATH não encontrado."
  exit 1
fi

# Cria o ACR (se necessário)
if ! az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
  echo "Criando Azure Container Registry ($ACR_NAME)..."
  az acr create \
    --name $ACR_NAME \
    --resource-group $RESOURCE_GROUP \
    --sku Basic \
    --admin-enabled true
fi

# Obter o login server do ACR
REGISTRY=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer --output tsv)

# Fazer build e push da imagem diretamente no ACR
echo "Construindo imagem com az acr build..."
az acr build \
  --registry $ACR_NAME \
  --image "$IMAGE_NAME:latest" \
  --file $DOCKERFILE_PATH \
  $CONTEXT_PATH

# Criar o App Service Plan (se necessário)
if ! az appservice plan show --name $PLAN_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
  echo "Criando App Service Plan ($PLAN_NAME)..."
  az appservice plan create \
    --name $PLAN_NAME \
    --resource-group $RESOURCE_GROUP \
    --location $LOCATION \
    --is-linux \
    --sku B1
fi

# Criar ou atualizar a Function App
if ! az functionapp show --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
  echo "Criando Function App ($FUNCTION_APP_NAME)..."
  az functionapp create \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --storage-account $STORAGE_ACCOUNT_NAME \
    --plan $PLAN_NAME \
    --functions-version 4 \
    --os-type Linux \
    --deployment-container-image-name "$REGISTRY/$IMAGE_NAME:latest"
else
  echo "Atualizando imagem da Function App ($FUNCTION_APP_NAME)..."
  az functionapp config container set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --docker-custom-image-name "$REGISTRY/$IMAGE_NAME:latest"
fi

# Mostrar URL final da Function App
echo "Obtendo URL da Function App..."
FUNCTION_URL=$(az functionapp show \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query defaultHostName \
  --output tsv)

if [ -z "$FUNCTION_URL" ]; then
  echo "Erro: Não foi possível obter o endereço da Function App."
  exit 1
else
  echo "Deploy concluído!"
  echo "URL da Function App: https://$FUNCTION_URL"
fi
