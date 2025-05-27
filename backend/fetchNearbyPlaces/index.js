const { MongoClient } = require("mongodb");

module.exports = async function (context, req) {
  try {
    const { lat, lon } = req.query;

    context.log("Parâmetros recebidos:", lat, lon);

    if (!lat || !lon) {
      context.res = {
        status: 400,
        body: "Parâmetros 'lat' e 'lon' são obrigatórios."
      };
      return;
    }

    const mapsKey = process.env.AZURE_MAPS_KEY;
    const mongoUri = process.env.COSMOSDB_CONN_STRING;

    if (!mapsKey || !mongoUri) {
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

    context.log("Ligando ao MongoDB...");
    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db("urbangeist");
    const col = db.collection("tb_local");
    context.log("Ligado ao MongoDB");

    for (const [categoria, categoriaId] of Object.entries(categoriaMap)) {
      context.log(`Buscando '${categoria}' no Azure Maps...`);

      const url = new URL("https://atlas.microsoft.com/search/poi/json");
      url.searchParams.set("subscription-key", mapsKey);
      url.searchParams.set("api-version", "1.0");
      url.searchParams.set("lat", lat);
      url.searchParams.set("lon", lon);
      url.searchParams.set("radius", radius);
      url.searchParams.set("query", categoria.toLowerCase());
      url.searchParams.set("limit", 10);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Erro na chamada ao Azure Maps: ${response.statusText}`);
      }
      const data = await response.json();

      context.log(`${categoria}: ${data.results.length} encontrados`);

      const locais = data.results.map(poi => ({
        // Gera URL de imagem estática do Azure Maps
        const staticMapUrl = `https://atlas.microsoft.com/map/static/png?api-version=1.0&subscription-key=${mapsKey}&zoom=15&center=${poi.position.lon},${poi.position.lat}&width=600&height=400&pins=default||${poi.position.lon} ${poi.position.lat}`;
        
        return {
          nome: poi.poi.name,
          coords: {
            type: "Point",
            coordinates: [poi.position.lon, poi.position.lat]
          },
          categoriaId,
          tipo: categoria,
          imagem: staticMapUrl,       // Imagem do Maps
          imagemOriginal: staticMapUrl
          //imagemGenerica: genericImages[categoria] // Fallback
      }));

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
    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: { mensagem: "Locais adicionados com sucesso." }
    };

  } catch (err) {
    context.log.error("ERRO INTERNO DETETADO");
    context.log.error("Mensagem:", err.message || "sem mensagem");
    context.log.error("Stacktrace:", err.stack || "sem stack");

    context.res = {
      status: 500,
      body: "Erro interno: " + (err.message || "desconhecido")
    };
  }
};
