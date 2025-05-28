const { MongoClient } = require("mongodb");

module.exports = async function (context, req) {
    const { email, preferencias } = req.body;
    const client = new MongoClient(process.env.COSMOSDB_CONN_STRING);

    try {
        await client.connect();
        const db = client.db("urbangeist");
        const collection = db.collection("tb_preferencias");
        await collection.insertOne({ email, ...preferencias });

        const sessions = db.collection("tb_sessions");
        const session = await sessions.findOne({
            sessionId,
            expiresAt: { $gt: new Date() }
        });

        if (!session) {
            context.res = { status: 401, body: "Sessão inválida ou expirada.", headers };
            return;
        }

        context.res = {
            status: 200,
            headers,
            body: {
                isValid: true,
                email: session.email
            }
        };
    } catch (err) {
        context.res = { status: 500, body: "Erro ao guardar preferências." };
    } finally {
        await client.close();
    }
};
