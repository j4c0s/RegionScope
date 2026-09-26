(function () {
  'use strict';

  // --- Translations (PL/EN) ---
  const translations = {
    pl: {
      subtitle: 'Nasłuchiwanie MQTT & Analiza Topologii',
      tabPackets: '📡 Pakiety Live',
      tabTopology: '🗺️ Mapa Topologii',
      statusConnecting: 'Łączenie z serwerem...',
      statusConnected: 'Połączono z serwerem WS',
      statusDisconnected: 'Rozłączono z serwerem WS',
      settings: 'Ustawienia',
      liveTitle: 'Ostatnie Odebrane Pakiety Live',
      btnRefresh: 'Odśwież',
      btnPause: 'Pauza',
      btnResume: 'Wznów',
      btnFilters: 'Filtry ▾',
      btnClearFilters: '✕ Wyczyść',
      btnGroupHash: 'Grupuj po hashu',
      btnHexPaths: 'Hex Ścieżki',
      btnDecode: 'Dekoduj Pakiet',
      phHash: 'Hash pakietu...',
      phNode: 'Węzeł...',
      filterPlaceholder: 'Filtr np: hash, typ, nazwa węzła, tekst wiadomości...',
      phSearchObs: 'Szukaj obserwatora...',
      obsAll: 'Wszyscy Obserwatorzy ▾',
      typesAll: 'Wszystkie Typy ▾',
      chanAll: 'Wszystkie Kanały',
      tw15: 'Ostatnie 15 min',
      tw30: 'Ostatnie 30 min',
      tw60: 'Ostatnia 1 godz.',
      tw180: 'Ostatnie 3 godz.',
      tw1440: 'Ostatnie 24 godz.',
      twAll: 'Wszystkie',
      sortObs: 'Sortuj: Obserwator',
      sortPathAsc: 'Sortuj: Ścieżka ↑ (najkrótsza)',
      sortPathDesc: 'Sortuj: Ścieżka ↓ (najdłuższa)',
      sortTimeAsc: 'Sortuj: Czas ↑ (najstarszy)',
      sortTimeDesc: 'Sortuj: Czas ↓ (najnowszy)',
      colScope: 'Scope',
      colTime: 'Czas',
      colHash: 'Hash',
      colSize: 'Rozmiar',
      colHB: 'HB',
      colType: 'Typ',
      colOrigin: 'Obserwator / Nadawca',
      colPath: 'Ścieżka',
      colRpt: 'Ilość',
      colDetails: 'Szczegóły',
      emptyTitle: 'Oczekiwanie na pakiety MeshCore...',
      emptyDesc: 'Gdy w sieci MQTT pojawią się pakiety, zostaną automatycznie wyświetlone na tej liście.',
      selectPacketPrompt: 'Wybierz pakiet z listy, aby zobaczyć jego pełne szczegóły.',
      nodeInfoTitle: 'Informacje o Węźle',
      nodeInfoPlaceholder: 'Kliknij węzeł na mapie, aby zobaczyć jego właściwości.',
      legendAdvert: 'Known Advert Node',
      legendHop: 'Hop Node',
      legendFresh: '< 5 min',
      legendStale: '> 1 godz.',
      settingsTitle: 'Ustawienia i Konfiguracja',
      mqttServersTitle: 'Zarządzanie Serwerami MQTT',
      labelHost: 'Adres serwera (Host / IP)',
      labelPort: 'Port',
      labelUser: 'Użytkownik (opcjonalnie)',
      labelPass: 'Hasło (opcjonalnie)',
      labelTopic: 'Temat MQTT (Topic)',
      btnAddServer: 'Połącz i Dodaj Serwer',
      dbCleanupTitle: 'Zarządzanie Bazą Danych',
      dbCleanupDesc: 'Czyszczenie usunie zapisane pakiety, słownik węzłów z Advertów oraz krawędzie topologii.',
      btnClearDb: '🗑️ Wyczyść Wszystkie Dane Topologii',
      noHops: 'Bezpośrednio',
      btnRemove: 'Usuń',
      btnDeleteNode: '🗑️ Usuń Węzeł',
      btnDeleteEdge: '✂️ Usuń Połączenie',
      btnMergeNodes: '🔗 Połącz / Deduplikuj Węzeł',
      btnCollapseCluster: '📦 Zwiń Klaster',
      labelSelectTargetNode: 'Wybierz docelowy węzeł 3B/2B:',
      confirmClear: 'Czy na pewno chcesz usunąć wszystkie dane z bazy danych?',
      confirmDeleteNode: 'Czy na pewno chcesz usunąć ten węzeł i jego połączenia?',
      confirmDeleteEdge: 'Czy na pewno chcesz usunąć to połączenie?',
      confirmMergeNodes: 'Czy na pewno chcesz połączyć węzeł {alias} z węzłem {target}?',
      byopTitle: '📦 BYOP - Analiza Własnego Pakietu',
      byopDesc: 'Wklej surowy ciąg HEX pakietu z radia lub MQTT, aby przeprowadzić pełne dekodowanie i analizę bajt po bajcie:',
      supportedPathSizes: 'Obsługiwane prefiksy ścieżki',
      supportedRegions: 'Obsługiwane Scope',
      lastSeen: 'Ostatnio widziany',
      neighborsTitle: 'Sąsiednie Węzły (Połączenia)',
      noNeighbors: 'Brak zarejestrowanych sąsiadów',
    },
    en: {
      subtitle: 'MQTT Listening & Topology Mapping',
      tabPackets: '📡 Live Packets',
      tabTopology: '🗺️ Topology Map',
      statusConnecting: 'Connecting to server...',
      statusConnected: 'WS Server Connected',
      statusDisconnected: 'WS Server Disconnected',
      settings: 'Settings',
      liveTitle: 'Latest Received Live Packets',
      btnRefresh: 'Refresh',
      btnPause: 'Pause',
      btnResume: 'Resume',
      btnFilters: 'Filters ▾',
      btnClearFilters: '✕ Clear',
      btnGroupHash: 'Group by hash',
      btnHexPaths: 'Hex Paths',
      btnDecode: 'Decode Packet',
      phHash: 'Packet hash...',
      phNode: 'Node...',
      filterPlaceholder: 'Filter e.g. hash, type, node name, text message...',
      phSearchObs: 'Search observer...',
      obsAll: 'All Observers ▾',
      typesAll: 'All Types ▾',
      chanAll: 'All Channels',
      tw15: 'Last 15 min',
      tw30: 'Last 30 min',
      tw60: 'Last 1 hour',
      tw180: 'Last 3 hours',
      tw1440: 'Last 24 hours',
      twAll: 'All time',
      sortObs: 'Sort: Observer',
      sortPathAsc: 'Sort: Path ↑ (shortest)',
      sortPathDesc: 'Sort: Path ↓ (longest)',
      sortTimeAsc: 'Sort: Time ↑ (oldest)',
      sortTimeDesc: 'Sort: Time ↓ (newest)',
      colScope: 'Scope',
      colTime: 'Time',
      colHash: 'Hash',
      colSize: 'Size',
      colHB: 'HB',
      colType: 'Type',
      colOrigin: 'Observer / Sender',
      colPath: 'Path',
      colRpt: 'Count',
      colDetails: 'Details',
      emptyTitle: 'Waiting for MeshCore packets...',
      emptyDesc: 'When packets appear in the MQTT network, they will automatically be displayed here.',
      selectPacketPrompt: 'Select a packet from the list to view its full details.',
      nodeInfoTitle: 'Node Information',
      nodeInfoPlaceholder: 'Click a node on the map to view its attributes.',
      legendAdvert: 'Known Advert Node',
      legendHop: 'Hop Node',
      legendFresh: '< 5 min',
      legendStale: '> 1 hour',
      settingsTitle: 'Settings & Configuration',
      mqttServersTitle: 'MQTT Servers Management',
      labelHost: 'Server Host / IP',
      labelPort: 'Port',
      labelUser: 'Username (optional)',
      labelPass: 'Password (optional)',
      labelTopic: 'MQTT Topic',
      btnAddServer: 'Connect & Add Server',
      dbCleanupTitle: 'Database Cleanup',
      dbCleanupDesc: 'Cleaning will remove stored packets, advert node directory, and topology edges.',
      btnClearDb: '🗑️ Clear All Topology Data',
      noHops: 'Direct',
      btnRemove: 'Delete',
      btnDeleteNode: '🗑️ Delete Node',
      btnDeleteEdge: '✂️ Delete Connection',
      btnMergeNodes: '🔗 Merge / Deduplicate Node',
      btnCollapseCluster: '📦 Collapse Cluster',
      labelSelectTargetNode: 'Select target 3B/2B node:',
      confirmClear: 'Are you sure you want to clear all topology and packet database records?',
      confirmDeleteNode: 'Are you sure you want to delete this node and its connections?',
      confirmDeleteEdge: 'Are you sure you want to delete this connection?',
      confirmMergeNodes: 'Are you sure you want to merge node {alias} into target node {target}?',
      byopTitle: '📦 BYOP - Bring Your Own Packet',
      byopDesc: 'Paste raw hex bytes from your radio or MQTT feed to perform full step-by-step decoding:',
      supportedPathSizes: 'Supported Path Prefixes',
      supportedRegions: 'Supported Scope',
      lastSeen: 'Last Seen',
      neighborsTitle: 'Neighbor Nodes (Connections)',
      noNeighbors: 'No registered neighbors',
    }
  };

  const TYPE_NAMES = {
    0: 'REQ',
    1: 'RESP',
    2: 'TXT_MSG',
    3: 'ACK',
    4: 'ADVERT',
    5: 'GRP_TXT',
    7: 'LOCATION',
    8: 'PATH',
    9: 'TRACE',
    11: 'CONTROL'
  };

  let currentLang = localStorage.getItem('mc_analyzer_lang') || 'pl';
  let groupByHash = localStorage.getItem('mc_group_by_hash') !== 'false';
  let timeWindow = parseInt(localStorage.getItem('mc_time_window') || '15', 10);
  let showHexPaths = localStorage.getItem('mc_hex_paths') === 'true';
  let obsSortMode = localStorage.getItem('mc_obs_sort') || 'observer';

  let rawPackets = [];
  let observers = [];
  let observerMap = new Map();
  let selectedObservers = new Set();
  let selectedTypes = new Set();
  let selectedChannel = '';
  let filterHash = '';
  let filterNode = '';
  let filterNodeName = '';
  let filterExpr = '';

  let isPaused = false;
  let pauseBuffer = [];
  let expandedHashes = new Set();
  let selectedPacketQuery = null;
  let selectedObservationId = null;

  let brokers = [];
  let topologyData = { nodes: [], edges: [] };
  let expandedClusters = new Set();
  let ws = null;

  // Vis.js Network instance
  let network = null;
  let visNodes = new vis.DataSet();
  let visEdges = new vis.DataSet();

  // DOM Elements
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const langPlBtn = document.getElementById('langPlBtn');
  const langEnBtn = document.getElementById('langEnBtn');
  const tabPacketsBtn = document.getElementById('tabPacketsBtn');
  const tabTopologyBtn = document.getElementById('tabTopologyBtn');
  const packetsView = document.getElementById('packetsView');
  const topologyView = document.getElementById('topologyView');
  const openSettingsModalBtn = document.getElementById('openSettingsModalBtn');
  const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
  const settingsModal = document.getElementById('settingsModal');
  const addBrokerForm = document.getElementById('addBrokerForm');
  const brokersList = document.getElementById('brokersList');
  const clearDbBtn = document.getElementById('clearDbBtn');
  const pktBody = document.getElementById('pktBody');
  const emptyState = document.getElementById('emptyState');
  const nodeInfoBox = document.getElementById('nodeInfoBox');
  const pktRight = document.getElementById('pktRight');
  const closeDetailBtn = document.getElementById('closeDetailBtn');
  const pktCount = document.getElementById('pktCount');
  const pktPauseBtn = document.getElementById('pktPauseBtn');
  const pktRefreshBtn = document.getElementById('pktRefreshBtn');
  const pktByopBtn = document.getElementById('pktByopBtn');
  const byopModal = document.getElementById('byopModal');
  const closeByopModalBtn = document.getElementById('closeByopModalBtn');
  const byopDecodeBtn = document.getElementById('byopDecodeBtn');
  const byopHexInput = document.getElementById('byopHexInput');
  const byopResult = document.getElementById('byopResult');
  const fGroup = document.getElementById('fGroup');
  const hexHashToggle = document.getElementById('hexHashToggle');
  const fTimeWindow = document.getElementById('fTimeWindow');
  const fHash = document.getElementById('fHash');
  const fNode = document.getElementById('fNode');
  const fNodeDropdown = document.getElementById('fNodeDropdown');
  const packetFilterInput = document.getElementById('packetFilterInput');
  const clearFiltersBtn = document.getElementById('clearFiltersBtn');
  const observerTrigger = document.getElementById('observerTrigger');
  const observerMenu = document.getElementById('observerMenu');
  const observerList = document.getElementById('observerList');
  const observerSearchInput = document.getElementById('observerSearchInput');
  const typeTrigger = document.getElementById('typeTrigger');
  const typeMenu = document.getElementById('typeMenu');
  const fChannel = document.getElementById('fChannel');
  const fObsSort = document.getElementById('fObsSort');

  // --- View Switcher ---
  tabPacketsBtn.addEventListener('click', () => switchTab('packets'));
  tabTopologyBtn.addEventListener('click', () => switchTab('topology'));

  function switchTab(tab) {
    if (tab === 'packets') {
      tabPacketsBtn.classList.add('active');
      tabTopologyBtn.classList.remove('active');
      packetsView.classList.remove('hidden');
      packetsView.classList.add('active');
      topologyView.classList.add('hidden');
      topologyView.classList.remove('active');
    } else {
      tabTopologyBtn.classList.add('active');
      tabPacketsBtn.classList.remove('active');
      topologyView.classList.remove('hidden');
      topologyView.classList.add('active');
      packetsView.classList.add('hidden');
      packetsView.classList.remove('active');
      initVisNetwork();
      if (network) {
        setTimeout(() => {
          network.redraw();
          network.fit();
        }, 50);
      }
    }
  }

  // --- Language Toggle ---
  function applyLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('mc_analyzer_lang', lang);

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (translations[lang] && translations[lang][key]) {
        el.textContent = translations[lang][key];
      }
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (translations[lang] && translations[lang][key]) {
        el.title = translations[lang][key];
      }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (translations[lang] && translations[lang][key]) {
        el.placeholder = translations[lang][key];
      }
    });

    if (lang === 'pl') {
      langPlBtn.classList.add('active');
      langEnBtn.classList.remove('active');
    } else {
      langEnBtn.classList.add('active');
      langPlBtn.classList.remove('active');
    }

    renderPacketsTable();
    renderBrokers();
  }

  langPlBtn.addEventListener('click', () => applyLanguage('pl'));
  langEnBtn.addEventListener('click', () => applyLanguage('en'));

  // --- Settings Modal ---
  openSettingsModalBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
  closeSettingsModalBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.add('hidden');
  });

  // --- BYOP Modal ---
  pktByopBtn.addEventListener('click', () => byopModal.classList.remove('hidden'));
  closeByopModalBtn.addEventListener('click', () => byopModal.classList.add('hidden'));
  byopModal.addEventListener('click', (e) => {
    if (e.target === byopModal) byopModal.classList.add('hidden');
  });

  byopDecodeBtn.addEventListener('click', async () => {
    const rawHex = byopHexInput.value.trim();
    if (!rawHex) return;
    byopResult.innerHTML = `<p class="text-muted">Dekodowanie...</p>`;
    try {
      const res = await fetch('/api/decode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hex: rawHex })
      });
      const data = await res.json();
      if (data.error) {
        byopResult.innerHTML = `<p style="color:var(--accent-red); font-size:12px;">Błąd: ${escapeHtml(data.error)}</p>`;
      } else {
        byopResult.innerHTML = `<pre class="code-font" style="background:var(--bg-dark); padding:10px; border-radius:6px; font-size:11px; max-height:200px; overflow-y:auto; border:1px solid var(--border-color);">${escapeHtml(JSON.stringify(data.decoded, null, 2))}</pre>`;
      }
    } catch (err) {
      byopResult.innerHTML = `<p style="color:var(--accent-red); font-size:12px;">Błąd połączenia: ${escapeHtml(err.message)}</p>`;
    }
  });

  // --- Controls & Filters ---
  fGroup.classList.toggle('active', groupByHash);
  fGroup.addEventListener('click', () => {
    groupByHash = !groupByHash;
    localStorage.setItem('mc_group_by_hash', groupByHash);
    fGroup.classList.toggle('active', groupByHash);
    fetchPackets();
  });

  hexHashToggle.classList.toggle('active', showHexPaths);
  hexHashToggle.addEventListener('click', () => {
    showHexPaths = !showHexPaths;
    localStorage.setItem('mc_hex_paths', showHexPaths);
    hexHashToggle.classList.toggle('active', showHexPaths);
    renderPacketsTable();
  });

  fTimeWindow.value = String(timeWindow);
  fTimeWindow.addEventListener('change', (e) => {
    timeWindow = parseInt(e.target.value, 10);
    localStorage.setItem('mc_time_window', timeWindow);
    fetchPackets();
  });

  fObsSort.value = obsSortMode;
  fObsSort.addEventListener('change', (e) => {
    obsSortMode = e.target.value;
    localStorage.setItem('mc_obs_sort', obsSortMode);
    renderPacketsTable();
  });

  pktPauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    const t = translations[currentLang];
    pktPauseBtn.classList.toggle('btn-amber', isPaused);
    pktPauseBtn.innerHTML = isPaused ? `▶️ ${t.btnResume}` : `⏸️ ${t.btnPause}`;
    if (!isPaused && pauseBuffer.length > 0) {
      pauseBuffer.forEach(p => handleIncomingPacket(p));
      pauseBuffer = [];
    }
  });

  pktRefreshBtn.addEventListener('click', () => fetchPackets());

  fHash.addEventListener('input', debounce((e) => {
    filterHash = e.target.value.trim();
    checkClearFiltersBtn();
    fetchPackets();
  }, 300));

  packetFilterInput.addEventListener('input', debounce((e) => {
    filterExpr = e.target.value.trim().toLowerCase();
    checkClearFiltersBtn();
    renderPacketsTable();
  }, 300));

  clearFiltersBtn.addEventListener('click', () => {
    filterHash = '';
    filterNode = '';
    filterNodeName = '';
    filterExpr = '';
    selectedObservers.clear();
    selectedTypes.clear();
    selectedChannel = '';
    fHash.value = '';
    fNode.value = '';
    packetFilterInput.value = '';
    fChannel.value = '';
    buildObserverMenu();
    updateObserverTrigger();
    buildTypeMenu();
    updateTypeTrigger();
    checkClearFiltersBtn();
    fetchPackets();
  });

  function checkClearFiltersBtn() {
    const hasFilter = filterHash || filterNode || filterExpr || selectedObservers.size > 0 || selectedTypes.size > 0 || selectedChannel || timeWindow !== 15;
    clearFiltersBtn.classList.toggle('hidden', !hasFilter);
  }

  // Node Autocomplete
  fNode.addEventListener('input', debounce(async (e) => {
    const q = e.target.value.trim();
    if (!q) {
      filterNode = '';
      filterNodeName = '';
      fNodeDropdown.classList.add('hidden');
      fetchPackets();
      return;
    }
    try {
      const res = await fetch(`/api/nodes/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const nodes = data.nodes || [];
      if (nodes.length === 0) {
        fNodeDropdown.classList.add('hidden');
        return;
      }
      fNodeDropdown.innerHTML = nodes.map(n =>
        `<div class="node-filter-option" data-id="${escapeHtml(n.id)}" data-name="${escapeHtml(n.name)}">${escapeHtml(n.name || n.id)} <span class="code-font" style="color:var(--text-muted);">(${n.id})</span></div>`
      ).join('');
      fNodeDropdown.classList.remove('hidden');
      fNodeDropdown.querySelectorAll('.node-filter-option').forEach(opt => {
        opt.addEventListener('click', () => {
          filterNode = opt.getAttribute('data-id');
          filterNodeName = opt.getAttribute('data-name');
          fNode.value = filterNodeName || filterNode;
          fNodeDropdown.classList.add('hidden');
          checkClearFiltersBtn();
          fetchPackets();
        });
      });
    } catch (err) {}
  }, 250));

  // Multi-select Observers & Types
  observerTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    observerMenu.classList.toggle('open');
    typeMenu.classList.remove('open');
  });

  typeTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    typeMenu.classList.toggle('open');
    observerMenu.classList.remove('open');
  });

  document.addEventListener('click', (e) => {
    if (!observerFilterWrap.contains(e.target)) observerMenu.classList.remove('open');
    if (!typeFilterWrap.contains(e.target)) typeMenu.classList.remove('open');
    if (!fNodeDropdown.contains(e.target) && e.target !== fNode) fNodeDropdown.classList.add('hidden');
  });

  function buildObserverMenu() {
    const allChecked = selectedObservers.size === 0;
    let html = `<label class="multi-select-item"><input type="checkbox" data-obs-id="__all__" ${allChecked ? 'checked' : ''}> Wszyscy Obserwatorzy</label>`;
    for (const o of observers) {
      const checked = selectedObservers.has(o.id) ? 'checked' : '';
      html += `<label class="multi-select-item" data-name="${escapeHtml((o.name || o.id).toLowerCase())}"><input type="checkbox" data-obs-id="${escapeHtml(o.id)}" ${checked}> ${escapeHtml(o.name || o.id)}</label>`;
    }
    observerList.innerHTML = html;
  }

  function updateObserverTrigger() {
    const t = translations[currentLang];
    if (selectedObservers.size === 0 || selectedObservers.size === observers.length) {
      observerTrigger.textContent = t.obsAll;
    } else if (selectedObservers.size === 1) {
      const id = [...selectedObservers][0];
      const o = observerMap.get(id);
      observerTrigger.textContent = (o ? o.name : id) + ' ▾';
    } else {
      observerTrigger.textContent = selectedObservers.size + ' Obserwatorów ▾';
    }
  }

  observerMenu.addEventListener('change', (e) => {
    const id = e.target.getAttribute('data-obs-id');
    if (!id) return;
    if (id === '__all__') {
      selectedObservers.clear();
    } else {
      if (e.target.checked) selectedObservers.add(id); else selectedObservers.delete(id);
    }
    buildObserverMenu();
    updateObserverTrigger();
    checkClearFiltersBtn();
    fetchPackets();
  });

  observerSearchInput.addEventListener('input', (e) => {
    const term = e.target.value.trim().toLowerCase();
    observerList.querySelectorAll('.multi-select-item[data-name]').forEach(item => {
      const name = item.getAttribute('data-name');
      item.style.display = !term || name.includes(term) ? '' : 'none';
    });
  });

  function buildTypeMenu() {
    const allChecked = selectedTypes.size === 0;
    let html = `<label class="multi-select-item"><input type="checkbox" data-type-id="__all__" ${allChecked ? 'checked' : ''}> Wszystkie Typy</label>`;
    for (const [k, v] of Object.entries(TYPE_NAMES)) {
      const checked = selectedTypes.has(k) ? 'checked' : '';
      html += `<label class="multi-select-item"><input type="checkbox" data-type-id="${k}" ${checked}> ${v}</label>`;
    }
    typeMenu.innerHTML = html;
  }

  function updateTypeTrigger() {
    const t = translations[currentLang];
    if (selectedTypes.size === 0 || selectedTypes.size === Object.keys(TYPE_NAMES).length) {
      typeTrigger.textContent = t.typesAll;
    } else if (selectedTypes.size === 1) {
      const k = [...selectedTypes][0];
      typeTrigger.textContent = (TYPE_NAMES[k] || k) + ' ▾';
    } else {
      typeTrigger.textContent = selectedTypes.size + ' Typy ▾';
    }
  }

  typeMenu.addEventListener('change', (e) => {
    const id = e.target.getAttribute('data-type-id');
    if (!id) return;
    if (id === '__all__') {
      selectedTypes.clear();
    } else {
      if (e.target.checked) selectedTypes.add(id); else selectedTypes.delete(id);
    }
    buildTypeMenu();
    updateTypeTrigger();
    checkClearFiltersBtn();
    fetchPackets();
  });

  fChannel.addEventListener('change', (e) => {
    selectedChannel = e.target.value;
    checkClearFiltersBtn();
    fetchPackets();
  });

  closeDetailBtn.addEventListener('click', () => {
    const layout = document.querySelector('.split-layout');
    layout.classList.add('detail-collapsed');
    selectedPacketQuery = null;
    selectedObservationId = null;
    renderPacketsTable();
  });

  addBrokerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const host = document.getElementById('inputHost').value.trim();
    const port = document.getElementById('inputPort').value.trim();
    const user = document.getElementById('inputUser').value.trim();
    const pass = document.getElementById('inputPass').value.trim();
    const topic = document.getElementById('inputTopic').value.trim();

    if (!host) return;

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        action: 'add_broker',
        host: host,
        port: port,
        username: user,
        password: pass,
        topic: topic
      }));
    }

    addBrokerForm.reset();
    document.getElementById('inputPort').value = '1883';
    document.getElementById('inputTopic').value = 'meshcore/#';
  });

  clearDbBtn.addEventListener('click', () => {
    const t = translations[currentLang];
    if (confirm(t.confirmClear)) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'clear_db' }));
      }
    }
  });

  // --- WebSocket Connection ---
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    updateStatus('connecting');

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      updateStatus('connected');
      fetchObservers();
      fetchPackets();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'init') {
          if (msg.brokers) {
            brokers = msg.brokers || [];
            renderBrokers();
          }
          if (msg.topology) {
            topologyData = msg.topology;
            updateVisTopology(topologyData);
          }
        } else if (msg.type === 'packet' && msg.packet) {
          handleIncomingPacket(msg.packet);
          if (msg.topology) {
            topologyData = msg.topology;
            updateVisTopology(topologyData);
          }
        } else if (msg.type === 'topology' && msg.topology) {
          topologyData = msg.topology;
          updateVisTopology(topologyData);
        } else if (msg.type === 'brokers' && msg.brokers) {
          brokers = msg.brokers || [];
          renderBrokers();
        } else if (msg.type === 'cleared') {
          rawPackets = [];
          topologyData = { nodes: [], edges: [] };
          renderPacketsTable();
          updateVisTopology(topologyData);
        }
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    ws.onclose = () => {
      updateStatus('disconnected');
      setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = () => {
      updateStatus('disconnected');
    };
  }

  function updateStatus(state) {
    statusDot.className = 'status-dot ' + state;
    const t = translations[currentLang];
    if (state === 'connected') {
      statusText.textContent = t.statusConnected;
    } else if (state === 'connecting') {
      statusText.textContent = t.statusConnecting;
    } else {
      statusText.textContent = t.statusDisconnected;
    }
  }

  function handleIncomingPacket(pkt) {
    if (isPaused) {
      pauseBuffer.push(pkt);
      return;
    }
    rawPackets.unshift(pkt);
    if (rawPackets.length > 500) rawPackets.pop();
    renderPacketsTable();
  }

  // --- Fetch Packets & Observers from REST API ---
  async function fetchObservers() {
    try {
      const res = await fetch('/api/observers');
      const data = await res.json();
      observers = data.observers || [];
      observerMap = new Map(observers.map(o => [o.id, o]));
      buildObserverMenu();
      updateObserverTrigger();
    } catch (err) {}
  }

  async function fetchPackets() {
    try {
      let url = `/api/packets?limit=200&groupByHash=${groupByHash}`;
      if (timeWindow > 0) {
        const since = new Date(Date.now() - timeWindow * 60000).toISOString();
        url += `&since=${encodeURIComponent(since)}`;
      }
      if (filterHash) url += `&hash=${encodeURIComponent(filterHash)}`;
      if (filterNode) url += `&node=${encodeURIComponent(filterNode)}`;
      if (selectedChannel) url += `&channel=${encodeURIComponent(selectedChannel)}`;
      if (selectedObservers.size > 0) url += `&observer=${encodeURIComponent([...selectedObservers].join(','))}`;
      if (selectedTypes.size > 0) url += `&type=${encodeURIComponent([...selectedTypes].join(','))}`;

      const res = await fetch(url);
      const data = await res.json();
      rawPackets = data.packets || [];
      renderPacketsTable();
    } catch (err) {
      console.error('Failed to fetch packets:', err);
    }
  }

  // --- Group Packets by Hash ---
  function getGroupedPackets(packetsList) {
    const map = new Map();
    for (const p of packetsList) {
      const key = p.hash || p.raw_hex || p.timestamp;
      if (map.has(key)) {
        const group = map.get(key);
        group.count += 1;
        group._children.push(p);
        if (p.timestamp > group.latest) {
          group.latest = p.timestamp;
          if (p.scope_name) group.scope_name = p.scope_name;
        }
      } else {
        map.set(key, {
          ...p,
          latest: p.timestamp,
          count: 1,
          _children: [p]
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => (b.latest || '').localeCompare(a.latest || ''));
  }

  // --- Render Packets Table ---
  function renderPacketsTable() {
    const t = translations[currentLang];
    let displayList = rawPackets;

    if (filterExpr) {
      displayList = displayList.filter(p => {
        const txt = (p.raw_hex + ' ' + p.type_name + ' ' + (p.decrypted_txt || '') + ' ' + (p.channel_name || '') + ' ' + (p.origin || '') + ' ' + (p.observer || '')).toLowerCase();
        return txt.includes(filterExpr);
      });
    }

    if (groupByHash) {
      displayList = getGroupedPackets(displayList);
    }

    pktCount.textContent = `(${displayList.length})`;

    if (displayList.length === 0) {
      emptyState.classList.remove('hidden');
      pktBody.innerHTML = '';
      return;
    }

    emptyState.classList.add('hidden');

    pktBody.innerHTML = displayList.map(p => {
      const isGroupHeader = groupByHash && p.count > 1;
      const isExpanded = expandedHashes.has(p.hash);
      const isSelected = selectedPacketQuery === (p.hash || String(p.id));

      const typeBadgeClass = getTypeBadgeClass(p.type_name);
      const sizeBytes = p.packet_size || (p.raw_hex ? Math.floor(p.raw_hex.length / 2) : 0);
      const hb = (p.raw_hex && p.raw_hex.length >= 4) ? ((parseInt(p.raw_hex.slice(2, 4), 16) >> 6) + 1) : 1;

      let hopsList = p.resolved_hops && p.resolved_hops.length > 0 ? p.resolved_hops : p.hops;
      let pathHtml = '';
      if (hopsList && hopsList.length > 0) {
        pathHtml = hopsList.map(h => `<span class="hop-tag">${escapeHtml(h)}</span>`).join('<span class="arrow">→</span>');
      } else {
        pathHtml = `<span style="color:var(--text-muted); font-size:11px;">${t.noHops}</span>`;
      }

      let detailsHtml = p.raw_hex || '-';
      if (p.channel_name && p.decrypted_txt) {
        const senderStr = p.sender ? `[${escapeHtml(p.sender)}]: ` : '';
        detailsHtml = `💬 <strong style="color:var(--accent-green);">[${escapeHtml(p.channel_name)}]</strong> ${senderStr}${escapeHtml(p.decrypted_txt)}`;
      } else if (p.advert_name) {
        detailsHtml = `📢 [${escapeHtml(p.advert_name)}] ${detailsHtml}`;
      } else if (p.ctrl_subtype) {
        detailsHtml = `⚙️ ${escapeHtml(p.ctrl_subtype)} | ${detailsHtml}`;
      } else if (p.dest_hash && p.src_hash) {
        detailsHtml = `↔️ ${escapeHtml(p.src_hash)} → ${escapeHtml(p.dest_hash)} | ${detailsHtml}`;
      }

      let headerRow = `
        <tr class="${isGroupHeader ? 'group-header' : ''} ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''}" data-hash="${escapeHtml(p.hash || '')}" data-id="${p.id || ''}">
          <td class="col-expand" style="text-align:center;">${isGroupHeader ? (isExpanded ? '▼' : '▶') : ''}</td>
          <td class="col-region"><span class="badge-region">${escapeHtml(p.scope_name || p.region || 'MESH')}</span></td>
          <td class="col-time code-font">${formatTime(p.latest || p.timestamp)}</td>
          <td class="col-hash code-font" style="color:var(--accent-blue);">${escapeHtml((p.hash || '').slice(0, 8))}</td>
          <td class="col-size code-font">${sizeBytes}B</td>
          <td class="col-hashsize code-font">${hb}</td>
          <td class="col-type"><span class="badge ${typeBadgeClass}">${escapeHtml(p.type_name || 'DATA')}</span></td>
          <td class="col-observer" style="font-weight: 500;">${escapeHtml(p.origin || p.observer || 'Unknown')}</td>
          <td class="col-path"><div class="path-hops">${pathHtml}</div></td>
          <td class="col-rpt">${isGroupHeader ? `<span class="badge-obs">x${p.count}</span>` : '1'}</td>
          <td class="col-details"><span class="col-details-clip" title="${escapeHtml(p.raw_hex || '')}">${detailsHtml}</span></td>
        </tr>
      `;

      if (isExpanded && p._children) {
        const childRows = p._children.map(c => {
          const cTypeBadgeClass = getTypeBadgeClass(c.type_name);
          const cSizeBytes = c.packet_size || (c.raw_hex ? Math.floor(c.raw_hex.length / 2) : 0);
          let cHops = c.resolved_hops && c.resolved_hops.length > 0 ? c.resolved_hops : c.hops;
          let cPathHtml = cHops && cHops.length > 0 ? cHops.map(h => `<span class="hop-tag">${escapeHtml(h)}</span>`).join('<span class="arrow">→</span>') : `<span style="color:var(--text-muted);">${t.noHops}</span>`;

          return `
            <tr class="group-child" data-id="${c.id}" data-hash="${escapeHtml(c.hash || '')}">
              <td class="col-expand"></td>
              <td class="col-region"><span class="badge-region">${escapeHtml(c.scope_name || c.region || 'MESH')}</span></td>
              <td class="col-time code-font">${formatTime(c.timestamp)}</td>
              <td class="col-hash code-font" style="color:var(--accent-blue);">${escapeHtml((c.hash || '').slice(0, 8))}</td>
              <td class="col-size code-font">${cSizeBytes}B</td>
              <td class="col-hashsize code-font">1</td>
              <td class="col-type"><span class="badge ${cTypeBadgeClass}">${escapeHtml(c.type_name || 'DATA')}</span></td>
              <td class="col-observer">${escapeHtml(c.origin || c.observer || 'Unknown')}</td>
              <td class="col-path"><div class="path-hops">${cPathHtml}</div></td>
              <td class="col-rpt">1</td>
              <td class="col-details"><span class="col-details-clip">${escapeHtml(c.raw_hex || '')}</span></td>
            </tr>
          `;
        }).join('');
        return headerRow + childRows;
      }

      return headerRow;
    }).join('');

    // Row Click Handlers
    pktBody.querySelectorAll('tr').forEach(row => {
      row.addEventListener('click', (e) => {
        const hash = row.getAttribute('data-hash');
        const id = row.getAttribute('data-id');
        const isGroup = row.classList.contains('group-header');

        if (isGroup && e.target.classList.contains('col-expand')) {
          if (expandedHashes.has(hash)) expandedHashes.delete(hash);
          else expandedHashes.add(hash);
          renderPacketsTable();
          return;
        }

        selectedPacketQuery = hash || id;
        selectedObservationId = id;
        openPacketDetail(selectedPacketQuery, selectedObservationId);
        renderPacketsTable();
      });
    });
  }

  function getTypeBadgeClass(typeName) {
    if (!typeName) return 'badge-data';
    if (typeName.includes('ADVERT')) return 'badge-advert';
    if (typeName.includes('ACK')) return 'badge-ack';
    if (typeName.includes('GRP') || typeName.includes('TXT')) return 'badge-txt';
    if (typeName.includes('LOCATION')) return 'badge-location';
    return 'badge-data';
  }

  // --- Open & Render Packet Detail Sidebar ---
  async function openPacketDetail(query, obsId) {
    const layout = document.querySelector('.split-layout');
    layout.classList.remove('detail-collapsed');
    pktRight.classList.remove('empty');
    pktRight.innerHTML = `<button type="button" class="panel-close-btn" id="closeDetailBtn">&times;</button><p class="text-muted">Ładowanie szczegółów...</p>`;

    document.getElementById('closeDetailBtn').addEventListener('click', () => {
      layout.classList.add('detail-collapsed');
      selectedPacketQuery = null;
    });

    try {
      const res = await fetch(`/api/packets/${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        pktRight.innerHTML = `<button type="button" class="panel-close-btn" id="closeDetailBtn">&times;</button><p class="text-muted">Błąd: ${escapeHtml(data.error || 'Nie znaleziono pakietu')}</p>`;
        document.getElementById('closeDetailBtn').addEventListener('click', () => {
          layout.classList.add('detail-collapsed');
          selectedPacketQuery = null;
        });
        return;
      }
      const pkt = data.packet;
      const observations = data.observations || [];

      if (!pkt) {
        pktRight.innerHTML = `<button type="button" class="panel-close-btn" id="closeDetailBtn">&times;</button><p class="text-muted">Nie znaleziono pakietu.</p>`;
        return;
      }

      let currentObs = pkt;
      if (obsId && observations.length > 0) {
        const found = observations.find(o => String(o.id) === String(obsId));
        if (found) currentObs = found;
      }

      const typeBadgeClass = getTypeBadgeClass(currentObs.type_name);
      const hopsList = currentObs.resolved_hops && currentObs.resolved_hops.length > 0 ? currentObs.resolved_hops : currentObs.hops;
      const pathStr = hopsList && hopsList.length > 0 ? hopsList.join(' → ') : 'Bezpośrednio';

      let messageHtml = '';
      if (currentObs.channel_name && currentObs.decrypted_txt) {
        messageHtml = `
          <div class="detail-message">
            <div>💬 <strong>[${escapeHtml(currentObs.channel_name)}]</strong> ${currentObs.sender ? `[${escapeHtml(currentObs.sender)}]: ` : ''}${escapeHtml(currentObs.decrypted_txt)}</div>
          </div>
        `;
      } else if (currentObs.advert_name) {
        messageHtml = `
          <div class="detail-message">
            <div>📢 <strong>[${escapeHtml(currentObs.advert_name)}]</strong> ${escapeHtml(currentObs.raw_hex || '')}</div>
          </div>
        `;
      }

      let observationsTableHtml = '';
      if (observations.length > 1) {
        const obsRows = observations.map(o => `
          <tr style="cursor:pointer;" data-obs-id="${o.id}">
            <td>${escapeHtml(o.observer)}</td>
            <td>${(o.hops || []).length}</td>
            <td>${o.snr != null ? o.snr + ' dB' : '-'}</td>
            <td>${o.rssi != null ? o.rssi + ' dBm' : '-'}</td>
            <td class="code-font">${formatTime(o.timestamp)}</td>
          </tr>
        `).join('');

        observationsTableHtml = `
          <div style="margin-top:16px;">
            <h4 style="font-size:13px; font-weight:600; margin-bottom:6px;">Obserwacje (${observations.length})</h4>
            <table class="detail-obs-table">
              <thead>
                <tr>
                  <th>Obserwator</th>
                  <th>Hopy</th>
                  <th>SNR</th>
                  <th>RSSI</th>
                  <th>Czas</th>
                </tr>
              </thead>
              <tbody>${obsRows}</tbody>
            </table>
          </div>
        `;
      }

      pktRight.innerHTML = `
        <button type="button" class="panel-close-btn" id="closeDetailBtn">&times;</button>
        <div class="detail-title">
          <span class="badge ${typeBadgeClass}">${escapeHtml(currentObs.type_name || 'DATA')}</span>
          <span>${escapeHtml(currentObs.origin || currentObs.observer || 'Pakiet')}</span>
        </div>
        <div class="detail-hash">${escapeHtml(currentObs.hash || '-')}</div>
        ${messageHtml}

        <dl class="detail-meta">
          <dt>Typ Pakietu</dt><dd>${escapeHtml(currentObs.type_name || 'DATA')}</dd>
          <dt>Ścieżka</dt><dd class="code-font">${escapeHtml(pathStr)}</dd>
          <dt>Czas</dt><dd class="code-font">${formatTime(currentObs.timestamp)}</dd>
          <dt>Obserwator</dt><dd>${escapeHtml(currentObs.observer || '-')}</dd>
          <dt>Scope</dt><dd><span class="badge-region">${escapeHtml(currentObs.scope_name || currentObs.region || 'MESH')}</span></dd>
          <dt>Rozmiar</dt><dd class="code-font">${currentObs.packet_size || Math.floor((currentObs.raw_hex || '').length / 2)} B</dd>
          <dt>SNR / RSSI</dt><dd>${currentObs.snr != null ? currentObs.snr + ' dB' : '-'} / ${currentObs.rssi != null ? currentObs.rssi + ' dBm' : '-'}</dd>
        </dl>

        <details class="detail-technical" open>
          <summary>Podgląd Bajtów (Raw Hex)</summary>
          <div class="hex-dump">${escapeHtml(currentObs.raw_hex || '-')}</div>
          <table class="field-table">
            <thead>
              <tr><th>Offset</th><th>Pole</th><th>Wartość</th></tr>
            </thead>
            <tbody>
              <tr class="section-row"><td colspan="3">Nagłówek MeshCore</td></tr>
              <tr><td class="code-font">0</td><td>Header Byte</td><td class="code-font">0x${(currentObs.raw_hex || '').slice(0, 2)}</td></tr>
              <tr><td class="code-font">1</td><td>Path Specifier</td><td class="code-font">0x${(currentObs.raw_hex || '').slice(2, 4)}</td></tr>
              <tr class="section-row"><td colspan="3">Payload / Dane Hex</td></tr>
              <tr><td class="code-font">2+</td><td>Payload Bytes</td><td class="code-font" style="word-break:break-all;">${escapeHtml((currentObs.raw_hex || '').slice(4))}</td></tr>
            </tbody>
          </table>
        </details>

        ${observationsTableHtml}
      `;

      document.getElementById('closeDetailBtn').addEventListener('click', () => {
        layout.classList.add('detail-collapsed');
        selectedPacketQuery = null;
      });

      pktRight.querySelectorAll('.detail-obs-table tr[data-obs-id]').forEach(tr => {
        tr.addEventListener('click', () => {
          const obsId = tr.getAttribute('data-obs-id');
          openPacketDetail(query, obsId);
        });
      });

    } catch (err) {
      pktRight.innerHTML = `<button type="button" class="panel-close-btn" id="closeDetailBtn">&times;</button><p class="text-muted">Błąd ładowania szczegółów: ${escapeHtml(err.message)}</p>`;
    }
  }

  function renderBrokers() {
    const t = translations[currentLang];
    if (brokers.length === 0) {
      brokersList.innerHTML = `<p style="color:var(--text-muted);font-size:13px;">Brak skonfigurowanych serwerów MQTT.</p>`;
      return;
    }

    brokersList.innerHTML = brokers.map(b => {
      const isEnabled = b.enabled !== false;
      const toggleBtnText = isEnabled ? t.btnPause : t.btnResume;
      const toggleBtnClass = isEnabled ? 'btn-amber' : 'btn-green';

      return `
        <div class="broker-item">
          <div class="broker-info">
            <span class="broker-url">${escapeHtml(b.broker)}</span>
            <span class="broker-topic">Topic: ${escapeHtml(b.topic || 'meshcore/#')} &bull; Status: <strong style="color:${getBrokerStatusColor(b.status)}">${b.status}</strong></span>
          </div>
          <div class="broker-actions">
            <button type="button" class="btn-sm ${toggleBtnClass}" data-toggle-id="${b.id}" data-enabled="${!isEnabled}">${toggleBtnText}</button>
            <button type="button" class="btn-danger btn-sm" data-id="${b.id}">${t.btnRemove}</button>
          </div>
        </div>
      `;
    }).join('');

    brokersList.querySelectorAll('.btn-danger').forEach(btn => {
      btn.addEventListener('click', () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 'remove_broker', id: btn.getAttribute('data-id') }));
        }
      });
    });

    brokersList.querySelectorAll('[data-toggle-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-toggle-id');
        const nextState = btn.getAttribute('data-enabled') === 'true';
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 'toggle_broker', id: id, enabled: nextState }));
        }
      });
    });
  }

  function getBrokerStatusColor(status) {
    if (status === 'connected') return 'var(--accent-green)';
    if (status === 'connecting') return 'var(--accent-amber)';
    if (status === 'paused') return 'var(--text-muted)';
    return 'var(--accent-red)';
  }

  // --- Vis.js Topology Graph ---
  function initVisNetwork() {
    const container = document.getElementById('topologyNetwork');
    if (!container || network) return;

    const data = { nodes: visNodes, edges: visEdges };
    const options = {
      nodes: {
        shape: 'dot',
        size: 18,
        font: {
          color: '#f8fafc',
          size: 13,
          face: 'Inter, sans-serif'
        },
        borderWidth: 2,
        shadow: true
      },
      edges: {
        smooth: {
          type: 'continuous'
        }
      },
      physics: {
        solver: 'barnesHut',
        barnesHut: {
          gravitationalConstant: -8000,
          centralGravity: 0.01,
          springLength: 180,
          springConstant: 0.01,
          damping: 0.3
        },
        maxVelocity: 30,
        minVelocity: 0.75,
        stabilization: {
          enabled: true,
          iterations: 100
        }
      },
      interaction: {
        hover: true,
        tooltipDelay: 150
      }
    };

    network = new vis.Network(container, data, options);
    updateVisTopology(topologyData);

    network.on('click', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        if (nodeId.startsWith('CLUSTER_')) {
          const cKey = nodeId.replace('CLUSTER_', '');
          expandedClusters.add(cKey);
          updateVisTopology(topologyData);
          displayClusterDetails(cKey);
        } else {
          displayNodeDetails(nodeId);
        }
      } else if (params.edges.length > 0) {
        const edgeId = params.edges[0];
        displayEdgeDetails(edgeId);
      }
    });
  }

  function getClusterKey(node) {
    if (node.scopes && node.scopes.length > 0) {
      const sc = node.scopes[0].toUpperCase();
      if (sc === 'WRO' || sc === 'POZ' || sc === 'IEG') {
        return sc + ' CLUSTER';
      }
    }
    if (node.id && node.id.length >= 2) {
      return node.id.substring(0, 2) + ' CLUSTER';
    }
    return 'OTHER CLUSTER';
  }

  function updateVisTopology(topo) {
    if (!topo) return;

    const allNodes = topo.nodes || [];
    const allEdges = topo.edges || [];

    const clusterMap = new Map();
    allNodes.forEach(n => {
      const key = getClusterKey(n);
      if (!clusterMap.has(key)) {
        clusterMap.set(key, []);
      }
      clusterMap.get(key).push(n);
    });

    const nodeToCluster = new Map();
    clusterMap.forEach((nodes, cKey) => {
      const isExpanded = expandedClusters.has(cKey);
      nodes.forEach(n => {
        if (isExpanded) {
          nodeToCluster.set(n.id, n.id);
        } else {
          nodeToCluster.set(n.id, 'CLUSTER_' + cKey);
        }
      });
    });

    const targetNodeIds = new Set();
    const nodeUpdates = [];

    clusterMap.forEach((nodes, cKey) => {
      const isExpanded = expandedClusters.has(cKey);
      const clusterId = 'CLUSTER_' + cKey;

      if (!isExpanded) {
        targetNodeIds.add(clusterId);
        nodeUpdates.push({
          id: clusterId,
          label: `📦 ${cKey}\n(${nodes.length} węzłów)`,
          shape: 'circle',
          size: 30,
          color: {
            background: 'rgba(56, 189, 248, 0.35)',
            border: '#38bdf8',
            highlight: { background: '#38bdf8', border: '#ffffff' }
          },
          font: { size: 13, bold: true, color: '#f8fafc' },
          title: `Klaster: ${cKey}\nWęzły: ${nodes.length}\n(Kliknij, aby eksplodować/rozwinąć)`,
          isClusterNode: true,
          clusterKey: cKey,
          physics: true
        });
      } else {
        nodes.forEach(n => {
          targetNodeIds.add(n.id);
          const isAdvert = n.name && !n.name.startsWith('Node ');
          const nodeColor = isAdvert ? '#38bdf8' : '#a855f7';
          const labelText = isAdvert ? `[${n.name}]\n${n.id}` : n.id;

          nodeUpdates.push({
            id: n.id,
            label: labelText,
            color: {
              background: isAdvert ? 'rgba(56, 189, 248, 0.25)' : 'rgba(168, 85, 247, 0.25)',
              border: nodeColor,
              highlight: { background: nodeColor, border: '#ffffff' }
            },
            title: `Node ID: ${n.id}\nName: ${n.name || 'Unknown'}\nLast Seen: ${formatTime(n.last_seen)}`,
            clusterKey: cKey,
            physics: true
          });
        });
      }
    });

    const currentVisIds = visNodes.getIds();
    const idsToRemove = currentVisIds.filter(id => !targetNodeIds.has(id));
    if (idsToRemove.length > 0) {
      visNodes.remove(idsToRemove);
    }

    visNodes.update(nodeUpdates);

    const bundledEdgeMap = new Map();
    allEdges.forEach(e => {
      if (!e.source || !e.target) return;
      const mappedSrc = nodeToCluster.get(e.source) || e.source;
      const mappedTgt = nodeToCluster.get(e.target) || e.target;

      if (mappedSrc === mappedTgt) return;

      const sortedPair = [mappedSrc, mappedTgt].sort().join('<->');
      if (bundledEdgeMap.has(sortedPair)) {
        const existing = bundledEdgeMap.get(sortedPair);
        existing.traffic += e.traffic_count;
        existing.isBidirectional = true;
        if (e.last_seen > existing.last_seen) {
          existing.last_seen = e.last_seen;
        }
      } else {
        bundledEdgeMap.set(sortedPair, {
          id: sortedPair,
          source: mappedSrc,
          target: mappedTgt,
          traffic: e.traffic_count,
          last_seen: e.last_seen,
          isBidirectional: false
        });
      }
    });

    const targetEdgeIds = new Set();
    const edgeUpdates = [];
    bundledEdgeMap.forEach(e => {
      targetEdgeIds.add(e.id);
      const width = Math.min(2 + Math.log2(e.traffic || 1), 8);
      const isFresh = isEdgeFresh(e.last_seen);
      const color = isFresh ? '#10b981' : '#64748b';

      const arrowsObj = e.isBidirectional
        ? { to: { enabled: true, scaleFactor: 0.8 }, from: { enabled: true, scaleFactor: 0.8 } }
        : { to: { enabled: true, scaleFactor: 0.8 } };

      edgeUpdates.push({
        id: e.id,
        from: e.source,
        to: e.target,
        arrows: arrowsObj,
        width: width,
        color: { color: color, highlight: '#38bdf8' },
        title: `Połączenie: ${e.source} ${e.isBidirectional ? '↔' : '→'} ${e.target}\nPakiety: ${e.traffic}`
      });
    });

    const currentEdgeIds = visEdges.getIds();
    const edgesToRemove = currentEdgeIds.filter(id => !targetEdgeIds.has(id));
    if (edgesToRemove.length > 0) {
      visEdges.remove(edgesToRemove);
    }

    visEdges.update(edgeUpdates);
  }

  function displayClusterDetails(cKey) {
    const t = translations[currentLang];
    const clusterNodes = (topologyData.nodes || []).filter(n => getClusterKey(n) === cKey);

    const nodeListHtml = clusterNodes.map(n => {
      return `<li style="margin-bottom: 4px; font-size: 13px;"><strong class="code-font" style="color:var(--accent-blue);">${escapeHtml(n.id)}</strong> - ${escapeHtml(n.name || 'Node')}</li>`;
    }).join('');

    nodeInfoBox.innerHTML = `
      <div class="node-detail-card">
        <h4 class="code-font" style="color:var(--accent-blue);">📦 ${escapeHtml(cKey)}</h4>
        <p style="font-weight: 600; font-size: 14px; margin-bottom: 8px;">Klaster (${clusterNodes.length} węzłów)</p>
        <p style="font-size: 12px; color: var(--text-muted);">Klaster został rozwinięty / eksplodowany na mapie.</p>

        <div style="margin-top: 12px; border-top: 1px solid var(--border-color); padding-top: 10px;">
          <span class="detail-label" style="font-weight: 600;">Węzły w klastrze:</span>
          <ul style="padding-left: 18px; margin-top: 6px; max-height: 180px; overflow-y: auto;">${nodeListHtml}</ul>
        </div>

        <div style="margin-top: 16px;">
          <button type="button" class="btn btn-secondary btn-sm" id="btnCollapseClusterAction" style="width: 100%;">${t.btnCollapseCluster}</button>
        </div>
      </div>
    `;

    document.getElementById('btnCollapseClusterAction')?.addEventListener('click', () => {
      expandedClusters.delete(cKey);
      updateVisTopology(topologyData);
      nodeInfoBox.innerHTML = `<p class="text-muted">${t.nodeInfoPlaceholder}</p>`;
    });
  }

  function displayNodeDetails(nodeId) {
    const t = translations[currentLang];
    const node = (topologyData.nodes || []).find(n => n.id === nodeId);
    if (!node) return;

    const pathSizesText = (node.path_sizes || [2]).map(s => `${s}-byte`).join(', ');
    const scopesText = (node.scopes || []).join(', ') || 'Global / MESH';

    const neighborIds = new Set();
    (topologyData.edges || []).forEach(e => {
      if (e.source === nodeId) neighborIds.add(e.target);
      if (e.target === nodeId) neighborIds.add(e.source);
    });

    let neighborsHtml = '';
    if (neighborIds.size > 0) {
      const neighborsList = Array.from(neighborIds).map(nId => {
        const nNode = (topologyData.nodes || []).find(n => n.id === nId);
        const nameStr = nNode && nNode.name ? ` (${escapeHtml(nNode.name)})` : '';
        return `<li style="margin-bottom: 4px; font-size: 13px;"><strong class="code-font" style="color:var(--accent-blue);">${escapeHtml(nId)}</strong>${nameStr}</li>`;
      }).join('');
      neighborsHtml = `<ul style="padding-left: 18px; margin-top: 6px; margin-bottom: 0;">${neighborsList}</ul>`;
    } else {
      neighborsHtml = `<p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">${t.noNeighbors}</p>`;
    }

    const candidates = (topologyData.nodes || []).filter(n => n.id !== node.id && n.id.length > node.id.length && n.id.startsWith(node.id));
    let mergeSectionHtml = '';
    if (node.id.length <= 4) {
      let optionsHtml = candidates.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.id)} - ${escapeHtml(c.name || 'Node')}</option>`).join('');
      mergeSectionHtml = `
        <div style="margin-top: 14px; border-top: 1px solid var(--border-color); padding-top: 10px;">
          <label style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px;">${t.labelSelectTargetNode}</label>
          <select id="selectTargetNode" class="form-control" style="width:100%; font-size: 12px; padding: 4px 8px; margin-bottom: 8px;">
            <option value="">-- ${t.labelSelectTargetNode} --</option>
            ${optionsHtml}
          </select>
          <button type="button" class="btn btn-primary btn-sm" id="btnMergeNodeAction" style="width: 100%;">${t.btnMergeNodes}</button>
        </div>
      `;
    }

    nodeInfoBox.innerHTML = `
      <div class="node-detail-card">
        <h4 class="code-font" style="color:var(--accent-blue);">${escapeHtml(node.id)}</h4>
        <p style="font-weight: 600; font-size: 15px; margin-bottom: 8px;">${escapeHtml(node.name || 'Unknown Repeater')}</p>

        <div class="detail-field">
          <span class="detail-label">${t.supportedPathSizes}:</span>
          <span class="badge-region">${escapeHtml(pathSizesText)}</span>
        </div>

        <div class="detail-field">
          <span class="detail-label">${t.supportedRegions}:</span>
          <span class="badge-region">${escapeHtml(scopesText)}</span>
        </div>

        <div class="detail-field">
          <span class="detail-label">${t.lastSeen}:</span>
          <span class="code-font">${formatTime(node.last_seen)}</span>
        </div>

        <div class="detail-field" style="margin-top: 12px; border-top: 1px solid var(--border-color); padding-top: 10px;">
          <span class="detail-label" style="font-weight: 600;">${t.neighborsTitle} (${neighborIds.size}):</span>
          ${neighborsHtml}
        </div>

        ${mergeSectionHtml}

        <div style="margin-top: 16px;">
          <button type="button" class="btn btn-danger btn-sm" id="btnDeleteNodeAction" style="width: 100%;">${t.btnDeleteNode}</button>
        </div>
      </div>
    `;

    document.getElementById('btnDeleteNodeAction')?.addEventListener('click', () => {
      if (confirm(t.confirmDeleteNode)) {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 'delete_node', id: node.id }));
        }
      }
    });

    document.getElementById('btnMergeNodeAction')?.addEventListener('click', () => {
      const targetId = document.getElementById('selectTargetNode')?.value;
      if (!targetId) return;
      const confirmText = t.confirmMergeNodes.replace('{alias}', node.id).replace('{target}', targetId);
      if (confirm(confirmText)) {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 'merge_nodes', alias_id: node.id, target_id: targetId }));
        }
      }
    });
  }

  function displayEdgeDetails(edgeId) {
    const t = translations[currentLang];
    const parts = edgeId.split('<->');
    if (parts.length < 2) return;
    const source = parts[0];
    const target = parts[1];

    nodeInfoBox.innerHTML = `
      <div class="node-detail-card">
        <h4 class="code-font" style="color:var(--accent-blue);">${escapeHtml(source)} &harr; ${escapeHtml(target)}</h4>
        <p style="font-weight: 600; font-size: 14px; margin-bottom: 8px;">Połączenie w topologii</p>

        <div style="margin-top: 16px;">
          <button type="button" class="btn btn-danger btn-sm" id="btnDeleteEdgeAction" style="width: 100%;">${t.btnDeleteEdge}</button>
        </div>
      </div>
    `;

    document.getElementById('btnDeleteEdgeAction')?.addEventListener('click', () => {
      if (confirm(t.confirmDeleteEdge)) {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 'delete_edge', source: source, target: target }));
        }
      }
    });
  }

  function isEdgeFresh(lastSeenIso) {
    if (!lastSeenIso) return false;
    try {
      const diffMs = Date.now() - new Date(lastSeenIso).getTime();
      return diffMs < 5 * 60 * 1000;
    } catch {
      return false;
    }
  }

  function formatTime(isoStr) {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return d.toTimeString().split(' ')[0] + '.' + String(d.getMilliseconds()).padStart(3, '0');
    } catch {
      return isoStr;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // --- Initial Start ---
  applyLanguage(currentLang);
  connectWebSocket();
})();
