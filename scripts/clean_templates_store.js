const fs = require('fs');
const path = require('path');

const storePath = path.join(__dirname, '../Reports-main/custom_templates_store.json');
const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));

console.log('Original count:', store.templates.length);

// Deduplicate: Keep JSW (tpl 0), clean Tata technologies DOCX (tpl 1), and clean Tata technologies PDF (tpl 4)
const uniqueTemplates = [];
const seenNames = new Set();

// Ensure Tata Technologies DOCX has the zero-dimension floating fix applied to its content
for (const tpl of store.templates) {
    const key = (tpl.name || '').trim().toLowerCase() + '_' + (tpl.isDocxTemplate ? 'docx' : tpl.isPdfTemplate ? 'pdf' : 'custom');
    if (seenNames.has(key)) {
        console.log('Skipping duplicate:', tpl.name, tpl.id);
        continue;
    }
    seenNames.add(key);

    if (tpl.content && (tpl.isDocxTemplate || tpl.content.includes('section.docx') || tpl.content.includes('docx-page-card'))) {
        // Fix zero-dimension divs and floating background shapes
        let fixedContent = tpl.content;
        fixedContent = fixedContent.replace(/<div style="width:\s*0px;\s*height:\s*0px;\s*display:\s*inline-block;\s*position:\s*relative;/gi,
            '<div style="width: 0px; height: 0px; display: block; position: absolute; top: 0; left: 0; pointer-events: none;');
        
        // Ensure section.docx has clean A4 styling
        fixedContent = fixedContent.replace(/style="padding:\s*36pt;\s*width:\s*595\.3pt;\s*min-height:\s*841\.9pt;/gi,
            'style="padding: 36pt; width: 794px; min-width: 794px; max-width: 794px; min-height: 1123px; position: relative; box-sizing: border-box; overflow: hidden;');
        
        tpl.content = fixedContent;
    }

    uniqueTemplates.push(tpl);
}

store.templates = uniqueTemplates;
console.log('Cleaned count:', store.templates.length);
fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
console.log('Saved clean store! New file size MB:', (fs.statSync(storePath).size / 1024 / 1024).toFixed(1));
