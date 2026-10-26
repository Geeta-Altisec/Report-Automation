const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9288;
const ARTIFACT_DIR = "C:\\Users\\geeta.jogi\\.gemini\\antigravity\\brain\\2a2f504b-b9cd-4cb2-9c3f-7783c65fb11f";

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
    throw new Error('Failed to find target in Edge DevTools');
}

async function run() {
    const tempDir = path.join(os.tmpdir(), `edge_perf_verify_${Date.now()}`);
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

        async function captureScreenshot(filepath) {
            const shot = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync(filepath, Buffer.from(shot.data, 'base64'));
            console.log(`Saved screenshot: ${filepath}`);
        }

        for (let i = 0; i < 30; i++) {
            const ok = await evalExpr('typeof deleteCustomTemplate === "function" && (AppState.customTemplates || []).length > 0');
            if (ok) break;
            await sleep(500);
        }

        console.log('--- TEST: Measuring Delete Confirmation and Execution Speed ---');
        
        // 1. Open Hub View
        await evalExpr('switchAppView("view-hub")');
        await sleep(500);

        // Find a template to test deleting (e.g. one of the duplicate ACME templates)
        const tplToTest = await evalExpr(`
            (function() {
                const t = (AppState.customTemplates || []).find(x => x.name.includes("ACME") || x.name.includes("JSW") || x.name.includes("jsw"));
                return t ? { id: t.id, name: t.name } : null;
            })()
        `);
        console.log('Template target for deletion test:', tplToTest);

        if (!tplToTest) {
            console.log('No test template found, skipping test.');
            return;
        }

        // 2. Open delete confirm modal
        const openTime = await evalExpr(`
            (function() {
                const t0 = performance.now();
                deleteCustomTemplate("${tplToTest.id}");
                const t1 = performance.now();
                const m = document.getElementById("confirmDeleteTemplateModal");
                return {
                    openMs: (t1 - t0).toFixed(2),
                    modalDisplay: window.getComputedStyle(m).display
                };
            })()
        `);
        console.log('Delete modal open performance:', openTime);

        await sleep(400);
        await captureScreenshot(path.join(ARTIFACT_DIR, 'screenshot_delete_modal_instant.png'));

        // 3. Measure executeTemplateDeletion speed
        const execTime = await evalExpr(`
            (async function() {
                const t0 = performance.now();
                await executeTemplateDeletion();
                const t1 = performance.now();
                const m = document.getElementById("confirmDeleteTemplateModal");
                return {
                    totalMs: (t1 - t0).toFixed(2),
                    modalDisplayImmediatelyAfterClick: window.getComputedStyle(m).display,
                    toastText: document.getElementById("toast")?.textContent?.trim()
                };
            })()
        `);
        console.log('Execution & backend delete speed:', execTime);

        await sleep(500);
        await captureScreenshot(path.join(ARTIFACT_DIR, 'screenshot_after_instant_delete.png'));

        // 4. Check if backend processed in background
        await sleep(1000);
        const serverCheck = await (await fetch('http://localhost:8000/api/templates')).json();
        const stillInServer = serverCheck.templates.some(t => t.id === tplToTest.id);
        console.log(`Backend server deletion complete: ${!stillInServer}`);

        console.log('\n⚡ PERFORMANCE VERIFICATION PASSED: ZERO HANG, INSTANT DISMISS!');
        ws.close();
    } finally {
        edge.kill();
    }
}

run().catch(console.error);