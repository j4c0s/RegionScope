(function () {
  'use strict';

  // --- Translations (PL/EN) ---
  const translations = {
    pl: {
      subtitle: 'Nasłuchiwanie MQTT & Analiza Ścieżek',
      statusConnecting: 'Łączenie z serwerem...',
      statusConnected: 'Połączono z serwerem WS',
      statusDisconnected: 'Rozłączono z serwerem WS',
      mqttServers: 'Serwery MQTT',
      statPackets: 'Wyświetlane pakiety',
      statRate: 'Aktywne Brokerzy MQTT',
      statLastPkt: 'Ostatni pakiet',
      liveTitle: 'Ostatnie Odebrane Pakiety Live',
      liveFeed: 'Na żywo (WebSockets)',
      colTime: 'Czas',
      colRegion: 'Region / Scope',
      colOrigin: 'Obserwator / Węzeł',
      colPathLen: 'Długość ścieżki',
      colHops: 'Repeatery w Ścieżce',
      colHash: 'Hash',
      colCount: 'Ilość',
      colHex: 'Raw Hex',
      groupByHash: 'Grupuj po hashu',
      emptyTitle: 'Oczekiwanie na pakiety MeshCore...',
      emptyDesc: 'Gdy w sieci MQTT pojawią się pakiety, zostaną automatycznie wyświetlone na tej liście.',
      modalTitle: 'Konfiguracja Serwerów MQTT',
      labelHost: 'Adres serwera (Host / IP)',
      labelPort: 'Port',
      labelUser: 'Użytkownik (opcjonalnie)',
      labelPass: 'Hasło (opcjonalnie)',
      labelTopic: 'Temat MQTT (Topic)',
      btnAddServer: 'Połącz i Dodaj Serwer',
      connectedServersTitle: 'Aktywne Połączenia MQTT',
      noHops: 'Brak repeaterów (Bezpośrednio)',
      bytesCount: 'bajt',
      bytesCountPlural: 'bajty',
      btnPause: 'Pauza',
      btnResume: 'Wznów',
      btnRemove: 'Usuń',
    },
    en: {
      subtitle: 'MQTT Listening & Path Analysis',
      statusConnecting: 'Connecting to server...',
      statusConnected: 'WS Server Connected',
      statusDisconnected: 'WS Server Disconnected',
      mqttServers: 'MQTT Servers',
      statPackets: 'Displayed Packets',
      statRate: 'Active MQTT Brokers',
      statLastPkt: 'Last Packet',
      liveTitle: 'Latest Received Live Packets',
      liveFeed: 'Live (WebSockets)',
      colTime: 'Time',
      colRegion: 'Region / Scope',
      colOrigin: 'Observer / Node',
      colPathLen: 'Path Length',
      colHops: 'Path Repeaters',
      colHash: 'Hash',
      colCount: 'Count',
      colHex: 'Raw Hex',
      groupByHash: 'Group by Hash',
      emptyTitle: 'Waiting for MeshCore packets...',
      emptyDesc: 'When packets appear in the MQTT network, they will automatically be displayed here.',
      modalTitle: 'MQTT Servers Configuration',
      labelHost: 'Server Host / IP',
      labelPort: 'Port',
      labelUser: 'Username (optional)',
      labelPass: 'Password (optional)',
      labelTopic: 'MQTT Topic',
      btnAddServer: 'Connect & Add Server',
      connectedServersTitle: 'Active MQTT Connections',
      noHops: 'No repeaters (Direct)',
      bytesCount: 'byte',
      bytesCountPlural: 'bytes',
      btnPause: 'Pause',
      btnResume: 'Resume',
      btnRemove: 'Delete',
    }
  };

  let currentLang = localStorage.getItem('mc_analyzer_lang') || 'pl';
  let isGroupedByHash = localStorage.getItem('mc_group_by_hash') === 'true';

  let rawPackets = []; // All raw incoming packets
  let brokers = [];
  let ws = null;

  // DOM Elements
  const statusBadge = document.getElementById('statusBadge');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const langPlBtn = document.getElementById('langPlBtn');
  const langEnBtn = document.getElementById('langEnBtn');
  const openBrokersModalBtn = document.getElementById('openBrokersModalBtn');
  const closeBrokersModalBtn = document.getElementById('closeBrokersModalBtn');
  const brokersModal = document.getElementById('brokersModal');
  const addBrokerForm = document.getElementById('addBrokerForm');
  const brokersList = document.getElementById('brokersList');
  const brokerCountBadge = document.getElementById('brokerCountBadge');
  const packetCountVal = document.getElementById('packetCountVal');
  const activeBrokersVal = document.getElementById('activeBrokersVal');
  const lastPktTimeVal = document.getElementById('lastPktTimeVal');
  const packetTableBody = document.getElementById('packetTableBody');
  const emptyState = document.getElementById('emptyState');
  const groupByHashToggle = document.getElementById('groupByHashToggle');
  const thCount = document.getElementById('thCount');

  groupByHashToggle.checked = isGroupedByHash;
  if (isGroupedByHash) {
    thCount.classList.remove('hidden');
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

  // --- i18n ---
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

  // --- Modal Logic ---
  openBrokersModalBtn.addEventListener('click', () => brokersModal.classList.remove('hidden'));
  closeBrokersModalBtn.addEventListener('click', () => brokersModal.classList.add('hidden'));
  brokersModal.addEventListener('click', (e) => {
    if (e.target === brokersModal) brokersModal.classList.add('hidden');
  });

  addBrokerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const host = document.getElementById('inputHost').value.trim();
    const port = document.getElementById('inputPort').value.trim();
    const user = document.getElementById('inputUser').value.trim();
    const pass = document.getElementById('inputPass').value.trim();
    const topic = document.getElementById('inputTopic').value.trim();

    if (!host) return;

    const payload = {
      action: 'add_broker',
      host: host,
      port: port,
      username: user,
      password: pass,
      topic: topic
    };

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }

    addBrokerForm.reset();
    document.getElementById('inputPort').value = '1883';
    document.getElementById('inputTopic').value = 'meshcore/#';
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

  // --- WebSocket Connection ---
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
        } else if (msg.type === 'packet' && msg.packet) {
          handleIncomingPacket(msg.packet);
        } else if (msg.type === 'brokers' && msg.brokers) {
          brokers = msg.brokers || [];
          renderBrokers();
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
    if (rawPackets.length > 200) { // Keep last 200 raw packets for grouping
      rawPackets.pop();
    }

    renderPackets(pkt.hash || pkt.timestamp);
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

    packetCountVal.textContent = `${displayList.length} / 20`;

    if (displayList.length === 0) {
      emptyState.classList.remove('hidden');
      packetTableBody.innerHTML = '';
      lastPktTimeVal.textContent = '-';
      return;
    }

    emptyState.classList.add('hidden');

    const firstPkt = displayList[0];
    if (firstPkt) {
      const timeStr = formatTime(firstPkt.timestamp);
      lastPktTimeVal.textContent = timeStr;
    }

    packetTableBody.innerHTML = displayList.map(p => {
      const isNew = (p.hash && p.hash === newPktId) || p.timestamp === newPktId;
      const pathBadgeClass = `badge-path-${p.path_byte_size || 1}`;

      let hopsHtml = '';
      if (p.hops && p.hops.length > 0) {
        const hopTags = p.hops.map(h => `<span class="hop-tag">${escapeHtml(h)}</span>`).join('<span class="hop-arrow">&rarr;</span>');
        hopsHtml = `<div class="hops-list">${hopTags}</div>`;
      } else {
        hopsHtml = `<span style="color:var(--text-muted);font-size:12px;">${t.noHops}</span>`;
      }

      const countCol = isGroupedByHash ? `<td><span class="badge-count-occurrences">x${p.count || 1}</span></td>` : '';

      return `
        <tr class="packet-row ${isNew ? 'new-entry' : ''}">
          <td class="code-font">${formatTime(p.timestamp)}</td>
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

  function renderBrokers() {
    const t = translations[currentLang];
    activeBrokersVal.textContent = brokers.filter(b => b.status === 'connected').length;
    brokerCountBadge.textContent = brokers.length;

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
