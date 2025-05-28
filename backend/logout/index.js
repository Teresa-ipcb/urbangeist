const { MongoClient } = require("mongodb");

module.exports = async function (context, req) {
    const sessionId = req.body?.sessionId;

    if (!sessionId) {
        context.res = {
            status: 400,
            body: "Sessão não fornecida."
        };
        return;
    }

    const client = new MongoClient(process.env.COSMOSDB_CONN_STRING);

    try {
        await client.connect();
        const db = client.db("urbangeist");
        const sessions = db.collection("tb_sessao");
        
        // Elimina a sessão da base de dados
        await sessions.deleteOne({ sessionId });

        context.res = {
            status: 200,
            body: "Logout realizado com sucesso."
        };
    } catch (err) {
        context.log("Erro no logout:", err);
        context.res = {
            status: 500,
            body: "Erro ao fazer logout."
        };
    } finally {
        await client.close();
    }
};
