const { MongoClient } = require("mongodb");
const { BlobServiceClient } = require("@azure/storage-blob");
const crypto = require("crypto");

module.exports = async function (context, req) {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      context.res = {
        status: 400,
        body: "Parâmetros 'lat' e 'lon' são obrigatórios."
      };
      return;
    }

    const mapsKey = process.env.AZURE_MAPS_KEY;
    const mongoUri = process.env.COSMOSDB_CONN_STRING;
    const blobConnStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const mapillaryToken = process.env.MAPILLARY_TOKEN;
    const containerName = "imagens";

    if (!mapsKey || !mongoUri || !blobConnStr || !mapillaryToken) {
      context.res = {
        status: 500,
        body: "Variáveis de ambiente ausentes."
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

    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db("urbangeist");
    const col = db.collection("tb_local");

    const blobService = BlobServiceClient.fromConnectionString(blobConnStr);
    const container = blobService.getContainerClient(containerName);

    for (const [categoria, categoriaId] of Object.entries(categoriaMap)) {
      const url = new URL("https://atlas.microsoft.com/search/poi/json");
      url.searchParams.set("subscription-key", mapsKey);
      url.searchParams.set("api-version", "1.0");
      url.searchParams.set("lat", lat);
      url.searchParams.set("lon", lon);
      url.searchParams.set("radius", radius);
      url.searchParams.set("query", categoria.toLowerCase());
      url.searchParams.set("limit", 10);

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Erro Azure Maps: ${response.statusText}`);
      const data = await response.json();

      for (const poi of data.results) {
        const nome = poi.poi.name;
        const coords = {
          type: "Point",
          coordinates: [poi.position.lon, poi.position.lat]
        };

        const existe = await col.findOne({ nome, "coords.coordinates": coords.coordinates });
        if (existe) continue;

        // Buscar imagem da Mapillary
        let imagemUrl = "https://via.placeholder.com/150";

        try {
          const mapillaryRes = await fetch(
            `https://graph.mapillary.com/images?access_token=${mapillaryToken}&fields=id,thumb_1024_url&closeto=${coords.coordinates[1]},${coords.coordinates[0]}&limit=1`
          );

          const mapillaryJson = await mapillaryRes.json();
          const thumbUrl = mapillaryJson.data?.[0]?.thumb_1024_url;

          if (thumbUrl) {
            const imageFetch = await fetch(thumbUrl);
            const arrayBuffer = await imageFetch.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Nome da imagem
            const slug = nome.toLowerCase().replace(/\s+/g, "_").replace(/[^\w\-]/g, "");
            const hash = crypto.createHash("md5").update(nome).digest("hex").slice(0, 6);
            const blobName = `${slug}_${hash}.jpg`;

            const blockBlob = container.getBlockBlobClient(blobName);
            await blockBlob.uploadData(buffer, {
              blobHTTPHeaders: { blobContentType: "image/jpeg" }
            });

            imagemUrl = blockBlob.url;
          }
        } catch (err) {
          context.log(`Erro ao buscar imagem no Mapillary para '${nome}': ${err.message}`);
        }

        const local = {
          nome,
          coords,
          categoriaId,
          tipo: categoria,
          tags: poi.poi.categories || [],
          info: poi.poi.classifications?.map(c => c.code).join(", ") || "",
          imagem: imagemUrl
        };

        await col.insertOne(local);
        context.log(`Inserido: ${nome}`);
      }
    }

    await client.close();
    context.res = {
      status: 200,
      body: { mensagem: "Locais adicionados com sucesso." }
    };

  } catch (err) {
    context.log.error("Erro:", err.message);
    context.res = {
      status: 500,
      body: "Erro interno: " + err.message
    };
  }
};
