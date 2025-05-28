#!/bin/bash

# Nome dos recursos
RESOURCE_GROUP="urbangeist-rg"
COSMOSDB_NAME="urbangeist-db"

# Obter string de conexão da CosmosDB
COSMOSDB_CONN_STRING=$(az cosmosdb keys list --type connection-strings \
    --name $COSMOSDB_NAME \
    --resource-group $RESOURCE_GROUP \
    --query "connectionStrings[0].connectionString" \
    --output tsv)

# Exportar variável de ambiente
export COSMOSDB_CONN_STRING

# Bloco Node.js para inserir preferências diferenciadas
node <<EOF
const { MongoClient } = require("mongodb");

(async () => {
  const mongoUri = process.env.COSMOSDB_CONN_STRING;
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db("urbangeist");
  const colUtilizador = db.collection("tb_utilizador");
  const colPreferencias = db.collection("tb_preferencias");

  const dados = [
    {
      email: "ana@exemplo.com",
      preferencias: {
        tempo_livre: "Museus",
        periodo: "Diurnas",
        planeamento: "Individual",
        estilo: "Cultural",
        orcamento: "Económico",
        condicoes: "Nenhuma",
        acesso_facilitado: "Sim",
        servicos_especificos: "Não",
        restricoes_alimentares: "Não",
        transporte: "Transporte público",
        ambiente: "Ambientes fechados"
      }
    },
    {
      email: "bruno@exemplo.com",
      preferencias: {
        tempo_livre: "Caminhadas",
        periodo: "Diurnas",
        planeamento: "Em grupo",
        estilo: "Aventuroso",
        orcamento: "Moderado",
        condicoes: "Necessidades auditivas",
        acesso_facilitado: "Sim",
        servicos_especificos: "Sim",
        restricoes_alimentares: "Sim",
        transporte: "Bicicleta",
        ambiente: "Ao ar livre"
      }
    },
    {
      email: "carla@exemplo.com",
      preferencias: {
        tempo_livre: "Cinema",
        periodo: "Noturnas",
        planeamento: "Individual",
        estilo: "Moderno",
        orcamento: "Luxuoso",
        condicoes: "Nenhuma",
        acesso_facilitado: "Não",
        servicos_especificos: "Não",
        restricoes_alimentares: "Não",
        transporte: "Carro próprio",
        ambiente: "Ambientes fechados"
      }
    },
    {
      email: "diogo@exemplo.com",
      preferencias: {
        tempo_livre: "Teatro",
        periodo: "Ambas",
        planeamento: "Em grupo",
        estilo: "Tradicional",
        orcamento: "Económico",
        condicoes: "Mobilidade reduzida",
        acesso_facilitado: "Sim",
        servicos_especificos: "Sim",
        restricoes_alimentares: "Sim",
        transporte: "Táxi",
        ambiente: "Ao ar livre"
      }
    },
    {
      email: "eva@exemplo.com",
      preferencias: {
        tempo_livre: "Bares",
        periodo: "Noturnas",
        planeamento: "Individual",
        estilo: "Moderno",
        orcamento: "Moderado",
        condicoes: "Necessidades visuais",
        acesso_facilitado: "Não",
        servicos_especificos: "Não",
        restricoes_alimentares: "Sim",
        transporte: "Carro próprio",
        ambiente: "Ambientes fechados"
      }
    },
    {
      email: "fabio@exemplo.com",
      preferencias: {
        tempo_livre: "Restaurantes",
        periodo: "Ambas",
        planeamento: "Em grupo",
        estilo: "Relaxado",
        orcamento: "Luxuoso",
        condicoes: "Nenhuma",
        acesso_facilitado: "Sim",
        servicos_especificos: "Sim",
        restricoes_alimentares: "Não",
        transporte: "Transporte público",
        ambiente: "Ao ar livre"
      }
    }
  ];

  for (const { email, preferencias } of dados) {
    const user = await colUtilizador.findOne({ email });
    if (!user) {
      console.log(`Utilizador não encontrado: ${email}`);
      continue;
    }

    const exists = await colPreferencias.findOne({ _id: user._id });
    if (!exists) {
      await colPreferencias.insertOne({ _id: user._id, ...preferencias });
      console.log(`Preferências inseridas para: ${email}`);
    } else {
      console.log(`ℹ Preferências já existem para: ${email}`);
    }
  }

  await client.close();
})();
EOF

echo "Preferências diferenciadas processadas com sucesso."