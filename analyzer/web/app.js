(function () {
  'use strict';

  // --- Translations (PL/EN) ---
  const translations = {
    pl: {
      subtitle: 'Nasłuchiwanie MQTT & Analiza Topologii',
      tabPackets: '📡 Pakiety Live',
      tabTopology: '🗺️ Mapa Topologii',
      statusConnecting: 'Łączenie z serwerem WS...',
      statusConnected: 'Połączono z serwerem WS',
      statusDisconnected: 'Rozłączono z serwerem WS',
      settings: '⚙️ Ustawienia',
      btnClearLog: '🗑️ Wyczyść Ekran',
      nodeInfoTitle: 'Informacje o Węźle',
      nodeInfoPlaceholder: 'Kliknij węzeł na mapie, aby zobaczyć jego właściwości.',
      settingsTitle: 'Ustawienia i Filtry Systemowe',
      filterTitle: 'Filtrowanie i Grupowanie',
      btnGroupHash: 'Grupuj pakiety po hashu',
      labelTimeWindow: 'Przedział czasowy:',
      labelChanFilter: 'Filtr kanału:',
      labelHashFilter: 'Filtr hashu / nadawcy:',
      mqttServersTitle: 'Serwery MQTT',
      btnAddServer: 'Dodaj Serwer MQTT',
      btnClearDb: '🗑️ Wyczyść Bazę Danych',
      confirmClear: 'Czy na pewno chcesz usunąć wszystkie dane z bazy danych?',
      confirmDeleteNode: 'Czy na pewno chcesz usunąć ten węzeł i jego połączenia?',
      confirmDeleteEdge: 'Czy na pewno chcesz usunąć to połączenie?',
      confirmMergeNodes: 'Czy na pewno chcesz połączyć węzeł {alias} z węzłem {target}?',
      tw15: 'Ostatnie 15 min',
      tw30: 'Ostatnie 30 min',
      tw60: 'Ostatnia 1 godz.',
      tw180: 'Ostatnie 3 godz.',
      tw1440: 'Ostatnie 24 godz.',
      twAll: 'Wszystkie',
    },
    en: {
      subtitle: 'MQTT Listening & Topology Mapping',
      tabPackets: '📡 Live Packets',
      tabTopology: '🗺️ Topology Map',
      statusConnecting: 'Connecting to WS server...',
      statusConnected: 'WS Server Connected',
      statusDisconnected: 'WS Server Disconnected',
      settings: '⚙️ Settings',
      btnClearLog: '🗑️ Clear Screen',
      nodeInfoTitle: 'Node Information',
      nodeInfoPlaceholder: 'Click a node on the map to view its attributes.',
      settingsTitle: 'System Settings & Filters',
      filterTitle: 'Filtering & Grouping',
      btnGroupHash: 'Group packets by hash',
      labelTimeWindow: 'Time window:',
      labelChanFilter: 'Channel filter:',
      labelHashFilter: 'Hash / Sender filter:',
      mqttServersTitle: 'MQTT Servers',
      btnAddServer: 'Add MQTT Server',
      btnClearDb: '🗑️ Clear Database',
      confirmClear: 'Are you sure you want to clear all topology and packet database records?',
      confirmDeleteNode: 'Are you sure you want to delete this node and its connections?',
      confirmDeleteEdge: 'Are you sure you want to delete this connection?',
      confirmMergeNodes: 'Are you sure you want to merge node {alias} into target node {target}?',
      tw15: 'Last 15 min',
      tw30: 'Last 30 min',
      tw60: 'Last 1 hour',
      tw180: 'Last 3 hours',
      tw1440: 'Last 24 hours',
      twAll: 'All time',
    }
  };

  let currentLang = localStorage.getItem('mc_analyzer_lang') || 'pl';
  let groupByHash = localStorage.getItem('mc_group_by_hash') !== 'false';
  let timeWindow = parseInt(localStorage.getItem('mc_time_window') || '15', 10);
  let filterChannel = '';
  let filterHash = '';

  let rawPackets = [];
  let brokers = [];
  let topologyData = { nodes: [], edges: [] };
  let expandedClusters = new Set();
  let ws = null;

  // Vis.js Network instance
  let network = null;
  let visNodes = new vis.DataSet();
  let visEdges = new vis.DataSet();

  // DOM Elements
  const statusPane = document.getElementById('statusPane');
  const countPane = document.getElementById('countPane');
  const langToggleBtn = document.getElementById('langToggleBtn');
  const tabPacketsBtn = document.getElementById('tabPacketsBtn');
  const tabTopologyBtn = document.getElementById('tabTopologyBtn');
  const packetsView = document.getElementById('packetsView');
  const topologyView = document.getElementById('topologyView');
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const openSettingsMenuBtn = document.getElementById('openSettingsMenuBtn');
  const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
  const closeSettingsOkBtn = document.getElementById('closeSettingsOkBtn');
  const settingsModal = document.getElementById('settingsModal');
  const clearLogBtn = document.getElementById('clearLogBtn');
  const pktLog = document.getElementById('pktLog');
  const notepadModal = document.getElementById('notepadModal');
  const notepadText = document.getElementById('notepadText');
  const closeNotepadBtn = document.getElementById('closeNotepadBtn');
  const closeNotepadOkBtn = document.getElementById('closeNotepadOkBtn');
  const addBrokerForm = document.getElementById('addBrokerForm');
  const brokersList = document.getElementById('brokersList');
  const clearDbBtn = document.getElementById('clearDbBtn');
  const groupByHashToggle = document.getElementById('groupByHashToggle');
  const fTimeWindow = document.getElementById('fTimeWindow');
  const fChannel = document.getElementById('fChannel');
  const fHash = document.getElementById('fHash');
  const nodeInfoBox = document.getElementById('nodeInfoBox');

  // --- View Switcher ---
  tabPacketsBtn.addEventListener('click', () => switchTab('packets'));
  tabTopologyBtn.addEventListener('click', () => switchTab('topology'));

  function switchTab(tab) {
    if (tab === 'packets') {
      tabPacketsBtn.classList.add('active');
      tabTopologyBtn.classList.remove('active');
      packetsView.classList.remove('hidden');
      topologyView.classList.add('hidden');
    } else {
      tabTopologyBtn.classList.add('active');
      tabPacketsBtn.classList.remove('active');
      topologyView.classList.remove('hidden');
      packetsView.classList.add('hidden');
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

    langToggleBtn.textContent = lang.toUpperCase();
    renderPacketLog();
    renderBrokers();
  }

  langToggleBtn.addEventListener('click', () => {
    applyLanguage(currentLang === 'pl' ? 'en' : 'pl');
  });

  // --- Settings Modal ---
  openSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
  openSettingsMenuBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
  closeSettingsModalBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
  closeSettingsOkBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));

  // --- Notepad Modal ---
  closeNotepadBtn.addEventListener('click', () => notepadModal.classList.add('hidden'));
  closeNotepadOkBtn.addEventListener('click', () => notepadModal.classList.add('hidden'));

  clearLogBtn.addEventListener('click', () => {
    pktLog.innerHTML = '';
    rawPackets = [];
    countPane.textContent = `Pakiety: 0`;
  });

  groupByHashToggle.checked = groupByHash;
  groupByHashToggle.addEventListener('change', (e) => {
    groupByHash = e.target.checked;
    localStorage.setItem('mc_group_by_hash', groupByHash);
    fetchPackets();
  });

  fTimeWindow.value = String(timeWindow);
  fTimeWindow.addEventListener('change', (e) => {
    timeWindow = parseInt(e.target.value, 10);
    localStorage.setItem('mc_time_window', timeWindow);
    fetchPackets();
  });

  fChannel.addEventListener('input', debounce((e) => {
    filterChannel = e.target.value.trim().toLowerCase();
    renderPacketLog();
  }, 300));

  fHash.addEventListener('input', debounce((e) => {
    filterHash = e.target.value.trim().toLowerCase();
    renderPacketLog();
  }, 300));

  addBrokerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const host = document.getElementById('inputHost').value.trim();
    const port = document.getElementById('inputPort').value.trim();
    const topic = document.getElementById('inputTopic').value.trim();

    if (!host) return;

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        action: 'add_broker',
        host: host,
        port: port || '1883',
        topic: topic || 'meshcore/#'
      }));
    }

    addBrokerForm.reset();
  });

  clearDbBtn.addEventListener('click', () => {
    const t = translations[currentLang];
    if (confirm(t.confirmClear)) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'clear_db' }));
      }
    }
  });

  // --- WebSocket Setup ---
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    updateStatus('connecting');

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      updateStatus('connected');
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
          renderPacketLog();
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
    const t = translations[currentLang];
    if (state === 'connected') {
      statusPane.textContent = t.statusConnected;
    } else if (state === 'connecting') {
      statusPane.textContent = t.statusConnecting;
    } else {
      statusPane.textContent = t.statusDisconnected;
    }
  }

  function handleIncomingPacket(pkt) {
    rawPackets.unshift(pkt);
    if (rawPackets.length > 500) rawPackets.pop();
    renderPacketLog();
  }

  async function fetchPackets() {
    try {
      let url = `/api/packets?limit=200&groupByHash=${groupByHash}`;
      if (timeWindow > 0) {
        const since = new Date(Date.now() - timeWindow * 60000).toISOString();
        url += `&since=${encodeURIComponent(since)}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      rawPackets = data.packets || [];
      renderPacketLog();
    } catch (err) {}
  }

  // --- Group Packets by Hash ---
  function getGroupedPackets(packetsList) {
    const map = new Map();
    for (const p of packetsList) {
      const key = p.hash || p.raw_hex || p.timestamp;
      if (map.has(key)) {
        const group = map.get(key);
        group.count += 1;
        if (p.timestamp > group.latest) group.latest = p.timestamp;
      } else {
        map.set(key, { ...p, latest: p.timestamp, count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => (b.latest || '').localeCompare(a.latest || ''));
  }

  // --- Render mIRC-Style Packet Log Stream ---
  function renderPacketLog() {
    let displayList = rawPackets;

    if (filterChannel) {
      displayList = displayList.filter(p => (p.channel_name || '').toLowerCase().includes(filterChannel));
    }

    if (filterHash) {
      displayList = displayList.filter(p => (p.hash || '').toLowerCase().includes(filterHash) || (p.sender || '').toLowerCase().includes(filterHash) || (p.origin || '').toLowerCase().includes(filterHash));
    }

    if (groupByHash) {
      displayList = getGroupedPackets(displayList);
    }

    countPane.textContent = `Pakiety: ${displayList.length}`;

    if (displayList.length === 0) {
      pktLog.innerHTML = `<div class="mirc-line mirc-dimmed">* Brak pakietów do wyświetlenia w logu mIRC.</div>`;
      return;
    }

    pktLog.innerHTML = displayList.map(p => {
      const timeStr = formatTime(p.latest || p.timestamp);
      const hopsList = p.resolved_hops && p.resolved_hops.length > 0 ? p.resolved_hops : p.hops;
      const pathSize = p.path_byte_size || 1;
      const pathStr = hopsList && hopsList.length > 0 ? hopsList.join(' -> ') : 'Direct';
      const scopeStr = p.scope_name || p.region || 'MESH';
      const countBadge = p.count > 1 ? ` (x${p.count})` : '';

      // Check if packet contains plaintext chat message
      const isChatMessage = p.channel_name && p.decrypted_txt;

      if (isChatMessage) {
        // Prominent chat message line
        const chanStr = `[${escapeHtml(p.channel_name)}]`;
        const senderStr = p.sender ? `<${escapeHtml(p.sender)}>` : `<${escapeHtml(p.origin || 'Anon')}>`;
        const msgStr = escapeHtml(p.decrypted_txt);

        return `
          <div class="mirc-line mirc-chat" data-query="${escapeHtml(p.hash || String(p.id))}">
            <span class="mirc-time">[${timeStr}]</span> <span class="mirc-type">${p.type_name}</span> | <span class="mirc-chan">${chanStr}[${scopeStr}]</span> | <span class="mirc-sender">${senderStr}</span>: <span class="mirc-msg">${msgStr}</span>${countBadge} | <span class="mirc-path">${pathSize}B path: ${pathStr}</span>
          </div>
        `;
      } else {
        // Dimmed system log line for non-chat packets (ADVERT, ACK, REQ, RESP, CONTROL, etc.)
        let infoParts = [];
        if (p.advert_name) infoParts.push(`Advert: ${p.advert_name}`);
        if (p.ctrl_subtype) infoParts.push(`Ctrl: ${p.ctrl_subtype}`);
        if (p.dest_hash && p.src_hash) infoParts.push(`${p.src_hash} -> ${p.dest_hash}`);
        if (infoParts.length === 0) infoParts.push(p.origin || p.observer || 'System');

        return `
          <div class="mirc-line mirc-dimmed" data-query="${escapeHtml(p.hash || String(p.id))}">
            <span class="mirc-time">[${timeStr}]</span> * <span class="mirc-type">${p.type_name}</span> [${scopeStr}] | <span class="mirc-msg">${escapeHtml(infoParts.join(' | '))}${countBadge}</span> | <span class="mirc-path">${pathSize}B path: ${pathStr}</span>
          </div>
        `;
      }
    }).join('');

    // Line Click Handler -> Open Win95 Notepad Popup
    pktLog.querySelectorAll('.mirc-line[data-query]').forEach(line => {
      rowClickToNotepad(line);
    });
  }

  function rowClickToNotepad(element) {
    element.addEventListener('click', async () => {
      const query = element.getAttribute('data-query');
      if (!query) return;

      notepadModal.classList.remove('hidden');
      notepadText.value = 'Ładowanie szczegółów pakietu w programie Notepad.exe...\n';

      try {
        const res = await fetch(`/api/packets/${encodeURIComponent(query)}`);
        const data = await res.json();
        const pkt = data.packet;
        const observations = data.observations || [];

        if (!pkt) {
          notepadText.value = 'BŁĄD: Nie znaleziono pakietu w bazie danych.';
          return;
        }

        let hopsStr = (pkt.resolved_hops || pkt.hops || []).join(' -> ');
        if (!hopsStr) hopsStr = 'Bezpośrednio (Direct)';

        let text = `=================================================================\n`;
        text += ` MESHCORE PACKET DETAILED ANALYSIS REPORT [Notepad.exe]\n`;
        text += `=================================================================\n\n`;
        text += `Typ Pakietu    : ${pkt.type_name || 'DATA'} (0x${(pkt.payload_type || 0).toString(16).toUpperCase()})\n`;
        text += `Hash Pakietu   : ${pkt.hash || '-'}\n`;
        text += `Czas Odbioru   : ${pkt.timestamp}\n`;
        text += `Scope / Region : ${pkt.scope_name || pkt.region || 'MESH'}\n`;
        text += `Obserwator     : ${pkt.observer || '-'}\n`;
        text += `Nadawca        : ${pkt.origin || '-'}\n`;
        text += `Rozmiar Bajtów : ${pkt.packet_size || Math.floor((pkt.raw_hex || '').length / 2)} B\n`;
        text += `Sygnał SNR/RSSI: ${pkt.snr != null ? pkt.snr + ' dB' : '-'} / ${pkt.rssi != null ? pkt.rssi + ' dBm' : '-'}\n`;
        text += `Rozmiar Ścieżki: ${pkt.path_byte_size || 1}-byte (${(pkt.hops || []).length} hopów)\n`;
        text += `Ścieżka Hopy   : ${hopsStr}\n\n`;

        if (pkt.channel_name || pkt.decrypted_txt) {
          text += `--- DESZYFROWANA WIADOMOŚĆ KANAŁU ---\n`;
          text += `Kanał          : ${pkt.channel_name || '-'}\n`;
          text += `Nadawca TXT    : ${pkt.sender || '-'}\n`;
          text += `Treść Wiadomości: ${pkt.decrypted_txt || '-'}\n\n`;
        }

        if (pkt.advert_name) {
          text += `--- DANE ADVERT / WĘZŁA ---\n`;
          text += `Nazwa Węzła    : ${pkt.advert_name}\n`;
          if (pkt.lat || pkt.lon) text += `Pozycja GPS    : ${pkt.lat}, ${pkt.lon}\n`;
          text += `\n`;
        }

        text += `--- STRUKTURA SUROWYCH BAJTÓW (RAW HEX DUMP) ---\n`;
        text += `${pkt.raw_hex || '-'}\n\n`;

        text += `--- ZzBADAJ ODKSZTAŁCENIE BAJTÓW NAGŁÓWKA ---\n`;
        text += `[00] Header Byte     : 0x${(pkt.raw_hex || '').slice(0, 2)}\n`;
        text += `[01] Path Specifier  : 0x${(pkt.raw_hex || '').slice(2, 4)}\n`;
        text += `[02+] Payload Data   : ${(pkt.raw_hex || '').slice(4)}\n\n`;

        if (observations.length > 1) {
          text += `--- OBSERWACJE WIELU OBSERWATORÓW (${observations.length}) ---\n`;
          observations.forEach((o, idx) => {
            text += `[#${idx + 1}] ${o.timestamp} | ${o.observer} | SNR: ${o.snr != null ? o.snr : '-'} dB | RSSI: ${o.rssi != null ? o.rssi : '-'} dBm\n`;
          });
        }

        notepadText.value = text;
      } catch (err) {
        notepadText.value = `BŁĄD POŁĄCZENIA: ${err.message}`;
      }
    });
  }

  function renderBrokers() {
    if (brokers.length === 0) {
      brokersList.innerHTML = `<p style="color:var(--win-text-muted);font-size:11px;">Brak połączonych serwerów MQTT.</p>`;
      return;
    }

    brokersList.innerHTML = brokers.map(b => `
      <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; padding:2px 4px; border:1px solid #808080; margin-bottom:2px;">
        <span><strong>${escapeHtml(b.broker)}</strong> (${escapeHtml(b.status)})</span>
        <button type="button" class="win-btn" data-id="${b.id}" style="padding:1px 4px; font-size:9px;">Usuń</button>
      </div>
    `).join('');

    brokersList.querySelectorAll('button[data-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 'remove_broker', id: btn.getAttribute('data-id') }));
        }
      });
    });
  }

  // --- Vis.js Topology Graph ---
  function initVisNetwork() {
    const container = document.getElementById('topologyNetwork');
    if (!container || network) return;

    const data = { nodes: visNodes, edges: visEdges };
    const options = {
      nodes: {
        shape: 'dot',
        size: 16,
        font: { color: '#000000', size: 11, face: 'Tahoma, sans-serif' },
        borderWidth: 2,
        shadow: false
      },
      edges: { smooth: { type: 'continuous' } },
      physics: {
        solver: 'barnesHut',
        barnesHut: { gravitationalConstant: -8000, centralGravity: 0.01, springLength: 150 }
      }
    };

    network = new vis.Network(container, data, options);
    updateVisTopology(topologyData);

    network.on('click', (params) => {
      if (params.nodes.length > 0) {
        displayNodeDetails(params.nodes[0]);
      }
    });
  }

  function updateVisTopology(topo) {
    if (!topo) return;
    const allNodes = topo.nodes || [];
    const allEdges = topo.edges || [];

    const nodeUpdates = allNodes.map(n => ({
      id: n.id,
      label: n.name || n.id,
      color: { background: '#c0c0c0', border: '#000080' }
    }));

    visNodes.update(nodeUpdates);

    const edgeUpdates = allEdges.map((e, idx) => ({
      id: `${e.source}_${e.target}_${idx}`,
      from: e.source,
      to: e.target,
      color: { color: '#008000' }
    }));

    visEdges.update(edgeUpdates);
  }

  function displayNodeDetails(nodeId) {
    const node = (topologyData.nodes || []).find(n => n.id === nodeId);
    if (!node) return;

    nodeInfoBox.innerHTML = `
      <div style="font-size: 11px;">
        <p><strong>ID Węzła:</strong> ${escapeHtml(node.id)}</p>
        <p><strong>Nazwa:</strong> ${escapeHtml(node.name || 'Unknown')}</p>
        <p><strong>Ostatnio widziany:</strong> ${formatTime(node.last_seen)}</p>
      </div>
    `;
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
