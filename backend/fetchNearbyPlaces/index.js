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
    const blobConn = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const mapillaryToken = process.env.MAPILLARY_TOKEN;
    const blobContainer = "imagens";
    const storageAccount = "urbangeiststorage"; // <- atualiza se o nome for outro

    if (!mapsKey || !mongoUri || !blobConn || !mapillaryToken) {
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

    const blobClient = BlobServiceClient.fromConnectionString(blobConn);
    const containerClient = blobClient.getContainerClient(blobContainer);

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
      if (!response.ok) {
        throw new Error(`Erro na chamada ao Azure Maps: ${response.statusText}`);
      }
      const data = await response.json();

      for (const poi of data.results) {
        let imagemURL;

        // Buscar imagem do Mapillary
        try {
          const mapiUrl = new URL("https://graph.mapillary.com/images");
          mapiUrl.searchParams.set("access_token", mapillaryToken);
          mapiUrl.searchParams.set("fields", "id,thumb_640_url");
          mapiUrl.searchParams.set("closeto", `${poi.position.lon},${poi.position.lat}`);
          mapiUrl.searchParams.set("limit", "1");

          const mapiRes = await fetch(mapiUrl);
          const mapiData = await mapiRes.json();

          if (mapiData.data && mapiData.data.length > 0) {
            const imgUrl = mapiData.data[0].thumb_640_url;

            const nomeBase = poi.poi.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
            const hash = crypto.createHash("md5").update(imgUrl).digest("hex").slice(0, 8);
            const blobName = `${nomeBase}_${hash}.jpg`;

            const blobBlockClient = containerClient.getBlockBlobClient(blobName);
            const exists = await blobBlockClient.exists();

            if (!exists) {
              const imgRes = await fetch(imgUrl);
              const buffer = Buffer.from(await imgRes.arrayBuffer());
              await blobBlockClient.uploadData(buffer, {
                blobHTTPHeaders: { blobContentType: "image/jpeg" }
              });
            }

            imagemURL = blobBlockClient.url;
          }
        } catch (err) {
          context.log.warn(`Erro ao obter imagem do Mapillary: ${err.message}`);
        }

        // Se falhou imagem, usa o default com base no tipo
        if (!imagemURL) {
          const tipoFormatado = categoria.toLowerCase();
          imagemURL = `https://${storageAccount}.blob.core.windows.net/${blobContainer}/default/${tipoFormatado}.jpg`;
        }

        const local = {
          nome: poi.poi.name,
          coords: {
            type: "Point",
            coordinates: [poi.position.lon, poi.position.lat]
          },
          categoriaId,
          tipo: categoria,
          tags: poi.poi.categories || [],
          info: poi.poi.classifications?.map(c => c.code).join(", ") || "",
          imagem: imagemURL
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
