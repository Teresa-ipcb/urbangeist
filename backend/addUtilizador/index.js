const { MongoClient } = require("mongodb");

module.exports = async function (context, req) {
    const { nome, email, password } = req.body;
    const client = new MongoClient(process.env.COSMOSDB_CONN_STRING);

    try {
        await client.connect();
        const db = client.db("urbangeist");
        const collection = db.collection("tb_utilizador");

         // Verificar se já existe utilizador
        const existing = await collection.findOne({ email });
        if (existing) {
            context.res = {
                status: 409,
                headers,
                body: "Utilizador já existe."
            };
            return;
        }
        
        await collection.insertOne({ nome, email, password });

        // efetuar login
        const loginRes = await fetch(`${process.env.BASE_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': origin
            },
            body: JSON.stringify({ email, password }),
            credentials: 'include'
        });

        const responseBody = await loginRes.json();

        const rawSetCookie = loginRes.headers.getSetCookie?.() || loginRes.headers.get('set-cookie');

        context.res = {
            status: loginRes.status,
            headers: {
                ...headers,
                'Set-Cookie': rawSetCookie
            },
            body: responseBody
        };
    } catch (err) {
        context.res = { status: 500, body: "Erro ao criar utilizador." };
    } finally {
        await client.close();
    }
};
