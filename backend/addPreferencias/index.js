const { MongoClient } = require("mongodb");

module.exports = async function (context, req) {
    const { email, preferencias } = req.body;
    const client = new MongoClient(process.env.COSMOSDB_CONN_STRING);

    try {
        await client.connect();
        const db = client.db("urbangeist");
        const collection = db.collection("tb_preferencias");
        await collection.insertOne({ email, ...preferencias });

        context.res = { status: 200, body: "Preferências guardadas." };
    } catch (err) {
        context.res = { status: 500, body: "Erro ao guardar preferências." };
    } finally {
        await client.close();
    }
};