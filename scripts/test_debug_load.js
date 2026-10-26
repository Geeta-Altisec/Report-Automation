const { spawn } = require('child_process');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9234;

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

    ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.method === 'Runtime.consoleAPICalled') {
            console.log('[CONSOLE]', m.params.type, m.params.args.map(a => a.value || a.description).join(' '));
        }
        if (m.method === 'Runtime.exceptionThrown') {
            console.log('[EXCEPTION]', m.params.exceptionDetails.text, m.params.exceptionDetails.exception?.description);
        }
        if (m.method === 'Network.responseReceived') {
            console.log('[NET RESPONSE]', m.params.response.url, m.params.response.status);
        }
        if (m.method === 'Network.loadingFailed') {
            console.log('[NET FAIL]', m.params.errorText, m.params.type);
        }
    };

    let id = 1;
    function send(method, params = {}) {
        return new Promise(resolve => {
            const curId = id++;
            ws.send(JSON.stringify({ id: curId, method, params }));
            resolve();
        });
    }

    await send('Network.enable');
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Console.enable');

    console.log('Reloading page...');
    await send('Page.reload');
    await sleep(8000);

    ws.close();
    edge.kill();
}

run().catch(console.error);
