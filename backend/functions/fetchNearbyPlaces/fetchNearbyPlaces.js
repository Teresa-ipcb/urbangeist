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
  const radius = 20000;

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
      categoriaId: categoriaId,
      tipo: categoria,
      tags: poi.poi.categories || [],
      info: poi.poi.classifications?.map(c => c.code).join(", ") || "",
      imagem: "https://via.placeholder.com/150"
    }));

    if (locais.length > 0) await col.insertMany(locais);
  }

  await client.close();
  context.res = { status: 200, body: "Locais adicionados com sucesso." };
};
