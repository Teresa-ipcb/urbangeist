#!/bin/bash

# Nome dos recursos
RESOURCE_GROUP="urbangeist-rg"
COSMOSDB_NAME="urbangeist-db"

# Obter string de conexão da CosmosDB
COSMOSDB_CONN_STRING=$(az cosmosdb keys list --type connection-strings \
											 --name $COSMOSDB_NAME \
											 --resource-group $RESOURCE_GROUP \
											 --query "connectionStrings[0].connectionString" \
											 --output tsv)

# Exportar para usar no process.env
export COSMOSDB_CONN_STRING
export NODE_PATH=./node_modules

echo "A verificar/inserir categorias..."

node <<EOF
const { MongoClient } = require("mongodb");

(async () => {
  const uri = process.env.COSMOSDB_CONN_STRING;
  const client = new MongoClient(uri);

  await client.connect();
  const db = client.db("urbangeist");
  const col = db.collection("tb_categoria");

  const count = await col.countDocuments();

  if (count === 0) {
    const dados = [
      { "_id": "1", "nome": "Lazer" },
      { "_id": "2", "nome": "Eventos" },
      { "_id": "3", "nome": "Cultura" },
      { "_id": "4", "nome": "Natureza" },
      { "_id": "5", "nome": "Culinária" }
    ];

    await col.insertMany(dados);
    console.log("Categorias inseridas.");
  } else {
    console.log("Categorias já existem na base de dados.");
  }

  await client.close();
})();
EOF

echo "Script concluído com sucesso."

echo "A publicar Azure Functions para o Azure..."

cd ../backend
func azure functionapp publish urbangeist-function

cd ../scripts