const axios = require("axios");
const { MongoClient } = require("mongodb");

module.exports = async function (context, req) {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    context.res = { status: 400, body: "Parâmetros 'lat' e 'lon' obrigatórios." };
    return;
  }

  const mapsKey = process.env.AZURE_MAPS_KEY;
  const mongoUri = process.env.COSMOSDB_CONN_STRING;

  if (!mapsKey || !mongoUri) {
    context.res = { status: 500, body: "Erro de configuração: chaves de ambiente não definidas." };
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
    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db("urbangeist");
    const col = db.collection("tb_local");

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
        if (!existe) await col.insertOne(local);
      }
    }

    await client.close();
    context.res = { status: 200, body: "Locais adicionados com sucesso." };
  } catch (err) {
    context.log.error("Erro na função fetchNearbyPlaces:", err);
    context.res = { status: 500, body: "Erro interno ao buscar ou gravar locais." };
  }
};
