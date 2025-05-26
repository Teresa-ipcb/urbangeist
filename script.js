navigator.geolocation.getCurrentPosition(
  async pos => {
    const userLat = pos.coords.latitude;
    const userLon = pos.coords.longitude;

    try {
      // Buscar chave do Azure Maps a partir do backend
      const keyRes = await fetch("https://urbangeist-function.azurewebsites.net/api/getAzureMapsKey");
      const keyData = await keyRes.json();
      const azureMapsKey = keyData.key;

      // Fetch locais próximos e depois todos os locais
      await fetch(`https://urbangeist-function.azurewebsites.net/api/fetchNearbyPlaces?lat=${userLat}&lon=${userLon}`);
      const locaisRes = await fetch("https://urbangeist-function.azurewebsites.net/api/locais");
      const locais = await locaisRes.json();

      mostrarNoMapa(locais, azureMapsKey, userLat, userLon);
    } catch (err) {
      console.error("Erro ao carregar dados ou mapa:", err);
    }
  },
  err => {
    console.error("Erro ao obter localização:", err);
    alert("Não foi possível aceder à sua localização. Verifique permissões do navegador.");
  }
);

let map, dataSource;

function mostrarNoMapa(locais, azureMapsKey, userLat, userLon) {
  console.log("Locais recebidos:", locais);

  map = new atlas.Map("mapa", {
    center: [userLon, userLat],
    zoom: 13,
    authOptions: {
      authType: "subscriptionKey",
      subscriptionKey: azureMapsKey
    }
  });

  map.events.add("ready", () => {
    dataSource = new atlas.source.DataSource();
    map.sources.add(dataSource);

    // Camada de ícones
    map.layers.add(new atlas.layer.SymbolLayer(dataSource, null, {
      iconOptions: {
        image: ['get', 'icon'],
        allowOverlap: true
      },
      textOptions: {
        textField: ['get', 'title'],
        offset: [0, 1.2]
      }
    }));

    dataSource.clear();
    const lista = document.getElementById("lista-locais");
    lista.innerHTML = "";

    // 🔴 Marcar localização atual
    const userLocation = new atlas.data.Feature(new atlas.data.Point([userLon, userLat]), {
      title: "Você está aqui",
      icon: "pin-round-red"
    });
    dataSource.add(userLocation);

    // 🗺️ Adicionar marcadores dos locais
    locais.forEach(loc => {
      const [lon, lat] = loc.coords.coordinates;
      dataSource.add(new atlas.data.Feature(new atlas.data.Point([lon, lat]), {
        title: loc.nome,
        icon: "pin-blue"
      }));

      // Criar card na interface
      const card = document.createElement("div");
      card.className = "local-card";

      const img = document.createElement("img");
      img.src = loc.imagemThumbnail || loc.imagem || "https://via.placeholder.com/150";
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
