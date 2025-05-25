const { MongoClient } = require("mongodb");
const { BlobServiceClient } = require("@azure/storage-blob");

module.exports = async function (context, req) {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      context.res = { status: 400, body: "Parâmetros 'lat' e 'lon' são obrigatórios." };
      return;
    }

    const mapsKey = process.env.AZURE_MAPS_KEY;
    const mongoUri = process.env.COSMOSDB_CONN_STRING;
    const blobConn = process.env.STORAGE_CONN_STRING;
    if (!mapsKey || !mongoUri || !blobConn) {
      context.res = { status: 500, body: "Variáveis de ambiente em falta." };
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

    const client = new MongoClient(mongoUri);
    await client.connect();
    const col = client.db("urbangeist").collection("tb_local");

    const containerName = "imagens";
    const blobServiceClient = BlobServiceClient.fromConnectionString(blobConn);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists();

    for (const [categoria, categoriaId] of Object.entries(categoriaMap)) {
      const url = new URL("https://atlas.microsoft.com/search/poi/json");
      url.searchParams.set("subscription-key", mapsKey);
      url.searchParams.set("api-version", "1.0");
      url.searchParams.set("lat", lat);
      url.searchParams.set("lon", lon);
      url.searchParams.set("radius", radius);
      url.searchParams.set("query", categoria.toLowerCase());
      url.searchParams.set("limit", 10);

      const res = await fetch(url);
      if (!res.ok) throw new Error("Erro ao chamar Azure Maps: " + res.statusText);
      const data = await res.json();

      for (const poi of data.results) {
        const nome = poi.poi.name;
        const coords = [poi.position.lon, poi.position.lat];
        const filename = nome.replace(/\s/g, "_").toLowerCase() + ".jpg";

        const imgURL = `https://placehold.co/600x400?text=${encodeURIComponent(nome)}`;

        // Fazer download da imagem
        let blobUrl;
        try {
          const imgRes = await fetch(imgURL);
          const arrayBuffer = await imgRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          const blockBlobClient = containerClient.getBlockBlobClient(filename);
          await blockBlobClient.uploadData(buffer, { overwrite: true });
          blobUrl = blockBlobClient.url;
        } catch (e) {
          context.log(`Erro a guardar imagem de ${nome}: ${e.message}`);
          blobUrl = imgURL;
        }

        const local = {
          nome,
          coords: {
            type: "Point",
            coordinates: coords
          },
          categoriaId,
          tipo: categoria,
          tags: poi.poi.categories || [],
          info: poi.poi.classifications?.map(c => c.code).join(", ") || "",
          imagem: blobUrl
        };

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
      body: { mensagem: "Locais adicionados com imagens!" }
    };

  } catch (err) {
    context.log("Erro:", err.message);
    context.res = {
      status: 500,
      body: "Erro interno: " + err.message
    };
  }
};
