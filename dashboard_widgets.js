// ALTISEC EXECUTIVE DASHBOARD — customizable widget grid
// KPI cards + chart widgets, all fed from real report state: the current working report
// (AppState) or any accepted report snapshot. Charts render through ChartEngine, so every
// dashboard chart gets the same inspector as the report. Layout persists in localStorage (v1).
(function () {
    'use strict';

    const LAYOUT_KEY = 'altisec_dashboard_layout_v1';
    const SOURCE_KEY = 'altisec_dashboard_source';
    const LAYOUT_VERSION = 1;
    const KPI_SIZES = [2, 3, 4, 6];
    const CHART_SIZES = [4, 6, 8, 12];
    const ICONS = ['fa-shield-virus', 'fa-folder-open', 'fa-circle-check', 'fa-fire', 'fa-gauge-high', 'fa-stopwatch', 'fa-magnifying-glass-chart', 'fa-bell', 'fa-database', 'fa-bolt', 'fa-user-shield', 'fa-server', 'fa-bug', 'fa-chart-line'];

    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
    const toast = (m) => { if (typeof showToast === 'function') showToast(m); };
    const sum = (a) => a.reduce((t, v) => t + (+v || 0), 0);

    // ------------------------------------------------------------ data
    const SEV = ['Critical', 'High', 'Medium', 'Low'];
    const SEV_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#38bdf8'];

    const mapData = (map, dimension) => {
        const entries = (typeof getSortedMapEntries === 'function') ? getSortedMapEntries(map, 0) : Object.entries(map || {});
        return { labels: entries.map(e => e[0]), series: [{ name: 'Incidents', data: entries.map(e => e[1]) }], empty: !entries.length, dimension, measure: 'Incidents' };
    };

    const DATASETS = {
        trend:      { label: 'Daily incident trend', get: s => {
            const t = s.trendData || {};
            const counts = Array.isArray(t.counts) ? t.counts : [];
            return { labels: Array.isArray(t.labels) ? t.labels : [], series: [{ name: 'Incidents created', data: counts }], time: true, empty: !sum(counts), dimension: 'Day', measure: 'Incidents created' };
        } },
        severity:   { label: 'Severity distribution', get: s => {
            const m = s.metrics || {};
            const d = [m.sevCritical, m.sevHigh, m.sevMedium, m.sevLow].map(v => +v || 0);
            return { labels: SEV, series: [{ name: 'Incidents', data: d, colors: SEV_COLORS }], empty: !sum(d), dimension: 'Severity', measure: 'Incidents' };
        } },
        sevByStatus:{ label: 'Severity by status (open vs closed)', get: s => {
            const m = s.metrics || {};
            const all = [m.sevCritical, m.sevHigh, m.sevMedium, m.sevLow].map(v => +v || 0);
            const closed = [m.closedSevCritical, m.closedSevHigh, m.closedSevMedium, m.closedSevLow].map(v => +v || 0);
            return { labels: SEV, series: [
                { name: 'Open', data: all.map((v, i) => Math.max(0, v - closed[i])), colors: '#f87171' },
                { name: 'Closed', data: closed, colors: '#34d399' }
            ], empty: !sum(all), dimension: 'Severity', measure: 'Incidents' };
        } },
        status:     { label: 'Incident status', get: s => {
            const m = s.metrics || {};
            const d = [m.openIncidents, m.closedIncidents, m.pendingCustomer].map(v => +v || 0);
            return { labels: ['Open', 'Closed', 'Pending customer'], series: [{ name: 'Incidents', data: d, colors: ['#f87171', '#34d399', '#fbbf24'] }], empty: !sum(d), dimension: 'Status', measure: 'Incidents' };
        } },
        alerts:     { label: 'Top alert rules', get: s => mapData(s.alertNamesMap, 'Alert rule') },
        tactics:    { label: 'MITRE ATT&CK tactics', get: s => mapData(s.mitreTacticsMap, 'Tactic') },
        techniques: { label: 'MITRE ATT&CK techniques', get: s => mapData(s.mitreTechniquesMap, 'Technique') },
        categories: { label: 'Incident categories', get: s => mapData(s.categoryMap, 'Category') },
        assets:     { label: 'Asset type distribution', get: s => mapData(s.assetTypeMap, 'Asset type') },
        users:      { label: 'Top triggered usernames', get: s => mapData(s.userMap, 'Username') },
        hosts:      { label: 'Top triggered hostnames', get: s => mapData(s.hostnameMap, 'Hostname') },
        kri:        { label: 'Key risk indicators', get: s => {
            const list = (s.kriList || []).filter(k => k && k.enabled !== false);
            return { labels: list.map(k => k.name), series: [{ name: 'Value', data: list.map(k => +k.value || 0) }], empty: !list.length, dimension: 'Indicator', measure: 'Value' };
        } }
    };
    const DATASET_LIST = Object.keys(DATASETS).map(id => ({ id, label: DATASETS[id].label }));

    // goodDir: which direction of change is an improvement (drives delta coloring)
    const KPI_DEFS = {
        total:    { title: 'Total incidents', icon: 'fa-shield-virus', accent: '#38bdf8', get: s => s.metrics.totalIncidents, goodDir: 'down' },
        open:     { title: 'Open incidents', icon: 'fa-folder-open', accent: '#f87171', get: s => s.metrics.openIncidents, goodDir: 'down', ratioOf: 'total', sub: s => `${s.metrics.pendingCustomer || 0} pending customer` },
        closed:   { title: 'Closed incidents', icon: 'fa-circle-check', accent: '#34d399', get: s => s.metrics.closedIncidents, goodDir: 'up', ratioOf: 'total' },
        critHigh: { title: 'Critical + high', icon: 'fa-fire', accent: '#fb923c', get: s => (+s.metrics.sevCritical || 0) + (+s.metrics.sevHigh || 0), goodDir: 'down', ratioOf: 'total', sub: s => `${s.metrics.sevCritical || 0} critical · ${s.metrics.sevHigh || 0} high` },
        sla:      { title: 'SLA compliance', icon: 'fa-gauge-high', accent: '#34d399', get: s => num(s.metrics.slaCompliance), suffix: '%', decimals: 1, max: 100, goodDir: 'up', sub: () => 'Target ≥ 95%' },
        mttr:     { title: 'MTTR', icon: 'fa-stopwatch', accent: '#fbbf24', get: s => num(s.metrics.mttrHours), suffix: ' hrs', decimals: 2, max: 4, goodDir: 'down', sub: () => 'Mean time to resolve · target < 4 hrs' },
        mttd:     { title: 'MTTD', icon: 'fa-magnifying-glass-chart', accent: '#818cf8', get: s => num(s.metrics.mttdHours), suffix: ' hrs', decimals: 2, goodDir: 'down', sub: () => 'Mean time to detect' },
        mtta:     { title: 'MTTA', icon: 'fa-bell', accent: '#a78bfa', get: s => num(s.metrics.mttaHours), suffix: ' hrs', decimals: 2, goodDir: 'down', sub: () => 'Mean time to acknowledge' },
        ingest:   { title: 'Daily ingestion', icon: 'fa-database', accent: '#22d3ee', get: s => num(s.metrics.dailyIngestionGb), suffix: ' GB', decimals: 2, goodDir: null, sub: () => 'SIEM telemetry per day' }
    };

    const DEFAULT_LAYOUT = [
        { id: 'total', kind: 'kpi', w: 3 }, { id: 'open', kind: 'kpi', w: 3, style: 'progress' }, { id: 'closed', kind: 'kpi', w: 3, style: 'progress' },
        { id: 'critHigh', kind: 'kpi', w: 3, style: 'progress' },
        { id: 'sla', kind: 'kpi', w: 3, style: 'progress' }, { id: 'mttr', kind: 'kpi', w: 3, style: 'progress' },
        { id: 'mttd', kind: 'kpi', w: 2 }, { id: 'mtta', kind: 'kpi', w: 2 }, { id: 'ingest', kind: 'kpi', w: 2 },
        { id: 'c-trend', kind: 'chart', w: 8, dataset: 'trend', type: 'area' },
        { id: 'c-severity', kind: 'chart', w: 4, dataset: 'severity', type: 'doughnut' },
        { id: 'c-sevstatus', kind: 'chart', w: 4, dataset: 'sevByStatus', type: 'stackedBar' },
        { id: 'c-tactics', kind: 'chart', w: 4, dataset: 'tactics', type: 'hbar' },
        { id: 'c-status', kind: 'chart', w: 4, dataset: 'status', type: 'pie' },
        { id: 'c-alerts', kind: 'chart', w: 6, dataset: 'alerts', type: 'hbar' },
        { id: 'c-kri', kind: 'chart', w: 6, dataset: 'kri', type: 'bar' },
        { id: 'c-assets', kind: 'chart', w: 6, dataset: 'assets', type: 'doughnut' },
        { id: 'c-categories', kind: 'chart', w: 6, dataset: 'categories', type: 'pie', hidden: true }
    ];

    // ------------------------------------------------------------ layout persistence
    function sanitizeWidget(w) {
        if (!w || typeof w !== 'object' || typeof w.id !== 'string') return null;
        const kind = w.kind === 'chart' ? 'chart' : w.kind === 'kpi' ? 'kpi' : null;
        if (!kind) return null;
        if (kind === 'kpi' && !KPI_DEFS[w.id]) return null;
        const sizes = kind === 'kpi' ? KPI_SIZES : CHART_SIZES;
        const out = { id: w.id.slice(0, 64), kind, w: sizes.includes(w.w) ? w.w : sizes[kind === 'kpi' ? 0 : 1], hidden: w.hidden === true };
        if (kind === 'chart') {
            out.dataset = DATASETS[w.dataset] ? w.dataset : 'severity';
            out.type = typeof w.type === 'string' ? w.type : 'bar';
        } else {
            ['title', 'desc'].forEach(k => { if (typeof w[k] === 'string' && w[k].trim()) out[k] = w[k].slice(0, 80); });
            if (ICONS.includes(w.icon)) out.icon = w.icon;
            if (/^#[0-9a-f]{6}$/i.test(w.accent)) out.accent = w.accent;
            out.style = ['simple', 'progress', 'sparkline'].includes(w.style) ? w.style : 'simple';
            out.compare = w.compare !== false;
        }
        return out;
    }

    function defaultLayout() { return DEFAULT_LAYOUT.map(sanitizeWidget); }

    function loadLayout() {
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null'); } catch (e) { saved = null; }
        if (!saved || !Array.isArray(saved.widgets)) return defaultLayout();
        const seen = new Set();
        const widgets = saved.widgets.map(sanitizeWidget).filter(w => w && !seen.has(w.id) && seen.add(w.id));
        // widgets added in later versions appear at the end instead of silently missing
        defaultLayout().forEach(d => { if (!seen.has(d.id)) widgets.push(d); });
        return widgets;
    }

    let layout = loadLayout();
    let editing = false;
    const undoStack = [];
    const redoStack = [];

    function persist() {
        try { localStorage.setItem(LAYOUT_KEY, JSON.stringify({ v: LAYOUT_VERSION, savedAt: new Date().toISOString(), widgets: layout })); }
        catch (e) { toast('Could not save dashboard layout (storage full?)'); }
        const st = document.getElementById('dwStatus');
        if (st) st.textContent = 'Layout saved';
    }

    function change(mutator) {
        undoStack.push(JSON.stringify(layout));
        if (undoStack.length > 50) undoStack.shift();
        redoStack.length = 0;
        mutator();
        persist();
        render();
    }

    function stepLayout(from, to) {
        if (!from.length) return;
        to.push(JSON.stringify(layout));
        layout = JSON.parse(from.pop()).map(sanitizeWidget).filter(Boolean);
        persist();
        render();
    }

    // ------------------------------------------------------------ data sources
    function acceptedWithSnapshots() {
        return ((typeof AppState !== 'undefined' && AppState.acceptedReports) || []).filter(r => r && r.stateSnapshot && r.stateSnapshot.metrics);
    }

    function currentSourceId() {
        let id = 'current';
        try { id = localStorage.getItem(SOURCE_KEY) || 'current'; } catch (e) { /* default */ }
        if (id !== 'current' && !acceptedWithSnapshots().some(r => r.id === id)) id = 'current';
        return id;
    }

    function resolveSource(id) {
        if (id === 'current') return { state: AppState, record: null };
        const rec = acceptedWithSnapshots().find(r => r.id === id);
        return rec ? { state: rec.stateSnapshot, record: rec } : { state: AppState, record: null };
    }

    const clientOf = (s) => String((s && s.properties && s.properties.clientName) || '').trim().toLowerCase();

    // Previous period = next-older accepted report for the same client
    function previousFor(sourceId, state) {
        const client = clientOf(state);
        const list = acceptedWithSnapshots();
        const start = sourceId === 'current' ? 0 : list.findIndex(r => r.id === sourceId) + 1;
        const rec = list.slice(start).find(r => clientOf(r.stateSnapshot) === client && r.id !== sourceId);
        return rec ? { state: rec.stateSnapshot, record: rec } : null;
    }

    // Oldest → newest values of a KPI across this client's accepted reports (plus the current report)
    function historyFor(def, sourceId, state) {
        const client = clientOf(state);
        const list = acceptedWithSnapshots();
        const start = sourceId === 'current' ? 0 : Math.max(0, list.findIndex(r => r.id === sourceId));
        const pts = list.slice(start).filter(r => clientOf(r.stateSnapshot) === client).reverse().map(r => num(def.get(r.stateSnapshot, r)));
        if (sourceId === 'current') pts.push(num(def.get(state, null)));
        return pts.filter(v => v != null);
    }

    function hasTelemetry(s) {
        const m = s.metrics || {};
        return (+m.totalIncidents || 0) > 0 || Object.keys(s.alertNamesMap || {}).length > 0;
    }

    // ------------------------------------------------------------ rendering
    function fmt(v, def) {
        if (v == null) return '—';
        const d = def.decimals != null ? def.decimals : (Number.isInteger(+v) ? 0 : 2);
        return (+v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }) + (def.suffix || '');
    }

    function sparkSvg(values, color) {
        if (values.length < 2) return '<div class="dw-sub">Needs two or more reports for this client to draw a trend.</div>';
        const min = Math.min(...values), max = Math.max(...values), span = (max - min) || 1;
        const pts = values.map((v, i) => `${(i / (values.length - 1) * 100).toFixed(1)},${(30 - (v - min) / span * 26 - 2).toFixed(1)}`).join(' ');
        return `<svg class="dw-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
    }

    function toolsHtml(w) {
        const sizes = w.kind === 'kpi' ? KPI_SIZES : CHART_SIZES;
        return `<div class="dw-tools" data-html2canvas-ignore="true">
            <button type="button" class="dw-drag" draggable="true" data-drag="${esc(w.id)}" title="Drag to reorder" aria-label="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></button>
            ${editing ? `<button type="button" data-act="left" title="Move earlier" aria-label="Move earlier"><i class="fa-solid fa-arrow-left"></i></button>
            <button type="button" data-act="right" title="Move later" aria-label="Move later"><i class="fa-solid fa-arrow-right"></i></button>` : ''}
            <button type="button" data-act="size" title="Resize (width ${w.w}/12 → ${sizes[(sizes.indexOf(w.w) + 1) % sizes.length]}/12)" aria-label="Resize"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></button>
            <button type="button" data-act="settings" title="${w.kind === 'chart' ? 'Chart settings' : 'Card settings'}" aria-label="Settings"><i class="fa-solid fa-sliders"></i></button>
            <button type="button" data-act="hide" title="${w.hidden ? 'Show' : 'Hide'}" aria-label="${w.hidden ? 'Show' : 'Hide'}"><i class="fa-solid ${w.hidden ? 'fa-eye' : 'fa-eye-slash'}"></i></button>
        </div>`;
    }

    function kpiWidgetHtml(w, src, prev, sourceId) {
        const def = KPI_DEFS[w.id];
        const accent = w.accent || def.accent;
        const v = num(def.get(src.state, src.record));
        let delta = '';
        if (w.compare && prev) {
            const pv = num(def.get(prev.state, prev.record));
            if (v != null && pv != null) {
                const d = v - pv;
                const dir = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
                const good = def.goodDir === 'up' ? ' good' : '';
                const neutral = def.goodDir == null ? ' flat' : '';
                const pct = pv ? ` (${(d / Math.abs(pv) * 100).toFixed(0)}%)` : '';
                delta = `<span class="dw-delta ${dir}${good}${neutral}" title="vs ${esc(prev.record.customer)} · ${esc(prev.record.reportingPeriod)}">${d > 0 ? '▲' : d < 0 ? '▼' : '■'} ${esc(fmt(Math.abs(d), def))}${pct}</span>`;
            }
        }
        let extra = '';
        if (w.style === 'progress') {
            const base = def.max || (def.ratioOf ? num(KPI_DEFS[def.ratioOf].get(src.state, src.record)) : null);
            const ratio = (v != null && base) ? Math.max(0, Math.min(1, v / base)) : 0;
            extra = `<div class="dw-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(ratio * 100)}"><div style="width:${(ratio * 100).toFixed(1)}%"></div></div>`;
        } else if (w.style === 'sparkline') {
            extra = sparkSvg(historyFor(def, sourceId, src.state), accent);
        }
        const sub = w.desc || (def.sub ? def.sub(src.state) : '');
        return `
            <div class="dw-head">
                <div class="dw-title"><i class="fa-solid ${esc(w.icon || def.icon)}"></i><span>${esc(w.title || def.title)}</span></div>
                ${toolsHtml(w)}
            </div>
            <div class="dw-kpi-row"><div class="dw-kpi-val">${esc(fmt(v, def))}</div>${delta}</div>
            ${sub ? `<div class="dw-sub">${esc(sub)}</div>` : ''}
            ${extra}`;
    }

    function chartWidgetHtml(w) {
        const cfg = window.ChartEngine && ChartEngine.isMounted('dash-' + w.id) ? ChartEngine.effective('dash-' + w.id) : null;
        const ds = DATASETS[(cfg && cfg.dataset) || w.dataset] || DATASETS.severity;
        return `
            <div class="dw-head">
                <div style="min-width:0"><div class="dw-title"><span>${esc((cfg && cfg.title) || ds.label)}</span></div>
                ${cfg && cfg.subtitle ? `<div class="dw-desc">${esc(cfg.subtitle)}</div>` : ''}</div>
                ${toolsHtml(w)}
            </div>
            <div class="dw-chart-body"><canvas id="dwc-${esc(w.id)}"></canvas></div>`;
    }

    function mountChart(w, src) {
        if (!window.ChartEngine) return;
        ChartEngine.mount('dash-' + w.id, {
            canvasId: 'dwc-' + w.id,
            name: `Dashboard · ${DATASETS[w.dataset] ? DATASETS[w.dataset].label : w.id}`,
            surface: 'app', store: 'local', editButton: false, titleInHeader: true,
            datasets: DATASET_LIST,
            emptyText: 'No data in this report — upload telemetry in Report Studio',
            defaults: { type: w.type, dataset: w.dataset, legend: { show: true, position: 'bottom' }, topN: ['alerts', 'tactics', 'techniques', 'users', 'hosts'].includes(w.dataset) ? 8 : 0 },
            getData: (dsId) => (DATASETS[dsId] || DATASETS[w.dataset]).get(src.state),
            onChange: () => {
                const el = document.querySelector(`.dw-widget[data-id="${CSS.escape(w.id)}"] .dw-title span`);
                const cfg = ChartEngine.effective('dash-' + w.id);
                if (el && cfg) el.textContent = cfg.title || (DATASETS[cfg.dataset] || DATASETS[w.dataset]).label;
            }
        });
    }

    function sourceOptions(selected) {
        const opts = [`<option value="current" ${selected === 'current' ? 'selected' : ''}>Current working report — ${esc(AppState.properties.clientName || 'Unnamed')} · ${esc(AppState.properties.reportingPeriod || '')}</option>`];
        acceptedWithSnapshots().forEach(r => {
            opts.push(`<option value="${esc(r.id)}" ${selected === r.id ? 'selected' : ''}>Accepted — ${esc(r.customer)} · ${esc(r.reportingPeriod)} (${esc(r.createdAt)})</option>`);
        });
        return opts.join('');
    }

    function render() {
        const root = document.getElementById('dashWidgetRoot');
        if (!root || typeof AppState === 'undefined') return;
        const sourceId = currentSourceId();
        const src = resolveSource(sourceId);
        const prev = previousFor(sourceId, src.state);
        const empty = !hasTelemetry(src.state);

        root.innerHTML = `
            <div class="dw-toolbar" role="toolbar" aria-label="Dashboard controls">
                <div class="dw-left">
                    <label class="dw-source"><i class="fa-solid fa-database"></i><span>Data source</span>
                        <select id="dwSourceSelect" aria-label="Dashboard data source">${sourceOptions(sourceId)}</select></label>
                    <span class="dw-status" id="dwStatus">${prev ? `Comparing with ${esc(prev.record.reportingPeriod)}` : 'No earlier accepted report for this client to compare'}</span>
                </div>
                <div class="dw-right">
                    <button type="button" class="dw-btn" data-dw="undo" ${undoStack.length ? '' : 'disabled'} title="Undo layout change"><i class="fa-solid fa-rotate-left"></i></button>
                    <button type="button" class="dw-btn" data-dw="redo" ${redoStack.length ? '' : 'disabled'} title="Redo layout change"><i class="fa-solid fa-rotate-right"></i></button>
                    <button type="button" class="dw-btn" data-dw="add"><i class="fa-solid fa-plus"></i> Add widget</button>
                    <button type="button" class="dw-btn${editing ? ' active' : ''}" data-dw="edit" aria-pressed="${editing}"><i class="fa-solid fa-pen-ruler"></i> ${editing ? 'Done' : 'Customize'}</button>
                    <button type="button" class="dw-btn" data-dw="reset" title="Restore the default layout and chart settings"><i class="fa-solid fa-arrow-rotate-left"></i> Reset</button>
                </div>
            </div>
            ${empty ? `<div class="card" style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin:0; padding:12px 16px;">
                <span style="font-size:12.5px; color:var(--ink-muted);"><i class="fa-solid fa-circle-info" style="color:var(--accent); margin-right:6px;"></i>
                This report has no ingested telemetry yet. Upload an Excel/CSV export in Report Studio, or pick an accepted report as the data source.</span>
                <button type="button" class="dw-btn" onclick="switchAppView('view-studio')"><i class="fa-solid fa-file-arrow-up"></i> Open Report Studio</button></div>` : ''}
            <div class="dw-grid${editing ? ' dw-editing' : ''}" id="dwGrid">
                ${layout.map(w => `<section class="dw-widget ${w.kind === 'chart' ? 'dw-chart-widget' : 'dw-kpi-widget'}${w.hidden ? ' dw-hidden' : ''}" data-id="${esc(w.id)}"
                    style="--w:${w.w}; --dw-accent:${w.kind === 'kpi' ? esc(w.accent || KPI_DEFS[w.id].accent) : 'transparent'}" aria-label="${esc(w.kind === 'kpi' ? (w.title || KPI_DEFS[w.id].title) : 'Chart')}">
                    ${w.kind === 'kpi' ? kpiWidgetHtml(w, src, prev, sourceId) : chartWidgetHtml(w)}
                </section>`).join('')}
            </div>`;

        layout.filter(w => w.kind === 'chart' && (!w.hidden || editing)).forEach(w => mountChart(w, src));
        // chart titles come from the engine config, which exists only after mount
        layout.filter(w => w.kind === 'chart').forEach(w => {
            const el = root.querySelector(`.dw-widget[data-id="${CSS.escape(w.id)}"] .dw-title span`);
            const cfg = window.ChartEngine && ChartEngine.effective('dash-' + w.id);
            if (el && cfg) el.textContent = cfg.title || (DATASETS[cfg.dataset] || DATASETS[w.dataset]).label;
        });
    }

    // ------------------------------------------------------------ popovers
    let pop = null;
    function closePop() { if (pop) { pop.remove(); pop = null; } }

    function placePop(el, anchor) {
        document.body.appendChild(el);
        const r = anchor.getBoundingClientRect();
        const w = el.offsetWidth, h = el.offsetHeight;
        el.style.left = `${Math.max(12, Math.min(window.innerWidth - w - 12, r.right - w))}px`;
        el.style.top = `${r.bottom + 6 + h > window.innerHeight ? Math.max(12, r.top - h - 6) : r.bottom + 6}px`;
        pop = el;
        const f = el.querySelector('input, select, button');
        if (f) f.focus();
    }

    function openKpiSettings(w, anchor) {
        closePop();
        const def = KPI_DEFS[w.id];
        const el = document.createElement('div');
        el.className = 'dw-pop';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-label', 'Card settings');
        el.innerHTML = `
            <h4>Card settings · ${esc(def.title)}</h4>
            <div class="ce-field"><label for="dwk-title">Title</label><input id="dwk-title" type="text" value="${esc(w.title || '')}" placeholder="${esc(def.title)}"></div>
            <div class="ce-field"><label for="dwk-desc">Description</label><input id="dwk-desc" type="text" value="${esc(w.desc || '')}" placeholder="${esc(def.sub ? def.sub(AppState) : 'Optional')}"></div>
            <div class="ce-field"><label for="dwk-style">Display style</label><select id="dwk-style">
                ${[['simple', 'Simple KPI'], ['progress', 'KPI with progress bar'], ['sparkline', 'KPI with sparkline (report history)']].map(([v, l]) => `<option value="${v}" ${w.style === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
            <div class="ce-field"><label for="dwk-icon">Icon</label><select id="dwk-icon">${ICONS.map(i => `<option value="${i}" ${(w.icon || def.icon) === i ? 'selected' : ''}>${i.replace('fa-', '')}</option>`).join('')}</select></div>
            <div class="ce-row"><label for="dwk-accent">Accent color</label><input id="dwk-accent" type="color" value="${esc(w.accent || def.accent)}"></div>
            <div class="ce-row"><label for="dwk-compare">Compare with previous report</label><span class="ce-switch"><input id="dwk-compare" type="checkbox" ${w.compare ? 'checked' : ''}><span></span></span></div>
            <div class="dw-pop-foot"><button type="button" class="ce-btn ce-ghost" data-p="default">Defaults</button><span style="flex:1"></span><button type="button" class="ce-btn" data-p="cancel">Cancel</button><button type="button" class="ce-btn ce-primary" data-p="apply">Apply</button></div>`;
        el.addEventListener('click', (e) => {
            const b = e.target.closest('[data-p]');
            if (!b) return;
            if (b.dataset.p === 'cancel') return closePop();
            change(() => {
                const t = layout.find(x => x.id === w.id);
                if (b.dataset.p === 'default') { delete t.title; delete t.desc; delete t.icon; delete t.accent; t.style = 'simple'; t.compare = true; }
                else {
                    const v = (id) => el.querySelector(id).value.trim();
                    t.title = v('#dwk-title') || undefined;
                    t.desc = v('#dwk-desc') || undefined;
                    t.style = v('#dwk-style');
                    t.icon = v('#dwk-icon') === def.icon ? undefined : v('#dwk-icon');
                    t.accent = v('#dwk-accent').toLowerCase() === def.accent.toLowerCase() ? undefined : v('#dwk-accent');
                    t.compare = el.querySelector('#dwk-compare').checked;
                }
                Object.assign(t, sanitizeWidget(t));
                Object.keys(t).forEach(k => t[k] === undefined && delete t[k]);
            });
            closePop();
        });
        placePop(el, anchor);
    }

    function openAddMenu(anchor) {
        closePop();
        const hidden = layout.filter(w => w.hidden);
        const el = document.createElement('div');
        el.className = 'dw-pop';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-label', 'Add widget');
        el.innerHTML = `
            <h4>Add widget</h4>
            ${hidden.length ? `<div class="ce-sec"><h4 style="font-size:10.5px; color:var(--ink-dim); text-transform:uppercase; letter-spacing:.06em;">Hidden widgets</h4><div class="dw-add-list">
                ${hidden.map(w => `<button type="button" class="ce-btn" data-show="${esc(w.id)}"><i class="fa-solid fa-eye"></i> ${esc(w.kind === 'kpi' ? (w.title || KPI_DEFS[w.id].title) : DATASETS[w.dataset].label)}</button>`).join('')}</div></div>` : ''}
            <div class="ce-sec"><h4 style="font-size:10.5px; color:var(--ink-dim); text-transform:uppercase; letter-spacing:.06em;">New chart from dataset</h4><div class="dw-add-list">
                ${DATASET_LIST.map(d => `<button type="button" class="ce-btn" data-new="${esc(d.id)}"><i class="fa-solid fa-chart-simple"></i> ${esc(d.label)}</button>`).join('')}</div></div>`;
        el.addEventListener('click', (e) => {
            const show = e.target.closest('[data-show]');
            const add = e.target.closest('[data-new]');
            if (show) change(() => { layout.find(x => x.id === show.dataset.show).hidden = false; });
            else if (add) {
                const ds = add.dataset.new;
                change(() => layout.push({ id: `chart-${Date.now().toString(36)}`, kind: 'chart', w: 6, dataset: ds, type: ds === 'trend' ? 'line' : ds === 'sevByStatus' ? 'groupedBar' : 'bar', hidden: false }));
                toast(`Added chart: ${DATASETS[ds].label}`);
            } else return;
            closePop();
        });
        placePop(el, anchor);
    }

    // ------------------------------------------------------------ events
    let dragId = null;

    function onClick(e) {
        const tb = e.target.closest('[data-dw]');
        if (tb) {
            const a = tb.dataset.dw;
            if (a === 'edit') { editing = !editing; render(); }
            else if (a === 'add') openAddMenu(tb);
            else if (a === 'undo') stepLayout(undoStack, redoStack);
            else if (a === 'redo') stepLayout(redoStack, undoStack);
            else if (a === 'reset' && confirm('Restore the default dashboard layout and chart settings? Report data is not affected.')) {
                change(() => { layout = defaultLayout(); });
                if (window.ChartEngine) ChartEngine.resetLocal('dash-');
                render();
                toast('Dashboard restored to defaults');
            }
            return;
        }
        const btn = e.target.closest('.dw-tools [data-act]');
        if (!btn) return;
        const card = btn.closest('.dw-widget');
        const w = layout.find(x => x.id === card.dataset.id);
        if (!w) return;
        const act = btn.dataset.act;
        if (act === 'settings') {
            if (w.kind === 'chart') { if (window.ChartEngine) ChartEngine.open('dash-' + w.id); }
            else openKpiSettings(w, btn);
        } else if (act === 'size') {
            const sizes = w.kind === 'kpi' ? KPI_SIZES : CHART_SIZES;
            change(() => { w.w = sizes[(sizes.indexOf(w.w) + 1) % sizes.length]; });
        } else if (act === 'hide') {
            change(() => { w.hidden = !w.hidden; });
            if (w.hidden) toast('Widget hidden — use Add widget or Customize to show it again');
        } else if (act === 'left' || act === 'right') {
            const i = layout.indexOf(w), j = act === 'left' ? i - 1 : i + 1;
            if (j < 0 || j >= layout.length) return;
            change(() => { [layout[i], layout[j]] = [layout[j], layout[i]]; });
            const again = document.querySelector(`.dw-widget[data-id="${CSS.escape(w.id)}"] [data-act="${act}"]`);
            if (again) again.focus();
        }
    }

    function onDragStart(e) {
        const h = e.target.closest('[data-drag]');
        if (!h) return;
        dragId = h.dataset.drag;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', dragId);
        const card = h.closest('.dw-widget');
        e.dataTransfer.setDragImage(card, 20, 20);
        requestAnimationFrame(() => card.classList.add('dw-dragging'));
    }
    function onDragOver(e) {
        if (!dragId) return;
        const card = e.target.closest('.dw-widget');
        if (!card) return;
        e.preventDefault();
        document.querySelectorAll('.dw-drop-target').forEach(n => n !== card && n.classList.remove('dw-drop-target'));
        if (card.dataset.id !== dragId) card.classList.add('dw-drop-target');
    }
    function onDrop(e) {
        const card = e.target.closest('.dw-widget');
        if (!dragId || !card) return;
        e.preventDefault();
        const from = layout.findIndex(x => x.id === dragId);
        const to = layout.findIndex(x => x.id === card.dataset.id);
        dragId = null;
        if (from < 0 || to < 0 || from === to) { render(); return; }
        change(() => { const [m] = layout.splice(from, 1); layout.splice(to, 0, m); });
    }
    function onDragEnd() {
        dragId = null;
        document.querySelectorAll('.dw-dragging, .dw-drop-target').forEach(n => n.classList.remove('dw-dragging', 'dw-drop-target'));
    }

    function init() {
        const root = document.getElementById('dashWidgetRoot');
        if (!root || root.dataset.dwBound) return;
        root.dataset.dwBound = '1';
        root.addEventListener('click', onClick);
        root.addEventListener('change', (e) => {
            if (e.target.id !== 'dwSourceSelect') return;
            try { localStorage.setItem(SOURCE_KEY, e.target.value); } catch (err) { /* session only */ }
            render();
        });
        root.addEventListener('dragstart', onDragStart);
        root.addEventListener('dragover', onDragOver);
        root.addEventListener('drop', onDrop);
        root.addEventListener('dragend', onDragEnd);
        document.addEventListener('mousedown', (e) => { if (pop && !pop.contains(e.target)) closePop(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && pop) closePop(); });
    }

    window.DashboardWidgets = {
        render() { init(); render(); },
        resetLayout() { layout = defaultLayout(); persist(); render(); },
        _internals: { sanitizeWidget, DATASETS, KPI_DEFS }
    };

    // Self-check: layout sanitizer rejects junk and keeps valid entries.
    console.assert(sanitizeWidget({ id: 'total', kind: 'kpi', w: 99 }).w === 2, '[Dashboard] size clamp');
    console.assert(sanitizeWidget({ id: 'nope', kind: 'kpi' }) === null, '[Dashboard] unknown kpi');
    console.assert(sanitizeWidget({ id: 'x', kind: 'chart', dataset: 'evil' }).dataset === 'severity', '[Dashboard] dataset');
})();
