const { spawn } = require('child_process');
const fs = require('fs');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9227;

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
        this.contexts = [];
        this.ready = new Promise(resolve => {
            this.ws.onopen = resolve;
        });
        this.ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.method === 'Runtime.executionContextCreated') {
                this.contexts.push(msg.params.context);
                console.log('[CONTEXT CREATED]', msg.params.context.id, msg.params.context.name, msg.params.context.origin);
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

    async evalIn(expr, contextId) {
        const params = { expression: expr, returnByValue: true, awaitPromise: true };
        if (contextId) params.contextId = contextId;
        const res = await this.send('Runtime.evaluate', params);
        if (res.exceptionDetails) {
            console.error('Eval error:', res.exceptionDetails.exception?.description || res.exceptionDetails.text);
        }
        return res.result ? res.result.value : null;
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

        await cdp.send('Page.navigate', { url: 'http://localhost:8000' });
        await sleep(5000);

        const latestContext = cdp.contexts[cdp.contexts.length - 1];
        console.log('Evaluating in context:', latestContext ? latestContext.id : 'default');

        const title = await cdp.evalIn('document.title', latestContext?.id);
        console.log('Page title:', title);

        const hasAppState = await cdp.evalIn('typeof AppState', latestContext?.id);
        console.log('typeof AppState:', hasAppState);

        const templates = await cdp.evalIn('(AppState.customTemplates || []).map(t => t.name)', latestContext?.id);
        console.log('AppState templates:', templates);

        await cdp.close();
    } finally {
        edge.kill();
    }
}

run().catch(console.error);
