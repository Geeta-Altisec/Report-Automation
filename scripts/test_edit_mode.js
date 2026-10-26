const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9268;
const ARTIFACT_DIR = "C:\\Users\\geeta.jogi\\.gemini\\antigravity\\brain\\2a2f504b-b9cd-4cb2-9c3f-7783c65fb11f";

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getTargetWsUrl() {
    for (let i = 0; i < 30; i++) {
        try {
            const res = await fetch(`http://127.0.0.1:${PORT}/json`);
            const data = await res.json();
            const target = data.find(t => t.url.includes('localhost:8000') || t.title.includes('AltiSec'));
            if (target && target.webSocketDebuggerUrl) return target.webSocketDebuggerUrl;
        } catch (e) {}
        await sleep(500);
    }
    throw new Error('Failed to find AltiSec target');
}

async function run() {
    const tempDir = path.join(os.tmpdir(), `edge_test_edit_${Date.now()}`);
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
        const ws = new (globalThis.WebSocket || require('ws'))(wsUrl);
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

        async function evaluate(expr) {
            const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
            if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
            return r.result.value;
        }

        async function takeScreenshot(fileName) {
            const res = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync(path.join(ARTIFACT_DIR, fileName), Buffer.from(res.data, 'base64'));
            console.log(`Saved screenshot: ${fileName}`);
        }

        // Wait for page ready
        for (let i = 0; i < 30; i++) {
            try {
                const ready = await evaluate(`typeof window.switchAppView === 'function' && typeof window.renderLivePreview === 'function'`);
                if (ready) break;
            } catch (e) {}
            await sleep(500);
        }

        console.log("Navigating to Report Studio...");
        await evaluate(`
            switchAppView('view-studio', true);
            if (typeof setStudioStage === 'function') setStudioStage('report');
            renderLivePreview();
        `);
        await sleep(1500);

        // 1. Verify Page 3 (Risk Calculation) showing + sign and Table Add Row/Col buttons
        console.log("Testing 1: Scroll to Risk Calculation (Page 3)...");
        await evaluate(`
            const p3 = document.querySelector('[data-sec="risk"]');
            if (p3) p3.scrollIntoView();
        `);
        await sleep(600);
        await takeScreenshot('screenshot_risk_page_with_controls.png');

        // 2. Test Table Add Row on Risk Calculation Table
        console.log("Testing 2: Table Add Row on Risk Table...");
        const tableTest = await evaluate(`(() => {
            const riskTable = document.querySelector('[data-sec="risk"] table');
            if (!riskTable) return { error: 'No risk table found' };
            const initialRows = riskTable.querySelectorAll('tbody tr').length;
            const addRowBtn = riskTable.nextElementSibling.querySelector('button.btn-table-action');
            if (!addRowBtn) return { error: 'No add row button found next to table' };
            addRowBtn.click();
            const newRows = riskTable.querySelectorAll('tbody tr').length;
            return { initialRows, newRows, rowAdded: newRows === initialRows + 1 };
        })()`);
        console.log("TABLE ADD ROW RESULT:", JSON.stringify(tableTest, null, 2));
        await takeScreenshot('screenshot_table_after_add_row.png');

        // 3. Test Clicking the Image (Bug Icon)
        console.log("Testing 3: Clicking Image to open Image Toolbar...");
        const imageClickTest = await evaluate(`(() => {
            const bugImg = document.querySelector('[data-sec="risk"] img[alt*="Risk"], [data-sec="risk"] img');
            if (!bugImg) return { error: 'No bug img found' };
            bugImg.click();
            const toolbar = document.getElementById('reportImageFloatingToolbar');
            const overlay = document.getElementById('reportImageSelectOverlay');
            return {
                imgFound: true,
                imgSelected: bugImg.classList.contains('selected-report-image'),
                toolbarVisible: toolbar && !toolbar.classList.contains('hidden'),
                overlayVisible: overlay && !overlay.classList.contains('hidden')
            };
        })()`);
        console.log("IMAGE CLICK RESULT:", JSON.stringify(imageClickTest, null, 2));
        await takeScreenshot('screenshot_image_selected_toolbar.png');

        // 4. Test Clicking Chart to Open Chart Inspector
        console.log("Testing 4: Clicking Overview Chart to open Chart Inspector...");
        const chartTest = await evaluate(`(() => {
            if (typeof deselectReportImage === 'function') deselectReportImage();
            const chartCanvas = document.querySelector('[data-sec="overview"] canvas, canvas#previewSeverityChart, canvas');
            if (!chartCanvas) return { error: 'No chart canvas found' };
            chartCanvas.scrollIntoView();
            chartCanvas.click();
            const inspector = document.querySelector('.ce-inspector');
            return {
                chartCanvasId: chartCanvas.id,
                inspectorOpened: !!inspector,
                inspectorRole: inspector?.getAttribute('role')
            };
        })()`);
        console.log("CHART CLICK RESULT:", JSON.stringify(chartTest, null, 2));
        await sleep(600);
        await takeScreenshot('screenshot_chart_inspector_opened.png');

        // 5. Test Clicking "+" sign to Add Section
        console.log("Testing 5: Clicking Add Section (+) button...");
        const addSectionTest = await evaluate(`(() => {
            if (window.ChartEngine) ChartEngine.close();
            const addBtn = document.querySelector('.btn-add-section-insert');
            if (!addBtn) return { error: 'No add section button found' };
            addBtn.click();
            const modal = document.getElementById('addSectionModal');
            return {
                addBtnFound: true,
                modalOpened: modal && !modal.classList.contains('hidden') && window.getComputedStyle(modal).display !== 'none'
            };
        })()`);
        console.log("ADD SECTION MODAL RESULT:", JSON.stringify(addSectionTest, null, 2));
        await sleep(500);
        await takeScreenshot('screenshot_add_section_modal_opened.png');

        ws.close();
    } finally {
        edge.kill();
    }
}

run().catch(console.error);
