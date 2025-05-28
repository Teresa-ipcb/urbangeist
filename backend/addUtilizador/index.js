const { MongoClient } = require("mongodb");
const fetch = require("node-fetch");

module.exports = async function (context, req) {
    const { nome, email, password } = req.body;
    const client = new MongoClient(process.env.COSMOSDB_CONN_STRING);

    try {
        await client.connect();
        const db = client.db("urbangeist");
        const collection = db.collection("tb_utilizador");
        await collection.insertOne({ nome, email, password });

        // efetuar login
        const loginUrl = `https://urbangeist-function.azurewebsites.net/api/login`;
        const loginRes = await fetch(loginUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        const loginData = await loginRes.json();

        context.res = {
            status: 200,
            body: {
                mensagem: "Utilizador criado com sucesso e login efetuado.",
                sessao: loginData
            }
        };
    } catch (err) {
        context.res = { status: 500, body: "Erro ao criar utilizador." };
    } finally {
        await client.close();
    }
};
