// Variáveis globais
let map, dataSource;
let locais = [];
let categorias = [];
let modoVisualizacao = 'grelha'; // padrão

document.addEventListener('DOMContentLoaded', async () => {
  // Configurar eventos dos botões de visualização
  document.getElementById('modo-lista').addEventListener('click', () => {
    modoVisualizacao = 'lista';
    atualizarVistaLocais();
    document.getElementById('lista-locais').className = 'modo-lista';
  });
  
  document.getElementById('modo-grelha').addEventListener('click', () => {
    modoVisualizacao = 'grelha';
    atualizarVistaLocais();
    document.getElementById('lista-locais').className = 'modo-grelha';
  });

  // Obter localização e carregar dados
  navigator.geolocation.getCurrentPosition(
    async pos => {
      const userLat = pos.coords.latitude;
      const userLon = pos.coords.longitude;

      try {
        // Buscar chave do Azure Maps
        const keyRes = await fetch("https://urbangeist-function.azurewebsites.net/api/getAzureMapsKey");
        const keyData = await keyRes.json();
        const azureMapsKey = keyData.key;

        // Buscar locais e categorias
        await fetch(`https://urbangeist-function.azurewebsites.net/api/fetchNearbyPlaces?lat=${userLat}&lon=${userLon}`);
        
        const [locaisRes, categoriasRes] = await Promise.all([
          fetch("https://urbangeist-function.azurewebsites.net/api/locais"),
          fetch("https://urbangeist-function.azurewebsites.net/api/categorias")
        ]);
        
        locais = await locaisRes.json();
        categorias = await categoriasRes.json();

        // Inicializar mapa e interface
        inicializarMapa(locais, azureMapsKey, userLat, userLon);
        carregarFiltros();
        atualizarVistaLocais();
      } catch (err) {
        console.error("Erro:", err);
      }
    },
    err => {
      console.error("Erro de geolocalização:", err);
    }
  );
});

function inicializarMapa(locais, azureMapsKey, userLat, userLon) {
  map = new atlas.Map('mapa', {
    center: [userLon, userLat],
    zoom: 13,
    authOptions: {
      authType: 'subscriptionKey',
      subscriptionKey: azureMapsKey
    }
  });

  map.events.add('ready', () => {
    dataSource = new atlas.source.DataSource();
    map.sources.add(dataSource);

    // Adicionar localização do usuário
    dataSource.add(new atlas.data.Feature(
      new atlas.data.Point([userLon, userLat]),
      { title: "Você está aqui", icon: "pin-round-red" }
    ));

    // Adicionar locais ao mapa
    locais.forEach(local => {
      if (local.coords?.coordinates) {
        const [lon, lat] = local.coords.coordinates;
        dataSource.add(new atlas.data.Feature(
          new atlas.data.Point([lon, lat]),
          { ...local, title: local.nome, icon: "pin-blue" }
        ));
      }
    });

    // Camada de símbolos
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

    // Evento de clique nos marcadores
    map.events.add('click', dataSource, e => {
      if (e.shapes?.length > 0) {
        const local = e.shapes[0].getProperties();
        mostrarDetalhesLocal(local);
      }
    });
  });
}

function carregarFiltros(categorias) {
  const containerFiltros = document.getElementById('filtros');
  
  // Limpa filtros existentes (exceto o toggle view)
  const viewToggle = containerFiltros.querySelector('.view-toggle');
  containerFiltros.innerHTML = '';
  containerFiltros.appendChild(viewToggle);

  // Adiciona botão "Todos" primeiro
  const btnTodos = document.createElement('button');
  btnTodos.textContent = 'Todos';
  btnTodos.className = 'filtro ativo';
  btnTodos.dataset.categoria = 'todos';
  btnTodos.addEventListener('click', filtrarLocais);
  containerFiltros.prepend(btnTodos);

  // Adiciona categorias da BD
  categorias.forEach(cat => {
    const btn = document.createElement('button');
    btn.textContent = cat.nome;
    btn.className = 'filtro';
    btn.dataset.categoria = cat._id;
    btn.addEventListener('click', filtrarLocais);
    containerFiltros.insertBefore(btn, viewToggle);
  });
}

function filtrarLocais(e) {
  const categoriaId = e.target.dataset.categoria;
  
  // Atualizar botão ativo
  document.querySelectorAll('.filtro').forEach(btn => {
    btn.classList.remove('ativo');
  });
  e.target.classList.add('ativo');

  // Filtrar locais
  const locaisFiltrados = categoriaId === 'Todos' 
    ? locais 
    : locais.filter(local => local.categoria === categoriaId);

  atualizarVistaLocais(locaisFiltrados);
}

function atualizarVistaLocais(locaisParaMostrar = locais) {
  const container = document.getElementById('lista-locais');
  container.innerHTML = '';

  locaisParaMostrar.forEach(local => {
    const card = document.createElement('div');
    card.className = 'local-card';
    card.innerHTML = `
      <img src="${local.imagemThumbnail || 'https://via.placeholder.com/300x200?text=Sem+imagem'}" 
           alt="${local.nome}" 
           class="local-imagem">
      <div class="local-info">
        <h3>${local.nome}</h3>
        <p>${local.descricao || local.info || 'Sem descrição disponível.'}</p>
      </div>
    `;
    
    card.addEventListener('click', () => mostrarDetalhesLocal(local));
    container.appendChild(card);
  });
}

function mostrarDetalhesLocal(local) {
  const container = document.getElementById('local-selecionado');
  container.innerHTML = `
    <div class="detalhes-conteudo">
      <button class="fechar-btn">×</button>
      <h2>${local.nome}</h2>
      <img src="${local.imagemOriginal || local.imagemThumbnail || 'https://via.placeholder.com/800x400?text=Sem+imagem'}" 
           alt="${local.nome}" 
           class="detalhes-imagem">
      <div class="detalhes-info">
        <p><strong>Localização:</strong> ${local.endereco || 'Não disponível'}</p>
        <p><strong>Descrição:</strong> ${local.descricao || local.info || 'Sem descrição disponível.'}</p>
      </div>
    </div>
  `;
  
  container.style.display = 'block';
  container.querySelector('.fechar-btn').addEventListener('click', () => {
    container.style.display = 'none';
  });
}
