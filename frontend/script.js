// Espera o carregamento da página
window.onload = () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(loadMap, showError);
  } else {
    alert("Geolocalização não é suportada neste browser.");
  }
};

let map;

function loadMap(position) {
  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;

  // Inicializa o mapa Azure Maps
  map = new atlas.Map('map', {
    center: [longitude, latitude],
    zoom: 13,
    view: 'Auto',
    authOptions: {
      authType: 'anonymous',
      clientId: '', // Só precisas se usares a autenticação com Azure AD
      getToken: () => fetch('/api/token').then(r => r.text())
    }
  });

  map.events.add('ready', () => {
    // Chamar a API para obter os locais
    fetch('/api/locais')
      .then(res => res.json())
      .then(locais => {
        mostrarLocais(locais);
      })
      .catch(err => {
        console.error("Erro ao carregar locais:", err);
      });
  });
}

function mostrarLocais(locais) {
  const camada = new atlas.layer.SymbolLayer(new atlas.source.DataSource(), 'camadaLocais');
  const dataSource = new atlas.source.DataSource();
  map.sources.add(dataSource);
  map.layers.add(camada);

  const listaHTML = document.getElementById("lista-locais");
  listaHTML.innerHTML = "";

  locais.forEach(loc => {
    const coords = loc.coords.coordinates;

    // Adiciona marcador no mapa
    const pin = new atlas.data.Feature(new atlas.data.Point(coords));
    dataSource.add(pin);

    // Renderiza na lista
    listaHTML.innerHTML += `
      <div class="local-item">
        <h3>${loc.nome}</h3>
        <p><strong>Categoria:</strong> ${loc.categoriaInfo.nome}</p>
        <img src="${loc.imagem}" alt="${loc.nome}" width="150" />
        <p>${loc.info}</p>
      </div>
    `;
  });
}

function showError(error) {
  switch(error.code) {
    case error.PERMISSION_DENIED:
      alert("Permissão negada para aceder à localização.");
      break;
    case error.POSITION_UNAVAILABLE:
      alert("Informação de localização indisponível.");
      break;
    case error.TIMEOUT:
      alert("Tempo de espera para obter localização excedido.");
      break;
    default:
      alert("Erro desconhecido.");
      break;
  }
}
