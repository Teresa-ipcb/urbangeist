#!/bin/bash

# Variáveis
RESOURCE_GROUP="urbangeist-rg"
LOCATION="francecentral"
APP_NAME="urbangeist-app"
COSMOSDB_NAME="urbangeist-db"
BD_NAME="urbangeist"
STORAGE_ACCOUNT="teste56"
FUNCTION_APP="urbangeist-function"
AZURE_MAPS_ACCOUNT="urbangeist-maps"
CONTAINER_NAME="teste"

# Pasta local com imagens default por tipo categoria
DEFAULT_IMAGES_DIR="./frontend/images"

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
# Criar Storage Account (equivalente ao recurso principal)
az storage account create \
  --name teste56 \
  --resource-group $RESOURCE_GROUP \
  --location francecentral \
  --sku Standard_ZRS \
  --kind StorageV2 \
  --min-tls-version TLS1_2 \
  --allow-blob-public-access true \
  --allow-shared-key-access true \
  --public-network-access Enabled \
  --bypass AzureServices \
  --default-action Allow \
  --https-only true \
  --access-tier Hot

# Configurar Blob Service
az storage account blob-service-properties update \
  --account-name teste56 \
  --resource-group $RESOURCE_GROUP \
  --enable-change-feed true \
  --enable-restore-policy true \
  --restore-days 1 \
  --enable-container-delete-retention true \
  --container-retention-days 2 \
  --enable-delete-retention true \
  --delete-retention-days 2 \
  --enable-versioning true

# Configurar File Service
az storage account file-service-properties update \
  --account-name teste56 \
  --resource-group $RESOURCE_GROUP \
  --enable-smb-protocol \
  --enable-share-delete-retention true \
  --share-retention-days 2

# Criar container (equivalente ao último recurso)
az storage container create \
  --name teste \
  --account-name teste56 \
  --public-access container


STORAGE_KEY=$(az storage account keys list --account-name $STORAGE_ACCOUNT \
                                           --resource-group $RESOURCE_GROUP \
                                           --query '[0].value' -o tsv)

# Fazer upload de cada imagem default
for img_path in $DEFAULT_IMAGES_DIR/*.jpg; do
  filename=$(basename $img_path)
  blob_name="default/$filename"
  
  echo "A fazer upload de $img_path como $blob_name..."

  az storage blob upload \
  --account-name $STORAGE_ACCOUNT \
  --account-key $STORAGE_KEY \
  --container-name $CONTAINER_NAME \
  --name "$blob_name" \
  --file "$img_path" \
  --overwrite true
done

echo "Upload das imagens default concluído."

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
                       --sku G2 \
					   --kind Gen2

AZURE_MAPS_KEY=$(az maps account keys list --name $AZURE_MAPS_ACCOUNT \
                                           --resource-group $RESOURCE_GROUP \
                                           --query "primaryKey" \
                                           --output tsv)

# Obter string de conexão da CosmosDB
COSMOSDB_CONN_STRING=$(az cosmosdb keys list --type connection-strings \
                                             --name $COSMOSDB_NAME \
                                             --resource-group $RESOURCE_GROUP \
                                             --query "connectionStrings[0].connectionString" \
                                             --output tsv)

# Obter string de conexão da Storage
STORAGE_CONN_STRING=$(az storage account show-connection-string --name $STORAGE_ACCOUNT \
                                                                --resource-group $RESOURCE_GROUP \
                                                                --query connectionString \
                                                                --output tsv)
                                                                

# Definir variáveis de ambiente para App Service
az webapp config appsettings set --name $APP_NAME \
                                 --resource-group $RESOURCE_GROUP \
                                 --settings AZURE_MAPS_KEY=$AZURE_MAPS_KEY \
					    COSMOSDB_CONN_STRING="$COSMOSDB_CONN_STRING" \
					    AZURE_STORAGE_CONNECTION_STRING="$STORAGE_CONN_STRING" \
					    MAPILLARY_TOKEN="MLY|9589542104477443|51fa759e25e400b139506cbc58d40d9e"

# Definir variáveis de ambiente para Function App
az functionapp config appsettings set --name $FUNCTION_APP \
                                      --resource-group $RESOURCE_GROUP \
                                      --settings AZURE_MAPS_KEY=$AZURE_MAPS_KEY \
						 COSMOSDB_CONN_STRING="$COSMOSDB_CONN_STRING" \
                                                 AZURE_STORAGE_CONNECTION_STRING="$STORAGE_CONN_STRING" \
                                                 MAPILLARY_TOKEN="MLY|9589542104477443|51fa759e25e400b139506cbc58d40d9e"


# Adicionar permissões CORS
az functionapp cors add --name $FUNCTION_APP \
			--resource-group $RESOURCE_GROUP \
			--allowed-origins https://urbangeist-app.azurewebsites.net


# Ligar App Service ao GitHub para CI/CD
az webapp deployment source config --name $APP_NAME \
                                   --resource-group $RESOURCE_GROUP \
                                   --repo-url https://github.com/Teresa-ipcb/urbangeist.git \
                                   --branch master \
                                   --repository-type github
		
echo "Infraestrutura criada com sucesso!"

cd scripts
npm install mongodb@3.7 > /dev/null 2>&1
cd ..

chmod +x scripts/seed_categorias.sh
./scripts/seed_categorias.sh
