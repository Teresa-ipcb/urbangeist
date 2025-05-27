const { MongoClient } = require("mongodb");
const { BlobServiceClient } = require("@azure/storage-blob");

// Configurações
const CONTAINER_NAME = "locais-imagens";
const IMAGE_WIDTH = 800;
const IMAGE_HEIGHT = 600;

// Ícones por categoria
const CATEGORY_ICONS = {
  "Lazer": "park",
  "Eventos": "star",
  "Cultura": "museum",
  "Natureza": "tree",
  "Culinária": "restaurant"
};

module.exports = async function (context, req) {
  try {
    const { lat, lon } = req.query;
    const mapsKey = process.env.AZURE_MAPS_KEY;
    const mongoUri = process.env.COSMOSDB_CONN_STRING;
    const storageConnString = process.env.AZURE_STORAGE_CONNECTION_STRING;

    // Validações iniciais
    if (!lat || !lon) {
      return badRequest(context, "'lat' e 'lon' são obrigatórios");
    }

    if (!mapsKey || !mongoUri || !storageConnString) {
      return serverError(context, "Variáveis de ambiente ausentes");
    }

    // Conexão com o MongoDB
    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db("urbangeist");
    const locaisCollection = db.collection("tb_local");

    // Configuração do Blob Storage
    const blobServiceClient = BlobServiceClient.fromConnectionString(storageConnString);
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    await containerClient.createIfNotExists({ access: 'blob' });

    // Categorias de busca
    const categoriaMap = {
      "Lazer": "1",
      "Eventos": "2", 
      "Cultura": "3",
      "Natureza": "4",
      "Culinária": "5"
    };

    // Processar cada categoria
    for (const [categoria, categoriaId] of Object.entries(categoriaMap)) {
      context.log(`Processando categoria: ${categoria}`);

      // Buscar POIs no Azure Maps
      const pois = await buscarPOIs(categoria, lat, lon, mapsKey, context);
      
      // Processar cada POI encontrado
      for (const poi of pois) {
        try {
          // Gerar imagem do local
          const imagemUrl = await gerarImagemLocal(
            poi, 
            categoria, 
            mapsKey, 
            containerClient,
            context
          );

          // Criar documento do local
          const local = {
            nome: poi.poi.name,
            coords: {
              type: "Point",
              coordinates: [poi.position.lon, poi.position.lat]
            },
            categoriaId,
            tipo: categoria,
            imagem: imagemUrl,
            imagemOriginal: imagemUrl,
            tags: poi.poi.categories || [],
            ultimaAtualizacao: new Date()
          };

          // Upsert no MongoDB
          await locaisCollection.updateOne(
            { 
              nome: local.nome,
              "coords.coordinates": local.coords.coordinates
            },
            { $set: local },
            { upsert: true }
          );

        } catch (error) {
          context.log(`Erro ao processar POI ${poi.poi.name}: ${error.message}`);
        }
      }
    }

    await client.close();
    return successResponse(context, "Locais atualizados com sucesso");

  } catch (err) {
    context.log.error("Erro principal:", err);
    return serverError(context, err.message);
  }
};

// Funções auxiliares
async function buscarPOIs(categoria, lat, lon, mapsKey, context) {
  const url = new URL("https://atlas.microsoft.com/search/poi/json");
  url.searchParams.append("subscription-key", mapsKey);
  url.searchParams.append("api-version", "1.0");
  url.searchParams.append("query", categoria);
  url.searchParams.append("lat", lat);
  url.searchParams.append("lon", lon);
  url.searchParams.append("radius", 20000);
  url.searchParams.append("limit", 10);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Azure Maps error: ${response.status}`);
  }
  return (await response.json()).results;
}

async function gerarImagemLocal(poi, categoria, mapsKey, containerClient, context) {
  // 1. Tentar buscar foto do POI
  try {
    const photosUrl = `https://atlas.microsoft.com/search/poi/${poi.poi.id}/photos/json?subscription-key=${mapsKey}&api-version=1.0`;
    const photosResponse = await fetch(photosUrl);
    
    if (photosResponse.ok) {
      const photosData = await photosResponse.json();
      if (photosData.photos?.length > 0) {
        return photosData.photos[0].url; // Usa a primeira foto disponível
      }
    }
  } catch (error) {
    context.log(`Não encontrou fotos para ${poi.poi.name}`);
  }

  // 2. Criar imagem estática personalizada
  const staticImageUrl = new URL("https://atlas.microsoft.com/map/static/png");
  staticImageUrl.searchParams.append("api-version", "1.0");
  staticImageUrl.searchParams.append("subscription-key", mapsKey);
  staticImageUrl.searchParams.append("center", `${poi.position.lon},${poi.position.lat}`);
  staticImageUrl.searchParams.append("zoom", "15");
  staticImageUrl.searchParams.append("width", IMAGE_WIDTH);
  staticImageUrl.searchParams.append("height", IMAGE_HEIGHT);
  staticImageUrl.searchParams.append(
    "pins", 
    `default|${CATEGORY_ICONS[categoria]}||${poi.position.lon} ${poi.position.lat}`
  );

  // 3. Fazer upload para Blob Storage
  try {
    const imageResponse = await fetch(staticImageUrl);
    const blobName = `local-${Date.now()}-${poi.poi.name.replace(/[^\w]/g, '-')}.jpg`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    await blockBlobClient.uploadStream(imageResponse.body);
    return blockBlobClient.url;
  } catch (error) {
    context.log(`Erro no upload da imagem: ${error.message}`);
    return staticImageUrl.toString(); // Fallback para URL direta se falhar o upload
  }
}

function successResponse(context, message) {
  context.res = {
    status: 200,
    body: { success: true, message }
  };
}

function badRequest(context, message) {
  context.res = {
    status: 400,
    body: { success: false, message }
  };
}

function serverError(context, message) {
  context.res = {
    status: 500, 
    body: { success: false, message }
  };
}
