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
          subscriptionKey: 'AZURE_MAPS_KEY_AQUI_SE_FOR_TESTE_DIRETO' // OU deixa anónimo se usas backend
        }
      });

      map.events.add('ready', () => {
        dataSource = new atlas.source.DataSource();
        map.sources.add(dataSource);
        map.layers.add(new atlas.layer.SymbolLayer(dataSource));

        // Buscar locais a partir da localização do utilizador
        fetch(`/api/fetchNearbyPlaces?lat=${lat}&lon=${lon}`)
          .then(res => res.json())
          .then(() => fetch("/api/locais"))
          .then(res => res.json())
          .then(mostrarNoMapa)
          .catch(err => console.error("Erro ao carregar locais:", err));
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

  const categorias = {};

  locais.forEach(loc => {
    const cat = loc.categoriaInfo.nome;
    if (!categorias[cat]) categorias[cat] = [];
    categorias[cat].push(loc);

    // Marcador no mapa
    const [lon, lat] = loc.coords.coordinates;
    dataSource.add(new atlas.data.Feature(new atlas.data.Point([lon, lat])));
  });

  for (const categoria in categorias) {
    const section = document.createElement("section");
    section.innerHTML = `<h2>${categoria}</h2>`;
    
    categorias[categoria].forEach(loc => {
      const div = document.createElement("div");
      div.className = "local-item";
      div.innerHTML = `
        <h3>${loc.nome}</h3>
        <img src="${loc.imagem}" width="150" alt="${loc.nome}" />
        <p><strong>Info:</strong> ${loc.info}</p>
        <button onclick="marcarFavorito('${loc._id}')">⭐ Favorito</button>
      `;
      section.appendChild(div);
    });

    lista.appendChild(section);
  }
}

function marcarFavorito(localId) {
  const userId = "demo-user";

  fetch("/api/marcarFavorito", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      localId,
      acao: "favorito",
      timestamp: new Date().toISOString()
    })
  })
  .then(res => {
    if (res.ok) alert("Favorito registado!");
    else alert("Erro ao marcar favorito.");
  });
}
