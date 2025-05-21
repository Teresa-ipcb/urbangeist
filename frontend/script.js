let map, dataSource;

window.onload = () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      map = new atlas.Map('map', {
        center: [lon, lat],
        zoom: 13,
        view: 'Auto',
        authOptions: {
          authType: 'subscriptionKey',
          subscriptionKey: 'AZURE_MAPS_KEY_AQUI_SE_FOR_FRONTEND_TESTE'
        }
      });

      map.events.add('ready', () => {
        dataSource = new atlas.source.DataSource();
        map.sources.add(dataSource);
        map.layers.add(new atlas.layer.SymbolLayer(dataSource));

        fetch(`/api/fetchNearbyPlaces?lat=${lat}&lon=${lon}`)
          .then(res => res.json())
          .then(() => fetch("/api/locais"))
          .then(res => res.json())
          .then(mostrarNoMapa);
      });
    }, err => {
      alert("Erro ao obter localização: " + err.message);
    });
  } else {
    alert("Geolocalização não suportada.");
  }
};

function mostrarNoMapa(locais) {
  const lista = document.getElementById("lista-locais");
  lista.innerHTML = "";
  dataSource.clear();

  locais.forEach(loc => {
    const [lon, lat] = loc.coords.coordinates;

    // Adiciona marcador no mapa
    dataSource.add(new atlas.data.Feature(new atlas.data.Point([lon, lat])));

    // Mostra na lista
    const div = document.createElement("div");
    div.className = "local-item";
    div.innerHTML = `
      <h3>${loc.nome}</h3>
      <img src="${loc.imagem}" width="150" />
      <p><strong>Categoria:</strong> ${loc.tipo}</p>
      <p>${loc.info}</p>
    `;
    lista.appendChild(div);
  });
}
