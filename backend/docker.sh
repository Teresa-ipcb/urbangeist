#!/bin/bash

# Variáveis de configuração
IMAGE_NAME="ampliarimagem"
ACR_NAME="urbangeistregistry"
RESOURCE_GROUP="urbangeist-rg"
FUNCTION_APP_NAME="urbangeist-ampliarimagem"
STORAGE_ACCOUNT_NAME="teste56"
PLAN_NAME="urbangeist-plan"
LOCATION="francecentral"

# Verificar se o diretório ampliarImagem existe
if [ ! -d "./ampliarImagem" ]; then
  echo "Erro: Diretório ampliarImagem não encontrado."
  echo "Execute este script do diretório pai (onde a pasta ampliarImagem está localizada)."
  exit 1
fi

# 1. Criar ACR (se não existir)
if ! az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
  echo "Criando Azure Container Registry..."
  az acr create \
    --name $ACR_NAME \
    --resource-group $RESOURCE_GROUP \
    --sku Basic \
    --admin-enabled true
fi

# 2. Obter login server do ACR
REGISTRY=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer --output tsv)

# 3. Construir e enviar imagem para o ACR
echo "Construindo imagem diretamente no ACR..."
az acr build \
  --registry $ACR_NAME \
  --image $IMAGE_NAME:latest \
  --file ./ampliarImagem/Dockerfile \
  ./ampliarImagem

# 4. Criar App Service Plan se necessário
if ! az appservice plan show --name $PLAN_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
  echo "Criando App Service Plan..."
  az appservice plan create \
    --name $PLAN_NAME \
    --resource-group $RESOURCE_GROUP \
    --is-linux \
    --sku B1 \
    --location $LOCATION
fi

# 5. Criar Function App (ou atualizar container)
if ! az functionapp show --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP &> /dev/null; then
  echo "Criando Function App..."
  az functionapp create \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --storage-account $STORAGE_ACCOUNT_NAME \
    --plan $PLAN_NAME \
    --functions-version 4 \
    --runtime custom \
    --os-type Linux \
    --deployment-container-image-name "$REGISTRY/$IMAGE_NAME:latest"
else
  echo "Atualizando Function App com nova imagem..."
  az functionapp config container set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --docker-custom-image-name "$REGISTRY/$IMAGE_NAME:latest" \
    --docker-registry-server-url "https://$REGISTRY/" \
    --docker-registry-server-user $ACR_NAME \
    --docker-registry-server-password $(az acr credential show --name $ACR_NAME --query "passwords[0].value" --output tsv)
fi

# 6. Mostrar URL final
echo "Deploy concluído! URL da Function App:"
az functionapp show --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --query defaultHostName --output tsv
