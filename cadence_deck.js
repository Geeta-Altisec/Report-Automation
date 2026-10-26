// ALTISEC CADENCE DECK ENGINE
// A deck is JSON: slides made of typed blocks (text, bullets, kpis, table, chart, image, cards,
// steps, callout) laid out on a 12-column grid inside a fixed 1280×720 slide (= 13.33in × 7.5in at
// 96px/in, PowerPoint's widescreen size). The same render feeds the editor, the thumbnails and the
// PPTX export, which reads each block's on-slide position and rebuilds it with native PowerPoint
// text, tables and charts (PptxGenJS). Charts go through ChartEngine, so they get the same
// inspector as the report and dashboard, plus an editable data grid.
(function () {
    'use strict';

    const W = 1280, H = 720, PX_PER_IN = 96;
    const DECK_VERSION = 1;
    const LS_WORKING = 'altisec_cadence_working_deck_v1';
    const BLOCK_TYPES = ['text', 'bullets', 'kpis', 'table', 'chart', 'image', 'cards', 'steps', 'callout'];
    const SPANS = [12, 8, 6, 4, 3];

    const DEFAULT_THEME = {
        primary: '#1E2761', accent: '#E8702A', soft: '#CADCFC', tint: '#EEF3FD', ink: '#1A1F36',
        muted: '#5B6478', line: '#E2E8F0', teal: '#065A82', good: '#1E8449', bad: '#C0392B', warn: '#B9770E',
        heading: 'Montserrat', body: 'Calibri'
    };

    const templates = {};
    let deck = null;
    let current = 0;
    const undoStack = [];
    const redoStack = [];

    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const uid = () => Math.random().toString(36).slice(2, 10);
    const clone = (o) => JSON.parse(JSON.stringify(o));
    const toast = (m) => { if (typeof showToast === 'function') showToast(m); };
    const audit = (action, details) => { if (typeof recordAuditLog === 'function') { try { recordAuditLog('cadence', action, details); } catch (e) { /* best-effort */ } } };
    const lines = (t) => String(t == null ? '' : t).split('\n');
    const T = () => Object.assign({}, DEFAULT_THEME, deck && deck.theme);

    // ------------------------------------------------------------------ model
    function sanitizeBlock(b) {
        if (!b || typeof b !== 'object' || !BLOCK_TYPES.includes(b.type)) return null;
        const out = clone(b);
        out.id = typeof b.id === 'string' && b.id ? b.id.slice(0, 40) : uid();
        out.span = Number.isInteger(b.span) && b.span >= 1 && b.span <= 12 ? b.span : 12;
        out.rowSpan = Number.isInteger(b.rowSpan) && b.rowSpan > 1 && b.rowSpan <= 4 ? b.rowSpan : undefined;
        if (out.type === 'table') {
            out.header = Array.isArray(b.header) ? b.header.map(String) : [];
            out.rows = Array.isArray(b.rows) ? b.rows.map(r => (Array.isArray(r) ? r : []).map(String)) : [];
        }
        if (out.type === 'chart') {
            const d = b.data || {};
            out.data = {
                labels: Array.isArray(d.labels) ? d.labels.map(String) : [],
                series: (Array.isArray(d.series) ? d.series : []).map(s => ({ name: String(s && s.name || 'Series'), data: (s && Array.isArray(s.data) ? s.data : []).map(v => Number(v) || 0), colors: s && s.colors })),
                time: !!d.time, dimension: d.dimension, measure: d.measure
            };
            out.chart = b.chart && typeof b.chart === 'object' ? b.chart : null;
        }
        ['items'].forEach(k => { if (k in out && !Array.isArray(out[k])) out[k] = []; });
        return out;
    }

    function sanitizeDeck(d) {
        if (!d || typeof d !== 'object' || !Array.isArray(d.slides)) return null;
        return {
            v: DECK_VERSION,
            id: typeof d.id === 'string' ? d.id : 'deck-' + uid(),
            templateId: d.templateId || null,
            name: String(d.name || 'Cadence deck'),
            client: String(d.client || 'TENANT'),
            period: String(d.period || ''),
            theme: Object.assign({}, DEFAULT_THEME, d.theme || {}),
            assets: Object.assign({}, d.assets || {}),
            slides: d.slides.map(s => ({
                uid: typeof s.uid === 'string' ? s.uid : uid(),
                layout: ['cover', 'section', 'content', 'closing'].includes(s.layout) ? s.layout : 'content',
                title: String(s.title || ''),
                subtitle: String(s.subtitle || ''),
                kicker: s.kicker ? String(s.kicker) : '',
                notes: String(s.notes || ''),
                footnote: s.footnote ? String(s.footnote) : '',
                blocks: (Array.isArray(s.blocks) ? s.blocks : []).map(sanitizeBlock).filter(Boolean)
            }))
        };
    }

    // Decks saved by the old fixed-layout studio ({headerTitle, slaVal, mttrVal, notes})
    function fromLegacySlides(slides, client) {
        return sanitizeDeck({
            name: `${client || 'Tenant'} Monthly Cadence`, client: client || 'TENANT',
            slides: (slides || []).map(s => ({
                layout: 'content', title: s.headerTitle || s.title || 'Slide',
                blocks: [
                    { type: 'kpis', span: 12, items: [{ value: s.slaVal || '—', label: 'SLA compliance', tone: 'soft' }, { value: s.mttrVal || '—', label: 'Average MTTR', tone: 'soft' }] },
                    s.notes ? { type: 'text', span: 12, text: s.notes } : null
                ].filter(Boolean)
            }))
        });
    }

    function getPath(o, path) { return path.split('.').reduce((a, k) => (a == null ? a : a[k]), o); }
    function setPath(o, path, v) {
        const ks = path.split('.');
        let t = o;
        ks.slice(0, -1).forEach(k => { if (t[k] == null) t[k] = {}; t = t[k]; });
        t[ks[ks.length - 1]] = v;
    }

    function slide() { return deck && deck.slides[current]; }
    function blockById(s, id) { return s && s.blocks.find(b => b.id === id); }

    // ------------------------------------------------------------------ persistence + history
    function save() {
        if (!deck) return;
        try { localStorage.setItem(LS_WORKING, JSON.stringify(deck)); }
        catch (e) { toast('Deck too large to autosave in this browser — use Save draft to keep it.'); }
    }
    function snapshot() {
        if (!deck) return;
        undoStack.push(JSON.stringify(deck));
        if (undoStack.length > 60) undoStack.shift();
        redoStack.length = 0;
        syncUndoButtons();
    }
    function step(from, to) {
        if (!from.length) return;
        to.push(JSON.stringify(deck));
        deck = sanitizeDeck(JSON.parse(from.pop()));
        current = Math.min(current, deck.slides.length - 1);
        save();
        renderAll();
    }
    function syncUndoButtons() {
        const u = document.getElementById('btnCadenceUndo');
        const r = document.getElementById('btnCadenceRedo');
        if (u) u.disabled = !undoStack.length;
        if (r) r.disabled = !redoStack.length;
    }
    // mutate: structural change with undo + save + re-render
    function mutate(fn, opts = {}) {
        snapshot();
        fn();
        save();
        if (opts.navOnly) renderNav(); else renderAll();
    }

    // ------------------------------------------------------------------ html
    function toneOf(text) {
        const s = String(text || '').toLowerCase();
        if (/not completed|critical|\bhigh\b|\bopen\b|fail|breach/.test(s)) return 'bad';
        if (/in.?progress|medium|under|wip|validation|pending|uat/.test(s)) return 'warn';
        if (/completed|clear|closed|live|\blow\b|proactive|resolved|done/.test(s)) return 'good';
        return 'neutral';
    }
    const ed = (bid, path, editing, tag = 'span', cls = '', extra = '') =>
        (inner) => `<${tag} class="${cls}" ${editing ? `contenteditable="true" spellcheck="false" data-edit="${esc(bid)}|${esc(path)}"` : ''} ${extra}>${inner}</${tag}>`;
    const multi = (t) => lines(t).map(esc).join('<br>');

    function blockInner(b, s, editing) {
        const E = (path, tag, cls, extra) => ed(b.id, path, editing, tag, cls, extra);
        switch (b.type) {
            case 'text':
                return E('text', 'div', `cx-text cx-size-${b.size || 'md'}${b.tone ? ' cx-tone-text-' + b.tone : ''}`, 'data-multiline="1"')(multi(b.text));
            case 'bullets':
                return `<ul class="cx-bullets cx-size-${b.size || 'md'}" ${editing ? `contenteditable="true" spellcheck="false" data-edit-list="${esc(b.id)}|items"` : ''}>${(b.items || []).map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
            case 'kpis':
                return `<div class="cx-kpis" style="grid-template-columns:repeat(${Math.max(1, Math.min(b.cols || (b.items || []).length || 1, 6))},1fr)">${(b.items || []).map((k, i) => `
                    <div class="cx-kpi cx-tone-${esc(k.tone || 'soft')}" data-part="kpi">
                        ${E(`items.${i}.value`, 'b', 'cx-kpi-val')(esc(k.value))}
                        ${E(`items.${i}.label`, 'span', 'cx-kpi-lbl')(esc(k.label))}
                        ${k.sub != null ? E(`items.${i}.sub`, 'small', 'cx-kpi-sub')(esc(k.sub)) : ''}
                    </div>`).join('')}</div>`;
            case 'table': {
                const pill = new Set(b.pillCols || []);
                const group = Array.isArray(b.groups) && b.groups.length ? `<tr class="cx-tgroup">${b.groups.map(g => `<th colspan="${g.span || 1}">${esc(g.label)}</th>`).join('')}</tr>` : '';
                return `<table class="cx-table cx-size-${b.size || 'sm'}${b.total ? ' cx-total' : ''}">
                    <thead>${group}<tr>${(b.header || []).map((h, c) => E(`header.${c}`, 'th', '', b.widths && b.widths[c] ? `style="width:${b.widths[c]}%"` : '')(esc(h))).join('')}</tr></thead>
                    <tbody>${(b.rows || []).map((r, ri) => `<tr>${r.map((cell, c) => pill.has(c) && cell
                        ? `<td><span class="cx-pill cx-pill-${toneOf(cell)}">${E(`rows.${ri}.${c}`, 'span')(esc(cell))}</span></td>`
                        : E(`rows.${ri}.${c}`, 'td')(multi(cell))).join('')}</tr>`).join('')}</tbody></table>`;
            }
            case 'chart':
                return `<div class="cx-chart" style="height:${b.height || 230}px"><canvas id="${esc(chartId(s, b))}"></canvas></div>`;
            case 'image':
                return `<figure class="cx-img" style="height:${b.height || 260}px"><img src="${esc(resolveSrc(b.src))}" alt="${esc(b.alt || b.title || 'Slide image')}" data-part="img">${b.caption != null ? E('caption', 'figcaption')(esc(b.caption)) : ''}</figure>`;
            case 'cards':
                return `<div class="cx-cards cx-cards-${b.style || 'default'}" style="grid-template-columns:repeat(${b.cols || 2},1fr)">${(b.items || []).map((c, i) => `
                    <article class="cx-card${c.tone ? ' cx-tone-' + esc(c.tone) : ''}" data-part="card">
                        ${c.num != null ? `<span class="cx-card-num">${esc(c.num)}</span>` : ''}
                        <div class="cx-card-main">
                            ${c.title != null ? E(`items.${i}.title`, 'h5')(esc(c.title)) : ''}
                            ${c.body != null ? E(`items.${i}.body`, 'p', '', 'data-multiline="1"')(multi(c.body)) : ''}
                            ${c.meta != null || c.tag != null ? `<div class="cx-card-meta">${c.meta != null ? E(`items.${i}.meta`, 'small')(esc(c.meta)) : '<span></span>'}${c.tag != null ? `<span class="cx-pill cx-pill-${toneOf(c.tag)}">${E(`items.${i}.tag`, 'span')(esc(c.tag))}</span>` : ''}</div>` : ''}
                        </div>
                    </article>`).join('')}</div>`;
            case 'steps':
                return `<ol class="cx-steps" style="grid-template-columns:repeat(${(b.items || []).length || 1},1fr)">${(b.items || []).map((st, i) => `
                    <li class="${st.manual ? 'cx-manual' : ''}"><span class="cx-step-num" data-part="stepnum">${i + 1}</span>${E(`items.${i}.text`, 'span', 'cx-step-text', 'data-multiline="1"')(multi(st.text))}</li>`).join('')}</ol>`;
            case 'callout':
                return `<div class="cx-callout cx-tone-${esc(b.tone || 'tint')}">${b.value != null ? E('value', 'b', 'cx-callout-val')(esc(b.value)) : ''}${E('text', 'p', '', 'data-multiline="1"')(multi(b.text))}</div>`;
        }
        return '';
    }

    function blockTools(b) {
        const add = { kpis: 'tile', cards: 'card', bullets: 'point', steps: 'step' }[b.type];
        return `<div class="cx-tools" data-html2canvas-ignore="true" contenteditable="false">
            <button type="button" data-bact="span" title="Width: ${b.span}/12 (click to change)"><i class="fa-solid fa-arrows-left-right"></i></button>
            <button type="button" data-bact="up" title="Move earlier"><i class="fa-solid fa-arrow-up"></i></button>
            <button type="button" data-bact="down" title="Move later"><i class="fa-solid fa-arrow-down"></i></button>
            ${b.type === 'table' ? `<button type="button" data-bact="row+" title="Add row"><i class="fa-solid fa-plus"></i>Row</button><button type="button" data-bact="row-" title="Remove last row"><i class="fa-solid fa-minus"></i>Row</button>
                <button type="button" data-bact="col+" title="Add column"><i class="fa-solid fa-plus"></i>Col</button><button type="button" data-bact="col-" title="Remove last column"><i class="fa-solid fa-minus"></i>Col</button>` : ''}
            ${add ? `<button type="button" data-bact="item+" title="Add ${add}"><i class="fa-solid fa-plus"></i></button><button type="button" data-bact="item-" title="Remove last ${add}"><i class="fa-solid fa-minus"></i></button>` : ''}
            ${b.type === 'chart' ? `<button type="button" data-bact="chart" title="Chart type, data and style"><i class="fa-solid fa-sliders"></i>Chart</button>` : ''}
            ${b.type === 'image' ? `<button type="button" data-bact="img" title="Replace image"><i class="fa-regular fa-image"></i>Replace</button>` : ''}
            <button type="button" data-bact="del" title="Delete block" class="cx-danger"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    }

    function resolveSrc(src) {
        if (!src) return '';
        if (/^asset:/.test(src)) return (deck && deck.assets && deck.assets[src.slice(6)]) || '';
        return src;
    }

    function chartId(s, b) { return `cxc-${s.uid}-${b.id}`; }

    function slideHtml(s, index, d, editing) {
        const t = Object.assign({}, DEFAULT_THEME, d.theme);
        const vars = `--cx-primary:${t.primary};--cx-accent:${t.accent};--cx-soft:${t.soft};--cx-tint:${t.tint};--cx-ink:${t.ink};--cx-muted:${t.muted};--cx-line:${t.line};--cx-teal:${t.teal};--cx-good:${t.good};--cx-bad:${t.bad};--cx-warn:${t.warn};--cx-head:'${t.heading}';--cx-body:'${t.body}'`;
        const E = (path, tag, cls) => ed('@slide', path, editing, tag, cls);
        const logo = (key, cls) => d.assets && d.assets[key] ? `<img class="${cls}" src="${esc(d.assets[key])}" alt="" data-part="${key}">` : '';
        const num = index + 1;

        if (s.layout === 'cover') {
            return `<div class="cx-slide cx-cover" style="${vars}" data-slide="${esc(s.uid)}">
                ${logo('clientLogo', 'cx-logo-client')}
                <div class="cx-cover-art">${d.assets && d.assets.cover ? `<img src="${esc(d.assets.cover)}" alt="" data-part="cover">` : ''}</div>
                <div class="cx-cover-text">
                    ${E('title', 'h1', 'cx-cover-title')(esc(s.title))}
                    ${E('subtitle', 'p', 'cx-cover-period')(esc(s.subtitle))}
                    ${E('kicker', 'p', 'cx-cover-kicker')(esc(s.kicker))}
                </div>
                ${logo('vendorLogo', 'cx-logo-vendor')}
            </div>`;
        }
        if (s.layout === 'section' || s.layout === 'closing') {
            return `<div class="cx-slide cx-${s.layout}" style="${vars}" data-slide="${esc(s.uid)}">
                ${logo('clientLogo', 'cx-logo-client')}
                <div class="cx-section-mark" aria-hidden="true"></div>
                <div class="cx-section-text">
                    ${s.kicker || editing ? E('kicker', 'p', 'cx-section-kicker')(esc(s.kicker)) : ''}
                    ${E('title', 'h1', 'cx-section-title')(multi(s.title))}
                    ${s.subtitle || editing ? E('subtitle', 'p', 'cx-section-sub')(esc(s.subtitle)) : ''}
                </div>
                ${logo('vendorLogoLight', 'cx-logo-vendor')}
            </div>`;
        }
        return `<div class="cx-slide cx-content" style="${vars}" data-slide="${esc(s.uid)}">
            <header class="cx-head">
                <div class="cx-head-text">
                    ${E('title', 'h2', 'cx-title')(esc(s.title))}
                    ${s.subtitle || editing ? E('subtitle', 'p', 'cx-subtitle')(esc(s.subtitle)) : ''}
                </div>
                ${logo('clientLogo', 'cx-logo-client')}
            </header>
            <div class="cx-body">${s.blocks.map(b => `
                <section class="cx-b cx-b-${b.type}" data-block="${esc(b.id)}" style="grid-column:span ${b.span}${b.rowSpan ? `;grid-row:span ${b.rowSpan}` : ''}">
                    ${editing ? blockTools(b) : ''}
                    ${b.title != null ? ed(b.id, 'title', editing, 'h4', 'cx-bt')(esc(b.title)) : ''}
                    ${blockInner(b, s, editing)}
                </section>`).join('')}
            </div>
            <footer class="cx-foot">
                <span class="cx-foot-note">${s.footnote ? E('footnote', 'span')(esc(s.footnote)) : esc(`${d.client} · ${d.name}`)}</span>
                <span class="cx-foot-num" data-part="num">${num}</span>
                ${logo('vendorLogo', 'cx-logo-vendor')}
            </footer>
        </div>`;
    }

    function mountCharts(s) {
        if (!window.ChartEngine) return;
        s.blocks.filter(b => b.type === 'chart').forEach(b => {
            const id = chartId(s, b);
            ChartEngine.mount(id, {
                canvasId: id,
                name: `${s.title || 'Slide'} · ${b.title || 'Chart'}`,
                surface: 'paper', store: 'custom', auditCategory: 'cadence',
                editButton: true, time: !!b.data.time, barThickness: b.barThickness || 30,
                defaults: Object.assign({ legend: { show: true, position: 'bottom' } }, b.defaults || {}),
                readConfig: () => b.chart || null,
                writeConfig: (o) => { b.chart = o; save(); },
                getData: () => b.data,
                setData: (dd) => {
                    b.data = { labels: dd.labels.map(String), series: dd.series.map(x => ({ name: x.name, data: x.data.map(v => Number(v) || 0), colors: x.colors || undefined })), time: b.data.time, dimension: dd.dimension, measure: dd.measure };
                    save();
                    renderNav();
                }
            });
        });
    }

    // ------------------------------------------------------------------ editor render
    function stageEl() { return document.getElementById('cadenceSlideStage'); }

    function renderSlide() {
        const host = stageEl();
        if (!host || !deck) return;
        const s = slide();
        host.innerHTML = s ? slideHtml(s, current, deck, true) : '<div class="cx-empty">No slides</div>';
        if (s) mountCharts(s);
        fit();
        checkOverflow();
        const counter = document.getElementById('cadenceSlideCounter');
        if (counter) counter.textContent = `Slide ${current + 1} / ${deck.slides.length}`;
        const title = document.getElementById('cadenceTitleText');
        if (title) title.textContent = `${deck.client} · ${deck.name}`;
    }

    function fit() {
        const wrap = document.getElementById('cadenceSlideFit');
        const host = stageEl();
        if (!wrap || !host) return;
        const stage = wrap.parentElement;
        const avail = Math.max(320, stage.clientWidth - 32);
        const availH = Math.max(200, stage.clientHeight - 64);
        const scale = Math.min(avail / W, availH / H, 1.2);
        host.style.transform = `scale(${scale})`;
        wrap.style.width = `${W * scale}px`;
        wrap.style.height = `${H * scale}px`;
    }

    function checkOverflow() {
        const body = stageEl() && stageEl().querySelector('.cx-body');
        const warn = document.getElementById('cadenceOverflowWarn');
        if (!warn) return;
        warn.hidden = !(body && body.scrollHeight > body.clientHeight + 2);
    }

    function thumbGlyphs(s) {
        const icon = { text: 'fa-align-left', bullets: 'fa-list-ul', kpis: 'fa-hashtag', table: 'fa-table', chart: 'fa-chart-column', image: 'fa-image', cards: 'fa-clone', steps: 'fa-arrow-right-long', callout: 'fa-quote-left' };
        return s.blocks.slice(0, 8).map(b => `<i class="fa-solid ${icon[b.type]}" title="${b.type}"></i>`).join('');
    }

    function renderNav() {
        const nav = document.getElementById('cadenceSlideNav');
        const count = document.getElementById('cadenceSlideCount');
        if (count && deck) count.textContent = deck.slides.length;
        if (!nav || !deck) return;
        nav.innerHTML = deck.slides.map((s, i) => `
            <li class="cd-thumb${i === current ? ' active' : ''}" data-index="${i}" draggable="true">
                <button type="button" class="cd-thumb-main" data-nact="go" aria-current="${i === current}" aria-label="Slide ${i + 1}: ${esc(s.title)}">
                    <span class="cd-thumb-num">${i + 1}</span>
                    <span class="cd-mini cx-mini cx-mini-${s.layout}">
                        <b>${esc((s.title || '').replace(/\n/g, ' ') || 'Untitled')}</b>
                        <span class="cx-mini-glyphs">${s.layout === 'content' ? thumbGlyphs(s) : `<em>${s.layout}</em>`}</span>
                    </span>
                </button>
                <span class="cd-thumb-tools">
                    <button type="button" data-nact="up" ${i === 0 ? 'disabled' : ''} title="Move up" aria-label="Move slide ${i + 1} up"><i class="fa-solid fa-chevron-up"></i></button>
                    <button type="button" data-nact="down" ${i === deck.slides.length - 1 ? 'disabled' : ''} title="Move down" aria-label="Move slide ${i + 1} down"><i class="fa-solid fa-chevron-down"></i></button>
                    <button type="button" data-nact="dup" title="Duplicate" aria-label="Duplicate slide ${i + 1}"><i class="fa-regular fa-copy"></i></button>
                    <button type="button" data-nact="del" ${deck.slides.length > 1 ? '' : 'disabled'} title="Delete" aria-label="Delete slide ${i + 1}"><i class="fa-solid fa-trash"></i></button>
                </span>
            </li>`).join('');
    }

    function renderInspector() {
        const box = document.getElementById('cadenceDynamicFormContainer');
        if (!box || !deck) return;
        const s = slide();
        if (!s) { box.innerHTML = ''; return; }
        box.innerHTML = `
            <div class="cd-head"><h4>Slide ${current + 1}</h4><span class="cs-chip">${deck.slides.length} slides</span></div>
            <div class="cd-field"><label class="cs-label" for="cxSlideTitle">Title</label><input id="cxSlideTitle" class="cd-input" data-sfield="title" value="${esc(s.title)}"></div>
            <div class="cd-field"><label class="cs-label" for="cxSlideSub">Subtitle</label><input id="cxSlideSub" class="cd-input" data-sfield="subtitle" value="${esc(s.subtitle)}"></div>
            <div class="cd-field"><label class="cs-label" for="cxSlideLayout">Layout</label>
                <select id="cxSlideLayout" class="cd-input" data-sfield="layout">${['content', 'section', 'cover', 'closing'].map(l => `<option value="${l}" ${s.layout === l ? 'selected' : ''}>${l[0].toUpperCase() + l.slice(1)}</option>`).join('')}</select></div>
            <div class="cd-field"><label class="cs-label" for="cxSlideNotes">Speaker notes <small>(exported to PowerPoint notes)</small></label><textarea id="cxSlideNotes" class="cd-input" rows="3" data-sfield="notes">${esc(s.notes)}</textarea></div>
            ${s.layout === 'content' ? `
            <div class="cd-field"><span class="cs-label">Add to slide</span>
                <div class="cx-addgrid">
                    ${[['chart', 'fa-chart-column', 'Chart'], ['table', 'fa-table', 'Table'], ['kpis', 'fa-hashtag', 'KPI tiles'], ['text', 'fa-align-left', 'Text'], ['bullets', 'fa-list-ul', 'Bullets'], ['cards', 'fa-clone', 'Cards'], ['callout', 'fa-quote-left', 'Callout'], ['image', 'fa-image', 'Image']]
                        .map(([t, i, l]) => `<button type="button" class="st-btn" data-add="${t}"><i class="fa-solid ${i}"></i> ${l}</button>`).join('')}
                </div></div>` : ''}
            <div class="cd-field-row">
                <button type="button" class="st-btn cs-block" data-sact="dup"><i class="fa-regular fa-copy"></i> Duplicate</button>
                <button type="button" class="st-btn cs-block cs-danger" data-sact="del" ${deck.slides.length > 1 ? '' : 'disabled'}><i class="fa-solid fa-trash"></i> Delete</button>
            </div>
            <div class="cd-head" style="margin-top:6px"><h4>Deck</h4></div>
            <div class="cd-field"><label class="cs-label" for="cxDeckName">Deck name</label><input id="cxDeckName" class="cd-input" data-dfield="name" value="${esc(deck.name)}"></div>
            <div class="cd-field-row">
                <div class="cd-field"><label class="cs-label" for="cxDeckClient">Tenant</label><input id="cxDeckClient" class="cd-input" data-dfield="client" value="${esc(deck.client)}" placeholder="Tenant Name"></div>
                <div class="cd-field"><label class="cs-label" for="cxDeckPeriod">Period</label><input id="cxDeckPeriod" class="cd-input" data-dfield="period" value="${esc(deck.period)}"></div>
            </div>
            <div class="cd-field-row">
                <div class="cd-field"><label class="cs-label" for="cxThemePrimary">Primary color</label><input id="cxThemePrimary" type="color" class="cd-input cx-color" data-tfield="primary" value="${esc(T().primary)}"></div>
                <div class="cd-field"><label class="cs-label" for="cxThemeAccent">Accent color</label><input id="cxThemeAccent" type="color" class="cd-input cx-color" data-tfield="accent" value="${esc(T().accent)}"></div>
            </div>`;
    }

    function renderTemplates() {
        const box = document.getElementById('cadenceTemplateList');
        if (!box) return;
        box.innerHTML = Object.values(templates).map(t => `
            <article class="cx-tpl${deck && deck.templateId === t.id ? ' active' : ''}">
                <div class="cx-tpl-head"><i class="fa-solid fa-file-powerpoint"></i><div><strong>${esc(t.name)}</strong><small>${esc(t.description || '')}</small></div></div>
                <div class="cx-tpl-meta"><span class="cs-chip">${t.deck.slides.length} slides</span><span class="cs-chip">${t.deck.slides.reduce((n, s) => n + s.blocks.filter(b => b.type === 'chart').length, 0)} charts</span></div>
                <button type="button" class="st-btn st-primary cd-primary cs-block" data-tpl="${esc(t.id)}"><i class="fa-solid fa-wand-magic-sparkles"></i> Use this template</button>
            </article>`).join('') || '<p class="cs-note">No templates registered.</p>';
    }

    function renderAll() {
        renderNav();
        renderSlide();
        renderInspector();
        renderTemplates();
        syncUndoButtons();
    }

    // ------------------------------------------------------------------ editing events
    function commitEdit(el) {
        const s = slide();
        if (!s) return;
        if (el.dataset.editList) {
            const [bid, path] = el.dataset.editList.split('|');
            const b = blockById(s, bid);
            const items = [...el.querySelectorAll('li')].map(li => li.innerText.trim()).filter(Boolean);
            if (b && JSON.stringify(getPath(b, path)) !== JSON.stringify(items)) { snapshot(); setPath(b, path, items); save(); renderNav(); }
            return;
        }
        const [bid, path] = el.dataset.edit.split('|');
        const target = bid === '@slide' ? s : blockById(s, bid);
        if (!target) return;
        let v = el.innerText.replace(/ /g, ' ');
        v = el.dataset.multiline ? v.replace(/\n{3,}/g, '\n\n').trim() : v.replace(/\s*\n\s*/g, ' ').trim();
        if (getPath(target, path) === v) return;
        snapshot();
        setPath(target, path, v);
        save();
        renderNav();
        checkOverflow();
    }

    function onStageClick(e) {
        const btn = e.target.closest('[data-bact]');
        if (!btn) return;
        e.preventDefault();
        const s = slide();
        const sec = btn.closest('[data-block]');
        const b = blockById(s, sec && sec.dataset.block);
        if (!b) return;
        const i = s.blocks.indexOf(b);
        const act = btn.dataset.bact;
        if (act === 'chart') { if (window.ChartEngine) ChartEngine.open(chartId(s, b)); return; }
        if (act === 'img') { pickImage(src => mutate(() => { b.src = src; })); return; }
        if (act === 'del' && !confirm(`Delete this ${b.type} block?`)) return;
        mutate(() => {
            if (act === 'span') b.span = SPANS.find(v => v < b.span) || SPANS[0]; // 12 → 8 → 6 → 4 → 3 → 12
            else if (act === 'up' && i > 0) [s.blocks[i - 1], s.blocks[i]] = [s.blocks[i], s.blocks[i - 1]];
            else if (act === 'down' && i < s.blocks.length - 1) [s.blocks[i + 1], s.blocks[i]] = [s.blocks[i], s.blocks[i + 1]];
            else if (act === 'del') s.blocks.splice(i, 1);
            else if (act === 'row+') b.rows.push((b.header || []).map(() => ''));
            else if (act === 'row-' && b.rows.length > 1) b.rows.pop();
            else if (act === 'col+') { b.header.push('New'); b.rows.forEach(r => r.push('')); }
            else if (act === 'col-' && b.header.length > 1) { b.header.pop(); b.rows.forEach(r => r.pop()); b.groups = null; }
            else if (act === 'item+') b.items.push(newItem(b));
            else if (act === 'item-' && b.items.length > 1) b.items.pop();
        });
    }

    function newItem(b) {
        if (b.type === 'kpis') return { value: '0', label: 'New metric', tone: 'soft' };
        if (b.type === 'cards') return { title: 'New item', body: 'Details', tag: b.items[0] && b.items[0].tag != null ? 'Status' : undefined };
        if (b.type === 'steps') return { text: 'New step' };
        return 'New point';
    }

    function newBlock(type) {
        const base = { id: uid(), type, span: 6, title: type === 'chart' ? 'New chart' : type === 'table' ? 'New table' : undefined };
        if (type === 'chart') return Object.assign(base, { defaults: { type: 'bar', dataLabels: true, legend: { show: false } }, data: { labels: ['Jun', 'Jul', 'Aug'], series: [{ name: 'Value', data: [10, 20, 15] }], dimension: 'Month', measure: 'Value' } });
        if (type === 'table') return Object.assign(base, { header: ['Item', 'Value'], rows: [['Row 1', '0'], ['Row 2', '0']] });
        if (type === 'kpis') return Object.assign(base, { span: 12, items: [{ value: '0', label: 'Metric', tone: 'soft' }, { value: '0', label: 'Metric', tone: 'soft' }, { value: '0%', label: 'Metric', tone: 'dark' }] });
        if (type === 'text') return Object.assign(base, { text: 'Click to edit this text.' });
        if (type === 'bullets') return Object.assign(base, { items: ['First point', 'Second point'] });
        if (type === 'cards') return Object.assign(base, { span: 12, cols: 3, items: [{ title: 'Item', body: 'Details' }, { title: 'Item', body: 'Details' }, { title: 'Item', body: 'Details' }] });
        if (type === 'callout') return Object.assign(base, { value: '0%', text: 'Key takeaway for this slide.' });
        if (type === 'image') return Object.assign(base, { src: '', caption: 'Caption' });
        return base;
    }

    function pickImage(cb) {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/png,image/jpeg,image/svg+xml,image/gif,image/webp';
        inp.onchange = () => {
            const f = inp.files && inp.files[0];
            if (!f) return;
            if (f.size > 2.5 * 1024 * 1024) { toast('Image is over 2.5 MB — please use a smaller file.'); return; }
            const r = new FileReader();
            r.onload = () => cb(String(r.result));
            r.readAsDataURL(f);
        };
        inp.click();
    }

    function onInspectorEvent(e) {
        const s = slide();
        if (!s) return;
        const sf = e.target.closest('[data-sfield]');
        const df = e.target.closest('[data-dfield]');
        const tf = e.target.closest('[data-tfield]');
        if (e.type === 'change' && sf) {
            const k = sf.dataset.sfield;
            if (s[k] === sf.value) return;
            mutate(() => { s[k] = sf.value; });
        } else if (e.type === 'change' && df) {
            if (deck[df.dataset.dfield] === df.value) return;
            mutate(() => { deck[df.dataset.dfield] = df.value; });
        } else if (e.type === 'change' && tf) {
            mutate(() => { deck.theme = Object.assign({}, deck.theme, { [tf.dataset.tfield]: tf.value }); });
        } else if (e.type === 'click') {
            const add = e.target.closest('[data-add]');
            const sact = e.target.closest('[data-sact]');
            if (add) { mutate(() => s.blocks.push(newBlock(add.dataset.add))); toast(`Added ${add.dataset.add} block to slide ${current + 1}`); }
            else if (sact) navAction(sact.dataset.sact, current);
        }
    }

    function navAction(act, i) {
        if (act === 'go') { current = i; renderAll(); return; }
        if (act === 'del' && !confirm(`Delete slide ${i + 1} "${deck.slides[i].title}"?`)) return;
        mutate(() => {
            if (act === 'up' && i > 0) { [deck.slides[i - 1], deck.slides[i]] = [deck.slides[i], deck.slides[i - 1]]; current = i - 1; }
            else if (act === 'down' && i < deck.slides.length - 1) { [deck.slides[i + 1], deck.slides[i]] = [deck.slides[i], deck.slides[i + 1]]; current = i + 1; }
            else if (act === 'dup') {
                const copy = clone(deck.slides[i]);
                copy.uid = uid();
                copy.blocks.forEach(b => { b.id = uid(); });
                deck.slides.splice(i + 1, 0, copy);
                current = i + 1;
                audit('Slide Duplicated', `Duplicated slide ${i + 1} (${copy.title}) in ${deck.name}`);
            } else if (act === 'del' && deck.slides.length > 1) {
                deck.slides.splice(i, 1);
                current = Math.min(i, deck.slides.length - 1);
            }
        });
    }

    function moveSlide(from, to) {
        if (from === to || from < 0 || to < 0) return;
        mutate(() => { const [m] = deck.slides.splice(from, 1); deck.slides.splice(to, 0, m); current = to; });
    }

    function bind() {
        const host = stageEl();
        if (!host || host.dataset.cxBound) return;
        host.dataset.cxBound = '1';
        host.addEventListener('focusout', (e) => { const el = e.target.closest('[data-edit],[data-edit-list]'); if (el) commitEdit(el); });
        host.addEventListener('keydown', (e) => {
            const el = e.target.closest('[data-edit]');
            if (el && e.key === 'Enter' && !el.dataset.multiline && !e.shiftKey) { e.preventDefault(); el.blur(); }
            if (e.key === 'Escape' && el) el.blur();
        });
        host.addEventListener('click', onStageClick);
        // paste as plain text so slide styling stays consistent
        host.addEventListener('paste', (e) => {
            if (!e.target.closest('[contenteditable="true"]')) return;
            e.preventDefault();
            document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
        });

        const nav = document.getElementById('cadenceSlideNav');
        nav.addEventListener('click', (e) => {
            const b = e.target.closest('[data-nact]');
            if (!b) return;
            navAction(b.dataset.nact, +b.closest('li').dataset.index);
        });
        let dragFrom = -1;
        nav.addEventListener('dragstart', (e) => { const li = e.target.closest('li[data-index]'); if (!li) return; dragFrom = +li.dataset.index; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(dragFrom)); li.classList.add('dragging'); });
        nav.addEventListener('dragover', (e) => {
            const li = e.target.closest('li[data-index]');
            if (dragFrom < 0 || !li) return;
            e.preventDefault();
            nav.querySelectorAll('.drop-before,.drop-after').forEach(n => n.classList.remove('drop-before', 'drop-after'));
            const r = li.getBoundingClientRect();
            li.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
        });
        nav.addEventListener('drop', (e) => {
            e.preventDefault();
            const li = e.target.closest('li[data-index]');
            if (dragFrom >= 0 && li) {
                let to = +li.dataset.index + (li.classList.contains('drop-after') ? 1 : 0);
                if (to > dragFrom) to -= 1;
                moveSlide(dragFrom, to);
            }
            dragFrom = -1;
        });
        nav.addEventListener('dragend', () => { dragFrom = -1; nav.querySelectorAll('.dragging,.drop-before,.drop-after').forEach(n => n.classList.remove('dragging', 'drop-before', 'drop-after')); });

        const insp = document.getElementById('cadenceDynamicFormContainer');
        insp.addEventListener('change', onInspectorEvent);
        insp.addEventListener('click', onInspectorEvent);

        const tl = document.getElementById('cadenceTemplateList');
        if (tl) tl.addEventListener('click', (e) => { const b = e.target.closest('[data-tpl]'); if (b) useTemplate(b.dataset.tpl); });

        document.getElementById('btnPrevCadenceSlide')?.addEventListener('click', () => { if (current > 0) { current--; renderAll(); } });
        document.getElementById('btnNextCadenceSlide')?.addEventListener('click', () => { if (deck && current < deck.slides.length - 1) { current++; renderAll(); } });
        document.getElementById('btnCadenceUndo')?.addEventListener('click', () => step(undoStack, redoStack));
        document.getElementById('btnCadenceRedo')?.addEventListener('click', () => step(redoStack, undoStack));
        document.getElementById('btnSaveCadenceDraft')?.addEventListener('click', () => { saveToRepository(false); toast('Saved the cadence deck to Accepted Docs.'); });
        document.getElementById('btnExportCadencePptx')?.addEventListener('click', () => exportPptx(deck, { record: true }));
        document.getElementById('btnAddCadenceSlide')?.addEventListener('click', () => mutate(() => {
            deck.slides.splice(current + 1, 0, { uid: uid(), layout: 'content', title: 'New slide', subtitle: '', kicker: '', notes: '', footnote: '', blocks: [newBlock('text')] });
            current += 1;
        }));

        const dz = document.getElementById('cadencePptxDropzone');
        const inp = document.getElementById('cadencePptxInput');
        if (dz && inp) {
            dz.addEventListener('click', () => inp.click());
            dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
            dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
            dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('dragover'); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) importPptx(f); });
            inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; if (f) importPptx(f); inp.value = ''; });
        }

        if (window.ResizeObserver) new ResizeObserver(() => fit()).observe(host.closest('.cd-stage'));
        document.addEventListener('keydown', (e) => {
            const view = document.getElementById('view-cadence');
            if (!view || view.classList.contains('hidden') || !deck) return;
            if (e.target.closest('input,textarea,select,[contenteditable="true"]') || document.querySelector('.ce-inspector')) return;
            if (e.key === 'PageDown' || (e.key === 'ArrowDown' && e.altKey)) { e.preventDefault(); if (current < deck.slides.length - 1) { current++; renderAll(); } }
            if (e.key === 'PageUp' || (e.key === 'ArrowUp' && e.altKey)) { e.preventDefault(); if (current > 0) { current--; renderAll(); } }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); step(e.shiftKey ? redoStack : undoStack, e.shiftKey ? undoStack : redoStack); }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); step(redoStack, undoStack); }
        });
    }

    // ------------------------------------------------------------------ templates + repository
    function registerTemplate(t) {
        const d = sanitizeDeck(t.deck);
        if (!d) { console.warn('[CadenceDeck] invalid template', t && t.id); return; }
        templates[t.id] = { id: t.id, name: t.name, description: t.description, deck: Object.assign(d, { templateId: t.id }) };
        if (deck) renderTemplates();
    }

    function useTemplate(id, silent = false) {
        const t = templates[id];
        if (!t) return false;
        if (!silent && deck && deck.slides.length && !confirm(`Start a new deck from "${t.name}"? The current deck stays in Accepted Docs only if you saved it.`)) return false;
        snapshot();
        deck = clone(t.deck);
        deck.id = 'deck-' + uid();
        deck.slides.forEach(s => { s.uid = uid(); });
        current = 0;
        save();
        renderAll();
        audit('Template Applied', `Started cadence deck from template ${t.name}`);
        toast(`Loaded template: ${t.name} (${deck.slides.length} slides)`);
        return true;
    }

    function load(d, opts = {}) {
        const clean = sanitizeDeck(d);
        if (!clean) { toast('That cadence deck could not be opened.'); return false; }
        if (deck && opts.undoable !== false) snapshot();
        deck = clean;
        current = Math.min(opts.slide || 0, deck.slides.length - 1);
        save();
        renderAll();
        return true;
    }

    function saveToRepository(isExport) {
        if (!deck || typeof AppState === 'undefined') return null;
        const file = `${deck.client.replace(/[^\w]+/g, '_')}_${deck.name.replace(/[^\w]+/g, '_')}.pptx`;
        const entry = {
            id: 'cadence-ppt-' + Date.now(),
            title: `${deck.client} · ${deck.name}`,
            fileName: file,
            clientName: deck.client,
            totalSlides: deck.slides.length,
            savedAt: new Date().toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            status: isExport ? 'Exported PPTX' : 'Accepted Draft',
            templateUsed: deck.templateId || 'custom',
            deckSnapshot: clone(deck)
        };
        AppState.acceptedCadencePpts = AppState.acceptedCadencePpts || [];
        AppState.acceptedCadencePpts.unshift(entry);
        try { localStorage.setItem('altisec_accepted_cadence_ppts', JSON.stringify(AppState.acceptedCadencePpts)); }
        catch (e) { toast('Browser storage is full — the deck is listed for this session only.'); }
        if (typeof renderAcceptedCadencePpts === 'function') renderAcceptedCadencePpts();
        audit(isExport ? 'Cadence PPTX Exported' : 'Cadence Deck Saved', `${entry.title} (${entry.totalSlides} slides)`);
        return entry;
    }

    // ------------------------------------------------------------------ PPTX export
    const hex = (c) => String(c || '').replace('#', '').slice(0, 6).toUpperCase() || '000000';
    const ptOf = (el) => Math.round(parseFloat(getComputedStyle(el).fontSize) * 0.75 * 10) / 10;
    const imgCache = {};
    async function dataUrl(src) {
        if (!src) return null;
        if (/^data:/.test(src)) return src;
        if (imgCache[src]) return imgCache[src];
        try {
            const blob = await (await fetch(src)).blob();
            imgCache[src] = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
            return imgCache[src];
        } catch (e) { return null; }
    }

    function chartForPptx(pres, desc) {
        const t = desc.def;
        const C = pres.ChartType || pres.charts;
        if (t.html || t.base === 'polarArea') return null;
        const type = { pie: C.pie, doughnut: C.doughnut, bar: C.bar, line: t.fill ? C.area : C.line, radar: C.radar }[t.base];
        const data = desc.series.map(s => ({ name: s.name, labels: desc.labels, values: s.data }));
        const byPoint = desc.series.length === 1 && desc.series[0].byPoint;
        const colors = (byPoint ? desc.series[0].colors : desc.series.map(s => s.color)).map(hex);
        const cfg = desc.cfg;
        const legendPos = { top: 't', bottom: 'b', left: 'l', right: 'r' }[cfg.legend.position] || 'b';
        const o = {
            chartColors: colors.length ? colors : ['1E2761'],
            showLegend: !!cfg.legend.show && !(desc.series.length === 1 && !t.radial),
            legendPos, legendFontSize: 9, legendFontFace: 'Calibri',
            showValue: !!cfg.dataLabels, dataLabelFontSize: 8, dataLabelFontFace: 'Calibri', dataLabelColor: t.radial ? 'FFFFFF' : '1A1F36',
            showTitle: !!cfg.title, title: cfg.title || undefined, titleFontSize: 11, titleColor: '1A1F36',
            catAxisLabelFontSize: 8, valAxisLabelFontSize: 8, catAxisLabelColor: '475569', valAxisLabelColor: '475569',
            catAxisLabelFontFace: 'Calibri', valAxisLabelFontFace: 'Calibri',
            valAxisHidden: !cfg.axis, catGridLine: { style: 'none' },
            valGridLine: cfg.grid ? { color: 'E2E8F0', size: 0.5 } : { style: 'none' }
        };
        if (t.base === 'bar') {
            o.barDir = t.horizontal ? 'bar' : 'col';
            o.barGrouping = t.stacked ? 'stacked' : 'clustered';
            o.barGapWidthPct = 60;
            if (cfg.dataLabels) o.dataLabelPosition = t.stacked ? 'ctr' : 'outEnd';
        }
        if (t.base === 'line') { o.lineSize = 2; o.lineDataSymbol = 'circle'; o.lineDataSymbolSize = 5; if (t.stacked) o.barGrouping = 'stacked'; if (cfg.dataLabels) o.dataLabelPosition = 't'; }
        if (t.radial) { o.showPercent = false; o.dataLabelPosition = cfg.dataLabels ? 'ctr' : undefined; if (t.base === 'doughnut') o.holeSize = 58; }
        return { type, data, o };
    }

    async function exportPptx(d = deck, opts = {}) {
        if (!d) return;
        if (typeof PptxGenJS === 'undefined') { toast('The PowerPoint export library did not load (check your connection) — try again.'); return; }
        toast(`Building ${d.slides.length}-slide PowerPoint…`);
        const pres = new PptxGenJS();
        pres.layout = 'LAYOUT_WIDE';
        pres.title = d.name;
        pres.author = 'AltiSec SOC';
        pres.company = 'AltiSec';
        const t = Object.assign({}, DEFAULT_THEME, d.theme);

        const host = document.createElement('div');
        host.className = 'cx-export-host';
        host.setAttribute('aria-hidden', 'true');
        document.body.appendChild(host);
        const at = (el, base) => {
            const r = el.getBoundingClientRect();
            return { x: (r.left - base.left) / PX_PER_IN, y: (r.top - base.top) / PX_PER_IN, w: r.width / PX_PER_IN, h: r.height / PX_PER_IN };
        };
        const txt = (el, base, text, extra = {}) => {
            if (!el || !String(text || '').trim()) return;
            const cs = getComputedStyle(el);
            pres._cur.addText(String(text), Object.assign(at(el, base), {
                isTextBox: true, margin: 0, fontFace: /montserrat/i.test(cs.fontFamily) ? 'Montserrat' : 'Calibri',
                fontSize: ptOf(el), bold: +cs.fontWeight >= 600, color: hex(rgbToHex(cs.color)), valign: 'top',
                align: cs.textAlign === 'center' ? 'center' : cs.textAlign === 'right' ? 'right' : 'left', fit: 'shrink'
            }, extra));
        };

        try {
            for (let i = 0; i < d.slides.length; i++) {
                const s = d.slides[i];
                host.innerHTML = slideHtml(s, i, d, false);
                mountCharts(s);
                await new Promise(r => requestAnimationFrame(r));
                const root = host.firstElementChild;
                const base = root.getBoundingClientRect();
                const ps = pres.addSlide();
                pres._cur = ps;
                const dark = s.layout === 'section' || s.layout === 'closing';
                ps.background = { color: dark ? hex(t.primary) : 'FFFFFF' };
                if (s.notes) ps.addNotes(s.notes);

                for (const img of root.querySelectorAll('img[data-part]')) {
                    const data = await dataUrl(img.getAttribute('src'));
                    if (data) ps.addImage(Object.assign({ data }, at(img, base), { sizing: { type: 'contain', ...sizeIn(at(img, base)) } }));
                }
                root.querySelectorAll('.cx-section-mark').forEach(m => ps.addShape(pres.ShapeType.rect, Object.assign(at(m, base), { fill: { color: hex(t.accent) }, line: { color: hex(t.accent) } })));
                ['.cx-cover-title', '.cx-cover-period', '.cx-cover-kicker', '.cx-section-kicker', '.cx-section-title', '.cx-section-sub', '.cx-title', '.cx-subtitle', '.cx-foot-note', '.cx-foot-num']
                    .forEach(sel => root.querySelectorAll(sel).forEach(el => txt(el, base, el.innerText)));

                for (const sec of root.querySelectorAll('[data-block]')) {
                    const b = blockById(s, sec.dataset.block);
                    if (!b) continue;
                    const bt = sec.querySelector(':scope > .cx-bt');
                    if (bt) txt(bt, base, b.title);
                    if (b.type === 'text') txt(sec.querySelector('.cx-text'), base, b.text);
                    else if (b.type === 'bullets') {
                        const ul = sec.querySelector('.cx-bullets');
                        ps.addText((b.items || []).map((it, k, a) => ({ text: it, options: { bullet: true, breakLine: k < a.length - 1 } })),
                            Object.assign(at(ul, base), { isTextBox: true, margin: 0, fontFace: 'Calibri', fontSize: ptOf(ul), color: hex(t.ink), valign: 'top', paraSpaceAfter: 4, fit: 'shrink' }));
                    } else if (b.type === 'kpis') {
                        sec.querySelectorAll('[data-part="kpi"]').forEach((tile, k) => {
                            const it = b.items[k];
                            const cs = getComputedStyle(tile);
                            ps.addShape(pres.ShapeType.roundRect, Object.assign(at(tile, base), { fill: { color: hex(rgbToHex(cs.backgroundColor)) }, line: { color: hex(rgbToHex(cs.borderTopColor)), width: 0.75 }, rectRadius: 0.08 }));
                            txt(tile.querySelector('.cx-kpi-val'), base, it.value);
                            txt(tile.querySelector('.cx-kpi-lbl'), base, it.label);
                            if (it.sub != null) txt(tile.querySelector('.cx-kpi-sub'), base, it.sub);
                        });
                    } else if (b.type === 'table') {
                        const table = sec.querySelector('table');
                        const ths = [...table.querySelectorAll('thead tr:last-child th')];
                        const fs = ptOf(table.querySelector('td') || table);
                        const head = (b.header || []).map(h => ({ text: h, options: { bold: true, color: 'FFFFFF', fill: { color: hex(t.primary) } } }));
                        const rows = (b.rows || []).map((r, ri) => r.map((c, ci) => ({ text: c, options: { fill: { color: ri % 2 ? 'F4F6FB' : 'FFFFFF' }, bold: !!(b.total && ri === b.rows.length - 1), color: (b.pillCols || []).includes(ci) ? hex(t[{ bad: 'bad', warn: 'warn', good: 'good' }[toneOf(c)] || 'ink'] || t.ink) : hex(t.ink) } })));
                        const all = [head, ...rows];
                        if (b.groups && b.groups.length) all.unshift(b.groups.map(g => ({ text: g.label, options: { colspan: g.span || 1, bold: true, color: hex(t.primary), fill: { color: hex(t.soft) }, align: 'center' } })));
                        ps.addTable(all, Object.assign(at(table, base), { colW: ths.map(th => th.getBoundingClientRect().width / PX_PER_IN), fontFace: 'Calibri', fontSize: fs, border: { type: 'solid', pt: 0.5, color: 'D5DCE8' }, margin: 0.04, valign: 'middle', autoPage: false }));
                    } else if (b.type === 'chart') {
                        const desc = window.ChartEngine && ChartEngine.describe(chartId(s, b));
                        const box = at(sec.querySelector('.cx-chart'), base);
                        const native = desc && chartForPptx(pres, desc);
                        if (native) ps.addChart(native.type, native.data, Object.assign({}, box, native.o));
                        else if (desc && desc.def.html) {
                            const rowsT = [[{ text: desc.cfg.xTitle || 'Category', options: { bold: true, color: 'FFFFFF', fill: { color: hex(t.primary) } } }, ...desc.series.map(x => ({ text: x.name, options: { bold: true, color: 'FFFFFF', fill: { color: hex(t.primary) } } }))],
                                ...desc.labels.map((l, k) => [{ text: l }, ...desc.series.map(x => ({ text: desc.format(x.data[k], l), options: { align: 'right' } }))])];
                            ps.addTable(rowsT, Object.assign({}, box, { fontFace: 'Calibri', fontSize: 9, border: { type: 'solid', pt: 0.5, color: 'D5DCE8' } }));
                        } else {
                            // no native PowerPoint equivalent (polar area): embed the rendered chart
                            const cv = sec.querySelector('canvas');
                            if (cv) ps.addImage(Object.assign({ data: cv.toDataURL('image/png') }, box));
                        }
                    } else if (b.type === 'cards') {
                        sec.querySelectorAll('[data-part="card"]').forEach((card, k) => {
                            const it = b.items[k];
                            const cs = getComputedStyle(card);
                            ps.addShape(pres.ShapeType.roundRect, Object.assign(at(card, base), { fill: { color: hex(rgbToHex(cs.backgroundColor)) }, line: { color: hex(rgbToHex(cs.borderTopColor)), width: 0.75 }, rectRadius: 0.06 }));
                            const num = card.querySelector('.cx-card-num');
                            if (num) ps.addText(String(it.num), Object.assign(at(num, base), { shape: pres.ShapeType.ellipse, fill: { color: hex(t.soft) }, color: hex(t.primary), bold: true, fontSize: ptOf(num), align: 'center', valign: 'middle', margin: 0 }));
                            txt(card.querySelector('h5'), base, it.title);
                            txt(card.querySelector('p'), base, it.body);
                            txt(card.querySelector('.cx-card-meta small'), base, it.meta);
                            const pill = card.querySelector('.cx-pill');
                            if (pill) ps.addText(String(it.tag), Object.assign(at(pill, base), { fill: { color: hex(rgbToHex(getComputedStyle(pill).backgroundColor)) }, color: hex(rgbToHex(getComputedStyle(pill).color)), bold: true, fontSize: ptOf(pill), align: 'center', valign: 'middle', margin: 0, shape: pres.ShapeType.roundRect, rectRadius: 0.05 }));
                        });
                    } else if (b.type === 'steps') {
                        sec.querySelectorAll('.cx-steps li').forEach((li, k) => {
                            const n = li.querySelector('.cx-step-num');
                            ps.addText(String(k + 1), Object.assign(at(n, base), { shape: pres.ShapeType.ellipse, fill: { color: hex(b.items[k].manual ? t.accent : t.teal) }, color: 'FFFFFF', bold: true, fontSize: ptOf(n), align: 'center', valign: 'middle', margin: 0 }));
                            txt(li.querySelector('.cx-step-text'), base, b.items[k].text, { align: 'center' });
                        });
                    } else if (b.type === 'callout') {
                        const box = sec.querySelector('.cx-callout');
                        ps.addShape(pres.ShapeType.roundRect, Object.assign(at(box, base), { fill: { color: hex(rgbToHex(getComputedStyle(box).backgroundColor)) }, line: { color: hex(rgbToHex(getComputedStyle(box).borderTopColor)), width: 0.75 }, rectRadius: 0.08 }));
                        if (b.value != null) txt(box.querySelector('.cx-callout-val'), base, b.value);
                        txt(box.querySelector('p'), base, b.text);
                    }
                }
            }
            const fileName = `${d.client.replace(/[^\w]+/g, '_')}_${d.name.replace(/[^\w]+/g, '_')}.pptx`;
            await pres.writeFile({ fileName });
            if (opts.record) saveToRepository(true);
            toast(`Exported ${fileName}`);
        } catch (e) {
            console.error('[CadenceDeck] export failed', e);
            toast('PowerPoint export failed — see the browser console for details.');
        } finally {
            host.remove();
            delete pres._cur;
            if (deck === d) renderSlide(); // re-bind charts to the on-screen canvases
        }
    }

    function sizeIn(r) { return { w: r.w, h: r.h }; }
    function rgbToHex(c) {
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(c || '');
        if (!m) return /^#/.test(c || '') ? c : '#FFFFFF';
        if (m[4] !== undefined && +m[4] === 0) return '#FFFFFF';
        return '#' + [m[1], m[2], m[3]].map(v => (+v).toString(16).padStart(2, '0')).join('');
    }

    // ------------------------------------------------------------------ PPTX import
    // Reads any .pptx: slide titles, text, tables, native charts (with their data) and pictures
    // become blocks. Placement is approximated on the 12-column grid from each shape's position.
    async function importPptx(file) {
        if (!/\.pptx$/i.test(file.name)) { toast('Please choose a .pptx file (save .ppt decks as .pptx first).'); return; }
        if (typeof JSZip === 'undefined') { toast('The PowerPoint reader did not load — check your connection and try again.'); return; }
        toast(`Reading ${file.name}…`);
        try {
            const zip = await JSZip.loadAsync(file);
            const read = async (p) => { const f = zip.file(p); return f ? f.async('string') : null; };
            const xml = (s) => new DOMParser().parseFromString(s, 'application/xml');
            const rels = async (p) => {
                const dir = p.substring(0, p.lastIndexOf('/'));
                const r = await read(`${dir}/_rels/${p.substring(p.lastIndexOf('/') + 1)}.rels`);
                const out = {};
                if (r) [...xml(r).getElementsByTagName('Relationship')].forEach(n => { out[n.getAttribute('Id')] = resolvePath(dir, n.getAttribute('Target')); });
                return out;
            };
            const presRels = await rels('ppt/presentation.xml');
            const presXml = xml(await read('ppt/presentation.xml'));
            const sz = presXml.getElementsByTagName('p:sldSz')[0];
            const slideW = sz ? +sz.getAttribute('cx') : 12192000;
            const slideH = sz ? +sz.getAttribute('cy') : 6858000;
            const ids = [...presXml.getElementsByTagName('p:sldId')].map(n => presRels[n.getAttribute('r:id')]);
            const media = {};
            const slides = [];
            const mediaUrl = async (p) => {
                if (media[p] !== undefined) return media[p];
                const f = zip.file(p);
                if (!f || !/\.(png|jpe?g|gif|svg)$/i.test(p)) return (media[p] = null);
                const b64 = await f.async('base64');
                const mime = /\.svg$/i.test(p) ? 'image/svg+xml' : /\.png$/i.test(p) ? 'image/png' : /\.gif$/i.test(p) ? 'image/gif' : 'image/jpeg';
                return (media[p] = `data:${mime};base64,${b64}`);
            };

            for (const sp of ids) {
                const doc = xml(await read(sp));
                const r = await rels(sp);
                const items = [];
                let title = '';
                // position/size live in the shape's transform (a:xfrm, or p:xfrm on graphic frames);
                // <a:ext> also names Office extension tags, so only the transform's children count
                const geo = (el) => {
                    const xf = el.getElementsByTagName('a:xfrm')[0] || el.getElementsByTagName('p:xfrm')[0];
                    const kid = (t) => xf && [...xf.children].find(n => n.tagName === t);
                    const off = kid('a:off'), ext = kid('a:ext');
                    return off && ext ? { x: +off.getAttribute('x'), y: +off.getAttribute('y'), w: +ext.getAttribute('cx') } : { x: 0, y: 0, w: slideW };
                };
                const paras = (el) => [...el.getElementsByTagName('a:p')].map(p => [...p.getElementsByTagName('a:t')].map(t => t.textContent).join('').replace(/​/g, '').trim()).filter(Boolean);
                const tree = doc.getElementsByTagName('p:spTree')[0];
                if (!tree) continue;
                for (const el of tree.children) {
                    const tag = el.tagName;
                    if (tag === 'p:sp') {
                        const ph = el.getElementsByTagName('p:ph')[0];
                        const tx = paras(el);
                        if (!tx.length) continue;
                        if (!title && ph && /title/i.test(ph.getAttribute('type') || '')) { title = tx.join(' '); continue; }
                        const font = Math.max(0, ...[...el.getElementsByTagName('a:rPr')].map(r => +r.getAttribute('sz') || 0));
                        items.push(Object.assign(geo(el), { kind: 'text', tx, font }));
                    } else if (tag === 'p:graphicFrame') {
                        const tbl = el.getElementsByTagName('a:tbl')[0];
                        const ch = el.getElementsByTagName('c:chart')[0];
                        if (tbl) {
                            const rows = [...tbl.getElementsByTagName('a:tr')].map(tr => [...tr.getElementsByTagName('a:tc')].map(tc => paras(tc).join('\n')));
                            if (rows.length) items.push(Object.assign(geo(el), { kind: 'table', rows }));
                        } else if (ch && r[ch.getAttribute('r:id')]) {
                            const c = await read(r[ch.getAttribute('r:id')]);
                            if (c) items.push(Object.assign(geo(el), { kind: 'chart', chart: parseChartXml(xml(c)) }));
                        }
                    } else if (tag === 'p:pic') {
                        const blip = el.getElementsByTagName('a:blip')[0];
                        const g = geo(el);
                        if (blip && g.w > slideW * 0.12 && r[blip.getAttribute('r:embed')]) {
                            const src = await mediaUrl(r[blip.getAttribute('r:embed')]);
                            if (src) items.push(Object.assign(g, { kind: 'image', src }));
                        }
                    }
                }
                // no title placeholder: take the largest text in the top fifth of the slide
                if (!title) {
                    const cand = items.filter(i => i.kind === 'text' && i.y < slideH * 0.2 && i.tx.join(' ').length <= 90).sort((a, b) => b.font - a.font)[0];
                    if (cand && cand.font >= 1800) { title = cand.tx.join(' '); items.splice(items.indexOf(cand), 1); }
                }
                items.sort((a, b) => (a.y - b.y) || (a.x - b.x));
                const spanOf = (w) => { const s = Math.round(w / slideW * 12); return SPANS.reduce((best, v) => Math.abs(v - s) < Math.abs(best - s) ? v : best, 12); };
                const blocks = [];
                let textBuf = [];
                const flushText = () => {
                    if (!textBuf.length) return;
                    const all = textBuf.flatMap(i => i.tx);
                    blocks.push(all.length > 2 ? { type: 'bullets', span: 12, items: all.slice(0, 14) } : { type: 'text', span: 12, text: all.join('\n') });
                    textBuf = [];
                };
                items.forEach(it => {
                    if (it.kind === 'text') { textBuf.push(it); return; }
                    flushText();
                    if (it.kind === 'table') blocks.push({ type: 'table', span: spanOf(it.w), size: it.rows.length > 7 ? 'xs' : 'sm', header: it.rows[0], rows: it.rows.slice(1).map(row => { const r2 = row.slice(); while (r2.length < it.rows[0].length) r2.push(''); return r2.slice(0, it.rows[0].length); }) });
                    else if (it.kind === 'chart' && it.chart) {
                        const points = it.chart.series.length * it.chart.labels.length;
                        blocks.push({ type: 'chart', span: spanOf(it.w), title: it.chart.title || 'Chart', height: 230,
                            defaults: { type: it.chart.type, dataLabels: points <= 12, legend: { show: it.chart.series.length > 1, position: 'bottom' } },
                            data: { labels: it.chart.labels, series: it.chart.series, time: /line|area/.test(it.chart.type) } });
                    }
                    else if (it.kind === 'image') blocks.push({ type: 'image', span: spanOf(it.w), src: it.src });
                });
                flushText();
                const onlyTitle = !blocks.length;
                slides.push({ layout: onlyTitle && slides.length === 0 ? 'cover' : onlyTitle ? 'section' : 'content', title: title || (blocks[0] && blocks[0].type === 'text' ? '' : `Slide ${slides.length + 1}`), blocks });
            }
            const name = file.name.replace(/\.pptx$/i, '').replace(/[_-]+/g, ' ').trim();
            const imported = sanitizeDeck({ name, client: (typeof AppState !== 'undefined' && AppState.properties.clientName) || 'TENANT', templateId: 'import', slides });
            if (!imported || !imported.slides.length) { toast('No slides could be read from that file.'); return; }
            if (deck) snapshot();
            deck = imported;
            current = 0;
            save();
            renderAll();
            const charts = imported.slides.reduce((n, s) => n + s.blocks.filter(b => b.type === 'chart').length, 0);
            audit('PPTX Imported', `Imported ${file.name}: ${imported.slides.length} slides, ${charts} charts`);
            toast(`Imported ${imported.slides.length} slides and ${charts} editable charts from ${file.name}`);
        } catch (e) {
            console.error('[CadenceDeck] import failed', e);
            toast('That PowerPoint file could not be read.');
        }
    }

    function resolvePath(dir, target) {
        if (/^\//.test(target)) return target.slice(1);
        const parts = (dir + '/' + target).split('/');
        const out = [];
        parts.forEach(p => { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); });
        return out.join('/');
    }

    function parseChartXml(doc) {
        const plot = doc.getElementsByTagName('c:plotArea')[0];
        if (!plot) return null;
        const kinds = { 'c:barChart': 'bar', 'c:bar3DChart': 'bar', 'c:lineChart': 'line', 'c:line3DChart': 'line', 'c:pieChart': 'pie', 'c:pie3DChart': 'pie', 'c:doughnutChart': 'doughnut', 'c:areaChart': 'area', 'c:radarChart': 'radar' };
        const node = [...plot.children].find(n => kinds[n.tagName]);
        if (!node) return null;
        let type = kinds[node.tagName];
        const dir = node.getElementsByTagName('c:barDir')[0];
        const grp = node.getElementsByTagName('c:grouping')[0];
        const sers = [...node.getElementsByTagName('c:ser')];
        const stacked = grp && /stacked/i.test(grp.getAttribute('val'));
        if (type === 'bar') type = dir && dir.getAttribute('val') === 'bar' ? 'hbar' : stacked && sers.length > 1 ? 'stackedBar' : sers.length > 1 ? 'groupedBar' : 'bar';
        if (type === 'area' && stacked && sers.length > 1) type = 'stackedArea';
        const pts = (el) => el ? [...el.getElementsByTagName('c:pt')].sort((a, b) => +a.getAttribute('idx') - +b.getAttribute('idx')).map(p => (p.getElementsByTagName('c:v')[0] || {}).textContent) : [];
        let labels = [];
        const series = sers.map((s, i) => {
            const cat = s.getElementsByTagName('c:cat')[0];
            const val = s.getElementsByTagName('c:val')[0];
            if (!labels.length) labels = pts(cat).map(x => String(x || '').replace(/\n/g, ' '));
            const tx = s.getElementsByTagName('c:tx')[0];
            const name = tx ? [...tx.getElementsByTagName('c:v')].map(v => v.textContent).join('') : `Series ${i + 1}`;
            const sp = [...s.children].find(n => n.tagName === 'c:spPr');
            const clr = sp && sp.getElementsByTagName('a:srgbClr')[0];
            return { name, data: pts(val).map(v => Number(v) || 0), colors: clr ? '#' + clr.getAttribute('val') : undefined };
        });
        if (!labels.length && series[0]) labels = series[0].data.map((_, i) => String(i + 1));
        const title = [...(doc.getElementsByTagName('c:title')[0] || { getElementsByTagName: () => [] }).getElementsByTagName('a:t')].map(t => t.textContent).join('');
        return { type, labels, series, title };
    }

    // ------------------------------------------------------------------ init
    function init() {
        bind();
        let restored = null;
        try { restored = sanitizeDeck(JSON.parse(localStorage.getItem(LS_WORKING) || 'null')); } catch (e) { restored = null; }
        if (restored) deck = restored;
        else {
            const first = Object.values(templates)[0];
            if (first) { deck = clone(first.deck); deck.id = 'deck-' + uid(); deck.slides.forEach(s => { s.uid = uid(); }); }
            else deck = sanitizeDeck({ name: 'Monthly cadence', slides: [{ layout: 'content', title: 'New slide', blocks: [newBlock('text')] }] });
        }
        renderAll();
    }

    window.CadenceDeck = {
        init, render: renderAll, fit,
        registerTemplate, useTemplate, load, exportPptx, importPptx, saveToRepository,
        fromLegacySlides, sanitizeDeck,
        current: () => deck,
        setClient: (name) => { if (deck && name) mutate(() => { deck.client = name; }); },
        setTenant: (name) => { if (deck && name) mutate(() => { deck.client = name; }); },
        getTemplates: () => Object.assign({}, templates),
        getTemplate: (id) => templates[id],
        _internals: { toneOf, getPath, setPath, chartId }
    };

    // Self-check: sanitizer drops junk blocks/layouts; paths round-trip.
    (function selfCheck() {
        const d = sanitizeDeck({ slides: [{ layout: 'weird', blocks: [{ type: 'nope' }, { type: 'table', header: ['a'], rows: [['1']] }] }] });
        console.assert(d.slides[0].layout === 'content' && d.slides[0].blocks.length === 1, '[CadenceDeck] sanitize');
        const o = { items: [{ value: '1' }] };
        setPath(o, 'items.0.value', '2');
        console.assert(getPath(o, 'items.0.value') === '2', '[CadenceDeck] paths');
        console.assert(toneOf('Not completed') === 'bad' && toneOf('Completed') === 'good' && toneOf('In Progress') === 'warn', '[CadenceDeck] tones');
    })();
})();
