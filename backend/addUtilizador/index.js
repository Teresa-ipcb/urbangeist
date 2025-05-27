const { MongoClient } = require("mongodb");

module.exports = async function (context, req) {
    const { nome, email, password } = req.body;
    const client = new MongoClient(process.env.COSMOSDB_CONN_STRING);

    try {
        await client.connect();
        const db = client.db("urbangeist");
        const collection = db.collection("tb_utilizador");
        await collection.insertOne({ nome, email, password });

        context.res = { status: 200, body: "Utilizador criado com sucesso." };
    } catch (err) {
        context.res = { status: 500, body: "Erro ao criar utilizador." };
    } finally {
        await client.close();
    }
};