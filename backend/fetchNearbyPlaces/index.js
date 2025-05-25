const { MongoClient } = require("mongodb");
const { BlobServiceClient } = require("@azure/storage-blob");

navigator.geolocation.getCurrentPosition(pos => {
  const lat = pos.coords.latitude;
  const lon = pos.coords.longitude;

  fetch(`https://urbangeist-function.azurewebsites.net/api/fetchNearbyPlaces?lat=${lat}&lon=${lon}`)
    .then(res => res.json())
    .then(() => fetch("https://urbangeist-function.azurewebsites.net/api/locais"))
    .then(res => res.json())
    .then(locais => mostrarNoMapa(locais, [lon, lat])); // passa coords do utilizador
});

let map, dataSource;

function mostrarNoMapa(locais, userCoords) {
  console.log("🗺️ Locais recebidos:", locais);

  map = new atlas.Map("mapa", {
    center: userCoords,
    zoom: 13,
    authOptions: {
      authType: "subscriptionKey",
      subscriptionKey: "AZURE_MAPS_KEY substituída dinamicamente no HTML"
    }
  });

  map.events.add("ready", () => {
    dataSource = new atlas.source.DataSource();
    map.sources.add(dataSource);

    // Camada principal para os locais
    map.layers.add(new atlas.layer.SymbolLayer(dataSource));

    // Adicionar localização do utilizador com ponto vermelho
    const userPoint = new atlas.data.Feature(new atlas.data.Point(userCoords), {
      color: "red"
    });
    const userSource = new atlas.source.DataSource();
    userSource.add(userPoint);
    map.sources.add(userSource);

    map.layers.add(new atlas.layer.SymbolLayer(userSource, null, {
      iconOptions: {
        image: "pin-round-red",
        allowOverlap: true
      }
    }));

    // Criar lista e pins dos locais
    const lista = document.getElementById("lista-locais");
    lista.innerHTML = "";

    locais.forEach(loc => {
      const [lon, lat] = loc.coords.coordinates;
      dataSource.add(new atlas.data.Feature(new atlas.data.Point([lon, lat])));

      const card = document.createElement("div");
      card.className = "local-card";

      const img = document.createElement("img");
      img.src = loc.imagemThumbnail || loc.imagem || "https://placehold.co/150x100";
      img.alt = loc.nome;
      img.className = "thumb";

      img.onclick = () => {
        const overlay = document.createElement("div");
        overlay.className = "modal";
        overlay.innerHTML = `
          <div class="modal-content">
            <img src="${loc.imagemOriginal || loc.imagem}" alt="${loc.nome}" />
          </div>`;
        overlay.onclick = () => overlay.remove();
        document.body.appendChild(overlay);
      };

      const info = document.createElement("div");
      info.innerHTML = `<h3>${loc.nome}</h3><p>${loc.info || ""}</p>`;

      card.appendChild(img);
      card.appendChild(info);
      lista.appendChild(card);
    });
  });
}
