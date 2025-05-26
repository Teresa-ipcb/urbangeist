// Variáveis globais
let map, dataSource;
let locais = [];
let categorias = [];
let modoVisualizacao = 'grelha'; // padrão: 'grelha' ou 'lista'
let filtroAtivo = 'todos';

// Inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
  // Configurar eventos dos botões de visualização
  document.getElementById('modo-lista').addEventListener('click', alternarModoVisualizacao);
  document.getElementById('modo-grelha').addEventListener('click', alternarModoVisualizacao);

  // Obter localização e carregar dados
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      carregarDadosComLocalizacao,
      handleErroGeolocalizacao,
      { enableHighAccuracy: true, timeout: 10000 }
    );
  } else {
    alert("Geolocalização não suportada pelo navegador. Usando localização padrão.");
  }
});

// Função para alternar entre modos de visualização
function alternarModoVisualizacao(e) {
  modoVisualizacao = e.target.id === 'modo-lista' ? 'lista' : 'grelha';
  
  // Atualizar botões ativos
  document.getElementById('modo-lista').classList.toggle('ativo', modoVisualizacao === 'lista');
  document.getElementById('modo-grelha').classList.toggle('ativo', modoVisualizacao === 'grelha');
  
  // Aplicar classe ao container
  document.getElementById('lista-locais').className = `modo-${modoVisualizacao}`;
  
  // Reaplicar filtro atual
  aplicarFiltro(filtroAtivo);
}

// Carrega dados com a localização do usuário
async function carregarDadosComLocalizacao(pos) {
  const userLat = pos.coords.latitude;
  const userLon = pos.coords.longitude;

  try {
    // Buscar dados em paralelo
    const [keyRes, locaisRes, categoriasRes] = await Promise.all([
      fetch("https://urbangeist-function.azurewebsites.net/api/getAzureMapsKey"),
      fetch("https://urbangeist-function.azurewebsites.net/api/locais"),
      fetch("https://urbangeist-function.azurewebsites.net/api/categorias")
    ]);

    // Tratar possíveis erros nas respostas
    if (!keyRes.ok || !locaisRes.ok || !categoriasRes.ok) {
      throw new Error("Erro ao carregar dados da API");
    }

    const keyData = await keyRes.json();
    locais = await locaisRes.json();
    categorias = await categoriasRes.json();

    // Inicializar componentes
    inicializarMapa(locais, keyData.key, userLat, userLon);
    carregarFiltros(categorias);
    aplicarFiltro('todos'); // Mostrar todos inicialmente

    // Opcional: buscar locais próximos (sem esperar resposta)
    fetch(`https://urbangeist-function.azurewebsites.net/api/fetchNearbyPlaces?lat=${userLat}&lon=${userLon}`)
      .catch(err => console.error("Erro ao buscar locais próximos:", err));

  } catch (err) {
    console.error("Erro ao carregar dados:", err);
    mostrarErro("Erro ao carregar dados. Por favor, recarregue a página.");
  }
}


// Função para lidar com erros de geolocalização
function handleErroGeolocalizacao(err) {
  console.error("Erro de geolocalização:", err);
}

// Inicializa o mapa Azure Maps
function inicializarMapa(locais, azureMapsKey, userLat, userLon) {
  map = new atlas.Map('mapa', {
    center: [userLon, userLat],
    zoom: 13,
    view: 'Auto',
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
      { 
        title: "Você está aqui", 
        icon: "pin-round-red",
        type: "user-location"
      }
    ));

    // Adicionar locais ao mapa
    locais.forEach(local => {
      if (local.coords?.coordinates) {
        const [lon, lat] = local.coords.coordinates;
        dataSource.add(new atlas.data.Feature(
          new atlas.data.Point([lon, lat]),
          { 
            ...local,
            title: local.nome,
            icon: "pin-blue",
            type: "place"
          }
        ));
      }
    });

    // Camada de símbolos
    const symbolLayer = new atlas.layer.SymbolLayer(dataSource, null, {
      iconOptions: {
        image: ['get', 'icon'],
        allowOverlap: true,
        ignorePlacement: true
      },
      textOptions: {
        textField: ['get', 'title'],
        offset: [0, 1.2],
        allowOverlap: true
      },
      filter: ['==', ['get', 'type'], 'place']
    });

    // Camada separada para a localização do usuário
    const userLocationLayer = new atlas.layer.SymbolLayer(dataSource, null, {
      iconOptions: {
        image: 'pin-round-red',
        allowOverlap: true
      },
      textOptions: {
        textField: 'Você está aqui',
        offset: [0, 1.2]
      },
      filter: ['==', ['get', 'type'], 'user-location']
    });

    map.layers.add([symbolLayer, userLocationLayer]);

    // Evento de clique nos marcadores
    map.events.add('click', symbolLayer, e => {
      if (e.shapes?.length > 0) {
        const local = e.shapes[0].getProperties();
        mostrarDetalhesLocal(local);
      }
    });

    // Evento de hover para mudar cursor
    map.events.add('mouseover', symbolLayer, () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.events.add('mouseout', symbolLayer, () => {
      map.getCanvas().style.cursor = '';
    });
  });
}

