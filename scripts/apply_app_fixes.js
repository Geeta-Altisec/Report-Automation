const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '../Reports-main/app.js');
let app = fs.readFileSync(appPath, 'utf8');

// 1. REPLACE handleModalTemplateFileSelected
const sIdx = app.indexOf('window.handleModalTemplateFileSelected = async function(input) {');
const dIdx = app.indexOf('// ATTACH DRAG & DROP FOR TEMPLATE UPLOAD DROPZONE');

if (sIdx === -1 || dIdx === -1) {
    throw new Error('Could not find handleModalTemplateFileSelected bounds');
}

const newHandler = `window.handleModalTemplateFileSelected = async function(input) {
    const file = input && input.files && input.files[0];
    if (!file) return;

    // Hide base layout selection row (new custom template from uploaded document)
    const layoutRow = document.getElementById("modalTemplateLayoutAndTitleRow");
    if (layoutRow) layoutRow.style.display = "none";

    const dropTitle = document.getElementById("modalTemplateDropTitle");
    const dropSub = document.getElementById("modalTemplateDropSub");
    const dropIcon = document.getElementById("modalTemplateDropIcon");
    const nameInput = document.getElementById("editTemplateNameInput");
    const fmtSelect = document.getElementById("editTemplateFormatSelect");
    const customHtmlInput = document.getElementById("editTemplateCustomHtmlInput");

    const fileName = file.name;
    const baseName = fileName.replace(/\\.[^/.]+$/, "");
    if (nameInput && !nameInput.value.trim()) {
        nameInput.value = baseName;
    }

    const clientSelect = document.getElementById("editTemplateCustomerSelect");
    const targetCustomer = (clientSelect && clientSelect.value && clientSelect.value !== 'Global / All Clients') ? clientSelect.value : 'TENANT';

    const ext = fileName.split('.').pop().toLowerCase();

    // Reset temporary base64 holders
    window._lastUploadedDocxBase64 = null;
    window._lastUploadedPdfBase64 = null;
    window._lastUploadedDocxName = null;
    window._lastUploadedPdfName = null;

    if (ext === 'docx' || ext === 'doc') {
        if (fmtSelect) fmtSelect.value = 'docx';

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    const arrayBuffer = e.target.result;
                    
                    // Convert arrayBuffer to base64 safely
                    let binary = '';
                    const bytes = new Uint8Array(arrayBuffer);
                    const len = bytes.byteLength;
                    const chunkSize = 8192;
                    for (let i = 0; i < len; i += chunkSize) {
                        binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunkSize, len)));
                    }
                    const rawDocxBase64 = btoa(binary);
                    window._lastUploadedDocxBase64 = rawDocxBase64;
                    window._lastUploadedDocxName = fileName;

                    // Priority 1: High-fidelity exact Word DOCX renderer with zero-displacement & floating anchor fix
                    if (window.docx && typeof window.docx.renderAsync === 'function') {
                        const tempContainer = document.createElement("div");
                        const options = {
                            className: "docx",
                            inWrapper: false,
                            ignoreWidth: false,
                            ignoreHeight: false,
                            ignoreFonts: false,
                            breakPages: true,
                            ignoreLastRenderedPageBreak: false,
                            experimental: true,
                            trimXmlDeclaration: true,
                            useBase64URL: true,
                            renderHeaders: true,
                            renderFooters: true,
                            renderFootnotes: true,
                            renderEndnotes: true
                        };

                        await window.docx.renderAsync(arrayBuffer, tempContainer, null, options);

                        // 1. Prune phantom empty sections (created by trailing page breaks)
                        const allSections = Array.from(tempContainer.querySelectorAll("section.docx"));
                        allSections.forEach(sec => {
                            const text = sec.innerText.trim();
                            const hasMedia = sec.querySelector("img, svg, table, canvas");
                            if (!text && !hasMedia) {
                                sec.remove();
                            }
                        });

                        // 2. Fix floating anchored graphics & zero-dimension wrapper divs so they take zero vertical line space
                        tempContainer.querySelectorAll('div[style*="width: 0px"], div[style*="width:0px"], div[style*="width: 0pt"]').forEach(div => {
                            div.style.position = 'absolute';
                            div.style.top = '0';
                            div.style.left = '0';
                            div.style.width = '0';
                            div.style.height = '0';
                            div.style.margin = '0';
                            div.style.padding = '0';
                            div.style.pointerEvents = 'none';
                            div.querySelectorAll('img, svg').forEach(media => {
                                media.style.position = 'absolute';
                                media.style.pointerEvents = 'none';
                            });
                        });

                        // 3. Format valid sections as A4 page cards
                        const validSections = Array.from(tempContainer.querySelectorAll("section.docx"));
                        validSections.forEach((sec, idx) => {
                            sec.classList.add("a4-page-card", "docx-page-card");
                            sec.setAttribute("data-sec", \`docx-page-\${idx + 1}\`);
                            sec.style.width = "794px";
                            sec.style.minWidth = "794px";
                            sec.style.maxWidth = "794px";
                            sec.style.minHeight = "1123px";
                            sec.style.margin = "0 auto 30px auto";
                            sec.style.boxShadow = "0 4px 15px rgba(0,0,0,0.08)";
                            sec.style.borderRadius = "4px";
                            sec.style.background = "#ffffff";
                            sec.style.position = "relative";
                            sec.style.boxSizing = "border-box";
                            sec.style.overflow = "hidden";
                            sec.style.padding = "36pt";
                        });

                        const parsedPagesHtml = tempContainer.innerHTML;
                        if (customHtmlInput) {
                            customHtmlInput.value = parsedPagesHtml;
                        }
                        const pageCount = validSections.length || 1;
                        if (dropTitle) dropTitle.innerHTML = \`<i class="fa-solid fa-circle-check" style="color:#22c55e;"></i> \${escapeAuditHtml(fileName)}\`;
                        if (dropSub) dropSub.textContent = \`Word document rendered with exact layout (\${pageCount} pages). Original typography, tables, and graphics preserved.\`;
                        if (dropIcon) dropIcon.className = "fa-solid fa-file-word text-blue";
                        showToast(\`📄 Parsed Word template with \${pageCount} pages with exact layout & design\`);
                        resolve(parsedPagesHtml);
                        return;
                    }

                    // Fallback: Mammoth.js
                    if (window.mammoth) {
                        const res = await window.mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
                        const parsedPagesHtml = convertUploadedDocumentToReportPages(res.value || "", baseName, targetCustomer);
                        if (customHtmlInput) {
                            customHtmlInput.value = parsedPagesHtml;
                        }
                        const pageCount = (parsedPagesHtml.match(/a4-page-card/g) || []).length || 1;
                        if (dropTitle) dropTitle.innerHTML = \`<i class="fa-solid fa-circle-check" style="color:#22c55e;"></i> \${escapeAuditHtml(fileName)}\`;
                        if (dropSub) dropSub.textContent = \`Word document parsed (\${pageCount} section pages). All text, tables, and KPIs preserved as-is.\`;
                        if (dropIcon) dropIcon.className = "fa-solid fa-file-word text-blue";
                        showToast(\`📄 Parsed Word template with \${pageCount} sections & KPIs\`);
                        resolve(parsedPagesHtml);
                        return;
                    }
                    resolve();
                } catch (err) {
                    console.error("Word modal parse error:", err);
                    if (dropTitle) dropTitle.innerHTML = \`<i class="fa-solid fa-file-word text-blue"></i> \${escapeAuditHtml(fileName)}\`;
                    if (dropSub) dropSub.textContent = \`Attached Word document (\${(file.size / 1024).toFixed(1)} KB)\`;
                    showToast(\`Attached Word file "\${fileName}"\`);
                    resolve();
                }
            };
            reader.onerror = () => resolve();
            reader.readAsArrayBuffer(file);
        });
    } else if (ext === 'pdf') {
        if (fmtSelect) fmtSelect.value = 'custom';
        return new Promise((resolve) => {
            if (window.pdfjsLib) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                const reader = new FileReader();
                reader.onload = async function(e) {
                    try {
                        const arrayBuffer = e.target.result;
                        let binary = '';
                        const bytes = new Uint8Array(arrayBuffer);
                        const len = bytes.byteLength;
                        const chunkSize = 8192;
                        for (let i = 0; i < len; i += chunkSize) {
                            binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunkSize, len)));
                        }
                        const rawPdfBase64 = btoa(binary);
                        window._lastUploadedPdfBase64 = rawPdfBase64;
                        window._lastUploadedPdfName = fileName;

                        const typedarray = new Uint8Array(arrayBuffer);
                        const pdf = await window.pdfjsLib.getDocument(typedarray).promise;
                        const numPages = pdf.numPages;
                        let pagesHtml = '';

                        for (let i = 1; i <= numPages; i++) {
                            const page = await pdf.getPage(i);
                            const unscaledViewport = page.getViewport({ scale: 1 });
                            const scaleX = 794 / unscaledViewport.width;
                            const scaleY = 1123 / unscaledViewport.height;
                            const scale = Math.min(scaleX, scaleY);
                            const dpr = 2; // Retina sharpness for exact typography & graphics
                            const viewport = page.getViewport({ scale: scale * dpr });

                            const canvas = document.createElement('canvas');
                            canvas.width = viewport.width;
                            canvas.height = viewport.height;
                            const ctx = canvas.getContext('2d');
                            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
                            const dataUrl = canvas.toDataURL('image/png');

                            // High-precision text overlay layer for inline editing (ilovepdf parity)
                            let textLayerHtml = '';
                            try {
                                const textContent = await page.getTextContent();
                                if (textContent && textContent.items && textContent.items.length > 0) {
                                    const textSpans = textContent.items.map(item => {
                                        const tx = item.transform;
                                        const itemX = (tx[4] * scale).toFixed(1);
                                        const itemY = (1123 - (tx[5] * scale)).toFixed(1);
                                        const fontSize = Math.max(9, Math.round(Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]) * scale));
                                        const itemText = escapeAuditHtml(item.str || '');
                                        if (!itemText.trim()) return '';
                                        return \`<span contenteditable="true" style="position: absolute; left: \${itemX}px; top: \${itemY}px; font-size: \${fontSize}px; font-family: inherit; color: transparent; background: transparent; cursor: text; line-height: 1;" onfocus="this.style.color='#0f172a'; this.style.background='rgba(255,255,255,0.92)'; this.style.zIndex='20';" onblur="if(!this.dataset.edited){ this.style.color='transparent'; this.style.background='transparent'; this.style.zIndex='10'; }">\${itemText}</span>\`;
                                    }).filter(Boolean);
                                    textLayerHtml = \`<div class="pdf-text-layer" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: auto; z-index: 10;">\${textSpans.join('')}</div>\`;
                                }
                            } catch(te) {
                                console.warn("PDF text layer extraction warning:", te);
                            }

                            pagesHtml += \`
                                <div class="a4-page-card pdf-page-card" data-sec="pdf-page-\${i}" style="width: 794px; min-width: 794px; max-width: 794px; height: 1123px; min-height: 1123px; max-height: 1123px; padding: 0; margin: 0 auto 30px auto; background: #ffffff; box-shadow: 0 4px 15px rgba(0,0,0,0.08); border-radius: 4px; position: relative; overflow: hidden; display: block;">
                                    <img src="\${dataUrl}" style="width: 794px; height: 1123px; max-width: 794px; max-height: 1123px; display: block; object-fit: fill; pointer-events: none;" alt="Page \${i}">
                                    \${textLayerHtml}
                                </div>
                            \`;
                        }

                        if (customHtmlInput) customHtmlInput.value = pagesHtml;
                        if (dropTitle) dropTitle.innerHTML = \`<i class="fa-solid fa-circle-check" style="color:#22c55e;"></i> \${escapeAuditHtml(fileName)}\`;
                        if (dropSub) dropSub.textContent = \`PDF template parsed (\${numPages} pages). Exact design, placement, and typography preserved.\`;
                        if (dropIcon) dropIcon.className = "fa-solid fa-file-pdf text-rose";
                        showToast(\`📄 Parsed \${numPages}-page PDF template with exact layout & design\`);
                        resolve(pagesHtml);
                    } catch (pdfErr) {
                        console.error("PDF parse error:", pdfErr);
                        if (dropTitle) dropTitle.innerHTML = \`<i class="fa-solid fa-file-pdf text-rose"></i> \${escapeAuditHtml(fileName)}\`;
                        if (dropSub) dropSub.textContent = \`Attached PDF document (\${(file.size / 1024).toFixed(1)} KB)\`;
                        showToast(\`Attached PDF file "\${fileName}"\`);
                        resolve();
                    }
                };
                reader.onerror = () => resolve();
                reader.readAsArrayBuffer(file);
            } else {
                if (dropTitle) dropTitle.innerHTML = \`<i class="fa-solid fa-file-pdf text-rose"></i> \${escapeAuditHtml(fileName)}\`;
                if (dropSub) dropSub.textContent = \`PDF document attached (\${(file.size / 1024).toFixed(1)} KB)\`;
                showToast(\`Attached PDF file "\${fileName}"\`);
                resolve();
            }
        });
    } else if (ext === 'json') {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            const t = Array.isArray(data) ? data[0] : (data.templates ? data.templates[0] : data);
            if (t) {
                if (nameInput && t.name) nameInput.value = t.name;
                if (fmtSelect && t.type) fmtSelect.value = t.type;
                if (clientSelect && t.customer) clientSelect.value = t.customer;
                if (customHtmlInput && t.content) customHtmlInput.value = t.content;
                const repTitle = document.getElementById("editTemplateReportTitleInput");
                if (repTitle && (t.docTitle || t.name)) repTitle.value = t.docTitle || t.name;
                const fore = document.getElementById("editTemplateForewordInput");
                if (fore && t.foreword) fore.value = t.foreword;
                const obj = document.getElementById("editTemplateObjectivesInput");
                if (obj && t.objectives) obj.value = t.objectives;

                if (dropTitle) dropTitle.innerHTML = \`<i class="fa-solid fa-circle-check" style="color:#22c55e;"></i> \${escapeAuditHtml(fileName)}\`;
                if (dropSub) dropSub.textContent = \`Imported JSON template "\${t.name}" (\${t.pages || 1} pages).\`;
                if (dropIcon) dropIcon.className = "fa-solid fa-code text-indigo";
                showToast(\`Imported Template JSON: "\${t.name}"\`);
            }
        } catch (jsonErr) {
            console.error("Template JSON parse error:", jsonErr);
            showToast("Failed to parse JSON template file.", "error");
        }
    } else {
        if (dropTitle) dropTitle.innerHTML = \`<i class="fa-solid fa-paperclip text-blue"></i> \${escapeAuditHtml(fileName)}\`;
        if (dropSub) dropSub.textContent = \`File attached (\${(file.size / 1024).toFixed(1)} KB)\`;
        showToast(\`Attached file "\${fileName}"\`);
    }
};

`;

