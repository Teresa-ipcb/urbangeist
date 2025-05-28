#!/bin/bash

# Variáveis de configuração
IMAGE_NAME="ampliarimagem"
ACR_NAME="urbangeistregistry"
RESOURCE_GROUP="urbangeist-rg"
FUNCTION_APP_NAME="urbangeist-ampliarimagem"
STORAGE_ACCOUNT_NAME="urbangeiststorage"
PLAN_NAME="urbangeist-app-plan"
LOCATION="francecentral"

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

# 3. Login no ACR (sem Docker)
echo "Obtendo token do ACR..."
ACR_TOKEN=$(az acr login --name $ACR_NAME --expose-token --output tsv --query accessToken)
REGISTRY=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer --output tsv)

# 4. Construir e fazer push da imagem (usando ACR Tasks)
echo "Construindo imagem diretamente no ACR..."
az acr build \
  --registry $ACR_NAME \
  --image $IMAGE_NAME \
  --file ./ampliarImagem/Dockerfile \
  ./ampliarImagem

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
    --runtime-version 18 \
    --image $REGISTRY/$IMAGE_NAME:latest \
    --assign-identity '[system]'
else
  echo "Atualizando Function App..."
  az functionapp config container set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --docker-registry-server-url https://$REGISTRY \
    --docker-registry-server-user $ACR_NAME \
    --docker-registry-server-password $ACR_TOKEN \
    --docker-custom-image-name $REGISTRY/$IMAGE_NAME:latest
fi

echo "✅ Deploy completo!"
echo "URL da Function App: https://$(az functionapp show --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --query defaultHostName --output tsv)"
