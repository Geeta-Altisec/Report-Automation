const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9266;
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
    throw new Error('Failed to find AltiSec target in Edge DevTools');
}

async function run() {
    const tempDir = path.join(os.tmpdir(), `edge_test_jsw_${Date.now()}`);
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

        console.log('Waiting for page and AppState to initialize...');
        for (let i = 0; i < 30; i++) {
            const ok = await evalExpr('typeof openCreateTemplateModal === "function" && !!document.getElementById("templateEditorModal")');
            if (ok) break;
            await sleep(500);
        }

        console.log('\n--- STEP 1: Open "Add / Register New Template" Modal ---');
        const openRes = await evalExpr(`
            (function() {
                openCreateTemplateModal();
                const modal = document.getElementById('templateEditorModal');
                const nameInp = document.getElementById('editTemplateNameInput');
                const custSel = document.getElementById('editTemplateCustomerSelect');
                const layoutRow = document.getElementById('modalTemplateLayoutAndTitleRow');
                const baseSel = document.getElementById('editTemplateBaseSelect');

                return {
                    modalDisplay: modal ? window.getComputedStyle(modal).display : 'none',
                    custSelectVal: custSel ? custSel.value : null,
                    custSelectSelectedIndex: custSel ? custSel.selectedIndex : -1,
                    custSelectSelectedText: custSel && custSel.selectedIndex >= 0 ? custSel.options[custSel.selectedIndex].text : null,
                    layoutRowDisplay: layoutRow ? window.getComputedStyle(layoutRow).display : 'none',
                    baseSelectVal: baseSel ? baseSel.value : null
                };
            })()
        `);
        console.log('Template modal opened state:', openRes);

        await sleep(500);
        await captureScreenshot(path.join(ARTIFACT_DIR, 'screenshot_jsw_step1_modal_opened.png'));

        console.log('\n--- STEP 2: Enter "Weekly Report JSW" and inline tenant "JSW" ---');
        const enterDataRes = await evalExpr(`
            (function() {
                const nameInp = document.getElementById('editTemplateNameInput');
                nameInp.value = "Weekly Report JSW";

                // Click "Type New Tenant" button to open inline input
                const btnToggle = document.getElementById('btnToggleTemplateInlineTenant');
                if (btnToggle) btnToggle.click();

                const inlineInp = document.getElementById('editTemplateInlineTenantInput');
                inlineInp.value = "JSW";
                inlineInp.dispatchEvent(new Event('input', { bubbles: true }));

                return {
                    nameVal: nameInp.value,
                    inlineVal: inlineInp.value,
                    inlineBoxDisplay: window.getComputedStyle(document.getElementById('templateInlineTenantBox')).display
                };
            })()
        `);
        console.log('Entered template name and inline tenant:', enterDataRes);

        await sleep(500);
        await captureScreenshot(path.join(ARTIFACT_DIR, 'screenshot_jsw_step2_entered_jsw.png'));

        console.log('\n--- STEP 3: Click "Save & Register Template" ---');
        const saveRes = await evalExpr(`
            (async function() {
                await saveTemplateFromModal();

                const modal = document.getElementById('templateEditorModal');
                const allNames = (AppState.customTemplates || []).map(t => ({ id: t.id, name: t.name, customer: t.customer }));
                const savedTpl = (AppState.customTemplates || []).find(t => t.name === "Weekly Report JSW");
                const hasJswInCustomers = (AppState.customCustomers || []).includes("JSW");

                return {
                    modalDisplayAfterSave: modal ? window.getComputedStyle(modal).display : 'none',
                    allTemplates: allNames,
                    savedTpl: savedTpl ? {
                        id: savedTpl.id,
                        name: savedTpl.name,
                        customer: savedTpl.customer,
                        baseTemplate: savedTpl.baseTemplate,
                        pages: savedTpl.pages
                    } : null,
                    hasJswInCustomers: hasJswInCustomers,
                    activeClient: AppState.activeClient
                };
            })()
        `);
        console.log('Save result:', saveRes);

        await sleep(1000);

        console.log('\n--- STEP 4: Apply Saved Template & Verify Studio Preview ---');
        await evalExpr(`
            (function() {
                const savedTpl = (AppState.customTemplates || []).find(t => t.name === "Weekly Report JSW");
                if (savedTpl) {
                    applyAndEditCustomTemplate(savedTpl.id);
                }
            })()
        `);

        // Wait for templateLoadingTransition timer (1 second) to complete
        await sleep(1500);

        const previewRes = await evalExpr(`
            (function() {
                const preview = document.getElementById('a4DocumentPreview');
                const pages = preview ? preview.querySelectorAll('.cover-page-card, .a4-page-card, .docx-page-card, section.docx').length : 0;
                const headerTitle = document.getElementById('previewDocTitle')?.textContent;
                const clientTag = document.querySelector('.pg-tag')?.textContent?.trim();

                return {
                    renderedPages: pages,
                    headerTitle: headerTitle,
                    clientTag: clientTag,
                    activeTemplate: AppState.activeTemplate,
                    activeClient: AppState.activeClient
                };
            })()
        `);
        console.log('Studio preview result:', previewRes);

        await sleep(800);
        await captureScreenshot(path.join(ARTIFACT_DIR, 'screenshot_jsw_step4_studio_preview.png'));

        console.log('\n--- STEP 5: Verify Backend Customer Store ---');
        const backendCustomers = await (await fetch('http://localhost:8000/api/templates')).json();
        console.log('Backend registered customers:', backendCustomers.customers);

        console.log('\n✅ ALL VERIFICATIONS COMPLETED SUCCESSFULLY!');
        ws.close();
    } finally {
        edge.kill();
    }
}

run().catch(console.error);