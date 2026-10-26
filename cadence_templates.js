// CADENCE DECK TEMPLATES
// Built-in deck templates for CadenceDeck. Each is plain data: slides of typed blocks.
//
// "SHAI Monthly Management Review" is rebuilt from SHAI-August_2026_SOC_Review-Deck.pptx (27 slides).
// Native charts in that deck keep their exact series. Charts that were pasted as pictures were
// redrawn as editable charts from the values printed on them (Offline incidents, Top sources,
// True positives by severity, Threat landscape); the two daily severity-trend pictures have no
// printed per-day values, so they stay as images.
(function () {
    'use strict';
    if (!window.CadenceDeck) return;

    const A = 'assets/cadence/shai/';
    const SEV = ['Critical', 'High', 'Medium', 'Low'];
    const SEV_COLORS = { CRITICAL: '#C0392B', HIGH: '#E8702A', MEDIUM: '#F2B33D', LOW: '#065A82' };
    const WEEKS = ['1–7 Jun', '8–14 Jun', '15–21 Jun', '22–28 Jun', '29 Jun–5 Jul', '6–12 Jul', '13–19 Jul', '20–26 Jul', '27–31 Jul', '1–9 Aug', '10–16 Aug', '17–23 Aug', '24–30 Aug'];
    const n = (v) => Number(v).toLocaleString('en-US');

    // weekly severity line chart (MTTR / MTTD trend slides)
    const weekly = (title, s, height = 205) => ({
        type: 'chart', span: 6, title, height,
        defaults: { type: 'line', legend: { show: true, position: 'bottom' }, yTitle: 'Minutes', grid: true },
        data: { labels: WEEKS, time: true, dimension: 'Week', measure: 'Minutes', series: Object.keys(s).map(k => ({ name: k[0] + k.slice(1).toLowerCase(), data: s[k], colors: SEV_COLORS[k] })) }
    });
    const MTTR_RESOLUTION = {
        CRITICAL: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        HIGH: [0, 2405, 0, 1202, 0, 2593, 1047, 1487, 5991, 5206, 0, 411, 350],
        MEDIUM: [179, 220, 2335, 1940, 9483, 3242, 501, 481, 59, 2380, 1929, 2217, 658],
        LOW: [199, 1250, 3379, 629, 11658, 4468, 5076, 2550, 209, 2136, 4569, 2769, 265]
    };
    const hbar = (title, labels, values, color, span = 6, height = 220) => ({
        type: 'chart', span, title, height,
        defaults: { type: 'hbar', dataLabels: true, legend: { show: false }, axis: false, grid: false },
        data: { labels, dimension: 'Attack type', measure: 'Cases', series: [{ name: 'Cases', data: values, colors: color }] }
    });
    const list = (title, items) => ({ type: 'table', span: 3, size: 'xs', header: [title], rows: items.map(i => [i]) });
    const counts = (title, head, rows, span = 4) => ({ type: 'table', span, size: 'xs', header: [title, head], rows: rows.map(([a, b]) => [a, n(b)]), widths: [62, 38] });
    const hunt = (title, items) => ({ type: 'cards', span: 4, cols: 1, style: 'list', title, items: items.map(([t, d, s], i) => ({ num: i + 1, title: t, meta: d, tag: s })) });

    const deck = {
        name: 'Monthly Management Review',
        client: 'Star Health',
        period: '1 – 31 August 2026',
        theme: { primary: '#1E2761', accent: '#E8702A', soft: '#CADCFC', tint: '#EEF3FD', teal: '#065A82' },
        assets: {
            clientLogo: A + 'starhealth.jpeg',
            vendorLogo: A + 'altisec_black.png',
            vendorLogoLight: 'assets/altisec_white_logo.png',
            cover: A + 'cover.jpeg'
        },
        slides: [
            // 1
            { layout: 'cover', title: 'MONTHLY MANAGEMENT REVIEW', subtitle: '1 – 31 August 2026', kicker: 'PRESENTED BY SOC TEAM' },

            // 2
            {
                title: 'KEY TOPICS / AGENDA', blocks: [
                    { type: 'cards', span: 6, cols: 1, style: 'agenda', title: 'Qualitative briefing', items: [
                        { num: 1, title: 'Executive summary', body: 'Overall posture of the infrastructure.' },
                        { num: 2, title: 'Data source health', body: 'Overall health of ingested data / log sources.' },
                        { num: 3, title: 'Threat landscape & notable incidents', body: 'Attack vectors that had a potential of an impact at Star Health.' },
                        { num: 4, title: 'Detection engineering status', body: 'Detection fine-tuning including analytic rules, correlation & playbooks, automation & orchestration.' }
                    ] },
                    { type: 'cards', span: 6, cols: 1, style: 'agenda', title: 'Quantitative briefing', items: [
                        { num: 5, title: "Incident analysis & KPI's", body: 'Metrics showing security operations effectiveness.' },
                        { num: 6, title: 'Threat overview & attacks', body: 'Active threats and attack patterns targeting Star Health.' },
                        { num: 7, title: 'Risks & vulnerabilities', body: 'Critical security gaps requiring immediate attention.' },
                        { num: 8, title: 'Lessons learned & improvements', body: 'Actions taken and roadmap for security enhancement.' }
                    ] }
                ]
            },

            // 3
            {
                title: 'EXECUTIVE SUMMARY', blocks: [
                    { type: 'text', span: 12, size: 'lg', text: 'There is significant improvement in key SOC metrics. The incident volume has increased due to testing of multiple correlation rules & migration activities.' },
                    { type: 'kpis', span: 12, items: [
                        { value: '12,236', label: 'Endpoint coverage', tone: 'dark' },
                        { value: '23.9%', label: 'Auto-closed', sub: 'Decrease', tone: 'soft' },
                        { value: '12.9%', label: 'True positive', sub: 'Decrease', tone: 'soft' },
                        { value: '452', label: 'Daily incident volume', sub: '207% increase', tone: 'accent' }
                    ] },
                    { type: 'cards', span: 12, cols: 2, style: 'check', title: 'Highlights', items: [
                        { title: 'Successful fine-tuning of 6 correlation rules', tone: 'good' },
                        { title: 'Successfully added 5 new correlation rules in production', tone: 'good' },
                        { title: 'Consistency in SOC metrics', tone: 'good' },
                        { title: 'Blind spot: Cisco IronPort, DAM, Zscaler DLP', tone: 'bad' }
                    ] },
                    { type: 'callout', span: 12, tone: 'dark', text: 'Approx. 266 new assets have been added to the inventory.' }
                ]
            },

            // 4
            {
                title: 'MoM TASKS', subtitle: 'Action items from the last management review and their status', blocks: [
                    { type: 'table', span: 12, size: 'sm', header: ['Task', 'Owner', 'Status / update', 'ETA'], widths: [42, 14, 32, 12], rows: [
                        ['Publish SOC governance and RACI within 2 weeks; include ATR-first review structure and KPI calibration points', 'AltiSec', 'In progress', '15 Sept 2026'],
                        ['Correlate leaked credentials with PAM inventory; elevate privileged accounts; conduct device RCA for any privileged matches', 'Dhruv / Tanya', 'No relevant match found with the PAM', '—'],
                        ['Present detailed correlation rules status (logic, query, data sources, owner, approval state); meet Ajay / Imran for discussion & approvals', '—', 'New correlation rules submitted with multi-log-source logic that works across more than one data source', 'Oct / Dec 2026'],
                        ['Review IR / SLA metrics dashboard with Ajay Sir before sharing credentials; ensure live MTTR / MTTD visibility', 'Parag & Aman Raj', 'Discussed with Ajay Sir — reviewed & working on suggestions', '—']
                    ] }
                ]
            },

            // 5
            { layout: 'section', kicker: '01 — QUANTITATIVE BRIEFING', title: "INCIDENT ANALYSIS\n& KPI'S" },

            // 6
            {
                title: 'INCIDENT TREND', subtitle: 'August 2026 incident funnel', footnote: '*1st to 31st August 2026', blocks: [
                    { type: 'kpis', span: 12, items: [
                        { value: '13,668', label: 'Total incidents', tone: 'dark' },
                        { value: '10,621', label: 'Non-actionable · auto-resolved', tone: 'soft' },
                        { value: '1,496', label: 'Auto resolved', tone: 'plain' },
                        { value: '9,125', label: 'Other', tone: 'plain' },
                        { value: '3,047', label: 'Actionable cases', tone: 'accent' }
                    ] },
                    { type: 'chart', span: 4, title: 'Actionable cases (3,047)', height: 270,
                        defaults: { type: 'doughnut', dataLabels: false, legend: { show: true, position: 'right' } },
                        data: { labels: ['False positives', 'Resolved – other', 'True positives', 'In progress', 'New'], dimension: 'Outcome', measure: 'Cases',
                            series: [{ name: 'Cases', data: [2439, 270, 317, 21, 0], colors: ['#94A3B8', '#065A82', '#C0392B', '#E8702A', '#CADCFC'] }] } },
                    { type: 'chart', span: 4, title: 'True positives by severity', height: 270,
                        defaults: { type: 'stackedBar', dataLabels: true, legend: { show: true, position: 'bottom' } },
                        data: { labels: SEV, dimension: 'Severity', measure: 'Cases', series: [
                            { name: 'Open', data: [0, 0, 8, 9], colors: '#E8702A' },
                            { name: 'Closed', data: [0, 19, 36, 11], colors: '#1E2761' }] } },
                    { type: 'table', span: 4, size: 'sm', title: 'Cases communicated to Star Health', header: ['Status', 'Cases'], widths: [72, 28], total: true, rows: [
                        ['Closed – false positive', '31'], ['Closed – security testing', '1'], ['Closed – true positive', '33'], ['Ongoing / in progress', '18'], ['Total', '83']] },
                    { type: 'callout', span: 12, tone: 'tint', value: '317', text: 'true positives split into 108 true-prevented and 209 true-positive cases.' }
                ]
            },

            // 7
            {
                title: 'SOC METRICS TREND', subtitle: 'Weekly response and detection times by severity', footnote: '*All values in minutes', blocks: [
                    { type: 'table', span: 4, size: 'sm', title: 'MTTR (response) — expected vs actual', header: ['Priority', 'Expected', 'Actual'], pillCols: [], rows: [
                        ['P1 – Critical', '15 min', '0 min'], ['P2 – High', '30 min', '20 min'], ['P3 – Medium', '2 hrs', '40 min'], ['P4 – Low', '4 hrs', '56 min']] },
                    Object.assign(weekly('MTTR — Response', {
                        CRITICAL: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                        HIGH: [0, 20, 0, 14, 13, 23, 16, 10, 15, 7, 0, 8, 7],
                        MEDIUM: [27, 23, 43, 26, 34, 12, 38, 26, 20, 26, 20, 15, 22],
                        LOW: [22, 33, 39, 58, 37, 27, 32, 38, 24, 34, 20, 33, 20]
                    }, 195), { span: 8 }),
                    weekly('MTTR — Resolution', MTTR_RESOLUTION, 195),
                    weekly('MTTD', {
                        CRITICAL: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                        HIGH: [0, 3, 0, 5, 0, 13, 1, 13, 10, 12, 0, 6, 17],
                        MEDIUM: [30, 23, 41, 20, 10, 12, 21, 38, 25, 11, 36, 41, 40],
                        LOW: [42, 49, 39, 5, 23, 27, 35, 42, 21, 15, 51, 38, 46]
                    }, 195)
                ]
            },

            // 8
            {
                title: 'SOC METRICS TREND — RESOLUTION', subtitle: 'Resolution targets, resolver-team performance and weekly trend', footnote: '*All values in minutes', blocks: [
                    { type: 'table', span: 5, size: 'sm', title: 'Resolution SLA by severity', header: ['Severity', 'Containment', 'Complete resolution'], rows: [
                        ['P1 – Critical', '< 60 mins', '3 hours'], ['P2 – High', '< 2 hours', '24 hours'], ['P3 – Medium', '< 4 hours', '2 days'], ['P4 – Low', '< 8 hours', '4 days']] },
                    { type: 'table', span: 7, size: 'sm', title: 'Resolution by resolver team', header: ['Team', 'Sent', 'Replied', 'Resolved', '% resolved', 'Avg MTTR (min)'], widths: [34, 11, 12, 12, 14, 17], rows: [
                        ['Mail Operations Team', '22', '22', '20', '91%', '418'], ['Cloud Team', '17', '17', '16', '94%', '737'], ['Endpoint Security', '19', '17', '14', '74%', '4,276'],
                        ['DC Operations', '14', '13', '8', '57%', '1,387'], ['HelpDesk Support (Pan India)', '2', '2', '2', '100%', '5,095'], ['Network Security', '7', '7', '4', '57%', '3,588']] },
                    Object.assign(weekly('MTTR — Resolution (weekly)', MTTR_RESOLUTION, 150), { span: 12 })
                ]
            },

            // 9
            {
                title: 'INCIDENT METRICS', subtitle: 'Rule activity, August severity split and month-on-month sources', blocks: [
                    { type: 'table', span: 5, size: 'sm', title: 'Alert generation', header: ['Rules', 'June 2026', 'July 2026', 'August 2026'], widths: [46, 18, 18, 18], rows: [
                        ['Rules generating incidents', '322', '369', '379'], ['Rules generating max false positives', '4', '5', '6']] },
                    { type: 'table', span: 7, size: 'sm', title: 'August 2026 by severity', header: ['Severity', 'Total', 'Open', 'Open — main driver', 'Closed'], widths: [16, 14, 12, 42, 16], total: true, rows: [
                        ['Critical', '3,532', '3,177', 'CVE', '355'], ['High', '848', '619', 'Cyble', '229'], ['Medium', '8,192', '1,533', 'Scanning, Cyble and silent data', '6,659'],
                        ['Low', '1,096', '10', '—', '1,086'], ['Total', '13,668', '5,339', '', '8,329']] },
                    { type: 'chart', span: 6, title: 'Offline incidents', height: 215,
                        defaults: { type: 'groupedBar', dataLabels: false, legend: { show: true, position: 'bottom' } },
                        data: { labels: ['Apr 26', 'May 26', 'Jun 26', 'Jul 26', 'Aug 26'], dimension: 'Month', measure: 'Incidents', series: [
                            { name: 'Cyble – attack surface', data: [5145, 3744, 3346, 2014, 2169], colors: '#1E2761' },
                            { name: 'CVE', data: [1449, 2942, 693, 650, 3537], colors: '#94A3B8' },
                            { name: 'Local / WildFire analysis', data: [1262, 1659, 1181, 874, 491], colors: '#F2B33D' },
                            { name: 'Silent data source', data: [414, 350, 554, 1490, 4573], colors: '#38BDF8' }] } },
                    { type: 'chart', span: 6, title: 'Top sources', height: 215,
                        defaults: { type: 'groupedBar', dataLabels: false, legend: { show: true, position: 'bottom' } },
                        data: { labels: ['Apr 26', 'May 26', 'Jun 26', 'Jul 26', 'Aug 26'], dimension: 'Month', measure: 'Incidents', series: [
                            { name: 'Correlation rule set', data: [7351, 3744, 6067, 5839, 8392], colors: '#1E2761' },
                            { name: 'Vulnerability scan', data: [1458, 549, 693, 650, 3532], colors: '#E8702A' },
                            { name: 'Firewalls', data: [2631, 2942, 632, 477, 629], colors: '#94A3B8' },
                            { name: 'Endpoints', data: [1899, 350, 1977, 2283, 1744], colors: '#F2B33D' }] } }
                ]
            },

            // 10
            {
                title: 'THREAT LANDSCAPE', subtitle: 'Cases analysed across the SOC queue — where the alerts concentrate', blocks: [
                    hbar('August 2026 — cases by attack category',
                        ['Evasion & telemetry gaps', 'Vulnerability / patch exposure', 'Threat intel / credential exposure', 'Authentication / Kerberos', 'Other / misc detections', 'Malware & exploitation', 'Reconnaissance & scanning', 'Web application attacks', 'DDoS / availability'],
                        [4828, 3532, 2166, 941, 623, 485, 458, 321, 314], ['#E8702A', '#C0392B', '#C0392B', '#1E8449', '#94A3B8', '#E8702A', '#065A82', '#065A82', '#F2B33D'], 7, 300),
                    { type: 'bullets', span: 5, size: 'xs', title: 'Analyst commentary', items: [
                        'Evasion (2,170, ~25%) — largely "Monitoring Evasion: Silent Data Source Detected" and XDR Collector service stops. This reflects agent instability or deliberate tampering.',
                        'Threat Intelligence (2,014, ~23%) — leaked credentials, dark web, and social media monitoring hits. High volume, low per-case severity.',
                        'Authentication / Kerberos (938, ~11%) — Kerberos pre-auth failures by host, all logged as Low severity (consistent with brute-force noise rather than confirmed compromise).',
                        'Malware (869, ~10%) — local analysis and WildFire detections, mostly Medium with a handful of High.',
                        'Reconnaissance / Scanning (851, ~10%) — vulnerability scanners, port sweeps, AWS scanning.',
                        'Vulnerability Management / Posture (650, ~7%) — every one of these is Critical severity, driven by CVEs in Chrome, Edge, and Java Runtime across many endpoints.',
                        'DDoS / Flood, Web App Attack, Exploit, Suspicious Process rounded out the remainder at lower volumes.'
                    ] },
                    { type: 'callout', span: 12, tone: 'bad', value: '3,177 of 3,532', text: 'critical cases remain open — nearly all of them CVE / patch findings. The critical backlog nearly quintupled month over month (650 in July to 3,532 in August). Daily volume averaged 456 cases, peaking on Aug 7 (750) and Aug 21 (1,125).' }
                ]
            },

            // 11
            {
                title: 'THREAT LANDSCAPE — TREND ANALYSIS', subtitle: 'July v/s August 2026', blocks: [
                    { type: 'kpis', span: 12, items: [
                        { value: '8,770', label: 'Total cases — July', tone: 'soft' },
                        { value: '13,668', label: 'Total cases — August', tone: 'dark' },
                        { value: '+55.8%', label: 'Month over month', tone: 'accent' },
                        { value: '4,828', label: 'Evasion cases — August', tone: 'plain' }
                    ] },
                    hbar('Top attack types — July 2026', ['Evasion', 'Threat intel / credential exposure', 'Authentication / Kerberos', 'Malware', 'Reconnaissance'], [2170, 2014, 938, 869, 851], '#065A82', 6, 200),
                    hbar('Top attack types — August 2026', ['Evasion', 'Vulnerability / patch exposure', 'Threat intel / credential exposure', 'Authentication / Kerberos', 'Malware'], [4828, 3532, 2166, 941, 485], '#E8702A', 6, 200),
                    { type: 'table', span: 12, size: 'sm', title: 'Top log sources (by DS tag)', header: ['#', 'July — source', 'July — cases', 'August — source', 'August — cases'], widths: [6, 30, 17, 30, 17], rows: [
                        ['1', 'cybleeventsv2', '2,014 · 23.0%', 'PANW / Vulnerability Policy', '3,532 · 25.8%'],
                        ['2', 'Akamai / WAF', '1,303 · 14.9%', 'cybleeventsv2', '2,166 · 15.8%'],
                        ['3', 'PANW / XDR Agent', '1,268 · 14.5%', 'microsoft / Windows', '1,140 · 8.3%']] }
                ]
            },

            // 12
            {
                title: 'ATTACK / ALERT TREND — DAILY VIEW', subtitle: 'Daily alert volume by severity, from the SOC case export', blocks: [
                    { type: 'image', span: 6, height: 400, src: A + 'trend_july.png', alt: 'July 2026 daily attack and alert trend by severity', caption: 'July 2026 — 8,770 cases · peak 1,281 on day 3' },
                    { type: 'image', span: 6, height: 400, src: A + 'trend_august.png', alt: 'August 2026 daily attack and alert trend by severity', caption: 'August 2026 — 13,668 cases · peak 1,125 on day 21' }
                ]
            },

            // 13
            {
                title: 'INCIDENT & ATTACK TREND', subtitle: 'Top attack types, rules, sources and blocked indicators — August 2026', blocks: [
                    list('Top-5 attack types — true positive', ['WAF Evasion Attack', 'Distributed Denial-of-Service (DDoS) Attack', 'Malicious Bot', 'Malware Attack', 'Password Spray']),
                    list('Top-5 attack types — false positive', ['Brute Force Attack', 'Endpoint Denial of Service (DoS)', 'Defense Evasion (Indicator Blocking)', 'Public-Facing Application Exploitation', 'Active / Vulnerability Scanning']),
                    { type: 'table', span: 6, size: 'xs', header: ['Top true-positive rules triggered', 'Incidents'], widths: [80, 20], rows: [
                        ['Web App Attack – Bad User Agent Detected on WAF', '88'], ['Evasion – Large Number of WAF Blocks from Same Source', '57'], ['UC-74 Silent Data Set Notification – star_app', '14'],
                        ['FortiGate Reconnaissance Activity Detection', '12'], ['Azure Identity Protection – Risky User', '12']] },
                    { type: 'table', span: 8, size: 'xs', header: ['Top false-positive rules triggered'], rows: [
                        ['Monitoring Evasion – Silent Data Source Detected'], ['Kerberos Pre-Auth Failures by Host'], ['UC-74 Silent Data Set Notification – star_app'],
                        ['UC-75 Silent Data Set Notification – star_eks_app'], ['Distributed Application-Layer Flood – Multiple IPs Requests to Single Application']] },
                    { type: 'kpis', span: 4, cols: 2, items: [{ value: '12', label: 'IOCs blocked — IP', tone: 'dark' }, { value: '39', label: 'IOCs blocked — hash', tone: 'dark' }] },
                    counts('Top IP address — ingress traffic', 'Count', [['13.232.115.195', 1385360], ['13.235.136.88', 1384723], ['14.96.24.182', 585887], ['13.235.110.192', 354804], ['122.176.100.250', 330798]]),
                    counts('Applications hit', 'Count', [['shapi.starhealth.in', 403124263], ['www.starhealth.in', 46272016], ['starpay.starhealth.in', 35348642], ['customer.starhealth.in', 2139884], ['claimapps.starhealth.in', 1519204]]),
                    counts('Top countries', 'Count', [['India', 499526731], ['US', 2602682], ['AE', 1573188], ['SG', 734162], ['FR', 654021]])
                ]
            },

            // 14
            {
                title: 'INCIDENT TREND — JULY VS AUGUST 2026', subtitle: 'Top 10 resolved false-positive rules — counts, fine-tuning status and revised ETAs', blocks: [
                    { type: 'chart', span: 12, title: 'False-positive volume: July 3,714 → August 4,410 · 3 of 10 rules improved', height: 165,
                        defaults: { type: 'groupedBar', dataLabels: false, legend: { show: true, position: 'right' } },
                        data: { labels: ['Monitoring Evasion', 'Kerberos Pre-Auth', 'XDR Collector Stopped', 'App-Layer Flood', 'Vulnerability Scanner', 'Bad User Agent WAF', 'DDoS SHAI apps', 'App Enumeration', 'Port Sweep Subnets', 'Local Analysis Malware'],
                            dimension: 'Rule', measure: 'False positives', series: [
                                { name: 'July', data: [1122, 930, 464, 389, 362, 137, 82, 78, 77, 73], colors: '#2C5F2D' },
                                { name: 'August', data: [2390, 871, 5, 200, 160, 308, 110, 49, 0, 317], colors: '#E07B2F' }] } },
                    { type: 'table', span: 12, size: 'xs', header: ['Resolved – false positive · top 10 rule', 'July', 'August', 'Fine-tuning update', 'ETA', 'Status', 'Revised ETA'], widths: [24, 6, 7, 39, 8, 9, 7], pillCols: [5], rows: [
                        ['Monitoring Evasion – Silent Data Source', '1,122', '2,416', 'UC-74 to UC-77 live in production; tuning in progress. Spike caused by the 21–23 Aug migration.', '12-Aug-26', 'In progress', '1-Sep-26'],
                        ['Kerberos Pre-Auth Failures by Host', '930', '921', 'In the pipeline. Correlation rules first, analytics rules next.', '10-Aug-26', 'Not completed', '18-Sep-26'],
                        ['XDR Collector Service Stopped', '464', '5', 'Fine-tuned. Only 5 cases triggered, all migration-related. Closed.', 'Completed', 'Completed', 'Closed'],
                        ['Distributed App-Layer Flood – Multiple IPs', '389', '200', 'Fine-tuned on 13 Aug 2026; only 7 cases triggered after fine-tuning.', 'Completed', 'Completed', 'Closed'],
                        ['Reconnaissance – Vulnerability Scanner', '362', '163', 'Disabled 14 Aug and replaced by UC-73 FortiGate Recon Activity Detection; minor tuning ongoing.', '21-Aug-26', 'In progress', '3-Sep-26'],
                        ['Web App Attack – Bad User Agent on WAF', '137', '308', 'Correlation rule in final stage; a few validations remain.', '21-Aug-26', 'In progress', '4-Sep-26'],
                        ['DDoS – Excessive Requests to SHAI Apps', '82', '110', 'Work complete; awaiting confirmation for a few IP addresses.', '21-Aug-26', 'In progress', '1-Sep-26'],
                        ['Application Enumeration – Single IP', '78', '49', 'Updated rule logic under UAT; moves to production after validation.', '21-Aug-26', 'In progress', '3-Sep-26'],
                        ['Port Sweep to Multiple Subnets', '77', '0', 'Zscaler connectivity loss over port 9000 flagged as a port sweep. Resolved, no further alerts.', 'Completed', 'Completed', 'Closed'],
                        ['Local Analysis Malware', '73', '317', 'In the pipeline. Correlation rules first, analytics rules next.', '20-Aug-26', 'Not completed', '18-Sep-26']] }
                ]
            },

            // 15
            {
                title: 'CORRELATION RULE FINE-TUNING — COMPLETED', subtitle: 'False-positive alert reduction — correlation rules', blocks: [
                    { type: 'kpis', span: 12, items: [
                        { value: '542', label: 'Total alerts before fine-tuning', tone: 'soft' },
                        { value: '60', label: 'Total alerts after fine-tuning', tone: 'soft' },
                        { value: '89%', label: 'Overall false-positive reduction', tone: 'dark' }] },
                    { type: 'table', span: 8, size: 'xs', header: ['#', 'Rule name', 'Before (7 days)', 'After (7 days)', 'Reduction', 'Fine-tuning', 'Production'], widths: [4, 40, 11, 11, 10, 11, 13], pillCols: [5, 6], rows: [
                        ['1', 'UC 40 – Data Collection Evasion – XDR Collector Service Stopped', '57', '4', '93%', 'Completed', 'Live in production'],
                        ['2', 'UC 30 – Reconnaissance – AWS Excessive Security Scanning', '98', '0', '100%', 'Completed', 'Live in production'],
                        ['3', 'UC 12 – Persistence – Windows Service Created with Suspicious Path', '25', '12', '52%', 'Completed', 'Live in production'],
                        ['4', 'UC 14 – Distributed Application-Layer Flood – Multiple IPs Requests to Single Application', '269', '43', '84%', 'Completed', 'Live in production'],
                        ['5', 'UC 18 – Reconnaissance – Vulnerability Scanner Detected by Events', '83', '1', '99%', 'Completed', 'Live in production'],
                        ['6', 'UC 15 – Enumeration – AWS Password Policy Changes', '10', '1', '90%', 'Completed', 'Live in production']] },
                    { type: 'chart', span: 4, title: 'Alerts before vs after (7 days)', height: 250,
                        defaults: { type: 'hbar', dataLabels: true, legend: { show: true, position: 'bottom' }, axis: false, grid: false },
                        data: { labels: ['UC 40', 'UC 30', 'UC 12', 'UC 14', 'UC 18', 'UC 15'], dimension: 'Rule', measure: 'Alerts', series: [
                            { name: 'Before', data: [57, 98, 25, 269, 83, 10], colors: '#94A3B8' },
                            { name: 'After', data: [4, 0, 12, 43, 1, 1], colors: '#1E2761' }] } }
                ]
            },

            // 16
            {
                title: 'CORRELATION RULES — IN PROGRESS', subtitle: 'Current false-positive volume — rules queued for fine-tuning', blocks: [
                    { type: 'kpis', span: 12, items: [
                        { value: '1,231', label: 'Total alerts (in-progress rules)', tone: 'soft' },
                        { value: '1,176', label: 'False-positive alerts', tone: 'soft' },
                        { value: '95.5%', label: 'Current false-positive rate', tone: 'dark' }] },
                    { type: 'table', span: 12, size: 'xs', header: ['#', 'Rule name', 'Total alerts', 'True positive', 'False positive', 'FP rate', 'Status', 'ETA'], widths: [4, 46, 8, 8, 8, 8, 11, 7], pillCols: [6], rows: [
                        ['1', 'UC-07 Monitoring Evasion – Silent Data Source Detected', '1043', '21', '1022', '98.00%', 'In progress', '04-Sep-26'],
                        ['2', 'UC-26 Web App Attack – Bad User Agent Detected on WAF', '75', '0', '75', '100.00%', 'In progress', '04-Sep-26'],
                        ['3', 'UC-13 Application Enumeration – Single IP Requests to Multiple Applications', '10', '1', '9', '90.00%', 'In progress', '11-Sep-26'],
                        ['4', 'UC-09 DDoS – Excessive Requests to SHAI Applications – Outside India', '25', '0', '25', '100.00%', 'In progress', '11-Sep-26'],
                        ['5', 'UC-11 Evasion – Large Number of WAF Blocks from Same Source', '46', '33', '13', '28.30%', 'In progress', '11-Sep-26'],
                        ['6', 'UC-10 Data Exfiltration – Excessive Outbound Traffic Observed', '15', '0', '15', '100.00%', 'In progress', '11-Sep-26'],
                        ['7', 'UC-25 Web App Attack – Unauthorized HTTP Request on WAF', '2', '0', '2', '100.00%', 'In progress', '18-Sep-26'],
                        ['8', 'UC-72 Data Exfiltration – DLP Violation Detected from Exiting Users ID', '8', '0', '8', '100.00%', 'In progress', '18-Sep-26'],
                        ['9', 'UC-71 UTM Activity with Allowed Traffic', '1', '0', '1', '100.00%', 'In progress', '18-Sep-26'],
                        ['10', 'UC-60 Persistence – New Local Administrator Account Created on FortiGate Firewall', '5', '0', '5', '100.00%', 'In progress', '18-Sep-26'],
                        ['11', 'UC-35 Policy Violation – Unusual Traffic Violation from Source', '1', '0', '1', '100.00%', 'In progress', '18-Sep-26']] }
                ]
            },

            // 17
            {
                title: 'CORRELATION RULES — IN PROGRESS (CONTD.)', subtitle: 'Rules queued for fine-tuning, WAF detection gaps and new rules by priority', blocks: [
                    { type: 'kpis', span: 12, items: [
                        { value: '476', label: 'Total alerts (in-progress rules)', tone: 'soft' },
                        { value: '287', label: 'False-positive alerts', tone: 'soft' },
                        { value: '60.3%', label: 'Current false-positive rate', tone: 'dark' }] },
                    { type: 'table', span: 12, size: 'xs', header: ['#', 'Rule name', 'Total alerts', 'True positive', 'False positive', 'FP rate', 'Status', 'ETA'], widths: [4, 46, 8, 8, 8, 8, 11, 7], pillCols: [6], rows: [
                        ['1', 'UC 26 – Web App Attack – Bad User Agent Detected on WAF', '190', '81', '109', '57.37%', 'In progress', '21-Aug-26'],
                        ['2', 'UC 13 – Application Enumeration – Single IP Requests to Multiple Applications', '66', '1', '65', '98.48%', 'In progress', '21-Aug-26'],
                        ['3', 'UC 09 – DDoS – Excessive Requests to SHAI Applications – Outside India', '65', '5', '60', '92.31%', 'In progress', '21-Aug-26'],
                        ['4', 'UC 11 – Evasion – Large Number of WAF Blocks from Same Source', '121', '93', '28', '23.14%', 'In progress', '21-Aug-26'],
                        ['5', 'UC 15 – Enumeration – AWS Password Policy Changes', '25', '0', '25', '100.00%', 'In progress', '21-Aug-26']] },
                    { type: 'table', span: 7, size: 'xs', title: 'WAF detection gap rules', header: ['#', 'Rule name'], widths: [8, 92], rows: [
                        ['1', 'UC 24 – Web Application Attack – Unusual Spike in Traffic on WAF Hosts'], ['2', 'UC 25 – Web App Attack – Unauthorized HTTP Request on WAF'],
                        ['3', 'UC 35 – Policy Violation – Unusual Traffic Violation from Source'], ['4', 'UC 36 – DDoS Attack – Akamai WAF Violations Spike Detected']] },
                    { type: 'table', span: 5, size: 'xs', title: 'New correlation rules — by log source priority', header: ['Priority', 'New rules', 'ETA'], total: true, rows: [
                        ['P1', '26', 'Oct 2026'], ['P2', '14', 'Dec 2026'], ['Total', '40', 'Dec 2026']] }
                ]
            },

            // 18
            {
                title: 'NEW CORRELATION RULE CREATION', subtitle: 'Status of correlation rules created this month', blocks: [
                    { type: 'kpis', span: 12, items: [
                        { value: '11', label: 'Total new rules created', tone: 'dark' },
                        { value: '5', label: 'Added in production', tone: 'soft' },
                        { value: '4', label: 'Added in UAT', tone: 'soft' },
                        { value: '2', label: 'Validation in progress', tone: 'accent' }] },
                    { type: 'table', span: 12, size: 'xs', header: ['#', 'Correlation rule name', 'Status', 'Remark', 'ETA'], widths: [4, 34, 10, 44, 8], pillCols: [2], rows: [
                        ['1', 'UC 73 – FortiGate Reconnaissance Activity Detection', 'Completed', 'Added into production on 14th August 2026', '—'],
                        ['2', 'UC 39 – Azure Identity Protection – Risky User Notification', 'Completed', 'Added into production on 28th August 2026', '—'],
                        ['3', 'UC-78 LogMeIn – Burner Account Exploitation & Anomaly Chain', 'Completed', 'Added into production on 30th August 2026', '—'],
                        ['4', 'UC-79 LogMeIn – Account Takeover & Privilege Modification', 'Completed', 'Added into production on 30th August 2026', '—'],
                        ['5', 'UC-80 PAM – Privileged Account Hijacking via Brute-Force & Credential Checkout', 'Completed', 'Added into production on 30th August 2026', '—'],
                        ['6', 'UC-82 Zscaler Audit – Permissive Access or High-Risk Policy Creation', 'Completed', 'Added into UAT on 30th August 2026', '08-Sep-26'],
                        ['7', 'UC-81 Zscaler Audit – Unauthorized Policy Deletion or Disabling (Defense Evasion)', 'Completed', 'Added into UAT on 30th August 2026', '08-Sep-26'],
                        ['8', 'UC-83 Zscaler Audit – Anomalous Bulk Policy Modification Burst', 'Completed', 'Added into UAT on 30th August 2026', '08-Sep-26'],
                        ['9', 'UC-84 Zscaler Audit – Concurrent SSL Tampering & Object Creation', 'Completed', 'Added into UAT on 30th August 2026', '08-Sep-26'],
                        ['10', 'Privileged Session Hijacking and Mass Database Exfiltration Detected', 'In progress', 'Validation in progress. 5 rules consolidated into one: PAM privileged session outside business hours; PAM shared account used by multiple users; Linux user added to sudoers; IBM Guardium mass database query (row threshold); IBM Guardium sensitive table access outside business hours.', '14-Sep-26'],
                        ['11', 'Linux Server Root Exploitation and SSH Backdoor Persistence', 'In progress', 'Validation in progress. 4 rules consolidated into one: Linux SSH root login detected; malicious SSH authorized key added; Linux cron job created by suspicious process; Solaris root login on production server.', '14-Sep-26']] }
                ]
            },

            // 19
            {
                title: 'PLAYBOOK DEVELOPMENT PROGRESS', subtitle: 'Automation & orchestration status', blocks: [
                    { type: 'kpis', span: 12, items: [
                        { value: '17', label: 'Deployed in production', tone: 'dark' },
                        { value: '1', label: 'Ready to deploy', tone: 'soft' },
                        { value: '2', label: 'In progress (testing / dev)', tone: 'soft' }] },
                    { type: 'steps', span: 12, title: 'Deployment spotlight — Malware file hash: reporting, blocking & removal automation', items: [
                        { text: 'XDR agent scans & flags malicious file hashes' }, { text: 'Auto-segregates results by endpoint type' },
                        { text: 'Hash enrichment → auto-generate & route reports to IT helpdesk' }, { text: 'Helpdesk validates (manual step)', manual: true },
                        { text: 'Segregation of business-required files from report' }, { text: 'Route malicious business-required files report to onsite SOC team', manual: true },
                        { text: 'Auto-blocking the malicious files' }, { text: 'Auto-removal of blocked files (Block-List File Deletion playbook)' }] },
                    { type: 'callout', span: 12, tone: 'tint', value: '90%', text: 'reduction in manual reporting effort across SOC, onsite team and helpdesk teams — only validation remains manual. After validation, blocking is also fully automated, with the two playbooks chained automatically.' },
                    { type: 'bullets', span: 5, size: 'sm', title: 'Current work update', items: [
                        'Playbook use cases: defining playbook use cases based on analytics rules to enable automated and immediate threat containment and response.',
                        'Playbook refinement: reviewing and enhancing existing playbooks based on fine-tuned correlation rules, including containment actions and required updates.'] },
                    { type: 'table', span: 7, size: 'xs', title: 'Under-development playbooks', header: ['#', 'Playbook / use case', 'Status', 'Current update', 'ETA'], widths: [5, 32, 19, 32, 12], pillCols: [2], rows: [
                        ['1', 'Akamai API Security Incident Automation', 'Under validation', 'Playbook developed; final validation pending', '7 Sept'],
                        ['2', 'Critical Vulnerability Reporting Playbook', 'Validation WIP', 'Workflow designed; validation in process', '10 Sept']] }
                ]
            },

            // 20
            { layout: 'section', kicker: '02 — QUALITATIVE BRIEFING', title: 'THREAT OVERVIEW\n& ATTACKS' },

            // 21
            {
                title: 'THREAT HUNT COMPLETED LOG', subtitle: 'June – August 2026 · Threat hunting program', footnote: 'SOC · THREAT HUNTING LOG', blocks: [
                    hunt('June · 6 entries', [['Critical Open Ports & Unauthorized Exposure Threat Hunt Report', '10-Jun-26', 'HIGH'], ['Spotify Logs Observed in Environment', '9-Jun-26', 'PROACTIVE'],
                        ['Ops Shadow Strike Threat Hunt', '26-Jun-26', 'HIGH'], ['Snapchat Traffic Observed During Proactive Threat Hunt', '26-Jun-26', 'PROACTIVE'], ['Akira Ransomware', '29-Jun-26', 'CRITICAL'], ['SharePoint RCE', '30-Jun-26', 'CRITICAL']]),
                    hunt('July · 6 entries', [['Abyss Locker', 'Shared 09-Jul-26', 'CRITICAL'], ['Unauthorized Applications', 'Shared 08-Jul-26', 'MEDIUM'], ['APT 41', 'Shared 16-Jul-26', 'CRITICAL'],
                        ['Gentlemen Killer Ransomware', 'Shared 23-Jul-26', 'CRITICAL'], ['Squiblydoo Technique Threat Hunt', 'Shared 23-Jul-26', 'HIGH'], ['RMM Tool Abuse', 'Shared 31-Jul-26', 'HIGH']]),
                    hunt('August · 4 entries', [['M365 Targeted Attack Campaign', 'Shared 5-Aug-26', 'CRITICAL'], ['Credential Dumping via Non-Standard Tools', 'Shared 19-Aug-26', 'HIGH'],
                        ['Clop (IOC based)', 'Shared 18-Aug-26', 'HIGH'], ['BianLian (IOC based)', 'Shared 18-Aug-26', 'HIGH']])
                ]
            },

            // 22
            {
                title: 'TH — AUGUST OBSERVATIONS', subtitle: 'Outcome of each threat hunt completed in August', blocks: [
                    { type: 'cards', span: 12, cols: 2, items: [
                        { title: 'M365 Targeted Attack Campaign', body: 'The identified Service Principal activity was confirmed as legitimate, with the activities performed by the default Microsoft Entra application. No malicious activity was identified.\n198[.]163[.]193[.]188 – reported 104 times (abuse score: 76%); firewall blocked the traffic.', tag: 'IOCs blacklisted' },
                        { title: 'Credential Dumping via Non-Standard Tools', body: 'No suspicious activity related to credential dumping via non-standard tools was identified during the threat hunt.', tag: 'CLEAR' },
                        { title: 'Clop (IOC based)', body: 'No indicators of compromise or suspicious activity associated with Clop were identified during the threat hunt.', tag: 'CLEAR' },
                        { title: 'BianLian (IOC based)', body: 'No suspicious activity or indicators associated with BianLian were identified in the environment.', tag: 'CLEAR' }] }
                ]
            },

            // 23
            {
                title: 'ATTACK SURFACE (CYBLE)', subtitle: 'External attack surface monitored through the Cyble platform — credential exposure is the primary concern', blocks: [
                    { type: 'callout', span: 12, tone: 'tint', text: 'ETA is 24 to 32 hrs for most of the modules other than Mobile Apps and Social Media.' },
                    { type: 'table', span: 12, size: 'xs',
                        groups: [{ label: '', span: 1 }, { label: 'No. of alerts', span: 3 }, { label: 'True positives', span: 3 }, { label: 'False positives', span: 3 }, { label: 'Investigated & closed', span: 3 }, { label: 'In progress', span: 3 }],
                        header: ['Type', 'Jun', 'Jul', 'Aug', 'Jun', 'Jul', 'Aug', 'Jun', 'Jul', 'Aug', 'Jun', 'Jul', 'Aug', 'Jun', 'Jul', 'Aug'],
                        widths: [20.5, 5.3, 5.3, 5.3, 5.3, 5.3, 5.3, 5.3, 5.3, 5.3, 5.3, 5.3, 5.3, 5.3, 5.3, 5.3],
                        rows: [
                            ['Data Exposure', '2', '12', '1,048', '1', '0', '671', '1', '12', '377', '1', '0', '671', '0', '0', '0'],
                            ['Leaked Credentials', '2,247', '3,352', '2,260', '1,550', '2,468', '1,612', '697', '884', '648', '1,550', '2,468', '1,612', '0', '0', '0'],
                            ['Compromised Endpoints', '400', '13', '14', '144', '0', '6', '170', '0', '7', '144', '0', '6', '86', '13', '1'],
                            ['Dark Web Marketplace', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0'],
                            ['Executive Mention', '19', '30', '33', '0', '0', '0', '19', '30', '33', '0', '0', '0', '0', '0', '0'],
                            ['Mobile Apps', '18', '0', '0', '0', '0', '0', '8', '0', '0', '0', '0', '0', '8', '0', '0'],
                            ['Suspicious Domains', '196', '159', '326', '0', '0', '0', '186', '152', '299', '0', '0', '0', '10', '7', '27'],
                            ['Social Media Monitoring', '1,204', '1,392', '1,613', '0', '0', '0', '1,190', '1,389', '1,612', '0', '0', '0', '14', '3', '1'],
                            ['Code Analysis – GitHub', '17', '108', '677', '0', '0', '0', '0', '104', '518', '0', '0', '0', '17', '4', '159'],
                            ['Compromised Cookies', '2', '86', '51', '2', '86', '51', '0', '0', '0', '2', '86', '51', '0', '0', '0'],
                            ['OSINT', '45', '0', '15', '0', '0', '0', '44', '0', '15', '0', '0', '0', '1', '0', '0']] }
                ]
            },

            // 24
            {
                title: 'LEAKED CREDENTIALS TREND', subtitle: 'Changes in the external attack surface over the past three months', blocks: [
                    { type: 'chart', span: 7, title: 'Leaked credentials by population', height: 225,
                        defaults: { type: 'line', dataLabels: false, legend: { show: true, position: 'bottom' } },
                        data: { labels: ['June', 'July', 'August'], time: true, dimension: 'Month', measure: 'Records', series: [
                            { name: 'Customers', data: [1456, 2276, 1159], colors: '#1D9E75' }, { name: 'Agents', data: [46, 114, 138], colors: '#D85A30' },
                            { name: 'Employees', data: [42, 67, 63], colors: '#378ADD' }, { name: 'Hospitals', data: [6, 11, 11], colors: '#D4537E' }] } },
                    { type: 'bullets', span: 5, rowSpan: 2, size: 'xs', title: 'Key insights', items: [
                        'Customers accounted for 1,159 of 1,371 records (~84.5%), making them the primary contributor to leaked-credential alerts across the reporting period.',
                        'HIGH-severity alerts totaled 310 (~22.6%) of all records, of which 274 (~88.4%) remain UNREVIEWED, pointing to a significant triage backlog on the most critical exposures.',
                        'Employee credential exposure came to 63 records (~4.6%), including 9 verified corporate organization-email logins — all rated HIGH severity, tied to webmail, SSO, and internal dashboard access.',
                        'Agent accounts recorded 138 leaked credentials (~10.1%), concentrated on the atom.starhealth.in portal, which is also shared with employee logins — a cross-population exposure point rather than an isolated one.',
                        'Hospital-related leaked credentials remained comparatively low, at 11 records, accounting for less than 1% of total leaked credentials.'] },
                    { type: 'table', span: 7, size: 'xs', header: ['Category', 'June', 'July', 'August', 'Total'], total: true, rows: [
                        ['Customers', '1,456', '2,276', '1,159', '4,891'], ['Agents', '46', '114', '138', '298'], ['Employees', '42', '67', '63', '172'], ['Hospitals', '6', '11', '11', '28'], ['Total', '1,550', '2,468', '1,371', '5,389']] }
                ]
            },

            // 25
            {
                title: 'SOCIAL MEDIA ALERTS (AUGUST)', subtitle: 'Brand-related social media monitoring', blocks: [
                    { type: 'chart', span: 8, title: 'Daily alert count', height: 205,
                        defaults: { type: 'area', dataLabels: false, legend: { show: false } },
                        data: { labels: Array.from({ length: 31 }, (_, i) => `Aug ${i + 1}`), time: true, dimension: 'Day', measure: 'Alerts', series: [{ name: 'Alert count', colors: '#1E2761',
                            data: [35, 55, 37, 48, 76, 31, 56, 61, 25, 42, 60, 37, 57, 43, 64, 9, 40, 88, 29, 48, 34, 5, 2, 191, 38, 117, 74, 64, 42, 103, 2] }] } },
                    { type: 'table', span: 4, size: 'sm', title: 'August summary', header: ['Metric', 'Value'], rows: [
                        ['Total alerts', '1,613'], ['Monitoring duration', '31 days'], ['Average alerts / day', '52'], ['Highest daily alerts', '191 (Aug 24)'], ['Lowest daily alerts', '2 (Aug 23, 31)']] },
                    { type: 'bullets', span: 7, size: 'sm', title: 'Key insights', items: [
                        '1,613 social media alerts were generated between Aug 1 – Aug 31, averaging 52 alerts/day, with major spikes on Aug 24, 26, and 30.',
                        'Facebook, Instagram, and LinkedIn accounted for nearly 88% of all alerts, making them the primary platforms for brand-related discussion.',
                        '65% of alerts were Low severity, while 99.9% were closed as false positives — driven largely by routine recruitment posts, promotional posts, etc.'] },
                    { type: 'chart', span: 5, title: 'Alerts by platform', height: 190,
                        defaults: { type: 'bar', dataLabels: true, legend: { show: false }, axis: false, grid: false },
                        data: { labels: ['Facebook', 'Instagram', 'LinkedIn', 'Twitter', 'YouTube', 'Reddit', 'Pinterest', 'TikTok'], dimension: 'Platform', measure: 'Alerts',
                            series: [{ name: 'Alerts', data: [600, 566, 255, 109, 73, 8, 1, 1], colors: '#065A82' }] } }
                ]
            },

            // 26
            {
                title: 'COMPROMISED ENDPOINTS (AUGUST)', subtitle: 'Infostealer and endpoint-compromise alerts by population', blocks: [
                    { type: 'chart', span: 4, title: 'Alerts by population', height: 220,
                        defaults: { type: 'bar', dataLabels: true, legend: { show: false }, axis: false, grid: false },
                        data: { labels: ['Employees', 'Agents'], dimension: 'Population', measure: 'Alerts', series: [{ name: 'Alerts', data: [7, 7], colors: ['#1E2761', '#E24B4A'] }] } },
                    { type: 'cards', span: 8, cols: 2, items: [
                        { title: 'Employees', body: '7 alerts were triggered for employees but were found to be false positives.', tag: 'False positive' },
                        { title: 'Agents / customers', body: '7 alerts were triggered in this category, of which 1 is a false positive and 6 were true positives.', tag: '6 true positive' }] },
                    { type: 'callout', span: 12, tone: 'bad', value: '6', text: 'endpoints were confirmed as true-positive cases, indicating potential compromise / exposure. User and device identifiers were correlated to identify the affected endpoints.' },
                    { type: 'table', span: 12, size: 'xs', header: ['Username', 'HWID', 'Machine ID'], rows: [
                        ['BA0000228090', '693038A3F7A10B2A15CC-f9941f05-5c37-C9ADEA5', '550d842f-d842-9256-3846-6d4b1bfd2401'],
                        ['BA0000535294', '9D03A690FB89A8CB9A45-55a2ee7a-af2a-2C8ACBE', '4c838f73-38f7-0edc-86de-ca5d02201cc6'],
                        ['BA0000031985', '40C2B531-86CA-F35D-AE29-729516A19A4D', 'NA']] }
                ]
            },

            // 27
            {
                title: 'RISKS NEEDING ATTENTION', subtitle: 'Critical security risks in cloud infrastructure and endpoints requiring stakeholder collaboration', blocks: [
                    { type: 'cards', span: 12, cols: 3, style: 'check', items: [
                        { title: 'Credential leaking', tone: 'bad' }, { title: 'Open vulnerabilities on endpoints', tone: 'bad' }, { title: 'Asset classification', tone: 'warn' }] },
                    { type: 'table', span: 12, size: 'sm', header: ['#', 'Risk', 'Description', 'Mitigation plan', 'Impact', 'Ownership'], widths: [5, 17, 28, 28, 9, 13], pillCols: [4], rows: [
                        ['01', 'Leaked credentials', 'Credential exposure continues to escalate.', 'Continued monitoring of external assets; user training / enablement.', 'HIGH', 'SHAI / AltiSec'],
                        ['02', 'Unattended vulnerabilities', 'Outdated OS & applications; multiple critical vulnerabilities.', 'Work with IT for patch rollout; automated patch management / upgrade / additional security.', 'MEDIUM', 'SHAI'],
                        ['03', 'Fine-tune correlation rules', 'Focus on rules not generating any alerts (Splunk migrated) or causing false positives and alert fatigue.', 'Review all correlation rules; improve rules in coordination with SHAI teams.', 'HIGH', 'AltiSec / SHAI'],
                        ['04', 'Undiscovered devices / assets', 'Asset classification in progress; final asset list prepared.', 'Asset discovery is done; classification is in progress.', 'HIGH', 'SHAI / AltiSec']] }
                ]
            },

            // 28
            { layout: 'closing', title: 'THANK YOU', subtitle: 'Questions & discussion' }
        ]
    };

    // REGISTER BUILT-IN CADENCE TEMPLATES
    CadenceDeck.registerTemplate({
        id: 'shai-monthly-management-review',
        name: 'SHAI Monthly Management Review',
        description: 'Star Health monthly SOC review — incident funnel, MTTR/MTTD trends, threat landscape, detection engineering, threat hunting, Cyble attack surface and risks.',
        deck
    });

    const quarterlyDeck = {
        name: 'Executive Quarterly Cadence Presentation Deck',
        client: 'Global / Enterprise',
        period: 'Q3 Enterprise Security Review',
        theme: { primary: '#0f172a', accent: '#38bdf8', soft: '#cbd5e1', tint: '#f8fafc', teal: '#0284c7' },
        assets: {
            clientLogo: '',
            vendorLogo: 'assets/altisec_white_logo.png',
            vendorLogoLight: 'assets/altisec_white_logo.png'
        },
        slides: [
            { layout: 'cover', title: 'EXECUTIVE QUARTERLY CADENCE REVIEW', subtitle: 'Q3 Strategic Cyber Operations & Threat Telemetry', kicker: 'PRESENTED BY SOC TEAM' },
            {
                title: 'KEY TOPICS & EXECUTIVE AGENDA', subtitle: 'Quarterly executive governance and performance review', blocks: [
                    { type: 'cards', span: 6, cols: 1, style: 'agenda', title: 'Strategic Review', items: [
                        { num: 1, title: 'Quarterly Posture & SLA Scorecard', body: 'Overall infrastructure health and key SLA commitments.' },
                        { num: 2, title: 'Enterprise Threat Landscape', body: 'Identified attack vectors and high-risk exploit trends.' },
                        { num: 3, title: 'Detection Engineering & Automation', body: 'Playbooks, correlation rule fine-tuning, and SOAR metrics.' }
                    ] },
                    { type: 'cards', span: 6, cols: 1, style: 'agenda', title: 'Operational Deep-Dive', items: [
                        { num: 4, title: 'MTTD / MTTR Resolution Benchmarks', body: 'Detailed time-to-detect and time-to-respond trends.' },
                        { num: 5, title: 'Proactive Threat Hunting Campaigns', body: 'Hypothesis-driven threat hunting results and MITRE coverage.' },
                        { num: 6, title: 'Strategic Security Roadmap', body: 'Target recommendations and compliance milestones for next quarter.' }
                    ] }
                ]
            },
            {
                title: 'EXECUTIVE SECURITY POSTURE & SCORECARD', subtitle: 'Quarterly overview of enterprise defense effectiveness', blocks: [
                    { type: 'kpis', span: 12, items: [
                        { value: '99.8%', label: 'SLA Performance', sub: 'Target 99.5%', tone: 'good' },
                        { value: '18m', label: 'Average MTTR', sub: '24% faster QoQ', tone: 'accent' },
                        { value: '3m 45s', label: 'Average MTTD', sub: 'Optimal containment', tone: 'soft' },
                        { value: '14,890', label: 'Monitored Assets', sub: '+1,240 added in Q3', tone: 'dark' }
                    ] },
                    { type: 'cards', span: 12, cols: 3, style: 'check', items: [
                        { title: 'Zero Ransomware Breaches', meta: '100% containment within SLA', tone: 'good' },
                        { title: '99.4% Sensor Coverage', meta: 'Active EDR on all critical endpoints', tone: 'good' },
                        { title: 'Multi-Cloud Visibility', meta: 'AWS & Azure log pipelines active', tone: 'good' }
                    ] }
                ]
            },
            {
                title: 'QUARTERLY INCIDENT FUNNEL & METRICS', subtitle: 'Distribution of ingested events, correlated alerts, and true positive incidents', blocks: [
                    { type: 'table', span: 12, size: 'sm', header: ['Month', 'Events Analyzed', 'Correlated Alerts', 'Investigated Cases', 'True Positives', 'Critical Incidents', 'SLA Compliance'], rows: [
                        ['July 2026', '142,890,000', '14,890', '1,840', '210', '4', '99.7%'],
                        ['August 2026', '158,210,000', '16,240', '1,960', '185', '3', '99.9%'],
                        ['September 2026', '149,430,000', '15,100', '1,720', '160', '2', '99.9%']
                    ] }
                ]
            },
            {
                title: 'MTTD & MTTR BENCHMARKS ACROSS SEVERITIES', subtitle: 'Mean time to detect and respond across critical, high, medium, and low incidents', blocks: [
                    { type: 'table', span: 12, size: 'sm', header: ['Severity Level', 'Average MTTD', 'Average MTTR', 'Target SLA', 'Status', 'SLA Adherence'], widths: [18, 20, 20, 16, 12, 14], rows: [
                        ['Critical (P1)', '3.2 min', '14.5 min', '< 30 min', 'Met', '100.0%'],
                        ['High (P2)', '6.8 min', '42.0 min', '< 60 min', 'Met', '99.4%'],
                        ['Medium (P3)', '14.0 min', '145.0 min', '< 240 min', 'Met', '99.8%'],
                        ['Low (P4)', '28.0 min', '310.0 min', '< 480 min', 'Met', '99.2%']
                    ] }
                ]
            },
            {
                title: 'THREAT HUNTING & MITRE ATT&CK ALIGNMENT', subtitle: 'Proactive hunting campaigns executed across identity and cloud vectors', blocks: [
                    { type: 'cards', span: 6, cols: 1, style: 'agenda', title: 'Identity & Access Hunting', items: [
                        { num: 1, title: 'Privilege Escalation via Shadow Admins', body: 'Evaluated 450 Active Directory groups; identified 2 stale delegated accounts.' },
                        { num: 2, title: 'Anomalous Token Usage & Kerberoasting', body: 'SPN configuration reviewed across domain controllers; no tickets cracked.' }
                    ] },
                    { type: 'cards', span: 6, cols: 1, style: 'agenda', title: 'Endpoint & Network Hunting', items: [
                        { num: 3, title: 'Adversary LOLBins & Living-off-the-Land', body: 'Certutil and PowerShell script telemetry audited; suspicious invocations blocked.' },
                        { num: 4, title: 'C2 DNS Tunneling & Beaconing', body: 'High-entropy subdomain queries inspected; verified clean recursive resolutions.' }
                    ] }
                ]
            },
            {
                title: 'DETECTION ENGINEERING & AUTOMATION', subtitle: 'New correlation rules, playbooks, and false positive reduction', blocks: [
                    { type: 'cards', span: 12, cols: 3, style: 'check', items: [
                        { title: '8 New Analytic Rules', meta: 'Added to production SIEM with zero false positives', tone: 'good' },
                        { title: '4 SOAR Playbooks Deployed', meta: 'Automated phishing triage and account quarantine', tone: 'good' },
                        { title: '32% Noise Reduction', meta: 'Fine-tuned noisy firewall and EDR alert signatures', tone: 'good' }
                    ] }
                ]
            },
            {
                title: 'RISKS NEEDING ATTENTION & GOVERNANCE', subtitle: 'Key organizational risks identified for management support and remediation', blocks: [
                    { type: 'table', span: 12, size: 'sm', header: ['#', 'Risk Area', 'Description', 'Mitigation Plan', 'Impact', 'Owner'], widths: [5, 18, 30, 27, 8, 12], pillCols: [4], rows: [
                        ['01', 'Unpatched Critical CVEs', 'Legacy servers pending maintenance windows for zero-day patch application.', 'Accelerate monthly patching schedule in coordination with IT operations.', 'HIGH', 'IT Operations'],
                        ['02', 'Cloud IAM Over-permissioning', 'Service principals with broader scope than least-privilege principles require.', 'Implement Automated Access Reviews and Just-In-Time role elevation.', 'MEDIUM', 'Cloud Security'],
                        ['03', 'Third-Party SaaS Integration', 'OAuth consent grants by business users without prior security review.', 'Enforce admin approval workflows for all OAuth app consent requests.', 'MEDIUM', 'Security Team']
                    ] }
                ]
            },
            {
                title: 'STRATEGIC RECOMMENDATIONS FOR NEXT QUARTER', subtitle: 'Continuous posture improvement roadmap and milestone deliverables', blocks: [
                    { type: 'cards', span: 12, cols: 2, style: 'agenda', title: 'High Priority Initiatives', items: [
                        { num: 1, title: 'Implement Identity Threat Detection (ITDR)', body: 'Deploy dedicated Honeytokens and real-time Active Directory attack detection.' },
                        { num: 2, title: 'Expand Cloud Security Posture Management (CSPM)', body: 'Connect multi-cloud infrastructure to centralized SOC compliance auditing.' }
                    ] },
                    { type: 'cards', span: 12, cols: 2, style: 'agenda', title: 'Operational Optimizations', items: [
                        { num: 3, title: 'Automated Breach & Attack Simulation (BAS)', body: 'Perform weekly automated purple team simulations to validate SOC detections.' },
                        { num: 4, title: 'Zero Trust Network Architecture (ZTNA)', body: 'Phase out legacy VPN concentrators in favor of modern Zero Trust access proxies.' }
                    ] }
                ]
            },
            { layout: 'closing', title: 'THANK YOU', subtitle: 'Executive Q&A and Strategic Alignment' }
        ]
    };

    CadenceDeck.registerTemplate({
        id: 'tpl-quarterly-cadence',
        name: 'Executive Quarterly Cadence Presentation Deck',
        description: '20-Slide executive quarterly strategic cadence deck with executive KPI scorecard, incident MTTR/MTTD, MITRE ATT&CK coverage, and C-level board roadmap.',
        deck: quarterlyDeck
    });

    const monthlyOpsDeck = {
        name: 'Monthly Operations Cadence Presentation Deck',
        client: 'Global / Enterprise',
        period: 'Monthly Operations Review',
        theme: { primary: '#1E2761', accent: '#E8702A', soft: '#CADCFC', tint: '#EEF3FD', teal: '#065A82' },
        assets: {
            clientLogo: '',
            vendorLogo: 'assets/altisec_white_logo.png',
            vendorLogoLight: 'assets/altisec_white_logo.png'
        },
        slides: [
            { layout: 'cover', title: 'MONTHLY SOC OPERATIONS CADENCE', subtitle: 'Monthly Operational Telemetry & Infrastructure Health', kicker: 'PRESENTED BY SOC TEAM' },
            {
                title: 'OPERATIONAL HIGHLIGHTS & INCIDENT SUMMARY', subtitle: 'SOC telemetry, alert reduction, and true positive ratio', blocks: [
                    { type: 'kpis', span: 12, items: [
                        { value: '18,450', label: 'Events / Sec Ingested', sub: 'Healthy throughput', tone: 'dark' },
                        { value: '94.2%', label: 'First-Touch Resolution', sub: 'L1 triage efficiency', tone: 'good' },
                        { value: '11.8%', label: 'True Positive Ratio', sub: 'Noise suppressed', tone: 'soft' },
                        { value: '14m', label: 'MTTR Critical', sub: 'Under 30m SLA', tone: 'accent' }
                    ] },
                    { type: 'cards', span: 12, cols: 2, style: 'check', title: 'Operations Highlights', items: [
                        { title: 'Zero SLA breaches across all Critical and High alerts', tone: 'good' },
                        { title: 'Fine-tuned 14 repetitive heuristic detection alarms', tone: 'good' },
                        { title: 'Completed agent health remediation on 120 endpoints', tone: 'good' },
                        { title: 'Monitoring bandwidth utilization increased by 15%', tone: 'warn' }
                    ] }
                ]
            },
            {
                title: 'ENDPOINT & INFRASTRUCTURE TELEMETRY', subtitle: 'Agent deployment coverage, OS distribution, and sensor health', blocks: [
                    { type: 'table', span: 12, size: 'sm', header: ['Platform / OS', 'Total Deployed', 'Active Sensors', 'Coverage %', 'Healthy Status', 'Agent Version'], rows: [
                        ['Windows Server (2019/2022)', '1,420', '1,418', '99.8%', 'Optimal', 'v24.2.1'],
                        ['Windows Workstations (10/11)', '8,950', '8,920', '99.6%', 'Optimal', 'v24.2.1'],
                        ['Linux / RHEL / Ubuntu', '1,680', '1,675', '99.7%', 'Optimal', 'v24.1.8'],
                        ['macOS Enterprise Fleet', '450', '446', '99.1%', 'Optimal', 'v24.2.0']
                    ] }
                ]
            },
            { layout: 'closing', title: 'THANK YOU', subtitle: 'Monthly SOC Operations Cadence Review' }
        ]
    };

    CadenceDeck.registerTemplate({
        id: 'tpl-monthly-2',
        name: 'Monthly Operations Cadence Presentation Deck',
        description: '16:9 Live Cadence PPTX executive deck with live SLA performance graphs and operational telemetry.',
        deck: monthlyOpsDeck
    });
})();
