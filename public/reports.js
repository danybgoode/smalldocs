(function () {
  const state = {
    data: null,
    query: '',
    grain: 'all',
    status: '',
    area: '',
  };

  const els = {
    shipped: document.getElementById('stat-shipped'),
    active: document.getElementById('stat-active'),
    items: document.getElementById('stat-items'),
    generated: document.getElementById('generated-at'),
    views: document.getElementById('views-grid'),
    list: document.getElementById('report-list'),
    empty: document.getElementById('empty'),
    count: document.getElementById('result-count'),
    search: document.getElementById('search'),
    status: document.getElementById('status-filter'),
    area: document.getElementById('area-filter'),
    main: document.querySelector('main'),
    grainButtons: Array.from(document.querySelectorAll('[data-grain]')),
  };

  function text(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback || '';
    return String(value);
  }

  function clampPercent(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Datos actualizados';
    return new Intl.DateTimeFormat('es-MX', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  function create(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  }

  function option(value, label) {
    const node = document.createElement('option');
    node.value = value;
    node.textContent = label;
    return node;
  }

  function renderStats() {
    const stats = state.data.stats || {};
    els.shipped.textContent = text(stats.shippedEpics, '0');
    els.active.textContent = text(stats.activeEpics, '0');
    els.items.textContent = text(stats.total, state.data.items.length);
    els.generated.textContent = 'Actualizado ' + formatDate(state.data.generatedAt);
  }

  function renderViews() {
    els.views.replaceChildren();
    for (const view of state.data.views || []) {
      const card = create('a', 'view-card');
      card.href = view.href;

      card.appendChild(create('span', 'view-kind', text(view.kind, 'vista')));
      card.appendChild(create('span', 'view-title', text(view.title, 'Vista')));
      card.appendChild(create('p', 'view-description', text(view.description, '')));
      card.appendChild(create('span', 'view-meta', 'Abrir en SmallDocs'));
      els.views.appendChild(card);
    }
  }

  function fillFilters() {
    const statusValues = new Set();
    const areaValues = new Set();
    for (const item of state.data.items) {
      if (item.statusLabel || item.status) statusValues.add(item.statusLabel || item.status);
      if (item.area) areaValues.add(item.area);
    }

    els.status.replaceChildren(option('', 'Todos los estados'));
    for (const value of Array.from(statusValues).sort((a, b) => a.localeCompare(b))) {
      els.status.appendChild(option(value, value));
    }

    els.area.replaceChildren(option('', 'Todas las areas'));
    for (const value of Array.from(areaValues).sort((a, b) => a.localeCompare(b))) {
      els.area.appendChild(option(value, value));
    }
  }

  function searchable(item) {
    return [
      item.title,
      item.grain,
      item.status,
      item.statusLabel,
      item.area,
      item.priority,
      item.risk,
      item.progressLabel,
      item.sourcePath,
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function filteredItems() {
    const q = state.query.trim().toLowerCase();
    return state.data.items.filter((item) => {
      const itemStatus = item.statusLabel || item.status || '';
      if (state.grain !== 'all' && item.grain !== state.grain) return false;
      if (state.status && itemStatus !== state.status) return false;
      if (state.area && item.area !== state.area) return false;
      if (q && !item.searchableText.includes(q)) return false;
      return true;
    });
  }

  function renderReport(item) {
    const card = create('article', 'report-card');
    const main = create('div', 'report-main');
    const kicker = create('div', 'report-kicker');
    const status = item.statusLabel || item.status || 'Estado';
    const progress = clampPercent(item.progress && item.progress.percent);

    kicker.appendChild(create('span', 'chip', item.grainLabel || item.grain || 'Reporte'));
    if (status) kicker.appendChild(create('span', 'chip chip-status', status));
    if (item.area) kicker.appendChild(create('span', 'chip chip-area', item.area));

    const title = create('a', 'report-title', text(item.title, 'Reporte sin titulo'));
    title.href = item.href;
    title.title = text(item.title, '');

    const summaryBits = [];
    if (item.progressLabel) summaryBits.push(item.progressLabel);
    if (item.risk) summaryBits.push('Riesgo ' + item.risk);
    if (item.priority) summaryBits.push('Prioridad ' + item.priority);
    const summary = create('p', 'report-summary', summaryBits.join(' / ') || text(item.sourcePath, 'Roadmap'));

    main.appendChild(kicker);
    main.appendChild(title);
    main.appendChild(summary);

    const side = create('div', 'report-side');
    const stat = create('div', 'side-stat');
    stat.appendChild(create('span', '', 'Avance'));
    stat.appendChild(create('strong', '', progress + '%'));

    const bar = create('div', 'progress');
    const fill = create('span', '');
    fill.style.setProperty('--progress', progress + '%');
    bar.appendChild(fill);

    const source = create('a', 'source-link', 'Fuente GitHub');
    source.href = item.sourceUrl;
    source.rel = 'noopener';

    side.appendChild(stat);
    side.appendChild(bar);
    side.appendChild(source);

    card.appendChild(main);
    card.appendChild(side);
    return card;
  }

  function renderList() {
    const items = filteredItems();
    const visible = items.slice(0, 160);
    els.list.replaceChildren();
    for (const item of visible) {
      els.list.appendChild(renderReport(item));
    }
    els.empty.hidden = items.length > 0;
    const extra = items.length > visible.length ? ' - mostrando ' + visible.length : '';
    els.count.textContent = items.length + ' reportes' + extra;
  }

  function bind() {
    els.search.addEventListener('input', () => {
      state.query = els.search.value;
      renderList();
    });

    els.status.addEventListener('change', () => {
      state.status = els.status.value;
      renderList();
    });

    els.area.addEventListener('change', () => {
      state.area = els.area.value;
      renderList();
    });

    for (const button of els.grainButtons) {
      button.addEventListener('click', () => {
        state.grain = button.getAttribute('data-grain') || 'all';
        for (const peer of els.grainButtons) {
          peer.setAttribute('aria-pressed', peer === button ? 'true' : 'false');
        }
        renderList();
      });
    }
  }

  async function init() {
    bind();
    try {
      const dataUrl = els.main && els.main.dataset.reportData ? els.main.dataset.reportData : '/public/reports-data.json';
      const res = await fetch(dataUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error('report_data_unavailable');
      state.data = await res.json();
      if (!Array.isArray(state.data.items)) throw new Error('report_data_invalid');
      for (const item of state.data.items) item.searchableText = searchable(item);
      renderStats();
      renderViews();
      fillFilters();
      renderList();
    } catch (error) {
      els.generated.textContent = 'No se pudo cargar la biblioteca';
      els.count.textContent = 'Sin datos disponibles';
      els.empty.hidden = false;
      els.empty.textContent = 'La biblioteca publicada no esta disponible.';
    }
  }

  init();
})();
