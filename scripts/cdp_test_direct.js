const { spawn } = require('child_process');
const fs = require('fs');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9231;

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function getTargetWsUrl() {
    for (let i = 0; i < 20; i++) {
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
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=1600,1200',
        'http://localhost:8000'
    ]);

    try {
        const wsUrl = await getTargetWsUrl();
        const cdp = new CDPClient(wsUrl);

        await cdp.send('Page.enable');
        await cdp.send('Runtime.enable');
        
        // Polling wait until customTemplates are loaded in AppState
        let templates = [];
        for (let i = 0; i < 30; i++) {
            templates = await cdp.eval('((window.AppState && AppState.customTemplates) ? AppState.customTemplates.map(t => ({ id: t.id, name: t.name })) : [])');
            if (templates && templates.length > 0) break;
            await sleep(500);
        }
        console.log('Successfully loaded custom templates:', templates);

        // Apply Tata technologies template
        const applyRes = await cdp.eval(`
            (() => {
                const tpl = (AppState.customTemplates || []).find(t => t.name.toLowerCase().includes('tata'));
                if (!tpl) return 'TATA NOT FOUND';
                applyAndEditCustomTemplate(tpl.id);
                return 'APPLIED: ' + tpl.name + ' (' + tpl.id + ')';
            })()
        `);
        console.log('Apply result:', applyRes);

        // Wait 3.5s for template transition and renderLivePreview to complete
        await sleep(3500);

        // Inspect the preview container
        const previewInfo = await cdp.eval(`
            (() => {
                const preview = document.getElementById('a4DocumentPreview');
                if (!preview) return { error: 'No preview container' };
                const cards = Array.from(preview.querySelectorAll('section.docx, .docx-page-card, .a4-page-card'));
                return {
                    totalCards: cards.length,
                    activeTemplate: AppState.activeTemplate,
                    cards: cards.map((c, i) => {
                        const style = window.getComputedStyle(c);
                        const firstP = c.querySelector('p');
                        const h1 = c.querySelector('h1, .docx_heading1, [class*="heading"]');
                        return {
                            idx: i + 1,
                            tag: c.tagName,
                            classes: c.className,
                            width: c.offsetWidth,
                            height: c.offsetHeight,
                            offsetTop: c.offsetTop,
                            padding: style.padding,
                            margin: style.margin,
                            display: style.display,
                            position: style.position,
                            h1Text: h1 ? h1.innerText.substring(0, 50).replace(/\\n/g, ' ') : null,
                            h1OffsetTop: h1 ? h1.offsetTop : null,
                            firstPText: firstP ? firstP.innerText.substring(0, 80).replace(/\\n/g, ' ') : null,
                            firstPOffsetTop: firstP ? firstP.offsetTop : null,
                            textPreview: c.innerText.substring(0, 100).replace(/\\n/g, ' ')
                        };
                    })
                };
            })()
        `);
        console.log('Preview Info for Tata Technologies:', JSON.stringify(previewInfo, null, 2));

        // Take a screenshot of the view
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('C:/Users/geeta.jogi/.gemini/antigravity/brain/2a2f504b-b9cd-4cb2-9c3f-7783c65fb11f/screenshot_tata_preview_live.png', Buffer.from(shot.data, 'base64'));
        console.log('Saved screenshot_tata_preview_live.png');

        await cdp.close();
    } finally {
        edge.kill();
    }
}

run().catch(console.error);
