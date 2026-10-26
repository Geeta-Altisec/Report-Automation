const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9240;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
    const tmpDir = path.join(os.tmpdir(), 'edge_e2e_' + Date.now());
    const edge = spawn(EDGE_PATH, [
        `--remote-debugging-port=${PORT}`,
        `--user-data-dir=${tmpDir}`,
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=1600,1200',
        'http://localhost:8000'
    ]);

    await sleep(2500);
    const res = await fetch(`http://127.0.0.1:${PORT}/json`);
    const data = await res.json();
    const target = data.find(t => t.url.includes('localhost:8000') || t.title.includes('AltiSec'));
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
        if (r.exceptionDetails) console.error('Eval error:', r.exceptionDetails.exception?.description || r.exceptionDetails.text);
        return r.result ? r.result.value : null;
    }

    console.log('--- 1. WAITING FOR TEMPLATES TO LOAD ---');
    let templates = [];
    for (let i = 0; i < 40; i++) {
        templates = await evalExpr('((window.AppState && AppState.customTemplates) ? AppState.customTemplates.map(t => ({ id: t.id, name: t.name, isDocx: t.isDocxTemplate, isPdf: t.isPdfTemplate })) : [])');
        if (templates && templates.length > 0) {
            console.log(`Loaded ${templates.length} templates:`, templates);
            break;
        }
        await sleep(500);
    }

    console.log('--- 2. APPLYING TATA TECHNOLOGIES (DOCX) ---');
    const tataTpl = templates.find(t => t.name.toLowerCase().includes('tata') && t.isDocx);
    if (!tataTpl) throw new Error('Tata technologies DOCX template not found');
    
    await evalExpr(`applyAndEditCustomTemplate('${tataTpl.id}')`);
    console.log('Applied template:', tataTpl.name);
    // Wait for transition timer (1000ms) + rendering
    await sleep(3500);

    const docxInspection = await evalExpr(`
        (() => {
            const cont = document.getElementById('a4DocumentPreview');
            const cards = Array.from(cont.querySelectorAll('section.docx, .docx-page-card, .a4-page-card'));
            return {
                totalCards: cards.length,
                cards: cards.map((c, i) => {
                    const rect = c.getBoundingClientRect();
                    const style = window.getComputedStyle(c);
                    const h1 = c.querySelector('h1, .docx_heading1, [class*="heading"]');
                    const firstP = c.querySelector('p:not(:empty)');
                    return {
                        card: i + 1,
                        width: Math.round(rect.width),
                        height: Math.round(rect.height),
                        offsetTop: Math.round(c.offsetTop),
                        h1Text: h1 ? h1.innerText.trim() : null,
                        h1OffsetTop: h1 ? Math.round(h1.offsetTop) : null,
                        firstPText: firstP ? firstP.innerText.trim().substring(0, 80) : null,
                        firstPOffsetTop: firstP ? Math.round(firstP.offsetTop) : null
                    };
                })
            };
        })()
    `);
    console.log('DOCX Inspection in DOM:\n', JSON.stringify(docxInspection, null, 2));

    // Capture screenshot of page 1 and page 2 (Cover + Foreword)
    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    const shotPath1 = 'C:/Users/geeta.jogi/.gemini/antigravity/brain/2a2f504b-b9cd-4cb2-9c3f-7783c65fb11f/screenshot_e2e_tata_docx.png';
    fs.writeFileSync(shotPath1, Buffer.from(shot1.data, 'base64'));
    console.log('Saved screenshot_e2e_tata_docx.png');

    console.log('--- 3. APPLYING TATA TECHNOLOGIES (PDF) ---');
    const pdfTpl = templates.find(t => t.name.toLowerCase().includes('tata') && t.isPdf);
    if (pdfTpl) {
        await evalExpr(`applyAndEditCustomTemplate('${pdfTpl.id}')`);
        console.log('Applied template:', pdfTpl.name);
        await sleep(3500);

        const pdfInspection = await evalExpr(`
            (() => {
                const cont = document.getElementById('a4DocumentPreview');
                const cards = Array.from(cont.querySelectorAll('.pdf-page-card, .a4-page-card'));
                return {
                    totalCards: cards.length,
                    cards: cards.slice(0, 5).map((c, i) => {
                        const rect = c.getBoundingClientRect();
                        const img = c.querySelector('img');
                        return {
                            card: i + 1,
                            width: Math.round(rect.width),
                            height: Math.round(rect.height),
                            imgWidth: img ? img.offsetWidth : 0,
                            imgHeight: img ? img.offsetHeight : 0,
                            hasTextLayer: !!c.querySelector('.pdf-text-layer')
                        };
                    })
                };
            })()
        `);
        console.log('PDF Inspection in DOM:\n', JSON.stringify(pdfInspection, null, 2));

        const shot2 = await send('Page.captureScreenshot', { format: 'png' });
        const shotPath2 = 'C:/Users/geeta.jogi/.gemini/antigravity/brain/2a2f504b-b9cd-4cb2-9c3f-7783c65fb11f/screenshot_e2e_tata_pdf.png';
        fs.writeFileSync(shotPath2, Buffer.from(shot2.data, 'base64'));
        console.log('Saved screenshot_e2e_tata_pdf.png');
    }

    ws.close();
    edge.kill();
    console.log('--- E2E VERIFICATION COMPLETED SUCCESSFULLY ---');
}

run().catch(console.error);
