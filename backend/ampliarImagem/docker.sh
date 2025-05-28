#!/bin/bash

# Variáveis de configuração
IMAGE_NAME=ampliarimagem
ACR_NAME=urbangeistregistry
RESOURCE_GROUP=urbangeist-rg
FUNCTION_APP_NAME=urbangeist-ampliarimagem
STORAGE_ACCOUNT_NAME=urbangeiststorage # <-- substitui se for diferente
PLAN_NAME=urbangeist-plan # <-- substitui se necessário

# Criar o ACR (caso não exista)
az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP &> /dev/null
if [ $? -ne 0 ]; then
  echo "A criar Azure Container Registry $ACR_NAME..."
  az acr create \
    --name $ACR_NAME \
    --resource-group $RESOURCE_GROUP \
    --sku Basic \
    --admin-enabled true
fi

# Obter login server do ACR
REGISTRY=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer --output tsv)

# Login no ACR
az acr login --name $ACR_NAME

# Construir a imagem Docker
docker build -t $REGISTRY/$IMAGE_NAME ./ampliarImagem

# Push da imagem para o ACR
docker push $REGISTRY/$IMAGE_NAME

# Criar Function App (caso não exista)
if ! az functionapp show --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
  az functionapp create \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --storage-account $STORAGE_ACCOUNT_NAME \
    --plan $PLAN_NAME \
    --functions-version 4 \
    --deployment-container-image-name $REGISTRY/$IMAGE_NAME
else
  echo "Atualizar imagem da Function App existente..."
  az functionapp config container set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --docker-custom-image-name $REGISTRY/$IMAGE_NAME
fi

echo "✅ Deploy completo de $IMAGE_NAME para $FUNCTION_APP_NAME"
