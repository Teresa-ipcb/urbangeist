const axios = require("axios");
const { MongoClient } = require("mongodb");

console.log("TESTE");
module.exports = async function (context, req) {
  try {
    console.log("TESTE2");
    const { lat, lon } = req.query;

    context.log("Parâmetros recebidos:", lat, lon);

    if (!lat || !lon) {
      console.log("400");
      context.res = {
        status: 400,
        body: "Parâmetros 'lat' e 'lon' são obrigatórios."
      };
      return;
    }

    const mapsKey = process.env.AZURE_MAPS_KEY;
    const mongoUri = process.env.COSMOSDB_CONN_STRING;

    if (!mapsKey || !mongoUri) {
      console.log("500");
      context.log.error("Variáveis de ambiente ausentes!");
      context.res = {
        status: 500,
        body: "AZURE_MAPS_KEY ou COSMOSDB_CONN_STRING não definidas."
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

    console.log("TESTE3");
    context.log("Ligando ao MongoDB...");
    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db("urbangeist");
    const col = db.collection("tb_local");
    context.log("Ligado ao MongoDB");

    for (const [categoria, categoriaId] of Object.entries(categoriaMap)) {
      context.log(`Buscando '${categoria}' no Azure Maps...`);
      console.log("TESTE4");
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

      context.log(` ${categoria}: ${response.data.results.length} encontrados`);

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
      console.log("TESTE5");
      for (const local of locais) {
        const existe = await col.findOne({
          nome: local.nome,
          "coords.coordinates": local.coords.coordinates
        });

        if (!existe) {
          await col.insertOne(local);
          context.log(`Inserido: ${local.nome}`);
        } else {
          context.log(`Já existe: ${local.nome}`);
        }
      }
    }

    await client.close();
    context.res = { status: 200, body: "Locais adicionados com sucesso." };
  } catch (err) {
    context.log.error("ERRO INTERNO:", err.message);
    context.log.error(err.stack);
    context.res = {
      status: 500,
      body: "Erro interno: " + err.message
    };
  }
};
