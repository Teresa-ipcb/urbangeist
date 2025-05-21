const { MongoClient } = require("mongodb");

module.exports = async function (context, req) {
  const mongoUri = process.env.COSMOSDB_CONN_STRING;
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db("urbangeist");

  const locais = await db.collection("tb_local").aggregate([
    {
      $lookup: {
        from: "tb_categoria",
        localField: "categoriaId",
        foreignField: "_id",
        as: "categoriaInfo"
      }
    },
    {
      $unwind: "$categoriaInfo"
    }
  ]).toArray();

  await client.close();
  context.res = {
    status: 200,
    body: locais
  };
};
