const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9239;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
    const tmpDir = path.join(os.tmpdir(), 'edge_pdf_' + Date.now());
    const edge = spawn(EDGE_PATH, [
        `--remote-debugging-port=${PORT}`,
        `--user-data-dir=${tmpDir}`,
        '--headless=new',
        '--disable-gpu',
        '--window-size=1200,1600',
        'http://localhost:8000/test_render_pdf.html'
    ]);

    await sleep(2000);
    const res = await fetch(`http://127.0.0.1:${PORT}/json`);
    const data = await res.json();
    const target = data.find(t => t.url.includes('test_render_pdf.html'));
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

    let result = null;
    for (let i = 0; i < 40; i++) {
        result = await evalExpr('window._pdfDone');
        if (result) break;
        await sleep(500);
    }

    console.log('PDF Render Result:', JSON.stringify(result, null, 2));

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:/Users/geeta.jogi/.gemini/antigravity/brain/2a2f504b-b9cd-4cb2-9c3f-7783c65fb11f/screenshot_test_pdf_render.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved screenshot_test_pdf_render.png');

    ws.close();
    edge.kill();
}

run().catch(console.error);
