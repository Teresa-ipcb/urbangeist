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

function mostrarNoMapa(locais, azureMapsKey, userLat, userLon) {
  console.log("Locais recebidos:", locais);

  map = new atlas.Map("mapa", {
    center: [userLon, userLat],
    zoom: 12,
    authOptions: {
      authType: "subscriptionKey",
      subscriptionKey: azureMapsKey
    }
  });

  map.events.add("ready", () => {
    dataSource = new atlas.source.DataSource();
    map.sources.add(dataSource);
    map.layers.add(new atlas.layer.SymbolLayer(dataSource));

    const lista = document.getElementById("lista-locais");
    lista.innerHTML = "";
    dataSource.clear();

    // 🔴 Marcar localização atual com ponto vermelho
    const userFeature = new atlas.data.Feature(
      new atlas.data.Point([userLon, userLat]),
      { nome: "Você está aqui", tipo: "Localização atual" }
    );
    dataSource.add(userFeature);

    locais.forEach(loc => {
      const [lon, lat] = loc.coords.coordinates;
      const feature = new atlas.data.Feature(new atlas.data.Point([lon, lat]), loc);
      dataSource.add(feature);

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

    // ✅ Evento de clique para mostrar detalhes acima dos filtros
    map.events.add("click", dataSource, e => {
      if (e.shapes && e.shapes.length > 0) {
        const shape = e.shapes[0];
        const loc = shape.getProperties();
        if (loc && loc.nome !== "Você está aqui") {
          mostrarDetalhesDoLocal(loc);
        }
      }
    });
  });
}

// 📍 Mostrar detalhes acima dos filtros
function mostrarDetalhesDoLocal(loc) {
  let detalhes = document.getElementById("detalhes-local");
  if (!detalhes) {
    detalhes = document.createElement("div");
    detalhes.id = "detalhes-local";
    detalhes.className = "detalhes-local";
    const filtros = document.getElementById("filtros");
    filtros.parentNode.insertBefore(detalhes, filtros);
  }

  detalhes.innerHTML = `
    <h2>${loc.nome}</h2>
    <img src="${loc.imagemThumbnail || loc.imagem}" alt="${loc.nome}" style="max-width: 300px" />
    <p>${loc.info || "Sem descrição disponível."}</p>
  `;
}