// Carrega os filtros de categoria
function carregarFiltros(categorias) {
  const containerFiltros = document.getElementById('filtros');
  
  // Limpa filtros existentes (exceto o toggle view)
  const viewToggle = containerFiltros.querySelector('.view-toggle');
  containerFiltros.innerHTML = '';
  containerFiltros.appendChild(viewToggle);

  // Adiciona botão "Todos" primeiro
  const btnTodos = criarBotaoFiltro('Todos', 'todos', true);
  containerFiltros.prepend(btnTodos);

  // Adiciona categorias da BD
  categorias.forEach(cat => {
    const btn = criarBotaoFiltro(cat.nome, cat._id, false);
    containerFiltros.insertBefore(btn, viewToggle);
  });
}

// Helper para criar botões de filtro
function criarBotaoFiltro(texto, categoriaId, ativo) {
  const btn = document.createElement('button');
  btn.textContent = texto;
  btn.className = `filtro ${ativo ? 'ativo' : ''}`;
  btn.dataset.categoria = categoriaId;
  btn.addEventListener('click', () => aplicarFiltro(categoriaId));
  return btn;
}

// Aplica o filtro selecionado
function aplicarFiltro(categoriaId) {
  filtroAtivo = categoriaId;
  
  // Atualizar botão ativo
  document.querySelectorAll('.filtro').forEach(btn => {
    btn.classList.toggle('ativo', btn.dataset.categoria === categoriaId);
  });

  // Filtrar locais
  const locaisFiltrados = categoriaId === 'todos' 
    ? locais 
    : locais.filter(local => local.categoria === categoriaId);

  atualizarVistaLocais(locaisFiltrados);
  atualizarMarcadoresNoMapa(locaisFiltrados);
}

// Atualiza a visualização dos locais
function atualizarVistaLocais(locaisParaMostrar = locais) {
  const container = document.getElementById('lista-locais');
  
  // Se não houver locais, mostrar mensagem
  if (locaisParaMostrar.length === 0) {
    container.innerHTML = '<p class="sem-resultados">Nenhum local encontrado com este filtro.</p>';
    return;
  }

  container.innerHTML = '';

  locaisParaMostrar.forEach(local => {
    const card = document.createElement('div');
    card.className = 'local-card';
    card.innerHTML = `
      <img src="${local.imagemThumbnail || 'https://via.placeholder.com/300x200?text=Sem+imagem'}" 
           alt="${local.nome}" 
           class="local-imagem"
           loading="lazy">
      <div class="local-info">
        <h3>${local.nome}</h3>
        <p>${local.descricao || local.info || 'Sem descrição disponível.'}</p>
      </div>
    `;
    
    card.addEventListener('click', () => mostrarDetalhesLocal(local));
    container.appendChild(card);
  });
}

// Atualiza os marcadores visíveis no mapa
function atualizarMarcadoresNoMapa(locaisParaMostrar) {
  if (!dataSource) return;

  // Obter todos os features atuais
  const features = dataSource.getShapes();
  
  // Atualizar propriedade de visibilidade
  features.forEach(feature => {
    const props = feature.getProperties();
    if (props.type === 'place') {
      const visivel = filtroAtivo === 'todos' || 
                     locaisParaMostrar.some(l => l._id === props._id);
      feature.setProperty('visible', visivel);
    }
  });

  // Atualizar datasource
  dataSource.setShapes(features);
}

// Mostra os detalhes de um local
function mostrarDetalhesLocal(local) {
  const container = document.getElementById('local-selecionado');
  
  container.innerHTML = `
    <div class="detalhes-conteudo">
      <button class="fechar-btn" aria-label="Fechar detalhes">×</button>
      <h2>${local.nome}</h2>
      <div class="detalhes-imagem-container">
        <img src="${local.imagemOriginal || local.imagemThumbnail || 'https://via.placeholder.com/800x400?text=Sem+imagem'}" 
             alt="${local.nome}" 
             class="detalhes-imagem"
             loading="lazy">
      </div>
      <div class="detalhes-info">
        ${local.endereco ? `<p><strong>Localização:</strong> ${local.endereco}</p>` : ''}
        ${local.descricao ? `<p><strong>Descrição:</strong> ${local.descricao}</p>` : ''}
        ${local.horario ? `<p><strong>Horário:</strong> ${local.horario}</p>` : ''}
      </div>
      <div class="detalhes-acoes">
        <button class="btn-favorito" data-local-id="${local._id}">
          ❤️ Adicionar aos favoritos
        </button>
      </div>
    </div>
  `;
  
  container.style.display = 'block';
  
  // Configurar eventos
  container.querySelector('.fechar-btn').addEventListener('click', () => {
    container.style.display = 'none';
  });
  
  // Evento do botão de favorito
  container.querySelector('.btn-favorito').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavorito(local._id);
  });
  
  // Se houver coordenadas, centralizar no mapa
  if (local.coords?.coordinates) {
    const [lon, lat] = local.coords.coordinates;
    map.setCamera({
      center: [lon, lat],
      zoom: 15
    });
  }
}

// Gerencia favoritos
function toggleFavorito(localId) {
  const btn = document.querySelector(`.btn-favorito[data-local-id="${localId}"]`);
  const isFavorito = btn.textContent.includes('Remover');
  
  if (isFavorito) {
    btn.textContent = '❤️ Adicionar aos favoritos';
    // TODO: Remover dos favoritos no backend
  } else {
    btn.textContent = '✅ Remover dos favoritos';
    // TODO: Adicionar aos favoritos no backend
  }
}
