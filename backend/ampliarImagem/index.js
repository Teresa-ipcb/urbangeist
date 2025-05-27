const { MongoClient, ObjectId } = require("mongodb");
const { BlobServiceClient } = require("@azure/storage-blob");
const sharp = require("sharp");

const storageConnString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const mongoUri = process.env.COSMOSDB_CONN_STRING;

const containerOriginal = "imagens";
const containerThumbnail = "thumbnails";

module.exports = async function (context, req) {
  if (!storageConnString || !mongoUri) {
    context.res = { status: 500, body: "Faltam variáveis de ambiente." };
    return;
  }

  const id = req.query.id;
  if (!id) {
    context.res = { status: 400, body: "Parâmetro 'id' é obrigatório." };
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

    const local = await db.collection("tb_local").findOne({ _id: new ObjectId(id) });
    if (!local || !local.imagem) {
      context.res = { status: 404, body: "Local não encontrado ou sem imagem." };
      return;
    }

    const fileName = `${local._id}.jpg`;

    // Substituir axios: usar fetch nativo
    const response = await fetch(local.imagem);
    if (!response.ok) {
      throw new Error(`Erro ao fazer download da imagem: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const originalBuffer = Buffer.from(arrayBuffer);

    // Upload original
    const originalBlobClient = containerClientOriginal.getBlockBlobClient(fileName);
    await originalBlobClient.uploadData(originalBuffer, { overwrite: true });

    // Criar miniatura
    const thumbnailBuffer = await sharp(originalBuffer).resize(150).jpeg({ quality: 80 }).toBuffer();
    const thumbnailBlobClient = containerClientThumbnail.getBlockBlobClient(fileName);
    await thumbnailBlobClient.uploadData(thumbnailBuffer, { overwrite: true });

    const urlOriginal = originalBlobClient.url;
    const urlThumbnail = thumbnailBlobClient.url;

    // Atualizar documento
    await db.collection("tb_local").updateOne(
      { _id: local._id },
      { $set: { imagemOriginal: urlOriginal, imagemThumbnail: urlThumbnail } }
    );

    await mongo.close();

    context.res = {
      status: 200,
      body: {
        mensagem: `Miniatura gerada para ${local.nome}`,
        locais: [{ nome: local.nome, urlOriginal, urlThumbnail }]
      }
    };
  } catch (err) {
    context.log.error("Erro ao gerar miniatura:", err);
    context.res = {
      status: 500,
      body: "Erro ao gerar miniatura: " + err.message
    };
  }
};
