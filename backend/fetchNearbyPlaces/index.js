module.exports = async function (context, req) {
  context.log("⚡ Função chamada!");

  context.res = {
    status: 200,
    body: "✅ A função está viva e a responder!"
  };
};
