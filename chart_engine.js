// ALTISEC UNIVERSAL CHART ENGINE
// One versioned config schema, one renderer and one floating inspector for every
// Chart.js chart in the app (report preview, dashboard widgets).
//
//   ChartEngine.mount(id, spec)  register a chart bound to <canvas id=spec.canvasId||id>
//   spec.getData(datasetId) -> { labels:[], series:[{name, data:[], colors?}], empty?, dimension?, measure? }
//
// Data returned by getData is copied before any sort/top-N, so the source is never mutated.
// Per-chart overrides live in AppState.chartConfigs (store:'report', travels with drafts and
// accepted snapshots) or localStorage (store:'local', dashboard). "Save as default" is per chart id.
(function () {
    'use strict';

    const SCHEMA_VERSION = 1;
    const LS_LOCAL = 'altisec_chart_configs_v1';
    const LS_DEFAULTS = 'altisec_chart_defaults_v1';

    const TYPES = {
        pie:         { label: 'Pie',            icon: 'fa-chart-pie',       base: 'pie',       radial: true, shapes: ['cat'] },
        doughnut:    { label: 'Doughnut',       icon: 'fa-circle-notch',    base: 'doughnut',  radial: true, shapes: ['cat'] },
        polarArea:   { label: 'Polar area',     icon: 'fa-bullseye',        base: 'polarArea', radial: true, shapes: ['cat'] },
        bar:         { label: 'Column',         icon: 'fa-chart-column',    base: 'bar',       shapes: ['cat', 'time'] },
        hbar:        { label: 'Horizontal bar', icon: 'fa-chart-bar',       base: 'bar',       horizontal: true, shapes: ['cat', 'multi'] },
        groupedBar:  { label: 'Grouped bar',    icon: 'fa-chart-simple',    base: 'bar',       shapes: ['multi'] },
        stackedBar:  { label: 'Stacked bar',    icon: 'fa-layer-group',     base: 'bar',       stacked: true, shapes: ['multi'] },
        line:        { label: 'Line',           icon: 'fa-chart-line',      base: 'line',      shapes: ['cat', 'time', 'multi'] },
        area:        { label: 'Area',           icon: 'fa-chart-area',      base: 'line',      fill: true, shapes: ['cat', 'time', 'multi'] },
        stackedArea: { label: 'Stacked area',   icon: 'fa-mountain',        base: 'line',      fill: true, stacked: true, shapes: ['multi'] },
        radar:       { label: 'Radar',          icon: 'fa-satellite-dish',  base: 'radar',     shapes: ['cat', 'multi'], minPoints: 3 },
        kpi:         { label: 'KPI tiles',      icon: 'fa-hashtag',         html: true,        shapes: ['cat'] },
        table:       { label: 'Data table',     icon: 'fa-table',           html: true,        shapes: ['cat', 'time', 'multi'] }
    };

    const PALETTES = {
        source:    { label: 'Report default', colors: null },
        soc:       { label: 'SOC accent',     colors: ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#22d3ee', '#fb923c'] },
        severity:  { label: 'Severity',       colors: ['#b91c1c', '#ea580c', '#d97706', '#0284c7', '#16a34a', '#64748b'] },
        corporate: { label: 'Corporate',      colors: ['#1f3864', '#2f5597', '#4472c4', '#8faadc', '#a5a5a5', '#ed7d31'] },
        ocean:     { label: 'Ocean',          colors: ['#0c4a6e', '#0369a1', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd'] },
        violet:    { label: 'Violet',         colors: ['#4c1d95', '#6d28d9', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'] },
        emerald:   { label: 'Emerald',        colors: ['#064e3b', '#047857', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'] },
        mono:      { label: 'Monochrome',     colors: ['#0f172a', '#334155', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0'] }
    };

    const BASE = {
        v: SCHEMA_VERSION,
        type: 'bar',
        title: '', subtitle: '', xTitle: '', yTitle: '', unit: '',
        legend: { show: true, position: 'top' },
        dataLabels: false, tooltip: true, grid: true, axis: true,
        decimals: -1,
        palette: 'source', colorByPoint: null, colors: {},
        sort: 'none', topN: 0, other: false,
        dataset: null
    };

    const registry = {};
    const history = [];
    let historyPos = 0;
    let insp = null;
    let lastTab = 'type';

    // ---------------------------------------------------------------- utils
    const clone = (o) => JSON.parse(JSON.stringify(o));
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const labelKey = (l) => Array.isArray(l) ? l.join(' ') : String(l);
    const appState = () => (typeof AppState !== 'undefined' ? AppState : null);
    const toast = (m) => { if (typeof showToast === 'function') showToast(m); };

    function loadLS(key) {
        try { const v = JSON.parse(localStorage.getItem(key) || '{}'); return v && typeof v === 'object' ? v : {}; }
        catch (e) { return {}; }
    }
    function saveLS(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.warn('[ChartEngine] storage write failed', e); }
    }

    function alpha(color, a) {
        const m = /^#([0-9a-f]{6})$/i.exec(color || '');
        if (!m) return color;
        const n = parseInt(m[1], 16);
        return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    }

    // ---------------------------------------------------------------- schema
    // Accepts anything (legacy, malformed, future versions) and keeps only valid known fields.
    function sanitize(raw) {
        const out = {};
        if (!raw || typeof raw !== 'object') return out;
        if (typeof raw.type === 'string' && TYPES[raw.type]) out.type = raw.type;
        ['title', 'subtitle', 'xTitle', 'yTitle', 'unit'].forEach(k => { if (typeof raw[k] === 'string') out[k] = raw[k].slice(0, 160); });
        ['dataLabels', 'tooltip', 'grid', 'axis', 'other'].forEach(k => { if (typeof raw[k] === 'boolean') out[k] = raw[k]; });
        if (typeof raw.colorByPoint === 'boolean') out.colorByPoint = raw.colorByPoint;
        if (raw.legend && typeof raw.legend === 'object') {
            const l = {};
            if (typeof raw.legend.show === 'boolean') l.show = raw.legend.show;
            if (['top', 'right', 'bottom', 'left'].includes(raw.legend.position)) l.position = raw.legend.position;
            if (Object.keys(l).length) out.legend = l;
        }
        if (Number.isInteger(raw.decimals) && raw.decimals >= -1 && raw.decimals <= 4) out.decimals = raw.decimals;
        if (typeof raw.palette === 'string' && PALETTES[raw.palette]) out.palette = raw.palette;
        if (['none', 'asc', 'desc'].includes(raw.sort)) out.sort = raw.sort;
        if (Number.isInteger(raw.topN) && raw.topN >= 0 && raw.topN <= 50) out.topN = raw.topN;
        if (typeof raw.dataset === 'string') out.dataset = raw.dataset.slice(0, 64);
        if (raw.colors && typeof raw.colors === 'object') {
            const c = {};
            Object.keys(raw.colors).slice(0, 60).forEach(k => {
                if (/^#[0-9a-f]{6}$/i.test(raw.colors[k])) c[String(k).slice(0, 120)] = raw.colors[k];
            });
            if (Object.keys(c).length) out.colors = c;
        }
        return out;
    }

    function merge(...layers) {
        const out = clone(BASE);
        layers.forEach(l => {
            if (!l) return;
            const s = sanitize(l);
            Object.keys(s).forEach(k => {
                if (k === 'legend') out.legend = Object.assign({}, out.legend, s.legend);
                else if (k === 'colors') out.colors = Object.assign({}, out.colors, s.colors);
                else out[k] = s[k];
            });
        });
        out.v = SCHEMA_VERSION;
        return out;
    }

    // Only what differs from the baseline is stored, so later "save as default" changes still flow through.
    function diff(full, baseline) {
        const out = {};
        Object.keys(BASE).forEach(k => {
            if (k === 'v') return;
            if (JSON.stringify(full[k]) !== JSON.stringify(baseline[k])) out[k] = clone(full[k]);
        });
        return Object.keys(out).length ? Object.assign({ v: SCHEMA_VERSION }, out) : null;
    }

    function savedDefault(id) { return loadLS(LS_DEFAULTS)[id] || null; }
    function baseline(reg) { return merge(reg.defaults, savedDefault(reg.id)); }

    // store: 'report' (AppState.chartConfigs / AppState.chartDataOverrides) | 'local' (localStorage) | 'custom' (spec.readConfig / spec.writeConfig,
    // e.g. a cadence slide block that keeps its chart settings inside the deck)
    function readStore(reg) {
        if (reg.store === 'custom') return typeof reg.readConfig === 'function' ? reg.readConfig() : null;
        if (reg.store === 'report') {
            const s = appState();
            return (s && s.chartConfigs && s.chartConfigs[reg.id]) || null;
        }
        return loadLS(LS_LOCAL)[reg.id] || null;
    }
    function writeStore(reg, override) {
        if (reg.store === 'custom') { if (typeof reg.writeConfig === 'function') reg.writeConfig(override ? clone(override) : null); return; }
        if (reg.store === 'report') {
            const s = appState();
            if (!s) return;
            if (!s.chartConfigs || typeof s.chartConfigs !== 'object') s.chartConfigs = {};
            if (override) s.chartConfigs[reg.id] = override; else delete s.chartConfigs[reg.id];
        } else {
            const all = loadLS(LS_LOCAL);
            if (override) all[reg.id] = override; else delete all[reg.id];
            saveLS(LS_LOCAL, all);
        }
    }

    function readDataStore(reg) {
        if (reg.store === 'custom' && typeof reg.readData === 'function') return reg.readData();
        if (reg.store === 'report') {
            const s = appState();
            return (s && s.chartDataOverrides && s.chartDataOverrides[reg.id]) ? clone(s.chartDataOverrides[reg.id]) : null;
        }
        return null;
    }

    function writeDataStore(reg, override) {
        if (reg.store === 'custom' && typeof reg.writeData === 'function') {
            reg.writeData(override ? clone(override) : null);
            return;
        }
        if (reg.store === 'report') {
            const s = appState();
            if (!s) return;
            if (!s.chartDataOverrides || typeof s.chartDataOverrides !== 'object') s.chartDataOverrides = {};
            if (override) s.chartDataOverrides[reg.id] = clone(override);
            else delete s.chartDataOverrides[reg.id];

            if (typeof recordAuditLog === 'function') {
                const chartTitle = reg.title || reg.id;
                const rep = typeof getActiveReportContext === 'function' ? getActiveReportContext() : { displayTag: '' };
                const actionText = override ? `Chart Data Override Applied (${chartTitle})` : `Chart Data Override Reset (${chartTitle})`;
                const detailsText = override 
                    ? `${rep.displayTag} Applied telemetry data overrides to chart "${chartTitle}"`
                    : `${rep.displayTag} Reset chart "${chartTitle}" to default telemetry data`;
                recordAuditLog("report", actionText, detailsText);
            }
        }
    }

    function getAppliedData(reg, cfg) {
        const stored = readDataStore(reg);
        if (stored) return stored;
        return typeof reg.getData === 'function' ? reg.getData(cfg ? cfg.dataset : undefined) : null;
    }

    function getOriginalData(reg, cfg) {
        if (typeof reg.getOriginalData === 'function') {
            return clone(reg.getOriginalData(cfg ? cfg.dataset : undefined));
        }
        return typeof reg.getData === 'function' ? clone(reg.getData(cfg ? cfg.dataset : undefined)) : null;
    }

    function effective(reg) { return merge(reg.defaults, savedDefault(reg.id), readStore(reg)); }

    // ---------------------------------------------------------------- data
    function normalizeData(d) {
        d = d || {};
        const labels = Array.isArray(d.labels)
            ? d.labels.map(l => Array.isArray(l) ? l.slice() : (l == null ? '' : String(l)))
            : [];
        const series = (Array.isArray(d.series) ? d.series : []).map((s, i) => ({
            name: String(s && s.name != null ? s.name : `Series ${i + 1}`),
            data: labels.map((_, j) => {
                const rawVal = s && s.data ? s.data[j] : 0;
                const num = (typeof rawVal === 'number') ? rawVal : parseFloat(String(rawVal).replace(/[^0-9.-]/g, ''));
                return Number.isFinite(num) ? num : 0;
            }),
            colors: s && Array.isArray(s.colors) ? s.colors.slice() : (s && typeof s.colors === 'string' ? s.colors : null)
        }));
        return {
            labels, series,
            empty: !!d.empty || !labels.length || !series.length,
            time: !!d.time,
            dimension: d.dimension || 'Category',
            measure: d.measure || 'Count'
        };
    }

    function dataInfo(raw, reg) {
        const time = !!(reg.time || raw.time);
        return { shape: raw.series.length > 1 ? 'multi' : (time ? 'time' : 'cat'), time, points: raw.labels.length, seriesCount: raw.series.length };
    }

    function whyIncompatible(typeKey, info) {
        const t = TYPES[typeKey];
        if (!t) return 'Unknown chart type.';
        if (t.shapes.includes(info.shape)) {
            if (t.minPoints && info.points < t.minPoints) return `Needs at least ${t.minPoints} categories (this data has ${info.points}).`;
            return '';
        }
        if (t.radial) return info.shape === 'multi'
            ? `Shows a single series; this data has ${info.seriesCount} series.`
            : 'Time-series data reads best on an axis — use Column, Line or Area.';
        if (typeKey === 'stackedBar' || typeKey === 'stackedArea' || typeKey === 'groupedBar') return 'Needs two or more series — use Column or Line for a single series.';
        if (typeKey === 'bar') return 'Several series — use Grouped or Stacked bar.';
        if (typeKey === 'hbar') return 'Time runs left to right — use Column, Line or Area.';
        if (typeKey === 'kpi') return 'KPI tiles show one value per category; this data has several series.';
        if (typeKey === 'radar') return 'Radar compares categories, not points in time.';
        return 'Not compatible with this data.';
    }

    function firstCompatible(preferred, info) {
        if (preferred && !whyIncompatible(preferred, info)) return preferred;
        return Object.keys(TYPES).find(k => !whyIncompatible(k, info)) || 'table';
    }

    function transform(raw, cfg, info) {
        let pts = raw.labels.map((label, j) => ({
            label,
            values: raw.series.map(s => s.data[j]),
            colors: raw.series.map(s => Array.isArray(s.colors) && s.colors.length ? s.colors[j % s.colors.length] : null)
        }));
        if (!info.time) {
            const total = p => p.values.reduce((a, b) => a + b, 0);
            if (cfg.sort === 'desc') pts.sort((a, b) => total(b) - total(a));
            else if (cfg.sort === 'asc') pts.sort((a, b) => total(a) - total(b));
            if (cfg.topN > 0 && pts.length > cfg.topN) {
                const rest = pts.slice(cfg.topN);
                pts = pts.slice(0, cfg.topN);
                if (cfg.other) pts.push({ label: 'Other', values: raw.series.map((_, i) => rest.reduce((t, p) => t + p.values[i], 0)), colors: raw.series.map(() => '#94a3b8') });
            }
        }
        return {
            labels: pts.map(p => p.label),
            series: raw.series.map((s, i) => ({
                name: s.name,
                data: pts.map(p => p.values[i]),
                pointColors: pts.map(p => p.colors[i]),
                color: typeof s.colors === 'string' ? s.colors : null
            })),
            empty: raw.empty, dimension: raw.dimension, measure: raw.measure
        };
    }

    // ---------------------------------------------------------------- formatting & colors
    function makeFormatter(cfg, reg) {
        return (v, label) => {
            if (reg.labelFormatter && label !== undefined) {
                const s = reg.labelFormatter(v, labelKey(label));
                if (s != null) return s;
            }
            const n = Number(v);
            if (!Number.isFinite(n)) return String(v);
            const d = cfg.decimals >= 0 ? cfg.decimals : (Number.isInteger(n) ? 0 : 2);
            return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }) + (cfg.unit || '');
        };
    }

    function themeColors(surface) {
        if (surface === 'paper') return { text: '#0f172a', muted: '#475569', grid: '#e2e8f0', surface: '#ffffff' };
        const cs = getComputedStyle(document.body);
        const g = (n, f) => (cs.getPropertyValue(n) || '').trim() || f;
        return { text: g('--ink', '#e7ecf5'), muted: g('--ink-muted', '#93a1b8'), grid: g('--line-strong', 'rgba(148,163,184,.2)'), surface: g('--surface-2', '#111a2a') };
    }

    function usesPointColors(type, cfg, view) {
        const t = TYPES[type];
        if (t.radial || t.html) return true;
        if (t.base !== 'bar' || view.series.length !== 1) return false;
        if (cfg.colorByPoint != null) return cfg.colorByPoint;
        return cfg.palette === 'source' && view.series[0].pointColors.some(Boolean);
    }

    function resolveColors(view, cfg, type) {
        const pal = (PALETTES[cfg.palette] && PALETTES[cfg.palette].colors) || PALETTES.soc.colors;
        const fromSource = cfg.palette === 'source';
        const custom = cfg.colors || {};
        const byPoint = usesPointColors(type, cfg, view);
        return view.series.map((s, i) => ({
            byPoint,
            colors: view.labels.map((lab, j) => custom[labelKey(lab)] || (fromSource && s.pointColors[j]) || pal[j % pal.length]),
            color: custom[s.name] || (fromSource && (s.color || s.pointColors.find(Boolean))) || pal[i % pal.length]
        }));
    }

    // ---------------------------------------------------------------- chart.js config
    function makeLabelsPlugin(fmt, opts) {
        return {
            id: 'ceDataLabels',
            afterDatasetsDraw(chart) {
                if (!opts.display) return;
                const { ctx } = chart;
                chart.data.datasets.forEach((ds, i) => {
                    const meta = chart.getDatasetMeta(i);
                    if (meta.hidden || !chart.isDatasetVisible(i)) return;
                    meta.data.forEach((el, j) => {
                        const v = ds.data[j];
                        if (v == null || (v === 0 && (opts.radial || opts.stacked))) return;
                        if (opts.radial && !chart.getDataVisibility(j)) return;
                        const text = fmt(v, chart.data.labels[j]);
                        ctx.save();
                        ctx.font = '700 11px Arial, sans-serif';
                        ctx.fillStyle = opts.color;
                        if (opts.base === 'bar' && opts.stacked) {
                            ctx.fillStyle = '#ffffff';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            if (opts.horizontal) ctx.fillText(text, (el.x + el.base) / 2, el.y);
                            else ctx.fillText(text, el.x, (el.y + el.base) / 2);
                        } else if (opts.base === 'bar') {
                            if (opts.horizontal) { ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, el.x + 6, el.y); }
                            else { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(text, el.x, el.y - 4); }
                        } else if (opts.radial) {
                            const p = el.tooltipPosition();
                            ctx.fillStyle = '#ffffff';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(text, p.x, p.y);
                        } else {
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';
                            ctx.fillText(text, el.x, el.y - 6);
                        }
                        ctx.restore();
                    });
                });
            }
        };
    }

    function buildChartConfig(reg, type, cfg, view) {
        const t = TYPES[type];
        const theme = themeColors(reg.surface);
        const cols = resolveColors(view, cfg, type);
        const fmt = makeFormatter(cfg, reg);
        const plain = makeFormatter(cfg, {});
        const multi = view.series.length > 1;

        const datasets = view.series.map((s, i) => {
            const c = cols[i];
            const ds = { label: s.name, data: s.data.slice() };
            if (t.base === 'bar') {
                Object.assign(ds, { backgroundColor: c.byPoint ? c.colors : c.color, borderRadius: 4, borderWidth: 0, maxBarThickness: reg.barThickness || 38 });
            } else if (t.base === 'line') {
                Object.assign(ds, {
                    borderColor: c.color, backgroundColor: alpha(c.color, t.stacked ? 0.55 : 0.18), pointBackgroundColor: c.color,
                    fill: t.fill ? (t.stacked && i > 0 ? '-1' : 'origin') : false, tension: 0.3, cubicInterpolationMode: 'monotone', // smooth without overshooting real values pointRadius: 3, pointHoverRadius: 5, borderWidth: 2
                });
            } else if (t.base === 'radar') {
                Object.assign(ds, { borderColor: c.color, backgroundColor: alpha(c.color, 0.2), pointBackgroundColor: c.color, borderWidth: 2 });
            } else {
                Object.assign(ds, {
                    backgroundColor: t.base === 'polarArea' ? c.colors.map(x => alpha(x, 0.78)) : c.colors,
                    borderColor: theme.surface, borderWidth: 2, hoverOffset: 6
                });
            }
            return ds;
        });

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: (insp && insp.id === reg.id) ? 0 : 280 },
            indexAxis: t.horizontal ? 'y' : 'x',
            layout: { padding: { top: cfg.dataLabels && t.base === 'bar' && !t.horizontal && !t.stacked ? 18 : 6, right: cfg.dataLabels && t.horizontal && !t.stacked ? 40 : 8, left: 4, bottom: 2 } },
            plugins: {
                legend: { display: cfg.legend.show, position: cfg.legend.position, labels: { color: theme.text, boxWidth: 10, boxHeight: 10, padding: 12, font: { size: 11, weight: '600' } } },
                title: { display: !!cfg.title && !reg.titleInHeader, text: cfg.title, color: theme.text, font: { size: 13, weight: '700' }, padding: { bottom: cfg.subtitle ? 2 : 10 } },
                subtitle: { display: !!cfg.subtitle && !reg.titleInHeader, text: cfg.subtitle, color: theme.muted, font: { size: 11 }, padding: { bottom: 10 } },
                tooltip: {
                    enabled: cfg.tooltip,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', titleColor: '#e2e8f0', bodyColor: '#f8fafc',
                    borderColor: 'rgba(56, 189, 248, 0.45)', borderWidth: 1, padding: 10, cornerRadius: 8,
                    callbacks: {
                        label: (ctx) => {
                            const name = (t.radial || !multi) ? labelKey(ctx.label) : ctx.dataset.label;
                            let pct = '';
                            if (t.radial) {
                                const total = ctx.dataset.data.reduce((a, b) => a + (+b || 0), 0);
                                if (total) pct = ` (${(ctx.raw / total * 100).toFixed(1)}%)`;
                            }
                            return ` ${name}: ${fmt(ctx.raw, ctx.label)}${pct}`;
                        }
                    }
                }
            }
        };

        if (t.base === 'bar' || t.base === 'line') {
            const valueAxis = {
                display: cfg.axis, beginAtZero: true, stacked: !!t.stacked, grace: cfg.dataLabels ? '15%' : 0,
                grid: { display: cfg.grid, color: theme.grid }, border: { display: false },
                ticks: { color: theme.muted, font: { size: 11 }, precision: 0, callback: (v) => plain(v) },
                title: { display: !!cfg.yTitle, text: cfg.yTitle, color: theme.muted, font: { size: 11, weight: '600' } }
            };
            const catAxis = {
                stacked: !!t.stacked, grid: { display: false }, border: { color: theme.grid },
                ticks: { color: theme.text, font: { size: 11, weight: '600' }, autoSkip: !t.horizontal },
                title: { display: !!cfg.xTitle, text: cfg.xTitle, color: theme.muted, font: { size: 11, weight: '600' } }
            };
            options.scales = t.horizontal ? { x: valueAxis, y: catAxis } : { x: catAxis, y: valueAxis };
        } else if (t.base === 'radar' || t.base === 'polarArea') {
            options.scales = { r: {
                beginAtZero: true, grid: { display: cfg.grid, color: theme.grid }, angleLines: { color: theme.grid },
                pointLabels: { display: t.base === 'radar', color: theme.text, font: { size: 10.5, weight: '600' } },
                ticks: { display: false }
            } };
        }
        if (t.base === 'doughnut') options.cutout = '62%';

        const plugin = makeLabelsPlugin(fmt, { display: cfg.dataLabels, color: theme.text, base: t.base, horizontal: !!t.horizontal, stacked: !!t.stacked, radial: !!t.radial });
        return { type: t.base, data: { labels: view.labels.slice(), datasets }, options, plugins: [plugin] };
    }

    // ---------------------------------------------------------------- html renderers
    function tableHtml(view, cfg, reg) {
        const fmt = makeFormatter(cfg, reg);
        const multi = view.series.length > 1;
        const head = `<tr><th>${esc(view.dimension)}</th>${view.series.map(s => `<th class="num">${esc(multi ? s.name : view.measure)}</th>`).join('')}</tr>`;
        const rows = view.labels.map((l, j) => `<tr><td>${esc(labelKey(l))}</td>${view.series.map(s => `<td class="num">${esc(fmt(s.data[j], l))}</td>`).join('')}</tr>`).join('');
        const totals = reg.labelFormatter ? '' : `<tr><th>Total</th>${view.series.map(s => `<th class="num">${esc(fmt(s.data.reduce((a, b) => a + b, 0)))}</th>`).join('')}</tr>`;
        return `<table class="ce-table"><thead>${head}</thead><tbody>${rows || `<tr><td colspan="${view.series.length + 1}">No data</td></tr>`}</tbody>${rows ? `<tfoot>${totals}</tfoot>` : ''}</table>`;
    }

    function kpiHtml(view, cfg, reg, type) {
        const fmt = makeFormatter(cfg, reg);
        const s = view.series[0] || { data: [] };
        const total = s.data.reduce((a, b) => a + b, 0) || 1;
        const cols = resolveColors(view, cfg, type)[0] || { colors: [] };
        return `<div class="ce-kpis">${view.labels.map((l, j) => `
            <div class="ce-kpi"><span title="${esc(labelKey(l))}">${esc(labelKey(l))}</span><b>${esc(fmt(s.data[j], l))}</b>
            <i><em style="width:${Math.round(s.data[j] / total * 100)}%; background:${esc(cols.colors[j] || '#38bdf8')}"></em></i></div>`).join('')}</div>`;
    }

    function ariaSummary(reg, view) {
        const parts = view.labels.slice(0, 12).map((l, j) => `${labelKey(l)}: ${view.series.map(s => s.data[j]).join(' / ')}`);
        return `${reg.name}. ${view.empty ? 'No data.' : parts.join('; ')}`;
    }

    // ---------------------------------------------------------------- render
    function hostOf(canvas) { return canvas.parentElement; }

    function showState(host, kind, text) {
        const el = document.createElement('div');
        el.className = `ce-state${kind === 'error' ? ' ce-error' : ''}`;
        el.innerHTML = `<i class="fa-solid ${kind === 'error' ? 'fa-triangle-exclamation' : 'fa-chart-simple'}"></i><span>${esc(text)}</span>`;
        host.appendChild(el);
    }

    function ensureEditButton(reg, host) {
        let btn = host.querySelector(':scope > .ce-edit-btn');
        if (reg.editButton === false) { if (btn) btn.remove(); return; }
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ce-edit-btn';
            btn.setAttribute('data-html2canvas-ignore', 'true');
            btn.setAttribute('contenteditable', 'false');
            btn.innerHTML = '<i class="fa-solid fa-sliders"></i> Edit chart';
            host.appendChild(btn);
        }
        btn.classList.toggle('ce-on-dark', reg.surface === 'app');
        btn.setAttribute('aria-label', `Edit chart: ${reg.name}`);
        btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); open(reg.id); };
    }

    function render(id, draftCfg) {
        const reg = registry[id];
        if (!reg || typeof Chart === 'undefined') return null;
        const canvas = document.getElementById(reg.canvasId);
        if (!canvas) return null;
        const host = hostOf(canvas);
        host.classList.add('ce-host', reg.surface === 'app' ? 'ce-surface-app' : 'ce-surface-paper');
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

        if (reg._chart && reg._chart.canvas !== canvas) { try { reg._chart.destroy(); } catch (e) { /* stale */ } }
        const prev = Chart.getChart(canvas);
        if (prev) prev.destroy();
        reg._chart = null;
        host.querySelectorAll(':scope > .ce-html-view, :scope > .ce-state').forEach(n => n.remove());
        ensureEditButton(reg, host);

        if (!canvas.dataset.ceClickBound) {
            canvas.dataset.ceClickBound = 'true';
            canvas.style.cursor = 'pointer';
            canvas.title = 'Click to edit chart design and telemetry data';
            canvas.addEventListener('click', (e) => {
                if (typeof studioMode !== 'undefined' && studioMode === 'preview') return;
                e.preventDefault();
                e.stopPropagation();
                open(reg.id);
            });
        }

        const cfg = draftCfg ? merge(draftCfg) : effective(reg);
        // while the inspector edits this chart's data, preview the draft values instead of the applied data
        const isExporting = !!window.__ce_exporting;
        const draftData = (!isExporting && insp && insp.id === id && insp.draftData) ? insp.draftData : null;
        let raw;
        try { raw = normalizeData(draftData || getAppliedData(reg, cfg)); }
        catch (e) {
            console.error('[ChartEngine] data error', id, e);
            canvas.style.display = 'none';
            showState(host, 'error', 'Chart data could not be loaded');
            return null;
        }
        const info = dataInfo(raw, reg);
        const type = whyIncompatible(cfg.type, info) ? firstCompatible(reg.defaults.type, info) : cfg.type;
        const view = transform(raw, cfg, info);
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', ariaSummary(reg, view));

        try {
            if (TYPES[type].html) {
                canvas.style.display = 'none';
                canvas.dataset.ceHidden = '1';
                const div = document.createElement('div');
                div.className = 'ce-html-view';
                div.innerHTML = type === 'table' ? tableHtml(view, cfg, reg) : kpiHtml(view, cfg, reg, type);
                host.appendChild(div);
            } else {
                canvas.style.display = '';
                delete canvas.dataset.ceHidden;
                reg._chart = new Chart(canvas, buildChartConfig(reg, type, cfg, view));
            }
            if (raw.empty) showState(host, 'empty', reg.emptyText || 'No data for this period');
        } catch (e) {
            console.error('[ChartEngine] render error', id, e);
            canvas.style.display = 'none';
            showState(host, 'error', 'Chart could not be rendered');
        }
        return { type, info, view };
    }

    function mount(id, spec) {
        const prev = registry[id];
        registry[id] = Object.assign({ id, canvasId: id, name: id, surface: 'paper', store: 'report', defaults: {} }, spec, { _chart: prev ? prev._chart : null });
        render(id);
        if (insp && insp.id === id) renderInspector();
    }

    function renderAll(filter) {
        Object.keys(registry).forEach(id => {
            const reg = registry[id];
            if (filter && !filter(reg)) return;
            if (document.getElementById(reg.canvasId)) render(id, insp && insp.id === id ? insp.draft : null);
        });
    }

    // ---------------------------------------------------------------- history
    function pushHistory(entry) {
        history.splice(historyPos);
        history.push(entry);
        if (history.length > 100) history.shift();
        historyPos = history.length;
        syncHistoryButtons();
    }
    function stepHistory(dir) {
        const idx = dir < 0 ? historyPos - 1 : historyPos;
        const entry = history[idx];
        if (!entry || !registry[entry.id]) return false;
        const reg = registry[entry.id];
        const target = dir < 0 ? entry.before : entry.after;
        if (entry.kind === 'data') {
            writeDataStore(reg, target);
            if (typeof reg.setData === 'function') reg.setData(clone(target));
            if (typeof reg.onDataCommit === 'function') reg.onDataCommit(clone(target));
        } else {
            writeStore(reg, target);
        }
        historyPos = dir < 0 ? historyPos - 1 : historyPos + 1;
        if (insp && insp.id === entry.id) {
            insp.committed = effective(reg);
            insp.draft = clone(insp.committed);
            insp.draftData = editableData(reg, insp.committed);
            insp.dirty = false;
            renderInspector();
            if (typeof reg.onDataPreview === 'function') reg.onDataPreview(insp.draftData);
        }
        render(entry.id);
        syncHistoryButtons();
        toast(dir < 0 ? `Undid chart change: ${reg.name}` : `Redid chart change: ${reg.name}`);
        return true;
    }
    function syncHistoryButtons() {
        if (!insp || !insp.panel) return;
        const u = insp.panel.querySelector('[data-act="undo"]');
        const r = insp.panel.querySelector('[data-act="redo"]');
        if (u) u.disabled = historyPos === 0;
        if (r) r.disabled = historyPos >= history.length;
    }

    function commit(reg, override, label) {
        const before = readStore(reg);
        writeStore(reg, override);
        pushHistory({ id: reg.id, before: before ? clone(before) : null, after: override ? clone(override) : null });
        audit(reg, label);
        if (typeof reg.onChange === 'function') reg.onChange();
    }

    function audit(reg, label) {
        if (typeof recordAuditLog !== 'function') return;
        try { recordAuditLog(reg.auditCategory || 'report', 'Chart Customized', `${label}: ${reg.name}`); } catch (e) { /* audit is best-effort */ }
    }

    // ---------------------------------------------------------------- editable data
    function editableData(reg, cfg) {
        const applied = getAppliedData(reg, cfg);
        if (!applied && typeof reg.getData !== 'function') return null;
        const d = normalizeData(applied || reg.getData(cfg ? cfg.dataset : undefined));
        return {
            labels: d.labels.map(labelKey),
            series: d.series.map(s => ({
                name: s.name,
                data: s.data.slice(),
                colors: s.colors ? (Array.isArray(s.colors) ? s.colors.slice() : s.colors) : null
            })),
            time: d.time,
            dimension: d.dimension,
            measure: d.measure
        };
    }

    function commitData(reg, data) {
        const before = editableData(reg, effective(reg));
        writeDataStore(reg, data);
        if (typeof reg.setData === 'function') reg.setData(clone(data));
        pushHistory({ id: reg.id, kind: 'data', before, after: clone(data) });
        audit(reg, 'Edited chart data');
        if (typeof reg.onChange === 'function') reg.onChange();
        if (typeof reg.onDataCommit === 'function') reg.onDataCommit(clone(data));
    }

    // Tab- or comma-separated text (Excel copy): first row = [category heading, series names...]
    function parsePasted(text) {
        const lines = String(text || '').split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.trim());
        if (lines.length < 2) return null;
        const sep = lines[0].includes('\t') ? '\t' : ',';
        const rows = lines.map(l => l.split(sep).map(c => c.trim()));
        const head = rows[0];
        if (head.length < 2) return null;
        const num = (c) => { const n = parseFloat(String(c).replace(/[,%\s]/g, '')); return Number.isFinite(n) ? n : 0; };
        return {
            dimension: head[0] || 'Category',
            labels: rows.slice(1).map(r => r[0]),
            series: head.slice(1).map((name, i) => ({ name: name || `Series ${i + 1}`, data: rows.slice(1).map(r => num(r[i + 1])), colors: null }))
        };
    }

    function dataEditorHtml(dd) {
        const cell = (k, v, extra = '') => `<input type="text" data-cell="${k}" value="${esc(v)}" ${extra}>`;
        return `
            <div class="ce-grid-wrap"><table class="ce-grid">
                <thead><tr><th><input type="text" data-cell="dim" value="${esc(dd.dimension || 'Category')}" aria-label="Category column header" style="width:100%; font-weight:600;"></th>${dd.series.map((s, i) => `
                    <th><div class="ce-grid-h">${cell(`h,${i}`, s.name, `aria-label="Series ${i + 1} name"`)}
                    <button type="button" class="ce-grid-x" data-act="del-series" data-i="${i}" ${dd.series.length > 1 ? '' : 'disabled'} title="Remove series" aria-label="Remove series ${esc(s.name)}">×</button></div></th>`).join('')}<th></th></tr></thead>
                <tbody>${dd.labels.map((l, r) => `<tr><td>${cell(`l,${r}`, l, `aria-label="Row ${r + 1} label"`)}</td>${dd.series.map((s, i) => `<td>${cell(`v,${r},${i}`, (s.data && s.data[r] != null) ? s.data[r] : 0, `inputmode="decimal" class="num" aria-label="${esc(s.name)} for ${esc(l)}"`)}</td>`).join('')}
                    <td><button type="button" class="ce-grid-x" data-act="del-row" data-i="${r}" ${dd.labels.length > 1 ? '' : 'disabled'} title="Remove row" aria-label="Remove row ${esc(l)}">×</button></td></tr>`).join('')}</tbody>
            </table></div>
            <div class="ce-grid-btns">
                <button type="button" class="ce-btn" data-act="add-row"><i class="fa-solid fa-plus"></i> Row</button>
                <button type="button" class="ce-btn" data-act="add-series"><i class="fa-solid fa-plus"></i> Series</button>
            </div>
            <details class="ce-paste"><summary>Paste from Excel</summary>
                <textarea id="ce-paste" rows="5" placeholder="Copy cells from Excel and paste here.&#10;First row: category heading, then series names."></textarea>
                <button type="button" class="ce-btn" data-act="apply-paste">Use pasted data</button>
            </details>`;
    }

    // ---------------------------------------------------------------- inspector
    function applicable(key, type, info) {
        const t = TYPES[type];
        const reasons = {
            legend: t.html ? 'Not used by tables or KPI tiles.' : '',
            dataLabels: t.html ? 'Tables and tiles always show values.' : '',
            tooltip: t.html ? 'Not used by tables or KPI tiles.' : '',
            grid: t.html ? 'Not used by tables or KPI tiles.' : (t.base === 'pie' || t.base === 'doughnut') ? 'Pie charts have no gridlines.' : '',
            axis: (t.base === 'bar' || t.base === 'line') ? '' : 'Only axis-based charts have a value axis.',
            axisTitles: (t.base === 'bar' || t.base === 'line') ? '' : 'Only axis-based charts have axis titles.',
            colorByPoint: (t.base === 'bar' && info.seriesCount === 1) ? '' : 'Only applies to single-series bar charts.',
            sort: info.time ? 'Time-series data keeps its chronological order.' : '',
            topN: info.time ? 'Time-series data keeps every period.' : ''
        };
        return reasons[key] || '';
    }

    const sw = (k, checked, reason) => `
        <div class="ce-row${reason ? ' disabled' : ''}" ${reason ? `title="${esc(reason)}"` : ''}>
            <label for="ce-${k}">${esc(SW_LABELS[k])}</label>
            <span class="ce-switch"><input type="checkbox" id="ce-${k}" data-k="${k}" ${checked ? 'checked' : ''} ${reason ? 'disabled' : ''}><span></span></span>
        </div>`;
    const SW_LABELS = { 'legend.show': 'Show legend', dataLabels: 'Data labels', tooltip: 'Tooltips', grid: 'Gridlines', axis: 'Value axis', colorByPoint: 'Vary colors by category', other: 'Group remainder as “Other”' };

    function inspectorBody(reg, state) {
        const d = insp.draft;
        const { type, info, view } = state;
        const tab = insp.tab;

        if (tab === 'type') {
            const shapeText = info.shape === 'multi' ? `${info.seriesCount} series × ${info.points} categories` : info.shape === 'time' ? `Time series · ${info.points} periods` : `Categorical · ${info.points} categories`;
            const ax = applicable('axisTitles', type, info);
            return `
            <div class="ce-sec"><h4>Chart type</h4>
                <div class="ce-types">${Object.keys(TYPES).map(k => {
                    const why = whyIncompatible(k, info);
                    return `<button type="button" class="ce-type${k === type ? ' active' : ''}" data-type="${k}" ${why ? `disabled title="${esc(why)}"` : `title="${esc(TYPES[k].label)}"`} aria-pressed="${k === type}"><i class="fa-solid ${TYPES[k].icon}"></i>${esc(TYPES[k].label)}</button>`;
                }).join('')}</div>
                <p class="ce-note"><i class="fa-solid fa-circle-info"></i>${esc(shapeText)}. Types that don't fit this data are disabled — hover one to see why.</p>
                ${d.type !== type ? `<p class="ce-note"><i class="fa-solid fa-triangle-exclamation"></i>Saved type “${esc(TYPES[d.type].label)}” doesn't fit the current data, so “${esc(TYPES[type].label)}” is shown.</p>` : ''}
            </div>
            <div class="ce-sec"><h4>Titles</h4>
                <div class="ce-field"><label for="ce-title">Chart title</label><input type="text" id="ce-title" data-k="title" value="${esc(d.title)}" placeholder="None (section heading is used)"></div>
                <div class="ce-field"><label for="ce-subtitle">Subtitle</label><input type="text" id="ce-subtitle" data-k="subtitle" value="${esc(d.subtitle)}" placeholder="Optional"></div>
                <div class="ce-field${ax ? ' disabled' : ''}" ${ax ? `title="${esc(ax)}"` : ''}><label for="ce-xTitle">Category axis title</label><input type="text" id="ce-xTitle" data-k="xTitle" value="${esc(d.xTitle)}" ${ax ? 'disabled' : ''}></div>
                <div class="ce-field${ax ? ' disabled' : ''}" ${ax ? `title="${esc(ax)}"` : ''}><label for="ce-yTitle">Value axis title</label><input type="text" id="ce-yTitle" data-k="yTitle" value="${esc(d.yTitle)}" ${ax ? 'disabled' : ''}></div>
            </div>`;
        }

        if (tab === 'data' && insp.draftData) {
            const sortWhy = applicable('sort', type, info);
            const topWhy = applicable('topN', type, info);
            return `
            <div class="ce-sec"><h4>Values</h4>
                <p class="ce-note"><i class="fa-solid fa-pen"></i>Edit the numbers, labels and series for this chart. Changes preview live; Apply keeps them.</p>
                ${dataEditorHtml(insp.draftData)}
            </div>
            <div class="ce-sec"><h4>Sorting &amp; limits</h4>
                <div class="ce-row${sortWhy ? ' disabled' : ''}" ${sortWhy ? `title="${esc(sortWhy)}"` : ''}><label for="ce-sort">Sort</label>
                    <select id="ce-sort" data-k="sort" ${sortWhy ? 'disabled' : ''}>
                        <option value="none" ${d.sort === 'none' ? 'selected' : ''}>Source order</option>
                        <option value="desc" ${d.sort === 'desc' ? 'selected' : ''}>Largest first</option>
                        <option value="asc" ${d.sort === 'asc' ? 'selected' : ''}>Smallest first</option>
                    </select></div>
                <div class="ce-row${topWhy ? ' disabled' : ''}" ${topWhy ? `title="${esc(topWhy)}"` : ''}><label for="ce-topN">Show top N (0 = all)</label><input type="number" min="0" max="50" id="ce-topN" data-k="topN" data-t="num" value="${d.topN}" ${topWhy ? 'disabled' : ''}></div>
                ${sw('other', d.other, topWhy || (d.topN > 0 ? '' : 'Set Top N first.'))}
            </div>`;
        }

        if (tab === 'data') {
            const ds = reg.datasets && reg.datasets.length
                ? `<div class="ce-field"><label for="ce-dataset">Dataset</label><select id="ce-dataset" data-k="dataset">${reg.datasets.map(x => `<option value="${esc(x.id)}" ${x.id === (d.dataset || reg.defaults.dataset) ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></div>`
                : `<p class="ce-note"><i class="fa-solid fa-lock"></i>Bound to this report section's data. The source is locked so visual changes can't alter report values.</p>`;
            const sortWhy = applicable('sort', type, info);
            const topWhy = applicable('topN', type, info);
            return `
            <div class="ce-sec"><h4>Source</h4>${ds}
                <div class="ce-row"><label>Category field</label><select disabled><option>${esc(view.dimension)}</option></select></div>
                <div class="ce-row"><label>Value field</label><select disabled><option>${esc(view.measure)}</option></select></div>
                <div class="ce-row"><label>Series</label><select disabled><option>${esc(view.series.map(s => s.name).join(', ') || '—')}</option></select></div>
                <p class="ce-note">Fields come from the ingested telemetry for this dataset; each dataset exposes one category and one measure.</p>
            </div>
            <div class="ce-sec"><h4>Sorting &amp; limits</h4>
                <div class="ce-row${sortWhy ? ' disabled' : ''}" ${sortWhy ? `title="${esc(sortWhy)}"` : ''}><label for="ce-sort">Sort</label>
                    <select id="ce-sort" data-k="sort" ${sortWhy ? 'disabled' : ''}>
                        <option value="none" ${d.sort === 'none' ? 'selected' : ''}>Source order</option>
                        <option value="desc" ${d.sort === 'desc' ? 'selected' : ''}>Largest first</option>
                        <option value="asc" ${d.sort === 'asc' ? 'selected' : ''}>Smallest first</option>
                    </select></div>
                <div class="ce-row${topWhy ? ' disabled' : ''}" ${topWhy ? `title="${esc(topWhy)}"` : ''}><label for="ce-topN">Show top N (0 = all)</label><input type="number" min="0" max="50" id="ce-topN" data-k="topN" data-t="num" value="${d.topN}" ${topWhy ? 'disabled' : ''}></div>
                ${sw('other', d.other, topWhy || (d.topN > 0 ? '' : 'Set Top N first.'))}
            </div>
            <div class="ce-sec"><h4>Data (as displayed)</h4><div class="ce-insp-data">${tableHtml(view, d, reg)}</div>
                <p class="ce-note">Source values are never modified — sorting and Top N only change what is displayed.</p></div>`;
        }

        // style
        const colorItems = usesPointColors(type, d, view)
            ? view.labels.map((l, j) => ({ key: labelKey(l), color: resolveColors(view, d, type)[0].colors[j] }))
            : view.series.map((s, i) => ({ key: s.name, color: resolveColors(view, d, type)[i].color }));
        const legendWhy = applicable('legend', type, info);
        return `
        <div class="ce-sec"><h4>Display</h4>
            ${sw('legend.show', d.legend.show, legendWhy)}
            <div class="ce-row${legendWhy || !d.legend.show ? ' disabled' : ''}"><label for="ce-legpos">Legend position</label>
                <select id="ce-legpos" data-k="legend.position" ${legendWhy || !d.legend.show ? 'disabled' : ''}>${['top', 'right', 'bottom', 'left'].map(p => `<option value="${p}" ${d.legend.position === p ? 'selected' : ''}>${p[0].toUpperCase() + p.slice(1)}</option>`).join('')}</select></div>
            ${sw('dataLabels', d.dataLabels, applicable('dataLabels', type, info))}
            ${sw('tooltip', d.tooltip, applicable('tooltip', type, info))}
            ${sw('grid', d.grid, applicable('grid', type, info))}
            ${sw('axis', d.axis, applicable('axis', type, info))}
            ${sw('colorByPoint', usesPointColors(type, d, view), applicable('colorByPoint', type, info))}
        </div>
        <div class="ce-sec"><h4>Number format</h4>
            <div class="ce-row"><label for="ce-dec">Decimals</label><select id="ce-dec" data-k="decimals" data-t="num">${[[-1, 'Auto'], [0, '0'], [1, '0.0'], [2, '0.00']].map(([v, l]) => `<option value="${v}" ${d.decimals === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
            <div class="ce-row"><label for="ce-unit">Unit suffix</label><input type="text" id="ce-unit" data-k="unit" value="${esc(d.unit)}" placeholder="e.g. %, GB, hrs" style="width:130px"></div>
            ${reg.labelFormatter ? '<p class="ce-note"><i class="fa-solid fa-circle-info"></i>This section shows its own time labels on values.</p>' : ''}
        </div>
        <div class="ce-sec"><h4>Palette</h4>
            <div class="ce-palettes">${Object.keys(PALETTES).map(p => {
                const c = PALETTES[p].colors || (view.series[0] && view.series[0].pointColors.filter(Boolean).slice(0, 6)) || [];
                const show = c.length ? c : PALETTES.soc.colors;
                return `<button type="button" class="ce-palette${d.palette === p ? ' active' : ''}" data-palette="${p}" aria-pressed="${d.palette === p}">${esc(PALETTES[p].label)}<div>${show.slice(0, 6).map(x => `<span style="background:${x}"></span>`).join('')}</div></button>`;
            }).join('')}</div>
        </div>
        <div class="ce-sec"><h4>${usesPointColors(type, d, view) ? 'Category colors' : 'Series colors'}</h4>
            <div class="ce-swatches">${colorItems.slice(0, 24).map(it => `<label class="ce-swatch"><input type="color" value="${esc(/^#[0-9a-f]{6}$/i.test(it.color) ? it.color : '#38bdf8')}" data-color-key="${esc(it.key)}"><span title="${esc(it.key)}">${esc(it.key)}</span></label>`).join('')}</div>
        </div>`;
    }

    function renderInspector() {
        if (!insp) return;
        const reg = registry[insp.id];
        if (!reg) { close(); return; }
        const state = render(insp.id, insp.draft) || { type: insp.draft.type, info: { shape: 'cat', points: 0, seriesCount: 1 }, view: { labels: [], series: [], dimension: '', measure: '' } };
        const body = insp.panel.querySelector('.ce-insp-body');
        const scroll = body.scrollTop;
        body.innerHTML = inspectorBody(reg, state);
        body.scrollTop = scroll;
        insp.panel.querySelectorAll('.ce-insp-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === insp.tab));
        insp.panel.classList.toggle('dirty', insp.dirty);
        const clearDef = insp.panel.querySelector('[data-act="clear-default"]');
        if (clearDef) clearDef.hidden = !savedDefault(reg.id);
        syncHistoryButtons();
    }

    function setPath(obj, path, val) {
        const parts = path.split('.');
        let o = obj;
        while (parts.length > 1) { const p = parts.shift(); o[p] = o[p] && typeof o[p] === 'object' ? o[p] : {}; o = o[p]; }
        o[parts[0]] = val;
    }

    function onInspectorInput(e) {
        if (!insp) return;
        const cellEl = e.target.closest('[data-cell]');
        if (cellEl) {
            if (e.type !== 'input') return;
            const parts = cellEl.dataset.cell.split(',');
            const k = parts[0];
            const dd = insp.draftData;
            if (!dd) return;
            if (k === 'dim') {
                dd.dimension = cellEl.value;
            } else if (k === 'h') {
                const c = +parts[1];
                if (dd.series && dd.series[c]) dd.series[c].name = cellEl.value;
            } else if (k === 'l') {
                const r = +parts[1];
                if (Array.isArray(dd.labels)) dd.labels[r] = cellEl.value;
            } else if (k === 'v') {
                const r = +parts[1];
                const c = +parts[2];
                const num = parseFloat(String(cellEl.value).replace(/[^0-9.-]/g, ''));
                if (dd.series && dd.series[c]) {
                    if (!Array.isArray(dd.series[c].data)) dd.series[c].data = [];
                    dd.series[c].data[r] = Number.isFinite(num) ? num : 0;
                }
            }
            insp.dirty = true;
            insp.panel.classList.add('dirty');
            render(insp.id, insp.draft);
            const reg = registry[insp.id];
            if (reg && typeof reg.onDataPreview === 'function') {
                reg.onDataPreview(dd);
            }
            return;
        }
        const colorEl = e.target.closest('[data-color-key]');
        if (colorEl) {
            insp.draft.colors = Object.assign({}, insp.draft.colors, { [colorEl.dataset.colorKey]: colorEl.value });
            insp.dirty = true;
            insp.panel.classList.add('dirty');
            render(insp.id, insp.draft);
            return;
        }
        const el = e.target.closest('[data-k]');
        if (!el) return;
        const isText = el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'number');
        if (!isText && e.type === 'input') return; // selects/checkboxes: handle once, on change
        let v;
        if (el.type === 'checkbox') v = el.checked;
        else if (el.dataset.t === 'num') { v = parseInt(el.value, 10); if (!Number.isFinite(v)) v = 0; }
        else v = el.value;
        if (el.dataset.k === 'topN') v = Math.max(0, Math.min(50, v));
        setPath(insp.draft, el.dataset.k, v);
        insp.dirty = true;
        if (isText && e.type === 'input') { insp.panel.classList.add('dirty'); render(insp.id, insp.draft); }
        else if (!isText || e.type === 'change') renderInspector();
    }

    function onInspectorClick(e) {
        if (!insp) return;
        const reg = registry[insp.id];
        const tabBtn = e.target.closest('[data-tab]');
        if (tabBtn) { insp.tab = lastTab = tabBtn.dataset.tab; renderInspector(); return; }
        const typeBtn = e.target.closest('[data-type]');
        if (typeBtn && !typeBtn.disabled) { insp.draft.type = typeBtn.dataset.type; insp.dirty = true; renderInspector(); return; }
        const palBtn = e.target.closest('[data-palette]');
        if (palBtn) { insp.draft.palette = palBtn.dataset.palette; insp.draft.colors = {}; insp.dirty = true; renderInspector(); return; }
        const act = e.target.closest('[data-act]');
        if (!act) return;
        const dd = insp.draftData;
        const editData = (fn) => {
            fn();
            insp.dirty = true;
            renderInspector();
            render(insp.id, insp.draft);
            if (reg && typeof reg.onDataPreview === 'function') {
                reg.onDataPreview(insp.draftData);
            }
        };
        switch (act.dataset.act) {
            case 'add-row':
                if (!dd) break;
                editData(() => {
                    if (!Array.isArray(dd.labels)) dd.labels = [];
                    if (!Array.isArray(dd.series) || !dd.series.length) {
                        dd.series = [{ name: 'Series 1', data: [], colors: null }];
                    }
                    dd.labels.push(`Item ${dd.labels.length + 1}`);
                    dd.series.forEach(s => {
                        if (!Array.isArray(s.data)) s.data = [];
                        s.data.push(0);
                    });
                });
                break;
            case 'del-row':
                if (!dd || !Array.isArray(dd.labels) || dd.labels.length <= 1) break;
                editData(() => {
                    const i = +act.dataset.i;
                    dd.labels.splice(i, 1);
                    if (Array.isArray(dd.series)) {
                        dd.series.forEach(s => {
                            if (Array.isArray(s.data)) s.data.splice(i, 1);
                        });
                    }
                });
                break;
            case 'add-series':
                if (!dd) break;
                editData(() => {
                    if (!Array.isArray(dd.labels)) dd.labels = [];
                    if (!dd.labels.length) dd.labels.push('Item 1');
                    if (!Array.isArray(dd.series)) dd.series = [];
                    dd.series.push({
                        name: `Series ${dd.series.length + 1}`,
                        data: dd.labels.map(() => 0),
                        colors: null
                    });
                });
                break;
            case 'del-series':
                if (!dd || !Array.isArray(dd.series) || dd.series.length <= 1) break;
                editData(() => {
                    dd.series.splice(+act.dataset.i, 1);
                });
                break;
            case 'apply-paste': {
                const parsed = parsePasted(insp.panel.querySelector('#ce-paste') && insp.panel.querySelector('#ce-paste').value);
                if (!parsed) { toast('Paste at least a header row and one data row.'); break; }
                editData(() => { insp.draftData = Object.assign({}, dd, parsed); });
                toast(`Loaded ${parsed.labels.length} rows × ${parsed.series.length} series — Apply to keep them.`);
                break;
            }
            case 'close': cancel(); break;
            case 'cancel': cancel(); break;
            case 'undo': stepHistory(-1); break;
            case 'redo': stepHistory(1); break;
            case 'reset': {
                writeDataStore(reg, null);
                writeStore(reg, null);
                if (typeof reg.setData === 'function') {
                    const orig = getOriginalData(reg, baseline(reg));
                    if (orig) reg.setData(clone(orig));
                }
                insp.draftData = editableData(reg, baseline(reg));
                insp.draft = clone(baseline(reg));
                insp.committed = clone(insp.draft);
                insp.dirty = false;
                render(reg.id);
                renderInspector();
                if (typeof reg.onDataReset === 'function') reg.onDataReset(insp.draftData);
                else if (typeof reg.onDataCommit === 'function') reg.onDataCommit(insp.draftData);
                toast('Chart data and settings restored to original template.');
                break;
            }
            case 'apply': {
                if (!insp.dirty) { toast('No chart changes to apply.'); break; }
                const full = merge(insp.draft);
                if (insp.draftData) commitData(reg, insp.draftData);
                if (JSON.stringify(full) !== JSON.stringify(merge(insp.committed))) commit(reg, diff(full, baseline(reg)), 'Applied chart settings');
                insp.draftData = editableData(reg, full);
                insp.committed = clone(full);
                insp.draft = clone(full);
                insp.dirty = false;
                renderInspector();
                render(reg.id);
                toast(`Chart updated: ${reg.name}`);
                break;
            }
            case 'save-default': {
                const full = merge(insp.draft);
                const defs = loadLS(LS_DEFAULTS);
                const d = diff(full, merge(reg.defaults));
                if (d) defs[reg.id] = d; else delete defs[reg.id];
                saveLS(LS_DEFAULTS, defs);
                commit(reg, null, 'Saved chart default');
                insp.committed = clone(full);
                insp.draft = clone(full);
                insp.dirty = false;
                renderInspector();
                toast(`Saved as default for “${reg.name}”`);
                break;
            }
            case 'clear-default': {
                const defs = loadLS(LS_DEFAULTS);
                delete defs[reg.id];
                saveLS(LS_DEFAULTS, defs);
                insp.committed = effective(reg);
                insp.draft = clone(insp.committed);
                insp.dirty = false;
                renderInspector();
                toast('Saved default cleared.');
                break;
            }
        }
    }

    function onKey(e) {
        if (!insp) return;
        if (e.key === 'Escape') { e.preventDefault(); cancel(); return; }
        const inText = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName) || (document.activeElement && document.activeElement.isContentEditable);
        if (inText || !(e.ctrlKey || e.metaKey)) return;
        const k = e.key.toLowerCase();
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); stepHistory(-1); }
        else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); stepHistory(1); }
    }

    function open(id, initialTab) {
        const reg = registry[id];
        if (!reg) return;
        if (insp) { if (insp.id === id) return; cancel(); }
        if (typeof reg.onInspectorOpen === 'function') reg.onInspectorOpen();
        const committed = effective(reg);
        const panel = document.createElement('aside');
        panel.className = 'ce-inspector';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', `Chart settings: ${reg.name}`);
        panel.setAttribute('data-html2canvas-ignore', 'true');
        panel.innerHTML = `
            <div class="ce-insp-head">
                <div><h3>Chart settings <span class="ce-dirty-dot" title="Unapplied changes"></span></h3><p title="${esc(reg.name)}">${esc(reg.name)}</p></div>
                <span class="ce-spacer"></span>
                <button type="button" class="ce-icon-btn" data-act="undo" title="Undo (Ctrl+Z)" aria-label="Undo"><i class="fa-solid fa-rotate-left"></i></button>
                <button type="button" class="ce-icon-btn" data-act="redo" title="Redo (Ctrl+Y)" aria-label="Redo"><i class="fa-solid fa-rotate-right"></i></button>
                <button type="button" class="ce-icon-btn" data-act="close" title="Close (Esc)" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="ce-insp-tabs" role="tablist">
                <button type="button" data-tab="type" role="tab">Chart</button>
                <button type="button" data-tab="data" role="tab">Data</button>
                <button type="button" data-tab="style" role="tab">Style</button>
            </div>
            <div class="ce-insp-body"></div>
            <div class="ce-insp-foot">
                <button type="button" class="ce-btn ce-ghost" data-act="reset" title="Reset to the original template data and settings for this chart">Reset</button>
                <span class="ce-spacer"></span>
                <button type="button" class="ce-btn" data-act="cancel">Cancel</button>
                <button type="button" class="ce-btn ce-primary" data-act="apply">Apply</button>
            </div>`;
        document.body.appendChild(panel);
        panel.addEventListener('input', onInspectorInput);
        panel.addEventListener('change', onInspectorInput);
        panel.addEventListener('click', onInspectorClick);
        insp = { id, panel, committed: clone(committed), draft: clone(committed), draftData: editableData(reg, committed), tab: initialTab || lastTab || 'data', dirty: false };
        const canvas = document.getElementById(reg.canvasId);
        if (canvas) hostOf(canvas).classList.add('ce-selected');
        renderInspector();
        const first = panel.querySelector('.ce-type.active') || panel.querySelector('button');
        if (first) first.focus();
    }

    function cancel() {
        if (!insp) return;
        const id = insp.id;
        const reg = registry[id];
        const wasDirty = insp.dirty;
        close();
        render(id);
        if (wasDirty) {
            if (reg && typeof reg.onDataCancel === 'function') reg.onDataCancel();
            toast('Chart changes discarded.');
        }
    }

    function close() {
        if (!insp) return;
        const reg = registry[insp.id];
        const canvas = reg && document.getElementById(reg.canvasId);
        if (canvas) hostOf(canvas).classList.remove('ce-selected');
        insp.panel.remove();
        insp = null;
    }

    document.addEventListener('keydown', onKey);

    window.ChartEngine = {
        SCHEMA_VERSION, TYPES, PALETTES,
        mount, render, renderAll, open, close,
        sanitize, merge,
        effective: (id) => registry[id] ? effective(registry[id]) : null,
        compatibleTypes: (id) => {
            const reg = registry[id];
            if (!reg) return [];
            const info = dataInfo(normalizeData(getAppliedData(reg, effective(reg))), reg);
            return Object.keys(TYPES).filter(k => !whyIncompatible(k, info));
        },
        // Drop app-scoped overrides and saved defaults whose id starts with prefix (dashboard reset)
        resetLocal: (prefix) => {
            [LS_LOCAL, LS_DEFAULTS].forEach(key => {
                const all = loadLS(key);
                Object.keys(all).forEach(k => { if (k.startsWith(prefix)) delete all[k]; });
                saveLS(key, all);
            });
        },
        // What a chart currently shows (type after compatibility fallback, displayed data, resolved
        // colors), so exporters can rebuild it natively instead of pasting a picture
        describe: (id) => {
            const reg = registry[id];
            if (!reg) return null;
            const cfg = effective(reg);
            const raw = normalizeData(getAppliedData(reg, cfg));
            const info = dataInfo(raw, reg);
            const type = whyIncompatible(cfg.type, info) ? firstCompatible(reg.defaults.type, info) : cfg.type;
            const view = transform(raw, cfg, info);
            const cols = resolveColors(view, cfg, type);
            return {
                type, def: TYPES[type], cfg,
                labels: view.labels.map(labelKey),
                series: view.series.map((s, i) => ({ name: s.name, data: s.data.slice(), color: cols[i].color, colors: cols[i].colors, byPoint: cols[i].byPoint })),
                format: makeFormatter(cfg, reg)
            };
        },
        getActiveInspector: () => (insp ? { id: insp.id, draft: clone(insp.draft), draftData: clone(insp.draftData), dirty: insp.dirty } : null),
        undo: () => stepHistory(-1),
        redo: () => stepHistory(1),
        isMounted: (id) => !!registry[id],
        // exposed for the self-check below and for tests
        _internals: { normalizeData, transform, whyIncompatible, dataInfo, diff, getAppliedData, getOriginalData }
    };

    // Self-check: transforms must never mutate source data; schema must reject junk.
    (function selfCheck() {
        const src = Object.freeze({ labels: Object.freeze(['b', 'a', 'c']), series: Object.freeze([Object.freeze({ name: 'n', data: Object.freeze([1, 3, 2]) })]) });
        const raw = normalizeData(src);
        const v = transform(raw, merge({ sort: 'desc', topN: 2, other: true }), { time: false });
        console.assert(v.labels.join() === 'a,c,Other' && v.series[0].data.join() === '3,2,1', '[ChartEngine] transform');
        console.assert(src.series[0].data.join() === '1,3,2', '[ChartEngine] source mutated');
        console.assert(!sanitize({ type: 'nope', topN: 99, colors: { a: 'red' } }).type, '[ChartEngine] sanitize');
        console.assert(whyIncompatible('pie', { shape: 'multi', seriesCount: 2, points: 4 }) !== '', '[ChartEngine] compat');
    })();
})();
