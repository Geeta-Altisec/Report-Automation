const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9295;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getTargetWsUrl() {
    for (let i = 0; i < 30; i++) {
        try {
            const res = await fetch(`http://127.0.0.1:${PORT}/json`);
            const data = await res.json();
            const target = data.find(t => t.url.includes('localhost:8000') || t.title.includes('AltiSec'));
            if (target && target.webSocketDebuggerUrl) {
                return target.webSocketDebuggerUrl;
            }
        } catch (e) {}
        await sleep(500);
    }
    throw new Error('Failed to find AltiSec target in Edge DevTools');
}

async function run() {
    const tempDir = path.join(os.tmpdir(), `edge_test_user_${Date.now()}`);
    const edge = spawn(EDGE_PATH, [
        `--remote-debugging-port=${PORT}`,
        `--user-data-dir=${tempDir}`,
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=1600,1200',
        'http://localhost:8000'
    ]);

    try {
        const wsUrl = await getTargetWsUrl();
        const ws = new WebSocket(wsUrl);
        await new Promise(r => ws.onopen = r);

        let msgId = 1;
        function send(method, params = {}) {
            return new Promise((resolve, reject) => {
                const id = msgId++;
                const handler = (e) => {
                    const m = JSON.parse(e.data);
                    if (m.id === id) {
                        ws.removeEventListener('message', handler);
                        if (m.error) reject(m.error);
                        else resolve(m.result);
                    }
                };
                ws.addEventListener('message', handler);
                ws.send(JSON.stringify({ id, method, params }));
            });
        }

        async function evalExpr(expr) {
            const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
            if (r.exceptionDetails) console.error('Eval error:', r.exceptionDetails.exception?.description);
            return r.result ? r.result.value : null;
        }

        console.log('Waiting for AppState to initialize...');
        for (let i = 0; i < 30; i++) {
            const ok = await evalExpr('!!window.AppState && !!document.getElementById("addClientModal")');
            if (ok) break;
            await sleep(500);
        }

        console.log('Opening template modal...');
        const initModal = await evalExpr(`
            (function() {
                openCreateTemplateModal();
                const sel = document.getElementById('editTemplateCustomerSelect');
                return {
                    activeClient: AppState.activeClient,
                    custSelectVal: sel ? sel.value : null,
                    custSelectSelectedIndex: sel ? sel.selectedIndex : null,
                    custSelectOptions: sel ? Array.from(sel.options).map(o => ({ value: o.value, text: o.text })) : []
                };
            })()
        `);
        console.log('Initial modal state on fresh load:', initModal);

        ws.close();
    } finally {
        edge.kill();
    }
}

run().catch(console.error);
