const { MongoClient } = require("mongodb");
const { v4: uuidv4 } = require("uuid");

module.exports = async function (context, req) {
    const { nome, email, password } = req.body;

    if (!nome || !email || !password) {
        context.res = {
            status: 400,
            body: "Campos obrigatórios em falta."
        };
        return;
    }

    const client = new MongoClient(process.env.COSMOSDB_CONN_STRING);

    try {
        await client.connect();
        const db = client.db("urbangeist");
        const utilizadores = db.collection("tb_utilizador");
        const sessoes = db.collection("tb_sessao");

        // Verifica se utilizador já existe
        const existing = await utilizadores.findOne({ email });
        if (existing) {
            context.res = {
                status: 409,
                body: "Utilizador já existe."
            };
            return;
        }

        // Cria utilizador
        await utilizadores.insertOne({ nome, email, password });

        // Cria sessão diretamente (login imediato)
        const sessionId = uuidv4();
        await sessoes.insertOne({
            sessionId,
            email,
            createdAt: new Date()
        });

        context.res = {
            status: 200,
            body: {
                sessionId,
                email,
                nome
            }
        };
    } catch (err) {
        context.log("Erro no registo:", err);
        context.res = {
            status: 500,
            body: "Erro ao criar utilizador."
        };
    } finally {
        await client.close();
    }
};
