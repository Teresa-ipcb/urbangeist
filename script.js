navigator.geolocation.getCurrentPosition(async pos => {
  const lat = pos.coords.latitude;
  const lon = pos.coords.longitude;

  try {
    const keyRes = await fetch("https://urbangeist-function.azurewebsites.net/api/getAzureMapsKey");
    const keyData = await keyRes.json();
    const azureMapsKey = keyData.key;

    await fetch(`https://urbangeist-function.azurewebsites.net/api/fetchNearbyPlaces?lat=${lat}&lon=${lon}`);

    const locaisRes = await fetch("https://urbangeist-function.azurewebsites.net/api/locais");
    const locais = await locaisRes.json();

    mostrarNoMapa(locais, azureMapsKey, lat, lon);
  } catch (err) {
    console.error("Erro ao carregar dados ou mapa:", err);
  }
});

let map, dataSource;

function mostrarNoMapa(locais, azureMapsKey, latAtual, lonAtual) {
  const center = [lonAtual, latAtual];

  map = new atlas.Map("mapa", {
    center: center,
    zoom: 13,
    authOptions: {
      authType: "subscriptionKey",
      subscriptionKey: azureMapsKey
    }
  });

  map.events.add("ready", () => {
    dataSource = new atlas.source.DataSource();
    map.sources.add(dataSource);
    map.layers.add(new atlas.layer.SymbolLayer(dataSource));

    // Adicionar ponto vermelho da localização atual
    const pontoAtual = new atlas.HtmlMarker({
      color: "red",
      text: "•",
      position: [lonAtual, latAtual]
    });
    map.markers.add(pontoAtual);

    // Preparar container e limpar
    const lista = document.getElementById("lista-locais");
    lista.innerHTML = "";
    dataSource.clear();

    locais.forEach(loc => {
      const [lon, lat] = loc.coords.coordinates;
      const feature = new atlas.data.Feature(new atlas.data.Point([lon, lat]), loc);
      dataSource.add(feature);

      const marker = new atlas.HtmlMarker({
        color: "#0078D4",
        text: "●",
        position: [lon, lat],
        draggable: false
      });

      marker.getOptions().htmlContent = `<div style="color:#0078D4;font-size:20px;cursor:pointer;">📍</div>`;
      marker.setOptions({
        htmlContent: marker.getOptions().htmlContent
      });

      marker.metadata = loc;
      marker.addEventListener("click", () => mostrarLocalSelecionado(loc));
      map.markers.add(marker);

      const card = document.createElement("div");
      card.className = "local-card";

      const img = document.createElement("img");
      img.src = loc.imagemThumbnail || loc.imagem || "https://via.placeholder.com/150";
      img.alt = loc.nome;
      img.className = "thumb";

      img.onclick = () => {
        const overlay = document.createElement("div");
        overlay.className = "modal";
        overlay.innerHTML = `<div class="modal-content">
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

    // Ativar clique em marcador via Feature
    map.events.add("click", dataSource, e => {
      if (e.shapes && e.shapes.length > 0) {
        const shape = e.shapes[0];
        const loc = shape.getProperties();
        mostrarLocalSelecionado(loc);
      }
    });
  });
}

function mostrarLocalSelecionado(local) {
  const container = document.getElementById("detalhes-local");
  if (!container) return;

  container.innerHTML = `
    <div class="local-selecionado">
      <h2>${local.nome}</h2>
      <img src="${local.imagem}" alt="${local.nome}" class="thumb-grande">
      <p><strong>Tipo:</strong> ${local.tipo}</p>
      <p><strong>Descrição:</strong> ${local.info || "Sem descrição"}</p>
      <p><strong>Tags:</strong> ${(local.tags || []).join(", ")}</p>
    </div>
  `;
}
