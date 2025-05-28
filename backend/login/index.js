const { MongoClient } = require("mongodb");
const { v4: uuidv4 } = require("uuid");

module.exports = async function (context, req) {
    const allowedOrigins = [
        'https://urbangeist-app.azurewebsites.net',
        'http://localhost:3000'
    ];
    const origin = req.headers.origin;

    const headers = {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
    if (allowedOrigins.includes(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
    }

    if (req.method === "OPTIONS") {
        context.res = {
            status: 204,
            headers: headers
        };
        return;
    }

    const { email, password } = req.body;
    const client = new MongoClient(process.env.COSMOSDB_CONN_STRING);

    try {
        await client.connect();
        const db = client.db("urbangeist");
        const collection = db.collection("tb_utilizador");
        const sessions = db.collection("tb_sessions");

        const user = await collection.findOne({ email });

        if (!user) {
            context.res = { status: 404, body: "Utilizador não encontrado.", headers };
            return;
        }

        if (user.password !== password) {
            context.res = { status: 401, body: "Password incorreta.", headers };
            return;
        }

        const sessionId = uuidv4();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await sessions.insertOne({
            sessionId,
            userId: user._id,
            email: user.email,
            expiresAt,
            userAgent: req.headers['user-agent'],
            ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
        });

        context.res = {
            status: 200,
            headers,
            body: {
                message: "Login bem-sucedido.",
                sessionId,
                nome: user.nome,
                email: user.email
            }
        };
    } catch (err) {
        context.res = { status: 500, body: "Erro ao fazer login.", headers };
    } finally {
        await client.close();
    }
};
