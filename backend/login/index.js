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
        
        context.res = { 
            status: 200, 
            body: { 
                message: "Login bem-sucedido.",
                nome: user.nome,
                email: user.email
            }
        };
    } catch (err) {
        context.res = { status: 500, body: "Erro ao fazer login." };
    } finally {
        await client.close();
    }
};