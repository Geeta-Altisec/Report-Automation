const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9226;

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function getWsUrl() {
    for (let i = 0; i < 20; i++) {
        try {
            const res = await fetch(`http://127.0.0.1:${PORT}/json`);
            const data = await res.json();
            if (data && data.length > 0 && data[0].webSocketDebuggerUrl) {
                return data[0].webSocketDebuggerUrl;
            }
        } catch (e) {}
        await sleep(500);
    }
    throw new Error('Failed to connect to Edge DevTools');
}

class CDPClient {
    constructor(wsUrl) {
        this.ws = new WebSocket(wsUrl);
        this.id = 1;
        this.callbacks = new Map();
        this.ready = new Promise(resolve => {
            this.ws.onopen = resolve;
        });
        this.ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.method === 'Log.entryAdded') {
                console.log('[BROWSER LOG]', msg.params.entry.level, msg.params.entry.text, msg.params.entry.url);
            }
            if (msg.method === 'Runtime.exceptionThrown') {
                console.log('[EXCEPTION THROWN]', msg.params.exceptionDetails.text, msg.params.exceptionDetails.exception?.description, msg.params.exceptionDetails.url, 'line:', msg.params.exceptionDetails.lineNumber);
            }
            if (msg.id && this.callbacks.has(msg.id)) {
                const cb = this.callbacks.get(msg.id);
                this.callbacks.delete(msg.id);
                if (msg.error) cb.reject(msg.error);
                else cb.resolve(msg.result);
            }
        };
    }

    async send(method, params = {}) {
        await this.ready;
        const msgId = this.id++;
        return new Promise((resolve, reject) => {
            this.callbacks.set(msgId, { resolve, reject });
            this.ws.send(JSON.stringify({ id: msgId, method, params }));
        });
    }

    async close() {
        this.ws.close();
    }
}

async function run() {
    const edge = spawn(EDGE_PATH, [
        `--remote-debugging-port=${PORT}`,
        '--headless=new',
        '--disable-gpu',
        '--window-size=1600,1200',
        'about:blank'
    ]);

    try {
        const wsUrl = await getWsUrl();
        const cdp = new CDPClient(wsUrl);

        await cdp.send('Page.enable');
        await cdp.send('Runtime.enable');
        await cdp.send('Log.enable');

        await cdp.send('Page.navigate', { url: 'http://localhost:8000' });
        await sleep(4000);

        await cdp.close();
    } finally {
        edge.kill();
    }
}

run().catch(console.error);
