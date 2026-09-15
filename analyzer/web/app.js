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
      colTime: 'Czas',
      colType: 'Typ Pakietu',
      colRegion: 'Scope',
      colOrigin: 'Obserwator / Nadawca',
      colPathLen: 'Długość ścieżki',
      colHops: 'Repeatery w Ścieżce',
      colHash: 'Hash',
      colCount: 'Ilość',
      colHex: 'Raw Hex',
      liveTitle: 'Ostatnie Odebrane Pakiety Live',
      liveFeed: 'Na żywo (WebSockets)',
      emptyTitle: 'Oczekiwanie na pakiety MeshCore...',
      emptyDesc: 'Gdy w sieci MQTT pojawią się pakiety, zostaną automatycznie wyświetlone na tej liście.',
      nodeInfoTitle: 'Informacje o Węźle',
      nodeInfoPlaceholder: 'Kliknij węzeł na mapie, aby zobaczyć jego właściwości.',
      legendAdvert: 'Węzeł z Advertu',
      legendHop: 'Węzeł ze Ścieżki',
      legendFresh: '< 5 min',
      legendStale: '> 1 godz.',
      settingsTitle: 'Ustawienia i Konfiguracja',
      groupByHash: 'Grupuj pakiety live po hashu',
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
      noHops: 'Brak repeaterów (Bezpośrednio)',
      btnPause: 'Pauza',
      btnResume: 'Wznów',
      btnRemove: 'Usuń',
      confirmClear: 'Czy na pewno chcesz usunąć wszystkie dane z bazy danych?',
      supportedPathSizes: 'Obsługiwane prefiksy ścieżki',
      supportedRegions: 'Obsługiwane Scope',
      lastSeen: 'Ostatnio widziany',
      locationTitle: 'Lokalizacja GPS',
      noLocation: 'Brak danych GPS',
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
      colTime: 'Time',
      colType: 'Packet Type',
      colRegion: 'Region',
      colOrigin: 'Observer / Sender',
      colPathLen: 'Path Length',
      colHops: 'Path Repeaters',
      colHash: 'Hash',
      colCount: 'Count',
      colHex: 'Raw Hex',
      liveTitle: 'Latest Received Live Packets',
      liveFeed: 'Live (WebSockets)',
      emptyTitle: 'Waiting for MeshCore packets...',
      emptyDesc: 'When packets appear in the MQTT network, they will automatically be displayed here.',
      nodeInfoTitle: 'Node Information',
      nodeInfoPlaceholder: 'Click a node on the map to view its attributes.',
      legendAdvert: 'Known Advert Node',
      legendHop: 'Hop Node',
      legendFresh: '< 5 min',
      legendStale: '> 1 hour',
      settingsTitle: 'Settings & Configuration',
      groupByHash: 'Group live packets by hash',
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
      noHops: 'No repeaters (Direct)',
      btnPause: 'Pause',
      btnResume: 'Resume',
      btnRemove: 'Delete',
      confirmClear: 'Are you sure you want to clear all topology and packet database records?',
      supportedPathSizes: 'Supported Path Prefixes',
      supportedRegions: 'Supported Regions (Scope)',
      lastSeen: 'Last Seen',
      locationTitle: 'GPS Location',
      noLocation: 'No GPS data',
      neighborsTitle: 'Neighbor Nodes (Connections)',
      noNeighbors: 'No registered neighbors',
    }
  };

  let currentLang = localStorage.getItem('mc_analyzer_lang') || 'pl';
  let isGroupedByHash = localStorage.getItem('mc_group_by_hash') === 'true';

  let rawPackets = [];
  let brokers = [];
  let topologyData = { nodes: [], edges: [] };
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
  const groupByHashToggle = document.getElementById('groupByHashToggle');
  const thCount = document.getElementById('thCount');
  const packetTableBody = document.getElementById('packetTableBody');
  const emptyState = document.getElementById('emptyState');
  const nodeInfoBox = document.getElementById('nodeInfoBox');

  groupByHashToggle.checked = isGroupedByHash;
  if (isGroupedByHash) {
    thCount.classList.remove('hidden');
  }

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

  groupByHashToggle.addEventListener('change', (e) => {
    isGroupedByHash = e.target.checked;
    localStorage.setItem('mc_group_by_hash', isGroupedByHash);
    if (isGroupedByHash) {
      thCount.classList.remove('hidden');
    } else {
      thCount.classList.add('hidden');
    }
    renderPackets();
  });

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

    if (lang === 'pl') {
      langPlBtn.classList.add('active');
      langEnBtn.classList.remove('active');
    } else {
      langEnBtn.classList.add('active');
      langPlBtn.classList.remove('active');
    }

    renderPackets();
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

  function removeBroker(id) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'remove_broker', id: id }));
    }
  }

  function toggleBroker(id, enabled) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'toggle_broker', id: id, enabled: enabled }));
    }
  }

  // --- WebSocket Setup ---
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    updateStatus('connecting');

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      updateStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'init') {
          if (msg.brokers) {
            brokers = msg.brokers || [];
            renderBrokers();
          }
          if (msg.packets && msg.packets.length > 0) {
            rawPackets = msg.packets.reverse();
            renderPackets();
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
        } else if (msg.type === 'brokers' && msg.brokers) {
          brokers = msg.brokers || [];
          renderBrokers();
        } else if (msg.type === 'cleared') {
          rawPackets = [];
          topologyData = { nodes: [], edges: [] };
          renderPackets();
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
    rawPackets.unshift(pkt);
    if (rawPackets.length > 200) {
      rawPackets.pop();
    }
    renderPackets(pkt.hash || pkt.timestamp);
    animatePacketPath(pkt);
  }

  function getGroupedPackets() {
    const map = new Map();

    for (const p of rawPackets) {
      const key = p.hash || p.raw_hex || p.timestamp;
      if (map.has(key)) {
        const existing = map.get(key);
        existing.count += (p.count || 1);
        if (p.timestamp > existing.timestamp) {
          existing.timestamp = p.timestamp;
          if (p.region) existing.region = p.region;
          if (p.origin) existing.origin = p.origin;
        }
      } else {
        map.set(key, { ...p, count: p.count || 1 });
      }
    }

    const grouped = Array.from(map.values()).sort((a, b) => {
      return (b.timestamp || '').localeCompare(a.timestamp || '');
    });

    return grouped.slice(0, 20);
  }

  // --- Render Functions ---
  function renderPackets(newPktId) {
    const t = translations[currentLang];
    let displayList = isGroupedByHash ? getGroupedPackets() : rawPackets.slice(0, 20);

    if (displayList.length === 0) {
      emptyState.classList.remove('hidden');
      packetTableBody.innerHTML = '';
      return;
    }

    emptyState.classList.add('hidden');

    packetTableBody.innerHTML = displayList.map(p => {
      const isNew = (p.hash && p.hash === newPktId) || p.timestamp === newPktId;
      const pathBadgeClass = `badge-path-${p.path_byte_size || 1}`;

      let hopsHtml = '';
      const hopsList = p.resolved_hops && p.resolved_hops.length > 0 ? p.resolved_hops : p.hops;

      if (hopsList && hopsList.length > 0) {
        const hopTags = hopsList.map(h => `<span class="hop-tag">${escapeHtml(h)}</span>`).join('<span class="hop-arrow">&rarr;</span>');
        hopsHtml = `<div class="hops-list">${hopTags}</div>`;
      } else {
        hopsHtml = `<span style="color:var(--text-muted);font-size:12px;">${t.noHops}</span>`;
      }

      const countCol = isGroupedByHash ? `<td><span class="badge-count-occurrences">x${p.count || 1}</span></td>` : '';
      const typeBadgeClass = getTypeBadgeClass(p.type_name);

      return `
        <tr class="packet-row ${isNew ? 'new-entry' : ''}">
          <td class="code-font">${formatTime(p.timestamp)}</td>
          <td><span class="badge-type ${typeBadgeClass}">${escapeHtml(p.type_name || 'DATA')}</span></td>
          <td><span class="badge-region">${escapeHtml(p.region || 'MESH')}</span></td>
          <td style="font-weight: 500;">${escapeHtml(p.origin || p.observer || 'Unknown')}</td>
          <td>
            <span class="${pathBadgeClass}">
              ${p.path_byte_size || 1}-byte (${p.hops ? p.hops.length : 0})
            </span>
          </td>
          <td>${hopsHtml}</td>
          <td class="code-font" style="color:var(--accent-blue);">${escapeHtml(p.hash || '-')}</td>
          ${countCol}
          <td class="code-font" style="font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(p.raw_hex || '')}">
            ${escapeHtml(p.raw_hex || '-')}
          </td>
        </tr>
      `;
    }).join('');
  }

  function getTypeBadgeClass(typeName) {
    if (!typeName) return 'type-data';
    if (typeName.includes('ADVERT')) return 'type-advert';
    if (typeName.includes('ACK')) return 'type-ack';
    if (typeName.includes('GRP') || typeName.includes('TXT')) return 'type-txt';
    if (typeName.includes('LOCATION')) return 'type-location';
    return 'type-data';
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
        removeBroker(btn.getAttribute('data-id'));
      });
    });

    brokersList.querySelectorAll('[data-toggle-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-toggle-id');
        const nextState = btn.getAttribute('data-enabled') === 'true';
        toggleBroker(id, nextState);
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
          gravitationalConstant: -18000, // Very strong repulsion for loose layout
          centralGravity: 0.02,         // Loose central gravity to let graph spread far
          springLength: 220,           // Long elastic edge distance
          springConstant: 0.02,
          damping: 0.09
        },
        maxVelocity: 100,
        minVelocity: 0.5,
        stabilization: {
          enabled: true,
          iterations: 150
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
        displayNodeDetails(nodeId);
      }
    });
  }

  function updateVisTopology(topo) {
    if (!topo) return;

    const gpsNodes = (topo.nodes || []).filter(n => n.lat && n.lon && (n.lat !== 0 || n.lon !== 0));
    let centerLat = 0, centerLon = 0;
    let scale = 15000;

    if (gpsNodes.length > 0) {
      let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
      gpsNodes.forEach(n => {
        if (n.lat < minLat) minLat = n.lat;
        if (n.lat > maxLat) maxLat = n.lat;
        if (n.lon < minLon) minLon = n.lon;
        if (n.lon > maxLon) maxLon = n.lon;
      });
      centerLat = (minLat + maxLat) / 2;
      centerLon = (minLon + maxLon) / 2;
      const latSpan = maxLat - minLat;
      const lonSpan = maxLon - minLon;
      const maxSpan = Math.max(latSpan, lonSpan);
      if (maxSpan > 0) {
        scale = Math.max(10000, 600 / maxSpan);
      }
    }

    const nodeUpdates = [];
    (topo.nodes || []).forEach(n => {
      const isAdvert = n.name && !n.name.startsWith('Node ');
      const nodeColor = isAdvert ? '#38bdf8' : '#a855f7';
      const labelText = isAdvert ? `[${n.name}]\n${n.id}` : n.id;

      const nodeObj = {
        id: n.id,
        label: labelText,
        color: {
          background: isAdvert ? 'rgba(56, 189, 248, 0.25)' : 'rgba(168, 85, 247, 0.25)',
          border: nodeColor,
          highlight: { background: nodeColor, border: '#ffffff' }
        },
        title: `Node ID: ${n.id}\nName: ${n.name || 'Unknown'}\nLast Seen: ${formatTime(n.last_seen)}`
      };

      if (n.lat && n.lon && (n.lat !== 0 || n.lon !== 0)) {
        nodeObj.x = (n.lon - centerLon) * scale;
        nodeObj.y = -(n.lat - centerLat) * scale;
      }

      nodeUpdates.push(nodeObj);
    });

    // Merge bidirectional edges (A -> B and B -> A) into single elastic edge with double arrows
    const edgeMap = new Map();
    (topo.edges || []).forEach(e => {
      if (!e.source || !e.target) return;
      const sortedPair = [e.source, e.target].sort().join('<->');

      if (edgeMap.has(sortedPair)) {
        const existing = edgeMap.get(sortedPair);
        existing.traffic += e.traffic_count;
        existing.isBidirectional = true;
        if (e.last_seen > existing.last_seen) {
          existing.last_seen = e.last_seen;
        }
      } else {
        edgeMap.set(sortedPair, {
          id: sortedPair,
          source: e.source,
          target: e.target,
          traffic: e.traffic_count,
          last_seen: e.last_seen,
          isBidirectional: false
        });
      }
    });

    const edgeUpdates = [];
    edgeMap.forEach(e => {
      const width = Math.min(1.5 + Math.log2(e.traffic || 1), 7);
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
        title: `Relacja: ${e.source} ${e.isBidirectional ? '↔' : '→'} ${e.target}\nPakiety: ${e.traffic}\nOstatnia aktywność: ${formatTime(e.last_seen)}`
      });
    });

    visNodes.update(nodeUpdates);
    visEdges.update(edgeUpdates);
  }

  function animatePacketPath(pkt) {
    if (!network || !pkt || !pkt.resolved_hops || pkt.resolved_hops.length < 2) return;
    const hops = pkt.resolved_hops;

    for (let i = 0; i < hops.length - 1; i++) {
      const sortedPair = [hops[i], hops[i+1]].sort().join('<->');
      const edge = visEdges.get(sortedPair);
      if (edge) {
        visEdges.update({ id: sortedPair, color: { color: '#f59e0b' }, width: (edge.width || 2) + 2 });
        setTimeout(() => {
          if (visEdges.get(sortedPair)) {
            visEdges.update({ id: sortedPair, color: { color: edge.color.color }, width: edge.width });
          }
        }, 1500);
      }
    }
  }

  function displayNodeDetails(nodeId) {
    const t = translations[currentLang];
    const node = (topologyData.nodes || []).find(n => n.id === nodeId);
    if (!node) return;

    const pathSizesText = (node.path_sizes || [2]).map(s => `${s}-byte`).join(', ');
    const scopesText = (node.scopes || []).join(', ') || 'Global / MESH';

    // Find all neighbor nodes connected via topology edges
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

    nodeInfoBox.innerHTML = `
      <div class="node-detail-card">
        <h4 class="code-font" style="color:var(--accent-blue);">${escapeHtml(node.id)}</h4>
        <p style="font-weight: 600; font-size: 15px; margin-bottom: 8px;">${escapeHtml(node.name || 'Unknown Repeater')}</p>

        <div class="detail-field">
          <span class="detail-label">${t.supportedPathSizes}:</span>
          <span class="badge-path-2">${escapeHtml(pathSizesText)}</span>
        </div>

        <div class="detail-field">
          <span class="detail-label">${t.supportedRegions}:</span>
          <span class="badge-region">${escapeHtml(scopesText)}</span>
        </div>

        <div class="detail-field">
          <span class="detail-label">${t.lastSeen}:</span>
          <span class="code-font">${formatTime(node.last_seen)}</span>
        </div>

        <div class="detail-field">
          <span class="detail-label">${t.locationTitle}:</span>
          <span class="code-font">${(node.lat && node.lon && (node.lat !== 0 || node.lon !== 0)) ? `${node.lat.toFixed(6)}, ${node.lon.toFixed(6)}` : t.noLocation}</span>
        </div>

        <div class="detail-field" style="margin-top: 12px; border-top: 1px solid var(--border-color); padding-top: 10px;">
          <span class="detail-label" style="font-weight: 600;">${t.neighborsTitle} (${neighborIds.size}):</span>
          ${neighborsHtml}
        </div>
      </div>
    `;
  }

  function isEdgeFresh(lastSeenIso) {
    if (!lastSeenIso) return false;
    try {
      const diffMs = Date.now() - new Date(lastSeenIso).getTime();
      return diffMs < 5 * 60 * 1000; // 5 minutes
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

  // --- Initial Start ---
  applyLanguage(currentLang);
  connectWebSocket();
})();
