const { MongoClient } = require("mongodb");

module.exports = async function (context, req) {
  const mongoUri = process.env.COSMOSDB_CONN_STRING;

  if (!mongoUri) {
    context.res = {
      status: 500,
      body: "Erro de configuração: COSMOSDB_CONN_STRING não definido."
    };
    return;
  }

  try {
    const client = new MongoClient(mongoUri);
    await client.connect();

    const db = client.db("urbangeist");
    const locais = await db.collection("tb_local").find().toArray();

    await client.close();

    context.res = {
      status: 200,
      body: locais
    };
  } catch (err) {
    context.log.error("Erro ao buscar locais:", err);
    context.res = {
      status: 500,
      body: "Erro interno ao obter locais."
    };
  }
};
