const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

async function run() {
    const tempDir = path.join(os.tmpdir(), `edge_err_${Date.now()}`);
    const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
        '--remote-debugging-port=9298',
        '--user-data-dir=' + tempDir,
        '--headless=new',
        'about:blank'
    ]);
    let data = null;
    for (let i = 0; i < 20; i++) {
        try {
            const res = await fetch('http://127.0.0.1:9298/json');
            data = await res.json();
            if (data && data.length) break;
        } catch (e) {}
        await new Promise(r => setTimeout(r, 300));
    }
    if (!data) throw new Error("Could not connect to Edge DevTools");
    const ws = new WebSocket(data[0].webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    ws.onmessage = e => {
        const m = JSON.parse(e.data);
        if (m.method === 'Runtime.exceptionThrown') {
            console.error('[BROWSER EXCEPTION]', m.params.exceptionDetails.text, m.params.exceptionDetails.exception?.description);
        }
        if (m.method === 'Runtime.consoleAPICalled') {
            if (m.params.type === 'error') {
                console.error('[CONSOLE ERROR]', m.params.args.map(a => a.value || a.description).join(' '));
            }
        }
    };

    let id = 1;
    function send(method, params = {}) {
        return new Promise(resolve => {
            const curId = id++;
            ws.send(JSON.stringify({ id: curId, method, params }));
            setTimeout(resolve, 50);
        });
    }

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Console.enable');

    console.log('Navigating to http://localhost:8000 ...');
    await send('Page.navigate', { url: 'http://localhost:8000' });

    await new Promise(r => setTimeout(r, 5000));
    edge.kill();
}

run().catch(console.error);
