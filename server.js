const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
};

// TEMPLATE & CUSTOMER PERSISTENCE ENGINE (SERVER-SIDE ON-DISK STORAGE)
const TEMPLATES_STORE_PATH = path.join(PUBLIC_DIR, 'custom_templates_store.json');

function loadTemplatesStore() {
    try {
        if (fs.existsSync(TEMPLATES_STORE_PATH)) {
            const raw = fs.readFileSync(TEMPLATES_STORE_PATH, 'utf8').replace(/^\uFEFF/, '').trim();
            if (!raw) return { templates: [], customers: [] };
            const data = JSON.parse(raw);
            return {
                templates: Array.isArray(data.templates) ? data.templates : [],
                customers: Array.isArray(data.customers) ? data.customers : []
            };
        }
    } catch (e) {
        console.error('[Template Store] Load Error:', e.message);
    }
    return { templates: [], customers: [] };
}

function saveTemplatesStore(data) {
    try {
        fs.writeFileSync(TEMPLATES_STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('[Template Store] Save Error:', e.message);
        return false;
    }
}

function isValidCustomerName(c) {
    if (!c || typeof c !== 'string') return false;
    const clean = c.trim().toLowerCase();
    const blacklist = ['global / all clients', 'global / all tenants', 'global', 'client name', 'tenant', 'tenant name', '__add_new_client__', '__new_client__', 'all', 'auto (from telemetry data)', 'auto (from uploaded sheet)'];
    return clean.length > 0 && !blacklist.includes(clean);
}

// COMPLIANCE AUDIT LOGS STORAGE ENGINE (MULTI-USER PERSISTENCE)
const AUDIT_STORE_PATH = path.join(PUBLIC_DIR, 'audit_logs_store.json');

function loadAuditStore() {
    try {
        if (fs.existsSync(AUDIT_STORE_PATH)) {
            const raw = fs.readFileSync(AUDIT_STORE_PATH, 'utf8').replace(/^\uFEFF/, '').trim();
            if (!raw) return [];
            const data = JSON.parse(raw);
            return Array.isArray(data) ? data : (data.logs || []);
        }
    } catch (e) {
        console.error('[Audit Store] Load Error:', e.message);
    }
    return [];
}

function saveAuditStore(logs) {
    try {
        fs.writeFileSync(AUDIT_STORE_PATH, JSON.stringify(logs, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error('[Audit Store] Save Error:', e.message);
        return false;
    }
}

const server = http.createServer((req, res) => {
    let safeUrl = req.url.split('?')[0];

    // CORS & PREFLIGHT HEADERS
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        return res.end();
    }

    // BACKEND REST API ENDPOINTS FOR TEMPLATES & CUSTOMERS
    if (safeUrl === '/api/templates' && req.method === 'GET') {
        const store = loadTemplatesStore();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, templates: store.templates, customers: store.customers }));
    }

    if (safeUrl === '/api/templates/save' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const payload = JSON.parse(body || '{}');
                const tpl = payload.template || payload;
                if (!tpl || !tpl.name) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Template name is required.' }));
                }

                const store = loadTemplatesStore();
                const existingIdx = store.templates.findIndex(t => t.id === tpl.id);
                if (existingIdx >= 0) {
                    store.templates[existingIdx] = tpl;
                } else {
                    store.templates.unshift(tpl);
                }

                if (isValidCustomerName(tpl.customer) && !store.customers.includes(tpl.customer.trim())) {
                    store.customers.push(tpl.customer.trim());
                }
                if (isValidCustomerName(payload.customer) && !store.customers.includes(payload.customer.trim())) {
                    store.customers.push(payload.customer.trim());
                }

                saveTemplatesStore(store);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, template: tpl, templates: store.templates, customers: store.customers }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    if (safeUrl === '/api/templates/delete' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const payload = JSON.parse(body || '{}');
                const id = payload.id;
                const store = loadTemplatesStore();
                store.templates = store.templates.filter(t => t.id !== id);
                saveTemplatesStore(store);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, templates: store.templates }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    if (safeUrl === '/api/customers/clear' && req.method === 'POST') {
        const store = loadTemplatesStore();
        store.customers = [];
        (store.templates || []).forEach(t => { if (t) t.customer = ''; });
        saveTemplatesStore(store);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, customers: [] }));
    }

    if (safeUrl === '/api/customers/add' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const payload = JSON.parse(body || '{}');
                const customerName = payload.name || payload.customer;
                if (!isValidCustomerName(customerName)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Valid customer name is required.' }));
                }
                const custClean = customerName.trim();
                const store = loadTemplatesStore();
                if (!store.customers.includes(custClean)) {
                    store.customers.push(custClean);
                    saveTemplatesStore(store);
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, customers: store.customers }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // SYSTEM & USER IDENTITY ENDPOINT
    if (safeUrl === '/api/system/identity' && req.method === 'GET') {
        const os = require('os');
        let localUser = '';
        try { localUser = os.userInfo().username; } catch (e) {}
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            success: true,
            hostname: os.hostname(),
            username: localUser,
            host: req.headers.host || 'localhost:8000',
            source: 'localhost'
        }));
    }

    // AUDIT LOGS ENDPOINTS (MULTI-USER PERSISTENCE & BROADCAST)
    if (safeUrl === '/api/audit/logs' && req.method === 'GET') {
        const logs = loadAuditStore();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, logs: logs }));
    }

    if (safeUrl === '/api/audit/logs/add' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const entry = JSON.parse(body || '{}');
                if (!entry.action) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Action is required.' }));
                }
                const logs = loadAuditStore();
                const now = new Date();
                const pad = n => String(n).padStart(2, '0');
                const formattedTs = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

                const logRecord = {
                    id: entry.id || ("LOG-" + (1000 + logs.length + 1)),
                    timestamp: entry.timestamp || formattedTs,
                    category: entry.category || 'report',
                    categoryName: entry.categoryName || (entry.category === 'ingestion' ? 'Data Ingestion & Sync' : entry.category === 'export' ? 'Exports & Downloads' : entry.category === 'cadence' ? 'Cadence PPT' : 'Report Generation'),
                    action: entry.action,
                    user: entry.user || 'localhost',
                    details: entry.details || '',
                    reportId: entry.reportId || '',
                    reportTitle: entry.reportTitle || '',
                    changes: entry.changes || null,
                    status: entry.status || 'SUCCESS',
                    latency: entry.latency || (Math.floor(Math.random() * 80 + 35) + " ms"),
                    sourceIp: entry.sourceIp || (req.socket.remoteAddress || '127.0.0.1'),
                    checksum: entry.checksum || (Math.random().toString(16).substring(2, 10) + "..." + Math.random().toString(16).substring(2, 6))
                };

                logs.unshift(logRecord);
                if (logs.length > 2500) logs.length = 2500;
                saveAuditStore(logs);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: true, log: logRecord }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    if (safeUrl === '/api/audit/logs/clear' && req.method === 'POST') {
        saveAuditStore([]);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, logs: [] }));
    }

    let filePath = path.join(PUBLIC_DIR, decodeURIComponent(safeUrl));
    
    // Prevent directory traversal
    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        return res.end('403 Forbidden');
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            if (stats && stats.isDirectory()) {
                filePath = path.join(filePath, 'index.html');
            } else {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                return res.end('<h1>404 Not Found</h1>');
            }
        }

        const extname = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[extname] || 'application/octet-stream';

        fs.readFile(filePath, (error, content) => {
            if (error) {
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            }
        });
    });
});

server.listen(PORT, () => {
    console.log(`AltiSec server running at http://localhost:${PORT}/`);
});
