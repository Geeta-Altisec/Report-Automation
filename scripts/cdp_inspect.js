const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9225;

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

    async eval(expr) {
        const res = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (res.exceptionDetails) {
            console.error('Eval error for [' + expr + ']:', res.exceptionDetails.exception?.description || res.exceptionDetails.text);
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
        await cdp.send('DOM.enable');

        await cdp.send('Page.navigate', { url: 'http://localhost:8000' });
        // Wait for page and scripts to initialize
        await sleep(5000);

        const check1 = await cdp.eval(`typeof AppState`);
        console.log('typeof AppState:', check1);

        const check2 = await cdp.eval(`typeof window.applyAndEditCustomTemplate`);
        console.log('typeof applyAndEditCustomTemplate:', check2);

        const checkTemplates = await cdp.eval(`(AppState.customTemplates || []).map(t => ({ id: t.id, name: t.name }))`);
        console.log('Loaded templates:', checkTemplates);

        // Switch to Studio view and load Tata technologies
        await cdp.eval(`
            (() => {
                const tpl = (AppState.customTemplates || []).find(t => t.name.toLowerCase().includes('tata'));
                if (tpl) {
                    applyAndEditCustomTemplate(tpl.id);
                }
            })()
        `);
        console.log('Applied template!');
        await sleep(3000);

        // Check cards in DOM
        const cardDetails = await cdp.eval(`
            (() => {
                const preview = document.getElementById('a4DocumentPreview');
                const cards = Array.from(preview.querySelectorAll('.a4-page-card, section.docx, .docx-page-card'));
                return cards.map((c, i) => {
                    const rect = c.getBoundingClientRect();
                    const style = window.getComputedStyle(c);
                    // Check first 3 child elements and their positions
                    const children = Array.from(c.children).slice(0, 5).map(ch => ({
                        tag: ch.tagName,
                        className: ch.className,
                        offsetTop: ch.offsetTop,
                        offsetHeight: ch.offsetHeight,
                        text: ch.innerText.substring(0, 60).replace(/\\n/g, ' ')
                    }));
                    return {
                        cardIndex: i + 1,
                        width: rect.width,
                        height: rect.height,
                        offsetTop: c.offsetTop,
                        paddingTop: style.paddingTop,
                        marginTop: style.marginTop,
                        children: children,
                        textStart: c.innerText.substring(0, 100).replace(/\\n/g, ' ')
                    };
                });
            })()
        `);
        console.log('Card details:', JSON.stringify(cardDetails, null, 2));

        // Take a screenshot of the preview
        const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('C:/Users/geeta.jogi/.gemini/antigravity/brain/2a2f504b-b9cd-4cb2-9c3f-7783c65fb11f/screenshot_tata_preview.png', Buffer.from(screenshot.data, 'base64'));
        console.log('Saved screenshot_tata_preview.png');

        await cdp.close();
    } finally {
        edge.kill();
    }
}

run().catch(console.error);
