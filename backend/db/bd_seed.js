const { MongoClient } = require("mongodb");

const dados = [
  { "_id": "1", "nome": "Lazer" },
  { "_id": "2", "nome": "Eventos" },
  { "_id": "3", "nome": "Cultura" },
  { "_id": "4", "nome": "Natureza" },
  { "_id": "5", "nome": "Culinária" }
];

async function seedCategorias() {
  const client = new MongoClient("COSMOSDB_CONN_STRING");
  await client.connect();
  const db = client.db("urbangeist");
  await db.collection("tb_categoria").insertMany(dados);
  console.log("Categorias inseridas.");
  client.close();
}

seedCategorias();
