const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9241;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
    const tmpDir = path.join(os.tmpdir(), 'edge_reparse_' + Date.now());
    const edge = spawn(EDGE_PATH, [
        `--remote-debugging-port=${PORT}`,
        `--user-data-dir=${tmpDir}`,
        '--headless=new',
        '--disable-gpu',
        '--window-size=1200,1600',
        'http://localhost:8000/test_render_docx_fix.html'
    ]);

    await sleep(2500);
    const res = await fetch(`http://127.0.0.1:${PORT}/json`);
    const data = await res.json();
    const target = data.find(t => t.url.includes('test_render_docx_fix.html'));
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    function send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const curId = id++;
            const handler = (e) => {
                const m = JSON.parse(e.data);
                if (m.id === curId) {
                    ws.removeEventListener('message', handler);
                    if (m.error) reject(m.error);
                    else resolve(m.result);
                }
            };
            ws.addEventListener('message', handler);
            ws.send(JSON.stringify({ id: curId, method, params }));
        });
    }

    async function evalExpr(expr) {
        const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        return r.result ? r.result.value : null;
    }

    // Wait for render
    let done = null;
    for (let i = 0; i < 40; i++) {
        done = await evalExpr('window._renderDone');
        if (done && done.ok) break;
        await sleep(500);
    }

    console.log('Done status:', done ? done.ok : false);

    // Extract cleaned HTML
    const cleanHtml = await evalExpr(`
        (() => {
            const cont = document.getElementById('output');
            // Prune empty sections
            Array.from(cont.querySelectorAll('section.docx')).forEach(sec => {
                const txt = sec.innerText.trim();
                const media = sec.querySelector('img, svg, table, canvas');
                if (!txt && !media) sec.remove();
            });

            // Ensure styles and zero-dimension fixes
            const secs = Array.from(cont.querySelectorAll('section.docx'));
            secs.forEach((sec, idx) => {
                sec.classList.add('a4-page-card', 'docx-page-card');
                sec.setAttribute('data-sec', 'docx-page-' + (idx + 1));
                sec.style.width = '794px';
                sec.style.minWidth = '794px';
                sec.style.maxWidth = '794px';
                sec.style.minHeight = '1123px';
                sec.style.margin = '0 auto 30px auto';
                sec.style.boxShadow = '0 4px 15px rgba(0,0,0,0.08)';
                sec.style.borderRadius = '4px';
                sec.style.background = '#ffffff';
                sec.style.position = 'relative';
                sec.style.boxSizing = 'border-box';
                sec.style.overflow = 'hidden';
                sec.style.padding = '36pt';

                sec.querySelectorAll('div[style*="width: 0px"], div[style*="width:0px"], div[style*="width: 0pt"]').forEach(d => {
                    d.style.position = 'absolute';
                    d.style.top = '0';
                    d.style.left = '0';
                    d.style.width = '0';
                    d.style.height = '0';
                    d.style.pointerEvents = 'none';
                    d.querySelectorAll('img, svg').forEach(m => {
                        m.style.position = 'absolute';
                        m.style.pointerEvents = 'none';
                    });
                });
            });

            return {
                pageCount: secs.length,
                html: cont.innerHTML
            };
        })()
    `);

    console.log('Cleaned HTML page count:', cleanHtml.pageCount);

    // Update custom_templates_store.json
    const storePath = path.join(__dirname, '../Reports-main/custom_templates_store.json');
    const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    const tplTata = store.templates.find(t => t.name.toLowerCase().includes('tata') && t.isDocxTemplate);
    if (tplTata) {
        tplTata.content = cleanHtml.html;
        tplTata.pages = cleanHtml.pageCount;
        fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
        console.log('Updated Tata technologies in custom_templates_store.json!');
    }

    ws.close();
    edge.kill();
}

run().catch(console.error);
