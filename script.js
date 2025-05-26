navigator.geolocation.getCurrentPosition(
  async pos => {
    const userLat = pos.coords.latitude;
    const userLon = pos.coords.longitude;

    try {
      // Buscar chave do Azure Maps
      const keyRes = await fetch("https://urbangeist-function.azurewebsites.net/api/getAzureMapsKey");
      const keyData = await keyRes.json();
      const azureMapsKey = keyData.key;

      // Buscar locais
      await fetch(`https://urbangeist-function.azurewebsites.net/api/fetchNearbyPlaces?lat=${userLat}&lon=${userLon}`);
      const locaisRes = await fetch("https://urbangeist-function.azurewebsites.net/api/locais");
      const locais = await locaisRes.json();

      mostrarNoMapa(locais, azureMapsKey, userLat, userLon);
    } catch (err) {
      console.error("Erro:", err);
      alert("Erro ao carregar dados. Consulte o console para detalhes.");
    }
  },
  err => {
    console.error("Erro de geolocalização:", err);
    alert("Permissão de localização negada. Ative-a para usar o mapa.");
  }
);

let map, dataSource;

async function mostrarNoMapa(locais, azureMapsKey, userLat, userLon) {
  // Inicializar mapa
  map = new atlas.Map('mapa', {
    center: [userLon, userLat],
    zoom: 13,
    authOptions: {
      authType: 'subscriptionKey',
      subscriptionKey: azureMapsKey
    }
  });

  // Esperar o mapa estar pronto
  map.events.add('ready', async () => {
    // Criar fonte de dados
    dataSource = new atlas.source.DataSource();
    map.sources.add(dataSource);

    // Adicionar localização do usuário
    dataSource.add(new atlas.data.Feature(
      new atlas.data.Point([userLon, userLat]),
      {
        title: "Você está aqui",
        icon: "pin-red"
      }
    ));

    // Adicionar locais
    locais.forEach(local => {
      if (!local.coords?.coordinates) {
        console.warn('Local sem coordenadas:', local.nome);
        return;
      }

      const [lon, lat] = local.coords.coordinates;
      dataSource.add(new atlas.data.Feature(
        new atlas.data.Point([lon, lat]),
        {
          ...local,
          title: local.nome,
          icon: "pin-blue"
        }
      ));
    });

    // Carregar ícones padrão do Azure Maps
    try {
      // Usando ícones padrão que já existem no sprite do Azure Maps
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

      // Evento de clique
      map.events.add('click', symbolLayer, e => {
        if (e.shapes?.length > 0) {
          const props = e.shapes[0].getProperties();
          if (props.nome) {
            mostrarDetalhes(props);
          }
        }
      });

    } catch (error) {
      console.error('Erro ao carregar camada:', error);
    }

    // Atualizar lista de locais
    atualizarListaLocais(locais);
  });
}

function atualizarListaLocais(locais) {
  const lista = document.getElementById('lista-locais');
  lista.innerHTML = '';

  locais.forEach(local => {
    const card = document.createElement('div');
    card.className = 'local-card';
    
    const img = document.createElement('img');
    img.src = local.imagemThumbnail || local.imagem || 'https://via.placeholder.com/150';
    img.alt = local.nome;
    img.className = 'thumb';
    
    const info = document.createElement('div');
    info.innerHTML = `<h3>${local.nome}</h3><p>${local.info || ''}</p>`;
    
    card.appendChild(img);
    card.appendChild(info);
    lista.appendChild(card);
  });
}

function mostrarDetalhes(local) {
  const container = document.getElementById('local-selecionado') || criarContainerDetalhes();
  container.innerHTML = `
    <div class="local-detalhes">
      <h2>${local.nome}</h2>
      <img src="${local.imagemOriginal || local.imagem}" alt="${local.nome}">
      <p>${local.info || 'Sem descrição disponível.'}</p>
      <button onclick="fecharDetalhes()">Fechar</button>
    </div>
  `;
  container.style.display = 'block';
}

function criarContainerDetalhes() {
  const container = document.createElement('div');
  container.id = 'local-selecionado';
  container.style.display = 'none';
  document.body.appendChild(container);
  return container;
}

function fecharDetalhes() {
  const container = document.getElementById('local-selecionado');
  if (container) container.style.display = 'none';
}
