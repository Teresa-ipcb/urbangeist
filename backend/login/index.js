const { MongoClient } = require("mongodb");

module.exports = async function (context, req) {
    const { email, password } = req.body;
    const client = new MongoClient(process.env.COSMOSDB_CONN_STRING);

    try {
        await client.connect();
        const db = client.db("urbangeist");
        const collection = db.collection("tb_utilizador");
        
        const user = await collection.findOne({ email });
        
        if (!user) {
            context.res = { status: 404, body: "Utilizador não encontrado." };
            return;
        }
        
        if (user.password !== password) {
            context.res = { status: 401, body: "Password incorreta." };
            return;
        }

         // Criar sessão
        const sessionId = uuidv4();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas
        
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
            body: { 
                message: "Login bem-sucedido.",
                nome: user.nome,
                email: user.email
            },
            cookies: [{
                name: "sessionId",
                value: sessionId,
                maxAge: 24 * 60 * 60,
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "Strict"
            }]
        };
    } catch (err) {
        context.res = { status: 500, body: "Erro ao fazer login." };
    } finally {
        await client.close();
    }
};
