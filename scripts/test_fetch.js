const { spawn } = require('child_process');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9232;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
    const edge = spawn(EDGE_PATH, [
        `--remote-debugging-port=${PORT}`,
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=1600,1200',
        'http://localhost:8000'
    ]);

    await sleep(2000);
    const res = await fetch(`http://127.0.0.1:${PORT}/json`);
    const data = await res.json();
    const target = data.find(t => t.url.includes('localhost:8000') || t.title.includes('AltiSec'));
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let id = 1;
    function evalExpr(expr) {
        return new Promise(resolve => {
            const curId = id++;
            ws.onmessage = (e) => {
                const m = JSON.parse(e.data);
                if (m.id === curId) resolve(m.result ? m.result.value : m.error);
            };
            ws.send(JSON.stringify({ id: curId, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } }));
        });
    }

    const fetchResult = await evalExpr(`
        fetch('/api/templates')
            .then(r => r.json())
            .then(d => ({ ok: true, count: d.templates.length, names: d.templates.map(t => t.name) }))
            .catch(e => ({ ok: false, err: e.message }))
    `);
    console.log('In-browser fetch(/api/templates):', fetchResult);

    ws.close();
    edge.kill();
}

run().catch(console.error);
