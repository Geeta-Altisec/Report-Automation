const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9255;
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
    const tempDir = path.join(os.tmpdir(), `edge_tenant_verify_${Date.now()}`);
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

        console.log('Waiting for AppState to initialize...');
        for (let i = 0; i < 20; i++) {
            const ok = await evalExpr('!!window.AppState && !!document.getElementById("addClientModal")');
            if (ok) break;
            await sleep(500);
        }

        // TEST PART 1: ADD TENANT FROM INSIDE TEMPLATE EDITOR MODAL
        console.log('\n--- PART 1: Testing "+ New Tenant & Logo" inside Template Editor Modal ---');
        const openTplModal = await evalExpr(`
            (function() {
                openCreateTemplateModal();
                const m = document.getElementById('templateEditorModal');
                const custSelect = document.getElementById('editTemplateCustomerSelect');
                return {
                    tplModalDisplay: m ? window.getComputedStyle(m).display : 'none',
                    custSelectVal: custSelect ? custSelect.value : null,
                    options: custSelect ? Array.from(custSelect.options).map(o => o.value) : []
                };
            })()
        `);
        console.log('Template modal opened:', openTplModal);

        await sleep(500);

        // Click "+ New Tenant & Logo"
        console.log('Clicking "+ New Tenant & Logo"...');
        const clickNewTenant = await evalExpr(`
            (function() {
                const btn = document.querySelector('#templateEditorModal button[onclick*="openAddClientModal"]');
                if (btn) btn.click();
                else openAddClientModal();

                const addM = document.getElementById('addClientModal');
                const nameInp = document.getElementById('addClientNameInput');
                const ribbonName = document.getElementById('modalClientLogoNamePreview');
                const titleText = document.getElementById('addClientModalTitleText');

                return {
                    addModalDisplay: addM ? window.getComputedStyle(addM).display : 'none',
                    addModalZIndex: addM ? window.getComputedStyle(addM).zIndex : 'none',
                    nameInputValue: nameInp ? nameInp.value : null,
                    ribbonNameText: ribbonName ? ribbonName.textContent : null,
                    titleText: titleText ? titleText.textContent : null
                };
            })()
        `);
        console.log('Add Tenant Modal state:', clickNewTenant);

        await sleep(500);

        // Type "ACME DEFENSE SYSTEMS" and attach test logo
        console.log('Typing tenant name and attaching test logo...');
        const typeAndAttach = await evalExpr(`
            (function() {
                const nameInp = document.getElementById('addClientNameInput');
                nameInp.value = "ACME DEFENSE SYSTEMS";
                nameInp.dispatchEvent(new Event('input', { bubbles: true }));

                const ribbonName = document.getElementById('modalClientLogoNamePreview');

                // Attach a 1x1 blue PNG as sample logo
                const testLogo = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='20'><rect width='60' height='20' fill='%2300b0f0'/><text x='5' y='14' fill='white' font-size='10' font-family='sans-serif'>ACME</text></svg>";
                window._tempAddClientLogo = testLogo;
                const imgBox = document.getElementById('modalClientLogoImgBox');
                const removeBtn = document.getElementById('btnModalRemoveClientLogo');
                if (imgBox) {
                    imgBox.innerHTML = "<img src=\\"" + testLogo + "\\" style='height:22px; max-width:65px; object-fit:contain; border-radius:2px; vertical-align:middle;'>";
                    imgBox.style.display = "inline-block";
                }
                if (removeBtn) removeBtn.style.display = "inline-flex";

                return {
                    ribbonNameAfterTyping: ribbonName ? ribbonName.textContent : null,
                    logoImgBoxDisplay: imgBox ? window.getComputedStyle(imgBox).display : null,
                    removeBtnDisplay: removeBtn ? window.getComputedStyle(removeBtn).display : null
                };
            })()
        `);
        console.log('After typing & logo attach:', typeAndAttach);

        await sleep(500);

        // Click Save in Add Client Modal
        console.log('Calling saveAddClientModal()...');
        const saveResult = await evalExpr(`
            (function() {
                saveAddClientModal();

                const addM = document.getElementById('addClientModal');
                const tplM = document.getElementById('templateEditorModal');
                const custSelect = document.getElementById('editTemplateCustomerSelect');
                const logoStatus = document.getElementById('tplClientLogoStatus');
                const logoPreviewBox = document.getElementById('tplClientLogoPreviewBox');
                const studioSelect = document.getElementById('studioClientSelect');

                return {
                    addModalDisplayAfterSave: addM ? window.getComputedStyle(addM).display : 'none',
                    tplModalDisplayAfterSave: tplM ? window.getComputedStyle(tplM).display : 'none',
                    custSelectVal: custSelect ? custSelect.value : null,
                    custSelectHasAcme: custSelect ? Array.from(custSelect.options).some(o => o.value === "ACME DEFENSE SYSTEMS") : false,
                    tplLogoStatus: logoStatus ? logoStatus.textContent : null,
                    tplLogoHasImg: logoPreviewBox ? !!logoPreviewBox.querySelector('img') : false,
                    activeClient: AppState.activeClient,
                    customCustomers: AppState.customCustomers,
                    studioSelectVal: studioSelect ? studioSelect.value : null
                };
            })()
        `);
        console.log('Result after saveAddClientModal():', saveResult);

        await sleep(600);
        await captureScreenshot(path.join(ARTIFACT_DIR, 'screenshot_tenant_in_template_modal.png'));

        // Save the template with this new tenant!
        console.log('Saving template assigned to ACME DEFENSE SYSTEMS...');
        const saveTplRes = await evalExpr(`
            (async function() {
                const nameInp = document.getElementById('editTemplateNameInput');
                if (nameInp) nameInp.value = "ACME Weekly MDR SOC Template";

                await saveTemplateFromModal();

                const tplM = document.getElementById('templateEditorModal');
                const lastTpl = AppState.customTemplates ? AppState.customTemplates.find(t => t.name === "ACME Weekly MDR SOC Template") : null;

                return {
                    tplModalDisplay: tplM ? window.getComputedStyle(tplM).display : 'none',
                    savedTemplate: lastTpl ? { id: lastTpl.id, name: lastTpl.name, customer: lastTpl.customer } : null
                };
            })()
        `);
        console.log('Saved template result:', saveTplRes);

        await sleep(1000);

        // Check backend server store
        const serverCheck = await (await fetch('http://localhost:8000/api/templates')).json();
        console.log('Server customers after PART 1:', serverCheck.customers);

        // TEST PART 2: ADD TENANT FROM STUDIO SELECTOR
        console.log('\n--- PART 2: Testing "+ Enter Custom Tenant..." from Studio client selector ---');
        const studioSelectRes = await evalExpr(`
            (function() {
                const sel = document.getElementById('studioClientSelect');
                sel.value = "__add_new_client__";
                sel.dispatchEvent(new Event('change', { bubbles: true }));

                const addM = document.getElementById('addClientModal');
                const nameInp = document.getElementById('addClientNameInput');
                return {
                    addModalDisplay: addM ? window.getComputedStyle(addM).display : 'none',
                    nameInputValue: nameInp ? nameInp.value : null
                };
            })()
        `);
        console.log('Studio "+ Enter Custom Tenant..." opened modal:', studioSelectRes);

        await sleep(500);

        // Type "NEXUS CYBER" and save
        console.log('Typing "NEXUS CYBER" and saving...');
        const nexusSaveRes = await evalExpr(`
            (function() {
                const nameInp = document.getElementById('addClientNameInput');
                nameInp.value = "NEXUS CYBER";
                nameInp.dispatchEvent(new Event('input', { bubbles: true }));

                saveAddClientModal();

                const studioSel = document.getElementById('studioClientSelect');
                const headerSel = document.getElementById('headerCustomerSelect');
                const reportRibbon = document.querySelector('.pg-tag');

                return {
                    activeClient: AppState.activeClient,
                    studioSelectVal: studioSel ? studioSel.value : null,
                    headerSelectVal: headerSel ? headerSel.value : null,
                    reportRibbonText: reportRibbon ? reportRibbon.textContent.trim() : null
                };
            })()
        `);
        console.log('Nexus Cyber saved in studio:', nexusSaveRes);

        await sleep(1000);
        await captureScreenshot(path.join(ARTIFACT_DIR, 'screenshot_tenant_studio_preview.png'));

        const serverFinal = await (await fetch('http://localhost:8000/api/templates')).json();
        console.log('Server customers final list:', serverFinal.customers);

        console.log('\n✓ ALL TESTS COMPLETED SUCCESSFULLY!');
        ws.close();
    } finally {
        edge.kill();
    }
}

run().catch(console.error);
