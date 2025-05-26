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
    const categorias = await db.collection("tb_categoria")
                            .find()
                            .sort({ nome: 1 }) // Ordem alfabética
                            .project({ _id: 1, nome: 1 })
                            .toArray();

    await client.close();

    context.res = {
      status: 200,
      body: categorias,
      headers: {
        'Content-Type': 'application/json'
      }
    };
  } catch (err) {
    context.log.error("Erro ao buscar categorias:", err);
    context.res = {
      status: 500,
      body: "Erro interno ao obter categorias."
    };
  }
};