app = app.substring(0, sIdx) + newHandler + app.substring(dIdx);
console.log('Step 1 complete (handleModalTemplateFileSelected replaced)');

// 2. UPDATE saveTemplateFromModal to save pdfBase64 & isPdfTemplate
const sSaveOld = `const docxBase64 = window._lastUploadedDocxBase64 || (existingTpl ? existingTpl.docxBase64 : null);
    const isDocxTemplate = !!docxBase64 || (existingTpl ? existingTpl.isDocxTemplate : false);

    let pageCount = 16;
    if (customHtml) {
        const matches = customHtml.match(/class=["'][^"']*(?:a4-page-card|docx-page-card|section\\.docx)[^"']*["']/g) || customHtml.match(/data-sec=/g);`;

const sSaveNew = `const docxBase64 = window._lastUploadedDocxBase64 || (existingTpl ? existingTpl.docxBase64 : null);
    const isDocxTemplate = !!docxBase64 || (existingTpl ? existingTpl.isDocxTemplate : false);
    const pdfBase64 = window._lastUploadedPdfBase64 || (existingTpl ? existingTpl.pdfBase64 : null);
    const isPdfTemplate = !!pdfBase64 || (existingTpl ? existingTpl.isPdfTemplate : false) || customHtml.includes('pdf-page-card');

    let pageCount = 16;
    if (customHtml) {
        const matches = customHtml.match(/class=["'][^"']*(?:a4-page-card|docx-page-card|pdf-page-card|section\\.docx)[^"']*["']/g) || customHtml.match(/data-sec=/g);`;

