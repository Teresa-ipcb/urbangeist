const { MongoClient } = require("mongodb");
const { BlobServiceClient } = require("@azure/storage-blob");
const sharp = require("sharp");
const axios = require("axios");

const storageConnString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const mongoUri = process.env.COSMOSDB_CONN_STRING;

const containerOriginal = "imagens";
const containerThumbnail = "thumbnails";

module.exports = async function (context, req) {
  if (!storageConnString || !mongoUri) {
    context.res = { status: 500, body: "Faltam variáveis de ambiente." };
    return;
  }

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(storageConnString);
    const containerClientOriginal = blobServiceClient.getContainerClient(containerOriginal);
    const containerClientThumbnail = blobServiceClient.getContainerClient(containerThumbnail);

    await containerClientOriginal.createIfNotExists({ access: 'container' });
    await containerClientThumbnail.createIfNotExists({ access: 'container' });

    const mongo = new MongoClient(mongoUri);
    await mongo.connect();
    const db = mongo.db("urbangeist");
    const locais = await db.collection("tb_local").find().toArray();

    const atualizados = [];

    for (const local of locais) {
      if (!local.imagem) continue;

      const fileName = `${local._id}.jpg`;

      // Faz download da imagem atual
      const response = await axios.get(local.imagem, { responseType: 'arraybuffer' });
      const originalBuffer = Buffer.from(response.data);

      // Upload original
      await containerClientOriginal.getBlockBlobClient(fileName).uploadData(originalBuffer);

      // Criar miniatura
      const thumbnailBuffer = await sharp(originalBuffer).resize(150).jpeg({ quality: 80 }).toBuffer();
      await containerClientThumbnail.getBlockBlobClient(fileName).uploadData(thumbnailBuffer);

      const urlOriginal = containerClientOriginal.getBlockBlobClient(fileName).url;
      const urlThumbnail = containerClientThumbnail.getBlockBlobClient(fileName).url;

      // Atualiza na BD (opcional)
      await db.collection("tb_local").updateOne(
        { _id: local._id },
        { $set: { imagemOriginal: urlOriginal, imagemThumbnail: urlThumbnail } }
      );

      atualizados.push({ nome: local.nome, urlOriginal, urlThumbnail });
    }

    await mongo.close();

    context.res = {
      status: 200,
      body: {
        mensagem: `Miniaturas geradas para ${atualizados.length} locais.`,
        locais: atualizados
      }
    };
  } catch (err) {
    context.log.error("Erro:", err);
    context.res = {
      status: 500,
      body: "Erro ao gerar miniaturas: " + err.message
    };
  }
};
