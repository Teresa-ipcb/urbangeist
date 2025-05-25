module.exports = async function (context, req) {
  const mapsKey = process.env.AZURE_MAPS_KEY;

  context.res = {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    },
    body: {
      key: mapsKey
    }
  };
};
