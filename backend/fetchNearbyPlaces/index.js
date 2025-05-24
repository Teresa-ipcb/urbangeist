module.exports = async function (context, req) {
  context.log("🟢 A função está ativa!");
  context.res = {
    status: 200,
    body: "✅ Função executada com sucesso!"
  };
};
