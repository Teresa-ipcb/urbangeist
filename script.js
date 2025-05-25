navigator.geolocation.getCurrentPosition(pos => {
  const lat = pos.coords.latitude;
  const lon = pos.coords.longitude;

  console.log("TESTE");
  console.log(lat);
  
  fetch(`https://urbangeist-function.azurewebsites.net/api/fetchNearbyPlaces?lat=${lat}&lon=${lon}`)
    .then(res => res.json())
    .then(() => fetch("https://urbangeist-function.azurewebsites.net/api/locais"))
    .then(res => res.json())
    .then(mostrarNoMapa);
});

let map, dataSource;

function mostrarNoMapa(locais) {
  console.log("🗺️ Locais recebidos:", locais);

  const center = locais.length > 0
    ? locais[0].coords.coordinates
    : [-7.497, 40.283];

  map = new atlas.Map("mapa", {
    center: center,
    zoom: 12,
    authOptions: {
      authType: "subscriptionKey",
      subscriptionKey: "AZURE_MAPS_KEY substituída dinamicamente no HTML"
    }
  });

  map.events.add("ready", () => {
    dataSource = new atlas.source.DataSource();
    map.sources.add(dataSource);
    map.layers.add(new atlas.layer.SymbolLayer(dataSource));

    const lista = document.getElementById("lista-locais");
    lista.innerHTML = "";

    locais.forEach(loc => {
      const [lon, lat] = loc.coords.coordinates;
      dataSource.add(new atlas.data.Feature(new atlas.data.Point([lon, lat])));

      const card = document.createElement("div");
      card.className = "local-card";

      const img = document.createElement("img");
      img.src = loc.imagemThumbnail || loc.imagem || "https://via.placeholder.com/150";
      img.alt = loc.nome;
      img.className = "thumb";

      // Aumentar imagem ao clicar
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
