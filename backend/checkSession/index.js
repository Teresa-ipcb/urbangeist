// checkSession/index.js
const { MongoClient } = require("mongodb");

module.exports = async function (context, req) {
    // Configuração de CORS
    context.res = {
        headers: {
            "Access-Control-Allow-Origin": "https://urbangeist-app.azurewebsites.net",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Set-Cookie"
        }
    };
    
    if (req.method === "OPTIONS") {
        return context.res;
    }
    
    const sessionId = req.cookies.sessionId;
    const client = new MongoClient(process.env.COSMOSDB_CONN_STRING);

    if (!sessionId) {
        context.res = { status: 401, body: "Sessão não encontrada." };
        return;
    }

    try {
        await client.connect();
        const db = client.db("urbangeist");
        const sessions = db.collection("tb_sessao");
        
        const session = await sessions.findOne({ 
            sessionId,
            expiresAt: { $gt: new Date() }
        });

        if (!session) {
            context.res = { status: 401, body: "Sessão expirada ou inválida." };
            return;
        }

        context.res = { 
            status: 200,
            body: {
                isValid: true,
                email: session.email
            }
        };
    } catch (err) {
        context.res = { status: 500, body: "Erro ao verificar sessão." };
    } finally {
        await client.close();
    }
};
