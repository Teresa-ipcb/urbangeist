const axios = require("axios");
const { MongoClient } = require("mongodb");

console.log("Teste");
module.exports = async function (context, req) {
  const { lat, lon } = req.query;

  console.log("Teste2");
  if (!lat || !lon) {
    console.log("400");
    context.res = { status: 400, body: "Parâmetros 'lat' e 'lon' obrigatórios." };
    return;
  }

  const mapsKey = process.env.AZURE_MAPS_KEY;
  const mongoUri = process.env.COSMOSDB_CONN_STRING;

  if (!mapsKey || !mongoUri) {
    context.res = {
      console.log("500");
      status: 500,
      body: "Erro de configuração: chaves AZURE_MAPS_KEY ou COSMOSDB_CONN_STRING não definidas."
    };
    return;
  }

  const radius = 20000;

  const categoriaMap = {
    "Lazer": "1",
    "Eventos": "2",
    "Cultura": "3",
    "Natureza": "4",
    "Culinária": "5"
  };

  try {
    context.log("📡 Ligando à base de dados...");
    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db("urbangeist");
    const col = db.collection("tb_local");

    context.log("🧠 Ligado com sucesso. A consultar Azure Maps...");

    for (const [categoria, categoriaId] of Object.entries(categoriaMap)) {
      const response = await axios.get("https://atlas.microsoft.com/search/poi/json", {
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

      context.log(`📍 Categoria: ${categoria}, Resultados: ${response.data.results.length}`);

      const locais = response.data.results.map(poi => ({
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
          context.log(`✔️ Inserido: ${local.nome}`);
        } else {
          context.log(`⚠️ Já existe: ${local.nome}`);
        }
      }
    }

    await client.close();
    context.res = { status: 200, body: "Locais adicionados com sucesso." };
  } catch (err) {
    context.log.error("❌ Erro na função fetchNearbyPlaces:", err.message, err.stack);
    context.res = {
      status: 500,
      body: `Erro interno: ${err.message}`
    };
  }
};