if (app.includes(sSaveOld)) {
    app = app.replace(sSaveOld, sSaveNew);
    console.log('Step 2.1 complete (saveTemplateFromModal pdf detection)');
} else {
    console.warn('Could not find sSaveOld in app.js');
}

// Update the updatedTpl object in saveTemplateFromModal
const sTplObjOld = `docxBase64: docxBase64,
        isDocxTemplate: isDocxTemplate,`;

const sTplObjNew = `docxBase64: docxBase64,
        isDocxTemplate: isDocxTemplate,
        pdfBase64: pdfBase64,
        isPdfTemplate: isPdfTemplate,`;

if (app.includes(sTplObjOld)) {
    app = app.replace(sTplObjOld, sTplObjNew);
    console.log('Step 2.2 complete (updatedTpl pdf properties)');
}

// Clear window._lastUploadedPdfBase64
const sClearOld = `window._lastUploadedDocxBase64 = null;`;
const sClearNew = `window._lastUploadedDocxBase64 = null;
    window._lastUploadedPdfBase64 = null;`;
if (app.includes(sClearOld)) {
    app = app.replace(sClearOld, sClearNew);
    console.log('Step 2.3 complete (clear pdfBase64 holder)');
}

// 3. UPDATE renderLivePreview for custom templates
const sPrevOld = `const isDocxHtml = customHtml.includes("docx-page-card") || customHtml.includes("section.docx") || customHtml.includes("class=\\"docx\\"") || customHtml.includes("class='docx'");
        // If customHtml has not yet been split into A4 section cards, convert it
        if (!isDocxHtml && !customHtml.includes("a4-page-card") && !customHtml.includes("cover-page-card")) {
            customHtml = convertUploadedDocumentToReportPages(customHtml, ownTpl.name, targetTenant);
        }

        container.innerHTML = customHtml;

        // Ensure docx sections retain page card classes and shadow
        const docxSections = container.querySelectorAll("section.docx");
        if (docxSections.length > 0) {
            docxSections.forEach((sec, idx) => {
                sec.classList.add("a4-page-card", "docx-page-card");
                sec.setAttribute("data-sec", \`docx-page-\${idx + 1}\`);
                sec.style.margin = "0 auto 30px auto";
                sec.style.boxShadow = "0 4px 15px rgba(0,0,0,0.08)";
                sec.style.borderRadius = "4px";
                sec.style.background = "#ffffff";
            });
            const activeBadge = document.getElementById("activePageBadge");
            if (activeBadge) activeBadge.textContent = \`Page 1 / \${docxSections.length}\`;
        }`;

