const { MongoClient } = require("mongodb");

module.exports = async function (context, req) {
    const allowedOrigins = [
        'https://urbangeist-app.azurewebsites.net',
        'http://localhost:3000'
    ];
    const origin = req.headers.origin;

    const headers = {
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };
    if (allowedOrigins.includes(origin)) {
        headers["Access-Control-Allow-Origin"] = origin;
    }

    if (req.method === "OPTIONS") {
        context.res = { status: 204, headers };
        return;
    }

    const authHeader = req.headers["authorization"];
    const sessionId = authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : null;

    if (!sessionId) {
        context.res = { status: 401, body: "Sessão não enviada.", headers };
        return;
    }

    const client = new MongoClient(process.env.COSMOSDB_CONN_STRING);

    try {
        await client.connect();
        const db = client.db("urbangeist");
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
        context.res = { status: 500, body: "Erro ao verificar sessão.", headers };
    } finally {
        await client.close();
    }
};
