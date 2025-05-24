const { MongoClient } = require("mongodb");

module.exports = async function (context, req) {
  try {
    const mongoUri = process.env.COSMOSDB_CONN_STRING;
    if (!mongoUri) {
      context.res = { status: 500, body: "❌ Conexão não definida." };
      return;
    }

    context.log("🔌 Ligando à base de dados...");
    const client = new MongoClient(mongoUri);
    await client.connect();
    await client.close();

    context.res = { status: 200, body: "✅ Ligação à BD estabelecida com sucesso." };
  } catch (err) {
    context.log("❌ Falha na ligação:");
    context.log(err.message);
    context.res = { status: 500, body: "Erro: " + err.message };
  }
};
