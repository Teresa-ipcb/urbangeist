// Variáveis globais
let map, dataSource;
let locais = [];
let categorias = [];
let modoVisualizacao = 'grelha'; // padrão: 'grelha' ou 'lista'
let filtroAtivo = 'todos';
let previousCameraState = null;

// Inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
  // Verificar utilizador
  checkSession();
  
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
    const [keyRes, categoriasRes] = await Promise.all([
      fetch("https://urbangeist-function.azurewebsites.net/api/getAzureMapsKey"),
      fetch("https://urbangeist-function.azurewebsites.net/api/categorias")
    ]);

    await fetch(`https://urbangeist-function.azurewebsites.net/api/fetchNearbyPlaces?lat=${userLat}&lon=${userLon}`);
    const locaisRes = await fetch("https://urbangeist-function.azurewebsites.net/api/locais");
    locais = await locaisRes.json();

    // Garantir que locais é um array
    if (!Array.isArray(locais)) {
      console.error("Dados de locais inválidos:", locais);
      //locais = []; // Forçar array vazio
    }

    const keyData = await keyRes.json();
    const categorias = await categoriasRes.json();

    // Debug: verificar dados
    console.log("Locais recebidos:", locais);
    console.log("Formato do primeiro local:", locais[0]);

    // Inicializar componentes
    inicializarMapa(locais, keyData.key, userLat, userLon);
    carregarFiltros(categorias);
    aplicarFiltro('todos');

  } catch (err) {
    console.error("Erro ao carregar dados:", err);
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
    },
    enableCors: true
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
  console.log(categorias);
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

  // Filtrar locais - verifique a propriedade correta (categoriaId ou categoria)
  const locaisFiltrados = categoriaId === 'todos' 
    ? locais 
    : locais.filter(local => local.categoriaId === categoriaId || local.categoria === categoriaId);

  atualizarVistaLocais(locaisFiltrados);
  atualizarMarcadoresNoMapa(locaisFiltrados);
}

// Atualiza a visualização dos locais
function atualizarVistaLocais(locaisParaMostrar = []) {
  console.log(locaisParaMostrar);
  const container = document.getElementById('lista-locais');
  
  // Garantir que é um array
  if (!Array.isArray(locaisParaMostrar)) {
    console.error("locaisParaMostrar não é array:", locaisParaMostrar);
    locaisParaMostrar = [];
  }

  if (locaisParaMostrar.length === 0) {
    container.innerHTML = '<p class="sem-resultados">Nenhum local encontrado.</p>';
    return;
  }

  container.innerHTML = '';

  locaisParaMostrar.forEach(local => {
    const card = document.createElement('div');
    card.className = 'local-card';
    card.innerHTML = `
      <img src="${local.imagemOriginal || local.imagem || 'https://via.placeholder.com/300x200?text=Sem+imagem'}" 
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

  // Limpar todos os shapes existentes
  dataSource.clear();

  // Adicionar localização do usuário novamente
  const shapes = dataSource.getShapes();
  const userLocation = shapes.find(s => s.getProperties().type === 'user-location');
  if (userLocation) {
    dataSource.add(userLocation);
  }

  // Adicionar apenas os locais visíveis
  locaisParaMostrar.forEach(local => {
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

  // Não é necessário adicionar a fonte novamente ao mapa -> só notificar a fonte de dados que foi atualizada
  dataSource.setShapes(dataSource.getShapes());
}

// Mostra os detalhes de um local
function mostrarDetalhesLocal(local) {
  const container = document.getElementById('local-selecionado');
  if (!container) return;

  container.innerHTML = `
    <div class="detalhes-conteudo">
      <button class="fechar-btn" onclick="fecharDetalhes()">×</button>
      <img src="${local.imagemOriginal || local.imagem}" 
       data-id="${local._id}" 
       onclick="ampliarImagem(this)" 
       class="imagem-local">
     
      <h2>${local.nome || "Local Desconhecido"}</h2>
      
      <div class="detalhes-section">
        <h3>Localização</h3>
        <p>${local.endereco || "Endereço não disponível"}</p>
      </div>
      
      <div class="detalhes-section">
        <h3>Descrição do Local</h3>
        <p>${local.descricao || local.info || "Sem descrição disponível."}</p>
      </div>
      
      <div class="detalhes-section">
        <h3>Avaliações</h3>
        <div class="avaliacoes">
          <span class="avaliacao-media">★★★★☆</span>
          <span class="total-avaliacoes">(32 avaliações)</span>
        </div>
      </div>
      
      <div class="feedback-section">
        <h3>Indicar se foi uma boa recomendação</h3>
        <div class="feedback-buttons">
          <button class="feedback-btn positivo">👍 Sim</button>
          <button class="feedback-btn negativo">👎 Não</button>
        </div>
      </div>
    </div>
  `;
  
  container.style.display = 'block';
  
  // Configurar eventos
  container.querySelector('.fechar-btn').addEventListener('click', () => {
    container.style.display = 'none';
  });

  document.querySelectorAll('.feedback-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const tipo = this.classList.contains('positivo') ? 'positivo' : 'negativo';
      enviarFeedback(local.nome, tipo);
    });
  });

  // Guardar o estado atual do mapa antes de mudar
  previousCameraState = map.getCamera();

  // Se houver coordenadas, centralizar no mapa
  if (local.coords?.coordinates) {
    const [lon, lat] = local.coords.coordinates;
    map.setCamera({
      center: [lon, lat],
      zoom: 15
    });
  }
}

async function ampliarImagem(imgElement) {
  const localId = imgElement.dataset.id;

  try {
    const res = await fetch(`https://urbangeist-function.azurewebsites.net/api/ampliarImagem?id=${localId}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.mensagem || "Erro ao gerar imagem.");
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal';
    overlay.innerHTML = `
      <div class="modal-content">
        <img src="${data.locais[0].urlOriginal}" alt="Imagem ampliada" class="imagem-ampliada">
      </div>`;
    overlay.onclick = () => overlay.remove();
    document.body.appendChild(overlay);
  } catch (err) {
    console.error("Erro ao ampliar imagem:", err);
    alert("Não foi possível ampliar a imagem.");
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

function fecharDetalhes() {
  const container = document.getElementById("local-selecionado");
  if (container) container.style.display = "none";

  if (previousCameraState) {
    map.setCamera(previousCameraState);
  }
}

function enviarFeedback(nomeLocal, tipo) {
  console.log(`Feedback ${tipo} para ${nomeLocal}`);
  //adicionar info na bd
}

async function checkSession() {
    const sessionId = localStorage.getItem("sessionId");

    if (!sessionId) {
        console.log("Sessão não encontrada no localStorage");
        window.location.href = "frontend/authentication.html";
    }

    /*const response = await fetch("https://urbangeist-function.azurewebsites.net/api/checkSession", {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${sessionId}`
        }
    });

    const data = await response.json();
    if (response.ok && data.isValid) {
        console.log("Sessão válida:", data.email);
        document.querySelector('a[onclick="logout()"]').style.display = 'block';
    } else {
        console.log("Sessão inválida:", data);
        window.location.href = "frontend/authentication.html";
    }*/
}
