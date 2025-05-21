#!/bin/bash

# Variáveis
RESOURCE_GROUP="urbangeist-rg2"
LOCATION="francecentral"
APP_NAME="urbangeist-app2"
COSMOSDB_NAME="urbangeist-db2"
BD_NAME="urbangeist2"
STORAGE_ACCOUNT="urbangeiststorage2"
FUNCTION_APP="urbangeist-function2"
AZURE_MAPS_ACCOUNT="urbangeist-maps"

# Criar Resource Group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Criar App Service Plan
az appservice plan create --name $APP_NAME-plan \
                          --resource-group $RESOURCE_GROUP \
                          --sku B1 \
                          --location $LOCATION

# Criar App Service
az webapp create --resource-group $RESOURCE_GROUP \
                 --plan $APP_NAME-plan \
                 --name $APP_NAME \
                 --runtime "NODE|20LTS"

# Criar CosmosDB e base de dados
az cosmosdb create --name $COSMOSDB_NAME \
                   --resource-group $RESOURCE_GROUP \
                   --kind MongoDB

az cosmosdb mongodb database create --account-name $COSMOSDB_NAME \
                                    --name $BD_NAME \
                                    --resource-group $RESOURCE_GROUP

# Criar coleções
COLLECTIONS=("tb_utilizador" "tb_review" "tb_categoria" "tb_preferencias" "tb_user_action")
for c in "${COLLECTIONS[@]}"; do
  az cosmosdb mongodb collection create --account-name $COSMOSDB_NAME \
                                        --database-name $BD_NAME \
                                        --name $c \
                                        --resource-group $RESOURCE_GROUP \
                                        --throughput 400
done

# Criar tb_local com índice 2dsphere
az cosmosdb mongodb collection create --account-name $COSMOSDB_NAME \
                                      --database-name $BD_NAME \
                                      --name tb_local \
                                      --resource-group $RESOURCE_GROUP \
                                      --throughput 400 \
                                      --idx '[{"key": {"keys": ["_id"]}}, {"key": {"keys": ["coords"], "options": {"2dsphereIndexVersion": 3}}}]'

# Criar Storage Account
az storage account create --name $STORAGE_ACCOUNT \
                          --resource-group $RESOURCE_GROUP \
                          --sku Standard_LRS

# Criar Azure Function App
az functionapp create --resource-group $RESOURCE_GROUP \
                      --consumption-plan-location $LOCATION \
                      --name $FUNCTION_APP \
                      --storage-account $STORAGE_ACCOUNT \
                      --runtime node \
                      --functions-version 4

# Atribuir identidade à Function App (para futuras permissões)
az functionapp identity assign --name $FUNCTION_APP --resource-group $RESOURCE_GROUP

# Criar Azure Maps e obter chave
az maps account create --name $AZURE_MAPS_ACCOUNT \
                       --resource-group $RESOURCE_GROUP \
                       --location $LOCATION \
                       --sku S0

AZURE_MAPS_KEY=$(az maps account keys list \
  --name $AZURE_MAPS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query "primaryKey" \
  --output tsv)

# Obter string de conexão da CosmosDB
COSMOSDB_CONN_STRING=$(az cosmosdb keys list \
  --type connection-strings \
  --name $COSMOSDB_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "connectionStrings[0].connectionString" \
  --output tsv)

# Definir variáveis de ambiente para App Service
az webapp config appsettings set --name $APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings AZURE_MAPS_KEY=$AZURE_MAPS_KEY \
               COSMOSDB_CONN_STRING="$COSMOSDB_CONN_STRING"

# Definir variáveis de ambiente para Function App
az functionapp config appsettings set --name $FUNCTION_APP \
    --resource-group $RESOURCE_GROUP \
    --settings AZURE_MAPS_KEY=$AZURE_MAPS_KEY \
               COSMOSDB_CONN_STRING="$COSMOSDB_CONN_STRING"

# Ligar App Service ao GitHub para CI/CD
az webapp deployment source config --name $APP_NAME \
                                   --resource-group $RESOURCE_GROUP \
                                   --repo-url https://github.com/Teresa-ipcb/cn.git \
                                   --branch master \
                                   --repository-type github

echo "Infraestrutura criada com sucesso!"
echo "As Azure Functions devem ser chamadas para inserir e ler dados."
