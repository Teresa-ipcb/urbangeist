#!/bin/bash

# Nome dos recursos
RESOURCE_GROUP="urbangeist-rg"
COSMOSDB_NAME="urbangeist-db"
AZURE_MAPS_ACCOUNT="urbangeist-maps"

# Coordenadas de fallback (ex: IPCB)
LATITUDE=39.74362
LONGITUDE=-8.80705

echo "A preparar variáveis de ambiente..."

# Obter chave do Azure Maps
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

# Exportar variáveis para serem usadas no node
export AZURE_MAPS_KEY
export COSMOSDB_CONN_STRING

echo "📍 A buscar locais de interesse próximos (lat=$LATITUDE, lon=$LONGITUDE)..."

# Bloco Node.js para buscar e guardar locais
node <<EOF
const axios = require("axios");
const { MongoClient } = require("mongodb");

(async () => {
  const lat = $LATITUDE;
  const lon = $LONGITUDE;
  const radius = 20000;
  const mapsKey = process.env.AZURE_MAPS_KEY;
  const mongoUri = process.env.COSMOSDB_CONN_STRING;

  const categoriaMap = {
    "Lazer": "1",
    "Eventos": "2",
    "Cultura": "3",
    "Natureza": "4",
    "Culinária": "5"
  };

  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db("urbangeist");
  const col = db.collection("tb_local");

  for (const [categoria, categoriaId] of Object.entries(categoriaMap)) {
    const res = await axios.get("https://atlas.microsoft.com/search/poi/json", {
      params: {
        "subscription-key": mapsKey,
        "api-version": "1.0",
        "lat": lat,
        "lon": lon,
        "radius": radius,
        "query": categoria.toLowerCase(),
        "limit": 10
      }
    });

    const locais = res.data.results.map(poi => ({
      nome: poi.poi.name,
      coords: {
        type: "Point",
        coordinates: [poi.position.lon, poi.position.lat]
      },
      categoriaId,
      tipo: categoria,
      tags: poi.poi.categories || [],
      info: poi.poi.classifications?.map(c => c.code).join(", ") || "",
      imagem: "https://via.placeholder.com/150"
    }));

    for (const local of locais) {
      const existe = await col.findOne({
        nome: local.nome,
        "coords.coordinates": local.coords.coordinates
      });

      if (!existe) {
        await col.insertOne(local);
        console.log(\`Inserido: \${local.nome}\`);
      } else {
        console.log(\`Já existe: \${local.nome}\`);
      }
    }
  }

  await client.close();
})();
EOF

echo "Locais processados com sucesso."
