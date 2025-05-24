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

  const { userId, localId, acao } = req.body || {};

  if (!userId || !localId || !acao) {
    context.res = {
      status: 400,
      body: "Parâmetros 'userId', 'localId' e 'acao' são obrigatórios."
    };
    return;
  }

  try {
    const client = new MongoClient(mongoUri);
    await client.connect();

    const db = client.db("urbangeist");
    const col = db.collection("tb_user_action");

    const novaAcao = {
      userId,
      localId,
      acao,
      timestamp: new Date()
    };

    await col.insertOne(novaAcao);
    await client.close();

    context.res = {
      status: 200,
      body: "Ação registada com sucesso."
    };
  } catch (err) {
    context.log.error("Erro ao registar ação:", err);
    context.res = {
      status: 500,
      body: "Erro interno ao registar ação."
    };
  }
};
