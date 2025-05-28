#!/bin/bash

# Nome dos recursos
RESOURCE_GROUP="urbangeist-rg"
COSMOSDB_NAME="urbangeist-db"

echo "A preparar variáveis de ambiente..."

# Obter string de conexão da CosmosDB
COSMOSDB_CONN_STRING=$(az cosmosdb keys list --type connection-strings \
    --name $COSMOSDB_NAME \
    --resource-group $RESOURCE_GROUP \
    --query "connectionStrings[0].connectionString" \
    --output tsv)

# Exportar variável de ambiente
export COSMOSDB_CONN_STRING

echo " A inserir utilizadores de teste..."

# Bloco Node.js para inserir utilizadores
node <<EOF
const { MongoClient } = require("mongodb");

(async () => {
  const mongoUri = process.env.COSMOSDB_CONN_STRING;
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db("urbangeist");
  const col = db.collection("tb_utilizador");

  const utilizadores = [
    { nome: "Ana Silva", email: "ana@exemplo.com", password: "1234" },
    { nome: "Bruno Costa", email: "bruno@exemplo.com", password: "1234" },
    { nome: "Carla Pinto", email: "carla@exemplo.com", password: "1234" },
    { nome: "Diogo Lopes", email: "diogo@exemplo.com", password: "1234" },
    { nome: "Eva Santos", email: "eva@exemplo.com", password: "1234" },
    { nome: "Fábio Almeida", email: "fabio@exemplo.com", password: "1234" }
  ];

  for (const user of utilizadores) {
    const existe = await col.findOne({ email: user.email });
    if (!existe) {
      await col.insertOne(user);
      console.log(`Utilizador inserido: ${user.email}`);
    } else {
      console.log(`Utilizador já existe: ${user.email}`);
    }
  }

  await client.close();
})();
EOF

echo "Utilizadores de teste processados com sucesso."