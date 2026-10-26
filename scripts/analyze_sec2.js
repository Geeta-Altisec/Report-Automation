const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9237;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
    const tmpDir = path.join(os.tmpdir(), 'edge_sec2_' + Date.now());
    const edge = spawn(EDGE_PATH, [
        `--remote-debugging-port=${PORT}`,
        `--user-data-dir=${tmpDir}`,
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=1200,1600',
        'http://localhost:8000/test_render_docx.html'
    ]);

    await sleep(2500);
    const res = await fetch(`http://127.0.0.1:${PORT}/json`);
    const data = await res.json();
    const target = data.find(t => t.url.includes('test_render_docx.html'));
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
    await sleep(5000);

    const sec2Analysis = await evalExpr(`
        (() => {
            const sec2 = document.querySelectorAll('section.docx')[1]; // Section 2: FOREWORD
            if (!sec2) return 'No sec 2';
            
            const computed = window.getComputedStyle(sec2);
            const children = Array.from(sec2.children).map(c => {
                const cStyle = window.getComputedStyle(c);
                return {
                    tag: c.tagName,
                    className: c.className,
                    offsetHeight: c.offsetHeight,
                    offsetTop: c.offsetTop,
                    marginTop: cStyle.marginTop,
                    paddingTop: cStyle.paddingTop,
                    position: cStyle.position,
                    display: cStyle.display,
                    htmlSnippet: c.outerHTML.substring(0, 300)
                };
            });

            // Find all elements inside sec2 that contribute to vertical space
            const allDescendants = Array.from(sec2.querySelectorAll('*')).map(el => {
                const s = window.getComputedStyle(el);
                return {
                    tag: el.tagName,
                    class: el.className,
                    top: el.offsetTop,
                    height: el.offsetHeight,
                    pos: s.position,
                    marginTop: s.marginTop,
                    text: el.innerText ? el.innerText.substring(0, 40).replace(/\\n/g, ' ') : ''
                };
            }).filter(d => d.height > 50 || d.top > 200);

            return {
                secHeight: sec2.offsetHeight,
                secPadding: computed.padding,
                children: children,
                significantElements: allDescendants.slice(0, 15)
            };
        })()
    `);

    console.log('Section 2 Analysis:\n', JSON.stringify(sec2Analysis, null, 2));

    ws.close();
    edge.kill();
}

run().catch(console.error);
