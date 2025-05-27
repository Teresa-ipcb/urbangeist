const { MongoClient } = require("mongodb");

module.exports = async function (context, req) {
    const sessionId = req.cookies.sessionId;
    const client = new MongoClient(process.env.COSMOSDB_CONN_STRING);

    try {
        await client.connect();
        const db = client.db("urbangeist");
        const sessions = db.collection("tb_sessao");
        
        await sessions.deleteOne({ sessionId });

        context.res = {
            status: 200,
            body: "Logout realizado com sucesso",
            cookies: [{
                name: "sessionId",
                value: "",
                maxAge: 0
            }]
        };
    } catch (err) {
        context.res = { status: 500, body: "Erro ao fazer logout." };
    } finally {
        await client.close();
    }
};