const sPrevNew = `const isDocxHtml = customHtml.includes("docx-page-card") || customHtml.includes("section.docx") || customHtml.includes("class=\\"docx\\"") || customHtml.includes("class='docx'");
        const isPdfHtml = customHtml.includes("pdf-page-card") || (ownTpl && ownTpl.isPdfTemplate);
        // If customHtml has not yet been split into A4 section cards, convert it
        if (!isDocxHtml && !isPdfHtml && !customHtml.includes("a4-page-card") && !customHtml.includes("cover-page-card")) {
            customHtml = convertUploadedDocumentToReportPages(customHtml, ownTpl.name, targetTenant);
        }

        container.innerHTML = customHtml;

        // Ensure docx sections retain page card classes, shadow, and floating anchor fix
        const docxSections = container.querySelectorAll("section.docx, .docx-page-card");
        if (docxSections.length > 0) {
            docxSections.forEach((sec, idx) => {
                sec.classList.add("a4-page-card", "docx-page-card");
                sec.setAttribute("data-sec", \`docx-page-\${idx + 1}\`);
                sec.style.width = "794px";
                sec.style.minWidth = "794px";
                sec.style.maxWidth = "794px";
                sec.style.minHeight = "1123px";
                sec.style.margin = "0 auto 30px auto";
                sec.style.boxShadow = "0 4px 15px rgba(0,0,0,0.08)";
                sec.style.borderRadius = "4px";
                sec.style.background = "#ffffff";
                sec.style.position = "relative";
                sec.style.boxSizing = "border-box";
                sec.style.overflow = "hidden";
                sec.style.padding = "36pt";

                // Fix zero-dimension divs & floating shapes so they take zero vertical line space
                sec.querySelectorAll('div[style*="width: 0px"], div[style*="width:0px"], div[style*="width: 0pt"]').forEach(d => {
                    d.style.position = "absolute";
                    d.style.top = "0";
                    d.style.left = "0";
                    d.style.width = "0";
                    d.style.height = "0";
                    d.style.margin = "0";
                    d.style.padding = "0";
                    d.style.pointerEvents = "none";
                    d.querySelectorAll("img, svg").forEach(m => {
                        m.style.position = "absolute";
                        m.style.pointerEvents = "none";
                    });
                });
            });
            const activeBadge = document.getElementById("activePageBadge");
            if (activeBadge) activeBadge.textContent = \`Page 1 / \${docxSections.length}\`;
        }

        const pdfCards = container.querySelectorAll(".pdf-page-card");
        if (pdfCards.length > 0) {
            pdfCards.forEach((c) => {
                c.style.width = "794px";
                c.style.minWidth = "794px";
                c.style.maxWidth = "794px";
                c.style.height = "1123px";
                c.style.minHeight = "1123px";
                c.style.maxHeight = "1123px";
                c.style.padding = "0";
                c.style.margin = "0 auto 30px auto";
            });
            const activeBadge = document.getElementById("activePageBadge");
            if (activeBadge) activeBadge.textContent = \`Page 1 / \${pdfCards.length}\`;
        }`;

if (app.includes(sPrevOld)) {
    app = app.replace(sPrevOld, sPrevNew);
    console.log('Step 3 complete (renderLivePreview custom template handling)');
} else {
    console.warn('Could not find sPrevOld in app.js');
}

fs.writeFileSync(appPath, app, 'utf8');
console.log('Successfully saved app.js!');
