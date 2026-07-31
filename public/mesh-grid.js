/* === CoreScope — mesh-grid.js === */
'use strict';

(function () {
  // Dual-language dictionary
  const L10N = {
    en: {
      title: "Mesh Grid Analyzer",
      subtitle: "Interactive network topology, paths, and scope region analyzer",
      mode: "Visualization Mode:",
      modeRegion: "Region-based (Scope Bubbles)",
      modeNeighbor: "Pure Neighbors",
      options: "Options:",
      toggle1b: "Resolve 1-byte hops (Method A)",
      legend: "Legend:",
      legendHops: "Link weight (Relay count)",
      selectNode: "Select a node to view its detailed topographics",
      nodeDetails: "Node Details",
      scopesCarried: "Transported Scopes",
      noScopes: "No scopes transported",
      hopCountBreakdown: "Relay Hop Count Breakdown",
      packets: "packets",
      cityRegion: "City/Region",
      lastSeen: "Last Seen",
      firstSeen: "First Seen",
      copyUrl: "Copy URL",
      copyShortUrl: "Copy Short URL",
      copied: "Copied!",
      errorLoad: "Failed to load mesh-grid data: ",
      loading: "Loading mesh-grid data…",
      noHopsBreakdown: "No hop breakdown data",
      searchPlaceholder: "Search node by name or key…",
      clearSearch: "Clear",
      showAll: "Details",
      close: "Close"
    },
    pl: {
      title: "Analizator Siatki Mesh",
      subtitle: "Interaktywny analizator topologii sieci, ścieżek oraz regionów scope",
      mode: "Tryb wizualizacji:",
      modeRegion: "Oparty o regiony (Bańki Scope)",
      modeNeighbor: "Czysto Sąsiedzki",
      options: "Opcje:",
      toggle1b: "Rozwiązuj skoki 1-bajtowe (Metoda A)",
      legend: "Legenda:",
      legendHops: "Obciążenie łącza (Liczba relayów)",
      selectNode: "Wybierz węzeł, aby zobaczyć jego szczegóły topograficzne",
      nodeDetails: "Szczegóły Węzła",
      scopesCarried: "Wiadomości ze scope",
      noScopes: "Brak obsłużonych scope",
      hopCountBreakdown: "Rozkład liczby skoków (hop)",
      packets: "pakietów",
      cityRegion: "Miasto/Region",
      lastSeen: "Ostatnio widziany",
      firstSeen: "Pierwszy raz widziany",
      copyUrl: "Kopiuj URL",
      copyShortUrl: "Kopiuj krótki URL",
      copied: "Skopiowano!",
      errorLoad: "Błąd ładowania danych siatki: ",
      loading: "Ładowanie danych siatki…",
      noHopsBreakdown: "Brak danych o skokach",
      searchPlaceholder: "Szukaj węzła po nazwie lub kluczu…",
      clearSearch: "Wyczyść",
      showAll: "Szczegóły",
      close: "Zamknij"
    }
  };

  let lang = localStorage.getItem('meshcore-grid-lang') || 'pl';
  if (lang !== 'pl' && lang !== 'en') lang = 'pl';

  let _allNodes = [];
  let _neighborGraphData = null;
  let _canvasState = null;
  let _selectedNode = null;
  let _searchQuery = '';
  let _resolve1Byte = localStorage.getItem('meshcore-grid-resolve1b') !== 'false';

  function t(key) {
    return (L10N[lang] && L10N[lang][key]) || L10N['en'][key] || key;
  }

  function toggleLanguage() {
    lang = lang === 'pl' ? 'en' : 'pl';
    localStorage.setItem('meshcore-grid-lang', lang);
    const app = document.getElementById('app');
    if (app && currentPage === 'mesh-grid') {
      const state = captureCanvasState();
      renderLayout(app);
      restoreCanvasState(state);
      renderDetailPanel();
    }
  }

  function captureCanvasState() {
    if (!_canvasState) return null;
    return {
      zoom: _canvasState.zoom,
      panX: _canvasState.panX,
      panY: _canvasState.panY,
      cooling: _canvasState.cooling,
      mode: _canvasState.mode,
      nodes: _canvasState.nodes.map(n => ({ pubkey: n.pubkey, x: n.x, y: n.y, vx: n.vx, vy: n.vy }))
    };
  }

  function restoreCanvasState(state) {
    if (!state || !_canvasState) return;
    _canvasState.zoom = state.zoom;
    _canvasState.panX = state.panX;
    _canvasState.panY = state.panY;
    _canvasState.cooling = state.cooling;
    _canvasState.mode = state.mode;
    const modeSelect = document.getElementById('gridModeSelect');
    if (modeSelect) modeSelect.value = state.mode;
    state.nodes.forEach(sn => {
      const match = _canvasState.nodes.find(n => n.pubkey === sn.pubkey);
      if (match) {
        match.x = sn.x;
        match.y = sn.y;
        match.vx = sn.vx;
        match.vy = sn.vy;
      }
    });
  }

  async function init(app, routeParam) {
    app.innerHTML = `<div class="text-center text-muted" style="padding:40px">${t('loading')}</div>`;

    try {
      const rq = RegionFilter.regionQueryString() + AreaFilter.areaQueryString();
      const [nodesResp, graphData] = await Promise.all([
        fetchAllNodes('&sortBy=lastSeen' + rq, { ttl: CLIENT_TTL.nodeList }),
        api('/analytics/neighbor-graph?min_count=1&min_score=0' + rq, { ttl: CLIENT_TTL.analyticsRF }).catch(() => ({ nodes: [], edges: [] }))
      ]);

      _allNodes = nodesResp.nodes || nodesResp;
      _neighborGraphData = graphData;

      renderLayout(app);
      initGraphState();

      if (routeParam) {
        const found = _allNodes.find(n => n.public_key === routeParam || n.public_key.slice(0, 8) === routeParam);
        if (found) {
          _selectedNode = found;
          renderDetailPanel();
        }
      }
    } catch (e) {
      app.innerHTML = `<div class="text-muted" role="alert" style="padding:40px">${t('errorLoad')}${escapeHtml(e.message)}</div>`;
    }
  }

  function renderLayout(container) {
    container.innerHTML = `
      <div class="mesh-grid-page">
        <div class="mesh-grid-sidebar">
          <div class="mesh-grid-header-actions">
            <h2>${t('title')}</h2>
            <button class="btn btn-primary" id="gridLangToggle" style="font-size: 11px; padding: 2px 6px;">PL / EN</button>
          </div>
          <p class="text-muted" style="font-size:12px; margin-bottom: 12px;">${t('subtitle')}</p>

          <div class="grid-controls-card">
            <label style="font-weight:600; font-size:12px;">${t('mode')}</label>
            <select id="gridModeSelect" class="grid-mode-select">
              <option value="region">${t('modeRegion')}</option>
              <option value="neighbor">${t('modeNeighbor')}</option>
            </select>

            <div style="margin-top:12px;">
              <label style="font-weight:600; font-size:12px; display:block; margin-bottom:4px;">${t('options')}</label>
              <label style="font-size:12px; display:inline-flex; align-items:center; gap:6px; cursor:pointer;">
                <input type="checkbox" id="gridResolve1b" ${_resolve1Byte ? 'checked' : ''}> ${t('toggle1b')}
              </label>
            </div>

            <div style="margin-top:12px;">
              <input type="text" id="gridSearchInput" class="grid-search-input" placeholder="${t('searchPlaceholder')}" value="${escapeHtml(_searchQuery)}">
            </div>
          </div>

          <div class="grid-controls-card" style="margin-top: 12px;">
            <label style="font-weight:600; font-size:12px;">${t('legend')}</label>
            <div style="font-size:11px; margin-top:4px; display:flex; flex-direction:column; gap:4px;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:var(--mc-role-repeater, #D55E00)"></span>
                <span>Repeater</span>
              </div>
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:var(--mc-role-companion, #56B4E9)"></span>
                <span>Companion</span>
              </div>
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:var(--mc-role-room, #009E73)"></span>
                <span>Room Server</span>
              </div>
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="display:inline-block; width:12px; height:12px; border-radius:2px; background:transparent; border: 2px dashed rgba(255, 100, 0, 0.4); width: 24px; height: 1px; vertical-align: middle;"></span>
                <span>${t('legendHops')}</span>
              </div>
            </div>
          </div>

          <div id="gridDetailPanel" class="grid-detail-panel" style="margin-top:12px;">
            <!-- Rendered dynamically -->
          </div>
        </div>

        <div class="mesh-grid-view">
          <canvas id="meshGridCanvas" style="cursor:grab; outline:none; background:var(--content-bg, #0f0f23); width:100%; height:100%;"></canvas>
          <div id="gridCanvasTooltip" class="grid-canvas-tooltip" style="display:none; position:absolute; z-index:99; background:var(--surface-1,#1a1a2e); border:1px solid var(--border); padding:6px 10px; border-radius:4px; font-size:12px; pointer-events:none;"></div>
        </div>
      </div>
    `;

    document.getElementById('gridLangToggle').addEventListener('click', toggleLanguage);
    document.getElementById('gridModeSelect').addEventListener('change', e => {
      if (_canvasState) {
        _canvasState.mode = e.target.value;
        _canvasState.cooling = 1.0;
      }
    });

    document.getElementById('gridResolve1b').addEventListener('change', e => {
      _resolve1Byte = e.target.checked;
      localStorage.setItem('meshcore-grid-resolve1b', _resolve1Byte);
      const state = captureCanvasState();
      initGraphState();
      restoreCanvasState(state);
    });

    document.getElementById('gridSearchInput').addEventListener('input', e => {
      _searchQuery = e.target.value;
      _canvasState.cooling = 1.0;
    });

    renderDetailPanel();
  }

  function initGraphState() {
    const canvas = document.getElementById('meshGridCanvas');
    if (!canvas) return;

    // Filter node directories and build connections
    const repeatersAndRooms = _allNodes.filter(n => n.role === 'repeater' || n.role === 'room');
    const nodes = _allNodes.map(n => {
      const role = (n.role || 'unknown').toLowerCase();
      let radius = 6;
      if (role === 'repeater') radius = 10;
      else if (role === 'room') radius = 9;
      return {
        pubkey: n.public_key,
        name: n.name || n.public_key.slice(0, 12),
        role: n.role || 'unknown',
        radius: radius,
        x: 450 + (Math.random() - 0.5) * 500,
        y: 300 + (Math.random() - 0.5) * 400,
        vx: 0,
        vy: 0,
        nodeRef: n
      };
    });

    const nodeIdx = {};
    nodes.forEach((n, i) => { nodeIdx[n.pubkey] = i; });

    // Build edges from neighbor-graph edges AND path hops (with 1-byte resolution)
    const edgesMap = new Map();
    const addEdge = (source, target, weight, score, ambiguous) => {
      const sLower = source.toLowerCase();
      const tLower = target.toLowerCase();
      if (sLower === tLower) return;
      const key = sLower < tLower ? `${sLower}-${tLower}` : `${tLower}-${sLower}`;
      if (edgesMap.has(key)) {
        const e = edgesMap.get(key);
        e.weight = Math.max(e.weight, weight);
        e.score = Math.max(e.score, score);
        if (!ambiguous) e.ambiguous = false;
      } else {
        edgesMap.set(key, { source: sLower, target: tLower, weight, score, ambiguous: !!ambiguous });
      }
    };

    // 1. Existing neighbors
    if (_neighborGraphData && Array.isArray(_neighborGraphData.edges)) {
      _neighborGraphData.edges.forEach(e => {
        if (nodeIdx[e.source] !== undefined && nodeIdx[e.target] !== undefined) {
          // Check resolve 1-byte config: if resolve is off, skip any ambiguous (1-byte) edges
          if (!_resolve1Byte && e.ambiguous) return;
          addEdge(e.source, e.target, e.weight || 1, e.score || 0.5, e.ambiguous);
        }
      });
    }

    // 2. Derive extra path connections dynamically
    _allNodes.forEach(n => {
      if (n.transported_scopes && n.last_relayed) {
        // Find links terminating or transiting through n. We can add lightweight edge weights
        // based on the path logs
      }
    });

    const edges = Array.from(edgesMap.values()).filter(e => nodeIdx[e.source] !== undefined && nodeIdx[e.target] !== undefined);

    // Compute scope regions ("bańki")
    // Each unique scope gets a center coordinates and grouping radius
    const scopes = {};
    _allNodes.forEach(n => {
      if (Array.isArray(n.transported_scopes)) {
        n.transported_scopes.forEach(sc => {
          if (!scopes[sc]) {
            scopes[sc] = {
              name: sc,
              x: 450 + (Math.random() - 0.5) * 300,
              y: 300 + (Math.random() - 0.5) * 300,
              nodes: []
            };
          }
          scopes[sc].nodes.push(n.public_key);
        });
      }
    });

    _canvasState = {
      nodes,
      edges,
      nodeIdx,
      scopes: Object.values(scopes),
      zoom: 1,
      panX: 0,
      panY: 0,
      dragging: null,
      panning: false,
      hoverNode: null,
      lastMouseX: 0,
      lastMouseY: 0,
      cooling: 1.0,
      animId: null,
      mode: document.getElementById('gridModeSelect')?.value || 'region'
    };

    bindCanvasEvents(canvas);
    startRenderer(canvas);
  }

  function bindCanvasEvents(canvas) {
    function getMousePos(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left - _canvasState.panX) / _canvasState.zoom,
        y: (e.clientY - rect.top - _canvasState.panY) / _canvasState.zoom
      };
    }

    canvas.addEventListener('mousedown', e => {
      const pos = getMousePos(e);
      let foundNode = null;
      for (let i = _canvasState.nodes.length - 1; i >= 0; i--) {
        const n = _canvasState.nodes[i];
        const dx = pos.x - n.x;
        const dy = pos.y - n.y;
        if (dx*dx + dy*dy <= n.radius*n.radius) {
          foundNode = n;
          break;
        }
      }

      if (foundNode) {
        _canvasState.dragging = foundNode;
        foundNode._pinned = true;
        canvas.style.cursor = 'grabbing';
      } else {
        _canvasState.panning = true;
        canvas.style.cursor = 'grabbing';
      }
      _canvasState.lastMouseX = e.clientX;
      _canvasState.lastMouseY = e.clientY;
    });

    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      if (_canvasState.dragging) {
        const dx = (e.clientX - _canvasState.lastMouseX) / _canvasState.zoom;
        const dy = (e.clientY - _canvasState.lastMouseY) / _canvasState.zoom;
        _canvasState.dragging.x += dx;
        _canvasState.dragging.y += dy;
        _canvasState.lastMouseX = e.clientX;
        _canvasState.lastMouseY = e.clientY;
        _canvasState.cooling = Math.max(_canvasState.cooling, 0.4);
      } else if (_canvasState.panning) {
        _canvasState.panX += e.clientX - _canvasState.lastMouseX;
        _canvasState.panY += e.clientY - _canvasState.lastMouseY;
        _canvasState.lastMouseX = e.clientX;
        _canvasState.lastMouseY = e.clientY;
      } else {
        const pos = getMousePos(e);
        let foundNode = null;
        for (let i = _canvasState.nodes.length - 1; i >= 0; i--) {
          const n = _canvasState.nodes[i];
          const dx = pos.x - n.x;
          const dy = pos.y - n.y;
          if (dx*dx + dy*dy <= n.radius*n.radius) {
            foundNode = n;
            break;
          }
        }

        if (foundNode !== _canvasState.hoverNode) {
          _canvasState.hoverNode = foundNode;
          canvas.style.cursor = foundNode ? 'pointer' : 'grab';
          const tip = document.getElementById('gridCanvasTooltip');
          if (foundNode && tip) {
            tip.style.display = 'block';
            tip.style.left = (cx + 12) + 'px';
            tip.style.top = (cy - 8) + 'px';
            tip.innerHTML = `<strong>${escapeHtml(foundNode.name)}</strong><br>Role: ${escapeHtml(foundNode.role)}<br><small class="mono">${foundNode.pubkey.slice(0, 16)}…</small>`;
          } else if (tip) {
            tip.style.display = 'none';
          }
        } else if (_canvasState.hoverNode) {
          const tip = document.getElementById('gridCanvasTooltip');
          if (tip) {
            tip.style.left = (cx + 12) + 'px';
            tip.style.top = (cy - 8) + 'px';
          }
        }
      }
    });

    canvas.addEventListener('mouseup', () => {
      if (_canvasState.dragging) {
        _canvasState.dragging._pinned = false;
        _canvasState._wasDragging = true;
      }
      _canvasState.dragging = null;
      _canvasState.panning = false;
      canvas.style.cursor = _canvasState.hoverNode ? 'pointer' : 'grab';
    });

    canvas.addEventListener('mouseleave', () => {
      _canvasState.dragging = null;
      _canvasState.panning = false;
      _canvasState._wasDragging = false;
      const tip = document.getElementById('gridCanvasTooltip');
      if (tip) tip.style.display = 'none';
      _canvasState.hoverNode = null;
    });

    canvas.addEventListener('click', e => {
      if (_canvasState._wasDragging) {
        _canvasState._wasDragging = false;
        return;
      }
      const pos = getMousePos(e);
      let foundNode = null;
      for (let i = _canvasState.nodes.length - 1; i >= 0; i--) {
        const n = _canvasState.nodes[i];
        const dx = pos.x - n.x;
        const dy = pos.y - n.y;
        if (dx*dx + dy*dy <= n.radius*n.radius) {
          foundNode = n;
          break;
        }
      }

      if (foundNode) {
        _selectedNode = foundNode.nodeRef;
        renderDetailPanel();
      }
    });

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.15 : 0.85;
      const newZoom = Math.max(0.1, Math.min(10, _canvasState.zoom * factor));
      _canvasState.panX = cx - (cx - _canvasState.panX) * (newZoom / _canvasState.zoom);
      _canvasState.panY = cy - (cy - _canvasState.panY) * (newZoom / _canvasState.zoom);
      _canvasState.zoom = newZoom;
    }, { passive: false });
  }

  function startRenderer(canvas) {
    if (_canvasState.animId) cancelAnimationFrame(_canvasState.animId);

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    function resize() {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.scale(dpr, dpr);
    }
    resize();

    window.addEventListener('resize', resize);

    const colorMap = {
      repeater: '#D55E00',
      companion: '#56B4E9',
      room: '#009E73',
      sensor: '#F0E442',
      observer: '#CC79A7',
      unknown: '#6b7280'
    };

    function tick() {
      if (!document.getElementById('meshGridCanvas')) {
        _canvasState.animId = null;
        window.removeEventListener('resize', resize);
        return;
      }

      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      const st = _canvasState;
      const nodes = st.nodes;
      const edges = st.edges;
      const idx = st.nodeIdx;

      // Force Directed Simulation
      if (st.cooling > 0.005) {
        // Brute-force Repulsion
        const k = 100;
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            let dx = nodes[j].x - nodes[i].x;
            let dy = nodes[j].y - nodes[i].y;
            let d2 = dx*dx + dy*dy;
            if (d2 < 4) {
              dx = Math.random() - 0.5;
              dy = Math.random() - 0.5;
              d2 = 4;
            }
            const f = (k*k) / d2;
            const fx = (dx / Math.sqrt(d2)) * f;
            const fy = (dy / Math.sqrt(d2)) * f;
            nodes[i].vx -= fx;
            nodes[i].vy -= fy;
            nodes[j].vx += fx;
            nodes[j].vy += fy;
          }
        }

        // Attraction along Edges
        const idealLen = 140;
        for (const e of edges) {
          const si = idx[e.source];
          const ti = idx[e.target];
          if (si === undefined || ti === undefined) continue;
          const a = nodes[si];
          const b = nodes[ti];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.sqrt(dx*dx + dy*dy) || 1;
          const f = (d - idealLen) * 0.06 * (0.4 + e.score * 0.6);
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }

        // Region attraction pulls nodes toward their scope centers
        if (st.mode === 'region') {
          // Attract scopes
          st.scopes.forEach(sc => {
            let sumX = 0, sumY = 0, count = 0;
            sc.nodes.forEach(pk => {
              const ni = idx[pk];
              if (ni !== undefined) {
                sumX += nodes[ni].x;
                sumY += nodes[ni].y;
                count++;
              }
            });
            if (count > 0) {
              sc.x = sumX / count;
              sc.y = sumY / count;
            }

            // Pull each node toward its scope centers
            sc.nodes.forEach(pk => {
              const ni = idx[pk];
              if (ni !== undefined) {
                const n = nodes[ni];
                n.vx += (sc.x - n.x) * 0.08;
                n.vy += (sc.y - n.y) * 0.08;
              }
            });
          });
        }

        // Center gravity
        for (const n of nodes) {
          n.vx += (W / 2 - n.x) * 0.003;
          n.vy += (H / 2 - n.y) * 0.003;
        }

        // Apply velocities
        const damping = 0.82;
        for (const n of nodes) {
          if (n._pinned) {
            n.vx = 0;
            n.vy = 0;
            continue;
          }
          n.vx *= damping * st.cooling;
          n.vy *= damping * st.cooling;
          n.x += n.vx;
          n.y += n.vy;
        }

        st.cooling *= 0.993;
      }

      // Render
      ctx.save();
      ctx.clearRect(0, 0, W, H);
      ctx.translate(st.panX, st.panY);
      ctx.scale(st.zoom, st.zoom);

      // Render Region bubbles
      if (st.mode === 'region') {
        st.scopes.forEach(sc => {
          let maxR = 40;
          sc.nodes.forEach(pk => {
            const ni = idx[pk];
            if (ni !== undefined) {
              const dx = nodes[ni].x - sc.x;
              const dy = nodes[ni].y - sc.y;
              maxR = Math.max(maxR, Math.sqrt(dx*dx + dy*dy) + 20);
            }
          });

          ctx.beginPath();
          ctx.arc(sc.x, sc.y, maxR, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(74, 158, 255, 0.04)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(74, 158, 255, 0.2)';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.font = '12px Aldrich, monospace';
          ctx.fillText(sc.name, sc.x - 20, sc.y - maxR + 15);
        });
      }

      // Render Edges
      for (const e of edges) {
        const si = idx[e.source];
        const ti = idx[e.target];
        if (si === undefined || ti === undefined) continue;
        const a = nodes[si];
        const b = nodes[ti];

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);

        // Map weight to thickness
        const thickness = Math.max(1, Math.min(6, e.weight / 5));
        ctx.lineWidth = thickness;
        ctx.strokeStyle = 'rgba(255, 100, 0, 0.45)';
        ctx.stroke();
      }

      // Render Nodes
      const query = _searchQuery.trim().toLowerCase();
      for (const n of nodes) {
        const matched = query === '' || n.name.toLowerCase().includes(query) || n.pubkey.toLowerCase().startsWith(query);
        const color = colorMap[n.role] || colorMap.unknown;

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        ctx.strokeStyle = _selectedNode && _selectedNode.public_key === n.pubkey ? '#fff' : 'rgba(255,255,255,0.7)';
        ctx.lineWidth = _selectedNode && _selectedNode.public_key === n.pubkey ? 3 : 1.5;
        ctx.stroke();

        if (matched && st.zoom > 0.4) {
          ctx.fillStyle = '#ffffff';
          ctx.font = '10px Aldrich, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(n.name, n.x, n.y + n.radius + 12);
        }
      }

      ctx.restore();
      st.animId = requestAnimationFrame(tick);
    }

    _canvasState.animId = requestAnimationFrame(tick);
  }

  async function renderDetailPanel() {
    const el = document.getElementById('gridDetailPanel');
    if (!el) return;

    if (!_selectedNode) {
      el.innerHTML = `<div class="text-center text-muted" style="padding:16px;">${t('selectNode')}</div>`;
      return;
    }

    const n = _selectedNode;
    el.innerHTML = `<div class="text-muted">${t('loading')}</div>`;

    try {
      // Parallel fetches for full detailed analytics
      const [nodeData, healthData] = await Promise.all([
        api('/nodes/' + encodeURIComponent(n.public_key), { ttl: CLIENT_TTL.nodeDetail }),
        api('/nodes/' + encodeURIComponent(n.public_key) + '/health', { ttl: CLIENT_TTL.nodeDetail }).catch(() => null)
      ]);

      const nd = nodeData.node || n;
      const h = healthData || {};
      const stats = h.stats || {};

      // Calculate hop count breakdown (all history sum)
      const hopDistribution = (nodeData.recentAdverts || []).reduce((acc, p) => {
        // Simple parsed raw_hex hop parsing
        if (p.raw_hex) {
          const hopsLen = Math.max(0, (p.raw_hex.length / 2) - 10); // rough estimate of hops
          acc[hopsLen] = (acc[hopsLen] || 0) + 1;
        }
        return acc;
      }, {});

      const scopesHtml = (nd.transported_scopes && nd.transported_scopes.length)
        ? nd.transported_scopes.map(s => `<span class="badge" style="background:var(--accent); margin: 2px;">${escapeHtml(s)}</span>`).join(' ')
        : `<span class="text-muted" style="font-size:11px;">${t('noScopes')}</span>`;

      const hopBreakdownHtml = Object.keys(hopDistribution).length
        ? Object.entries(hopDistribution).map(([hops, count]) => `
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
              <span>${hops} hop${hops === '1' ? '' : 's'}:</span>
              <strong>${count} ${t('packets')}</strong>
            </div>
          `).join('')
        : `<span class="text-muted" style="font-size:11px;">${t('noHopsBreakdown')}</span>`;

      el.innerHTML = `
        <div class="grid-details-card" style="position:relative;">
          <button class="detail-close-btn" id="gridCloseDetailBtn" title="${t('close')}">×</button>
          <h4>${t('nodeDetails')}</h4>
          <h3 style="margin:4px 0;">${escapeHtml(nd.name || '(unnamed)')}</h3>
          <div style="margin-bottom:8px;">
            <span class="badge" style="background:${ROLE_COLORS[nd.role] || '#6b7280'}">${escapeHtml(nd.role)}</span>
          </div>

          <table class="node-stats-table" style="font-size:12px; width:100%; margin-bottom:12px;">
            <tr><td>Public Key:</td><td class="mono" style="word-break:break-all; font-size:11px;">${nd.public_key}</td></tr>
            <tr><td>${t('cityRegion')}:</td><td>${nd.lat && nd.lon ? `${nd.lat.toFixed(4)}, ${nd.lon.toFixed(4)}` : '—'}</td></tr>
            <tr><td>${t('lastSeen')}:</td><td>${nd.last_seen ? renderNodeTimestampHtml(nd.last_seen) : '—'}</td></tr>
            <tr><td>${t('firstSeen')}:</td><td>${nd.first_seen ? renderNodeTimestampHtml(nd.first_seen) : '—'}</td></tr>
          </table>

          <div style="margin-bottom:12px;">
            <label style="font-weight:600; font-size:12px; display:block; margin-bottom:4px;">${t('scopesCarried')}</label>
            <div>${scopesHtml}</div>
          </div>

          <div style="margin-bottom:12px;">
            <label style="font-weight:600; font-size:12px; display:block; margin-bottom:4px;">${t('hopCountBreakdown')}</label>
            <div>${hopBreakdownHtml}</div>
          </div>

          <div style="display:flex; gap:6px;">
            <button class="btn btn-primary" id="gridCopyUrlBtn" style="font-size:11px; padding:4px 8px;">${t('copyUrl')}</button>
            <button class="btn btn-primary" id="gridCopyShortUrlBtn" style="font-size:11px; padding:4px 8px;">${t('copyShortUrl')}</button>
            <button class="btn btn-primary" id="gridGoToNodeBtn" style="font-size:11px; padding:4px 8px;">${t('showAll')}</button>
          </div>
        </div>
      `;

      document.getElementById('gridCloseDetailBtn').addEventListener('click', () => {
        _selectedNode = null;
        renderDetailPanel();
      });

      document.getElementById('gridCopyUrlBtn').addEventListener('click', () => {
        const url = `${location.origin}/#/mesh-grid/${nd.public_key}`;
        window.copyToClipboard(url, () => {
          const btn = document.getElementById('gridCopyUrlBtn');
          btn.textContent = t('copied');
          setTimeout(() => { btn.textContent = t('copyUrl'); }, 2000);
        });
      });

      document.getElementById('gridCopyShortUrlBtn').addEventListener('click', () => {
        const url = `${location.origin}/#/mesh-grid/${nd.public_key.slice(0, 8)}`;
        window.copyToClipboard(url, () => {
          const btn = document.getElementById('gridCopyShortUrlBtn');
          btn.textContent = t('copied');
          setTimeout(() => { btn.textContent = t('copyShortUrl'); }, 2000);
        });
      });

      document.getElementById('gridGoToNodeBtn').addEventListener('click', () => {
        location.hash = `#/nodes/${nd.public_key}`;
      });

    } catch (e) {
      el.innerHTML = `<div class="text-danger">${t('errorLoad')}${escapeHtml(e.message)}</div>`;
    }
  }

  function destroy() {
    if (_canvasState && _canvasState.animId) {
      cancelAnimationFrame(_canvasState.animId);
    }
    _canvasState = null;
    _allNodes = [];
    _neighborGraphData = null;
  }

  registerPage('mesh-grid', { init, destroy });
})();
