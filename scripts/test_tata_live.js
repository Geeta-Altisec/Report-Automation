const { spawn } = require('child_process');
const fs = require('fs');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9233;

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

    console.log('Waiting for templates to load in browser...');
    let templates = [];
    for (let i = 0; i < 20; i++) {
        templates = await evalExpr('((window.AppState && AppState.customTemplates) ? AppState.customTemplates.map(t => ({ id: t.id, name: t.name })) : [])');
        if (templates && templates.length > 0) {
            console.log(`Loaded ${templates.length} templates after ${(i + 1) * 500}ms:`, templates);
            break;
        }
        await sleep(500);
    }

    if (!templates || templates.length === 0) {
        console.error('Templates failed to load in time.');
        ws.close();
        edge.kill();
        return;
    }

    console.log('Applying Tata Technologies template...');
    const applied = await evalExpr(`
        (() => {
            const tpl = AppState.customTemplates.find(t => t.name.toLowerCase().includes('tata'));
            if (!tpl) return 'Not found';
            applyAndEditCustomTemplate(tpl.id);
            return 'Applied: ' + tpl.name + ' (' + tpl.id + ')';
        })()
    `);
    console.log(applied);

    // Wait 3.5s for loading transition
    await sleep(4000);

    const preview = await evalExpr(`
        (() => {
            const cont = document.getElementById('a4DocumentPreview');
            const cards = Array.from(cont.querySelectorAll('section.docx, .docx-page-card, .a4-page-card'));
            return {
                cardCount: cards.length,
                cards: cards.map((c, i) => {
                    const style = window.getComputedStyle(c);
                    const rect = c.getBoundingClientRect();
                    const h1 = c.querySelector('h1, .docx_heading1, [class*="heading"]');
                    const firstP = c.querySelector('p');
                    const firstImg = c.querySelector('img');
                    return {
                        page: i + 1,
                        tag: c.tagName,
                        classes: c.className,
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                        offsetTop: Math.round(c.offsetTop),
                        padding: style.padding,
                        margin: style.margin,
                        h1Text: h1 ? h1.innerText.trim() : null,
                        h1Top: h1 ? Math.round(h1.offsetTop) : null,
                        firstPTop: firstP ? Math.round(firstP.offsetTop) : null,
                        firstPText: firstP ? firstP.innerText.trim().substring(0, 80) : null,
                        hasImg: !!firstImg,
                        firstImgTop: firstImg ? Math.round(firstImg.offsetTop) : null,
                        firstImgWidth: firstImg ? Math.round(firstImg.offsetWidth) : null,
                        firstImgHeight: firstImg ? Math.round(firstImg.offsetHeight) : null
                    };
                })
            };
        })()
    `);
    console.log('Preview Result:\n', JSON.stringify(preview, null, 2));

    // Capture screenshot of page 1 and page 2
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:/Users/geeta.jogi/.gemini/antigravity/brain/2a2f504b-b9cd-4cb2-9c3f-7783c65fb11f/screenshot_tata_preview_live.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved screenshot_tata_preview_live.png');

    ws.close();
    edge.kill();
}

run().catch(console.error);
