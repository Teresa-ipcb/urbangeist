navigator.geolocation.getCurrentPosition(
  async pos => {
    const userLat = pos.coords.latitude;
    const userLon = pos.coords.longitude;

    try {
      // Buscar chave do Azure Maps a partir do backend
      const keyRes = await fetch("https://urbangeist-function.azurewebsites.net/api/getAzureMapsKey");
      const keyData = await keyRes.json();
      const azureMapsKey = keyData.key;

      // Buscar locais próximos e todos os locais guardados
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

    // Primeiro carregue os ícones necessários
    map.imageSprite.add([
      {
        id: "pin-blue",
        url: "https://atlas.microsoft.com/images/poi_pin_blue.png",
        size: [24, 24]
      },
      {
        id: "pin-round-red",
        url: "https://atlas.microsoft.com/images/poi_pin_red.png",
        size: [24, 24]
      }
    ]).then(() => {
      console.log("Ícones carregados com sucesso");
      
      // Limpe o datasource APÓS carregar os ícones
      dataSource.clear();

      // Adicione a camada de símbolos
      const symbolLayer = new atlas.layer.SymbolLayer(dataSource, null, {
        iconOptions: {
          image: ['get', 'icon'],
          allowOverlap: true
        },
        textOptions: {
          textField: ['get', 'title'],
          offset: [0, 1.2]
        }
      });
      map.layers.add(symbolLayer);

      // Adicione os marcadores
      adicionarMarcadores(locais, userLat, userLon);

      // Configure o evento de clique
      map.events.add("click", symbolLayer, e => {
        if (e.shapes && e.shapes.length > 0) {
          const props = e.shapes[0].getProperties();
          console.log("Propriedades do marcador clicado:", props);
          if (props && props.nome) {
            mostrarDetalhesDoLocal(props);
          }
        }
      });

    }).catch(err => {
      console.error("Erro ao carregar ícones:", err);
    });
  });
}

function adicionarMarcadores(locais, userLat, userLon) {
  const lista = document.getElementById("lista-locais");
  lista.innerHTML = "";

  // Adicionar localização do usuário
  dataSource.add(new atlas.data.Feature(
    new atlas.data.Point([userLon, userLat]),
    { 
      title: "Você está aqui", 
      icon: "pin-round-red" 
    }
  ));

  // Adicionar locais
  locais.forEach(loc => {
    if (!loc.coords || !loc.coords.coordinates) {
      console.warn("Local sem coordenadas:", loc.nome);
      return;
    }
    
    const [lon, lat] = loc.coords.coordinates;
    if (lon == null || lat == null) return;
    
    const feature = new atlas.data.Feature(new atlas.data.Point([lon, lat]), {
      ...loc,  // Isso espalha todas as propriedades do local
      title: loc.nome,
      icon: "pin-blue"
    });
    dataSource.add(feature);

    // Criar card na lista
    const card = document.createElement("div");
    card.className = "local-card";
    const img = document.createElement("img");
    img.src = loc.imagemThumbnail || loc.imagem || "https://via.placeholder.com/150";
    img.alt = loc.nome;
    img.className = "thumb";
    img.onclick = () => {
      const overlay = document.createElement("div");
      overlay.className = "modal";
      overlay.innerHTML = `<div class="modal-content"><img src="${loc.imagemOriginal || loc.imagem}" alt="${loc.nome}" /></div>`;
      overlay.onclick = () => overlay.remove();
      document.body.appendChild(overlay);
    };
    const info = document.createElement("div");
    info.innerHTML = `<h3>${loc.nome}</h3><p>${loc.info || ""}</p>`;
    card.appendChild(img);
    card.appendChild(info);
    lista.appendChild(card);
  });
}

function mostrarDetalhesDoLocal(local) {
  let container = document.getElementById("local-selecionado");

  if (!container) {
    container = document.createElement("div");
    container.id = "local-selecionado";
    const filtros = document.getElementById("filtros");
    if (filtros && filtros.parentNode) {
      filtros.parentNode.insertBefore(container, filtros);
    } else {
      document.body.appendChild(container);
    }
  }

  container.style.display = "block";
  container.innerHTML = `
    <div class="local-detalhes-card">
      <img src="${local.imagemThumbnail || local.imagem || "https://via.placeholder.com/150"}" alt="${local.nome}" class="thumb">
      <div>
        <h3>${local.nome}</h3>
        <p>${local.info || "Sem descrição."}</p>
        <p><strong>Categoria:</strong> ${local.tipo || "Indefinida"}</p>
        <button onclick="marcarFavorito('${local.nome}')">❤️ Favorito</button>
        <div>
          <span>Foi uma boa recomendação?</span>
          <button>👍</button>
          <button>👎</button>
        </div>
      </div>
    </div>
  `;
}
