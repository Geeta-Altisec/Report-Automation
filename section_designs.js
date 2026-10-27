/**
 * section_designs.js
 * Multi-Layout Section Redesign Engine for Report Automation Studio.
 * Allows redesigning non-KPI sections (Risk Calculation, Foreword, Table of Contents,
 * Document Property, Confidentiality Clause, Governance Matrix, Cover Page) into
 * diverse, modern, executive layouts and templates with live interactive preview.
 * 
 * Strict Constraint: All KPI sections (overview, severity counts, trend charts,
 * alert names, MITRE, SLA response/resolution) are 100% managed by ChartEngine and excluded.
 */

// 1. STATE & PERSISTENCE
function ensureSectionDesignsState() {
    if (!window.AppState) window.AppState = {};
    if (!window.AppState.sectionDesigns) {
        try {
            window.AppState.sectionDesigns = JSON.parse(localStorage.getItem("altisec_section_designs") || "{}");
        } catch (e) {
            window.AppState.sectionDesigns = {};
        }
    }
    return window.AppState.sectionDesigns;
}

window.saveSectionDesigns = function() {
    try {
        ensureSectionDesignsState();
        localStorage.setItem("altisec_section_designs", JSON.stringify(window.AppState.sectionDesigns || {}));
    } catch (e) {
        console.warn("Error saving section designs:", e);
    }
};

window.getSectionDesign = function(secKey) {
    ensureSectionDesignsState();
    return (window.AppState.sectionDesigns && window.AppState.sectionDesigns[secKey]) || 'default';
};

// 2. DESIGNS DEFINITION REGISTRY
window.SECTION_DESIGNS = {
    risk: {
        title: "Risk Calculation",
        subtitle: "Redesign the Risk Rating matrix & criteria box into different layouts and visual styles",
        designs: [
            {
                id: "default",
                name: "Classic Color Matrix (Default)",
                badge: "DEFAULT",
                badgeClass: "badge-default",
                desc: "Original 4-row matrix table with bold blue header, colored severity cells, and detailed risk criteria."
            },
            {
                id: "modern-cards",
                name: "Modern Severity Cards",
                badge: "RECOMMENDED",
                badgeClass: "badge-rec",
                desc: "Four sleek horizontal cards with colored left accent borders, bold severity badges, and clean spacing."
            },
            {
                id: "matrix-grid",
                name: "2×2 Impact & Exploitability Grid",
                badge: "EXECUTIVE",
                badgeClass: "badge-exec",
                desc: "Balanced 2-column quadrant grid grouping Critical & High on top, Medium & Low below."
            },
            {
                id: "executive-pillars",
                name: "Executive Severity Pillars",
                badge: "MODERN",
                badgeClass: "badge-modern",
                desc: "Four vertical gauge columns with top severity meters, progress bars, and concise descriptions."
            },
            {
                id: "cyber-strips",
                name: "Cyber Security Threat Strips",
                badge: "TECH",
                badgeClass: "badge-tech",
                desc: "High-contrast tech-styled rows with monospace severity codes [P1 to P4] and SLA impact tags."
            }
        ]
    },
    foreword: {
        title: "Foreword & SOC Services",
        subtitle: "Redesign the Foreword narrative, Objectives, and Service Scope",
        designs: [
            {
                id: "default",
                name: "Classic Narrative & Lists (Default)",
                badge: "DEFAULT",
                badgeClass: "badge-default",
                desc: "Standard executive letter format with bulleted Security Operations & Incident Reporting sections."
            },
            {
                id: "executive-split",
                name: "Executive Split Cards",
                badge: "RECOMMENDED",
                badgeClass: "badge-rec",
                desc: "Two balanced cards: Objectives & Goals on the left, Security Operations & Reporting on the right."
            },
            {
                id: "highlight-banner",
                name: "Corporate Callout Banner",
                badge: "EXECUTIVE",
                badgeClass: "badge-exec",
                desc: "Navy blue executive banner with highlighted scope badges and structured 3-tier service metrics."
            }
        ]
    },
    toc: {
        title: "Table of Contents",
        subtitle: "Redesign the document index and page navigation",
        designs: [
            {
                id: "default",
                name: "Classic 2-Column Table (Default)",
                badge: "DEFAULT",
                badgeClass: "badge-default",
                desc: "Clean bordered table listing Section Title and Page Number."
            },
            {
                id: "cards-grid",
                name: "Modern Numbered Grid Cards",
                badge: "RECOMMENDED",
                badgeClass: "badge-rec",
                desc: "Two-column grid of numbered topic cards with blue page number badges."
            },
            {
                id: "compact-badges",
                name: "Executive Navigation Pills",
                badge: "COMPACT",
                badgeClass: "badge-modern",
                desc: "Sleek horizontal pill list with section icons and floating page markers."
            }
        ]
    },
    docprop: {
        title: "Document Property & SOC Team",
        subtitle: "Redesign metadata attributes and engagement team details",
        designs: [
            {
                id: "default",
                name: "Classic Stacked Tables (Default)",
                badge: "DEFAULT",
                badgeClass: "badge-default",
                desc: "Two separate structured tables for Document Property and SOC Engagement Team."
            },
            {
                id: "modern-roster",
                name: "Executive Metadata & Team Cards",
                badge: "RECOMMENDED",
                badgeClass: "badge-rec",
                desc: "Clean metadata chip card on top, and 2-column team member contact profile cards below."
            },
            {
                id: "side-by-side",
                name: "Side-by-Side Split Panel",
                badge: "COMPACT",
                badgeClass: "badge-exec",
                desc: "Document metadata on the left column (45%), SOC Engagement Team on the right column (55%)."
            }
        ]
    },
    confidentiality: {
        title: "Confidentiality Clause",
        subtitle: "Redesign the legal notice, disclosure policies, and confidentiality statement",
        designs: [
            {
                id: "default",
                name: "Classic Bulleted Points (Default)",
                badge: "DEFAULT",
                badgeClass: "badge-default",
                desc: "Five clear bulleted legal notices and copyright protection clauses."
            },
            {
                id: "shield-box",
                name: "Security Shield Notice Container",
                badge: "RECOMMENDED",
                badgeClass: "badge-rec",
                desc: "Bordered container featuring a security shield header, red CONFIDENTIAL badge, and organized clauses."
            },
            {
                id: "executive-callout",
                name: "Executive Slate Callout",
                badge: "EXECUTIVE",
                badgeClass: "badge-exec",
                desc: "Subtle slate-gray callout container with red left accent bar and formalized legal typography."
            }
        ]
    },
    governance: {
        title: "Governance Team Matrix",
        subtitle: "Redesign team escalation contacts and operational governance details",
        designs: [
            {
                id: "default",
                name: "Classic 4-Column Table (Default)",
                badge: "DEFAULT",
                badgeClass: "badge-default",
                desc: "Original matrix table displaying Name, Email, Contact Number, and Availability."
            },
            {
                id: "roster-cards",
                name: "24×7 Team Contact Cards",
                badge: "RECOMMENDED",
                badgeClass: "badge-rec",
                desc: "Two-column grid of member cards with 24×7 availability tags, email links, and phone badges."
            },
            {
                id: "tiered-hierarchy",
                name: "Tiered Operations Matrix",
                badge: "EXECUTIVE",
                badgeClass: "badge-exec",
                desc: "Lead Governance overview card on top with operational analyst escalation rows below."
            }
        ]
    },
    cover: {
        title: "Cover Page Theme",
        subtitle: "Redesign the primary report cover page artwork and typography theme",
        designs: [
            {
                id: "default",
                name: "Master Blue Shield (Default)",
                badge: "DEFAULT",
                badgeClass: "badge-default",
                desc: "Full-bleed glowing cyber security shield with deep blue circuit world map."
            },
            {
                id: "cyber-red",
                name: "Cyber Obsidian Red",
                badge: "RECOMMENDED",
                badgeClass: "badge-rec",
                desc: "Obsidian dark cover with glowing red neon borders and AltiSec red crest."
            },
            {
                id: "minimalist-dark",
                name: "Minimalist Executive Dark",
                badge: "EXECUTIVE",
                badgeClass: "badge-exec",
                desc: "Sleek slate-black executive layout with cyan accent framing."
            },
            {
                id: "corporate-white",
                name: "Corporate Clean White",
                badge: "LIGHT",
                badgeClass: "badge-modern",
                desc: "Clean white & navy corporate cover with high-contrast executive badge."
            }
        ]
    },
    highlights: {
        title: "Executive Telemetry Highlights",
        subtitle: "Redesign the telemetry insights and SLA adherence callout box into different executive templates",
        designs: [
            {
                id: "default",
                name: "Classic Left-Border Callout (Default)",
                badge: "DEFAULT",
                badgeClass: "badge-default",
                desc: "Original single callout container with blue left accent border, headline, and bulleted telemetry highlights."
            },
            {
                id: "modern-cards",
                name: "3-Column Executive Metric Cards",
                badge: "RECOMMENDED",
                badgeClass: "badge-rec",
                desc: "Three clean horizontal or multi-column cards separating Resolution Status, Severity Exposure, and SLA Adherence."
            },
            {
                id: "executive-badges",
                name: "Stat Badges Strip & Brief",
                badge: "EXECUTIVE",
                badgeClass: "badge-exec",
                desc: "High-impact top row with 3 numerical metric pills (Resolution %, Threat Levels, SLA 100%) paired with a structured brief below."
            },
            {
                id: "dark-cyber",
                name: "Cyber Defense Briefing Container",
                badge: "TECH",
                badgeClass: "badge-tech",
                desc: "Dark slate #0f172a terminal-grade container with cyan accents, glowing status indicators, and monospace tags."
            },
            {
                id: "compact-strip",
                name: "Compact Highlight Pills Strip",
                badge: "COMPACT",
                badgeClass: "badge-modern",
                desc: "Sleek horizontal 3-pillar banner designed to minimize page height while highlighting critical telemetry."
            }
        ]
    }
};

// 3. HTML GENERATORS FOR EACH SECTION DESIGN

// --- A. RISK CALCULATION DESIGNS ---
window.renderRiskCalculationDesign = function(prop, metrics) {
    const designId = window.getSectionDesign('risk');

    if (designId === 'modern-cards') {
        return `
            <div class="risk-design-modern-cards" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 22px;">
                <!-- Critical -->
                <div style="background: #fff5f5; border: 1.5px solid #fecaca; border-left: 6px solid #dc2626; border-radius: 8px; padding: 12px 16px; box-shadow: 0 2px 6px rgba(220,38,38,0.06);">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                        <span style="background: #dc2626; color: #ffffff; font-weight: 800; font-size: 11px; padding: 3px 12px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase;">CRITICAL</span>
                        <span style="font-size: 10px; font-weight: 700; color: #dc2626; background: #fee2e2; padding: 2px 8px; border-radius: 10px;">Immediate Mitigation</span>
                    </div>
                    <p style="font-size: 11px; line-height: 1.5; color: #1e293b; margin: 0;">
                        Considerably easy to exploit or gain/impact is Critical. Must be addressed on an urgent emergency basis; any suspicious potential attack is treated as Critical severity.
                    </p>
                </div>

                <!-- High -->
                <div style="background: #fffaf0; border: 1.5px solid #fed7aa; border-left: 6px solid #ea580c; border-radius: 8px; padding: 12px 16px; box-shadow: 0 2px 6px rgba(234,88,12,0.06);">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                        <span style="background: #ea580c; color: #ffffff; font-weight: 800; font-size: 11px; padding: 3px 12px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase;">HIGH</span>
                        <span style="font-size: 10px; font-weight: 700; color: #ea580c; background: #ffedd5; padding: 2px 8px; border-radius: 10px;">Moderate Exploit / High Impact</span>
                    </div>
                    <p style="font-size: 11px; line-height: 1.5; color: #1e293b; margin: 0;">
                        Ease of exploitation of the observed alert is Moderate, or the attack severity and overall resulting impact is considerably Moderate to High.
                    </p>
                </div>

                <!-- Medium -->
                <div style="background: #fefce8; border: 1.5px solid #fef08a; border-left: 6px solid #eab308; border-radius: 8px; padding: 12px 16px; box-shadow: 0 2px 6px rgba(234,179,8,0.06);">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                        <span style="background: #eab308; color: #000000; font-weight: 800; font-size: 11px; padding: 3px 12px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase;">MEDIUM</span>
                        <span style="font-size: 10px; font-weight: 700; color: #854d0e; background: #fef9c3; padding: 2px 8px; border-radius: 10px;">Standard SLA Schedule</span>
                    </div>
                    <p style="font-size: 11px; line-height: 1.5; color: #1e293b; margin: 0;">
                        Ease of exploitation of observed incidents is Medium. Events generated under Medium severity do not have an immediate operational impact on the organization.
                    </p>
                </div>

                <!-- Low -->
                <div style="background: #f0f9ff; border: 1.5px solid #bae6fd; border-left: 6px solid #0284c7; border-radius: 8px; padding: 12px 16px; box-shadow: 0 2px 6px rgba(2,132,199,0.06);">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                        <span style="background: #0284c7; color: #ffffff; font-weight: 800; font-size: 11px; padding: 3px 12px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase;">LOW</span>
                        <span style="font-size: 10px; font-weight: 700; color: #0369a1; background: #e0f2fe; padding: 2px 8px; border-radius: 10px;">Informational / Low Impact</span>
                    </div>
                    <p style="font-size: 11px; line-height: 1.5; color: #1e293b; margin: 0;">
                        Ease of exploitation is Low as the ease of exploitation is Low, having negligible immediate impact on business operations and infrastructure.
                    </p>
                </div>
            </div>
        `;
    }

    if (designId === 'matrix-grid') {
        return `
            <div class="risk-design-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 22px;">
                <!-- Top-Left: Critical -->
                <div style="background: #ffffff; border: 2px solid #dc2626; border-radius: 8px; padding: 14px; box-shadow: 0 2px 8px rgba(220,38,38,0.08);">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="width: 12px; height: 12px; border-radius: 50%; background: #dc2626; display: inline-block;"></span>
                        <strong style="color: #dc2626; font-size: 13px; font-weight: 800; text-transform: uppercase;">CRITICAL RATING</strong>
                    </div>
                    <p style="font-size: 11px; line-height: 1.5; color: #334155; margin: 0;">
                        Critical ease of exploitation or catastrophic impact. Action required immediately within urgent SOC escalation parameters.
                    </p>
                </div>

                <!-- Top-Right: High -->
                <div style="background: #ffffff; border: 2px solid #ea580c; border-radius: 8px; padding: 14px; box-shadow: 0 2px 8px rgba(234,88,12,0.08);">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="width: 12px; height: 12px; border-radius: 50%; background: #ea580c; display: inline-block;"></span>
                        <strong style="color: #ea580c; font-size: 13px; font-weight: 800; text-transform: uppercase;">HIGH RATING</strong>
                    </div>
                    <p style="font-size: 11px; line-height: 1.5; color: #334155; margin: 0;">
                        Moderate exploitability with substantial damage potential. Prioritized containment under standard SLA threshold.
                    </p>
                </div>

                <!-- Bottom-Left: Medium -->
                <div style="background: #ffffff; border: 2px solid #eab308; border-radius: 8px; padding: 14px; box-shadow: 0 2px 8px rgba(234,179,8,0.08);">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="width: 12px; height: 12px; border-radius: 50%; background: #eab308; display: inline-block;"></span>
                        <strong style="color: #854d0e; font-size: 13px; font-weight: 800; text-transform: uppercase;">MEDIUM RATING</strong>
                    </div>
                    <p style="font-size: 11px; line-height: 1.5; color: #334155; margin: 0;">
                        Moderate exposure without immediate operational breach. Scheduled resolution under business-hours operations.
                    </p>
                </div>

                <!-- Bottom-Right: Low -->
                <div style="background: #ffffff; border: 2px solid #0284c7; border-radius: 8px; padding: 14px; box-shadow: 0 2px 8px rgba(2,132,199,0.08);">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="width: 12px; height: 12px; border-radius: 50%; background: #0284c7; display: inline-block;"></span>
                        <strong style="color: #0284c7; font-size: 13px; font-weight: 800; text-transform: uppercase;">LOW RATING</strong>
                    </div>
                    <p style="font-size: 11px; line-height: 1.5; color: #334155; margin: 0;">
                        Low exploitability with informational significance. Tracked for telemetry and noise reduction audit logs.
                    </p>
                </div>
            </div>
        `;
    }

    if (designId === 'executive-pillars') {
        return `
            <div class="risk-design-pillars" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 22px;">
                <!-- Critical -->
                <div style="border: 1px solid #e2e8f0; border-top: 5px solid #dc2626; border-radius: 8px; padding: 12px; background: #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
                    <div style="font-weight: 800; font-size: 12px; color: #dc2626; text-align: center; margin-bottom: 6px;">CRITICAL</div>
                    <div style="height: 6px; background: #fee2e2; border-radius: 3px; overflow: hidden; margin-bottom: 10px;">
                        <div style="width: 100%; height: 100%; background: #dc2626;"></div>
                    </div>
                    <p style="font-size: 10px; line-height: 1.45; color: #475569; margin: 0;">
                        High exploit & severe impact. Requires urgent immediate remediation.
                    </p>
                </div>

                <!-- High -->
                <div style="border: 1px solid #e2e8f0; border-top: 5px solid #ea580c; border-radius: 8px; padding: 12px; background: #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
                    <div style="font-weight: 800; font-size: 12px; color: #ea580c; text-align: center; margin-bottom: 6px;">HIGH</div>
                    <div style="height: 6px; background: #ffedd5; border-radius: 3px; overflow: hidden; margin-bottom: 10px;">
                        <div style="width: 75%; height: 100%; background: #ea580c;"></div>
                    </div>
                    <p style="font-size: 10px; line-height: 1.45; color: #475569; margin: 0;">
                        Moderate exploit with significant operational damage potential.
                    </p>
                </div>

                <!-- Medium -->
                <div style="border: 1px solid #e2e8f0; border-top: 5px solid #eab308; border-radius: 8px; padding: 12px; background: #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
                    <div style="font-weight: 800; font-size: 12px; color: #854d0e; text-align: center; margin-bottom: 6px;">MEDIUM</div>
                    <div style="height: 6px; background: #fef9c3; border-radius: 3px; overflow: hidden; margin-bottom: 10px;">
                        <div style="width: 50%; height: 100%; background: #eab308;"></div>
                    </div>
                    <p style="font-size: 10px; line-height: 1.45; color: #475569; margin: 0;">
                        Moderate exposure with zero immediate organizational breach.
                    </p>
                </div>

                <!-- Low -->
                <div style="border: 1px solid #e2e8f0; border-top: 5px solid #0284c7; border-radius: 8px; padding: 12px; background: #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
                    <div style="font-weight: 800; font-size: 12px; color: #0284c7; text-align: center; margin-bottom: 6px;">LOW</div>
                    <div style="height: 6px; background: #e0f2fe; border-radius: 3px; overflow: hidden; margin-bottom: 10px;">
                        <div style="width: 25%; height: 100%; background: #0284c7;"></div>
                    </div>
                    <p style="font-size: 10px; line-height: 1.45; color: #475569; margin: 0;">
                        Low exploitability with minimal organizational risk.
                    </p>
                </div>
            </div>
        `;
    }

    if (designId === 'cyber-strips') {
        return `
            <div class="risk-design-cyber" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 22px;">
                <div style="display: grid; grid-template-columns: 140px 1fr 130px; align-items: center; background: #0f172a; color: #f8fafc; border-left: 5px solid #dc2626; border-radius: 6px; padding: 10px 14px;">
                    <span style="font-family: monospace; font-size: 12px; font-weight: 800; color: #f87171;">[P1-CRITICAL]</span>
                    <span style="font-size: 11px; color: #cbd5e1; padding: 0 12px;">Immediate threat to core infrastructure requiring emergency mitigation</span>
                    <span style="text-align: right; font-size: 10px; font-weight: 700; color: #dc2626; background: rgba(220,38,38,0.2); padding: 3px 8px; border-radius: 4px;">SLA: &lt; 15 mins</span>
                </div>

                <div style="display: grid; grid-template-columns: 140px 1fr 130px; align-items: center; background: #0f172a; color: #f8fafc; border-left: 5px solid #ea580c; border-radius: 6px; padding: 10px 14px;">
                    <span style="font-family: monospace; font-size: 12px; font-weight: 800; color: #fb923c;">[P2-HIGH]</span>
                    <span style="font-size: 11px; color: #cbd5e1; padding: 0 12px;">High exploitation probability with substantial impact potential</span>
                    <span style="text-align: right; font-size: 10px; font-weight: 700; color: #ea580c; background: rgba(234,88,12,0.2); padding: 3px 8px; border-radius: 4px;">SLA: &lt; 2 hours</span>
                </div>

                <div style="display: grid; grid-template-columns: 140px 1fr 130px; align-items: center; background: #0f172a; color: #f8fafc; border-left: 5px solid #eab308; border-radius: 6px; padding: 10px 14px;">
                    <span style="font-family: monospace; font-size: 12px; font-weight: 800; color: #fde047;">[P3-MEDIUM]</span>
                    <span style="font-size: 11px; color: #cbd5e1; padding: 0 12px;">Moderate exposure without immediate operational security breach</span>
                    <span style="text-align: right; font-size: 10px; font-weight: 700; color: #eab308; background: rgba(234,179,8,0.2); padding: 3px 8px; border-radius: 4px;">SLA: &lt; 8 hours</span>
                </div>

                <div style="display: grid; grid-template-columns: 140px 1fr 130px; align-items: center; background: #0f172a; color: #f8fafc; border-left: 5px solid #0284c7; border-radius: 6px; padding: 10px 14px;">
                    <span style="font-family: monospace; font-size: 12px; font-weight: 800; color: #38bdf8;">[P4-LOW]</span>
                    <span style="font-size: 11px; color: #cbd5e1; padding: 0 12px;">Low exploitability and informational awareness events</span>
                    <span style="text-align: right; font-size: 10px; font-weight: 700; color: #0284c7; background: rgba(2,132,199,0.2); padding: 3px 8px; border-radius: 4px;">SLA: &lt; 24 hours</span>
                </div>
            </div>
        `;
    }

    // Default Classic Table (exact reference design)
    return `
        <!-- RISK MATRIX TABLE (EXACT COLOR MATCHING REFERENCE SCREENSHOT) -->
        <table class="doc-table" style="border: 1px solid #000000; margin-bottom: 24px; width: 100%;">
            <thead>
                <tr style="background-color: #2563eb; color: #ffffff;">
                    <th style="width: 20%; background: #2563eb; color: #ffffff; text-align: center; font-weight: 700; border: 1px solid #000000; padding: 10px;">Rating</th>
                    <th style="background: #2563eb; color: #ffffff; font-weight: 700; border: 1px solid #000000; padding: 10px;">Description</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="background-color: #dc2626; color: #ffffff; font-weight: 800; text-align: center; border: 1px solid #000000; font-size: 12px; padding: 10px;">Critical</td>
                    <td style="border: 1px solid #000000; font-size: 10.5px; line-height: 1.5; color: #1e293b; padding: 10px;">
                        The security risk/Incidents/Case/event is Critical as either it is considerably easy to exploit the observed incidents & cases, or the gain/impact is Critical. This Incidents/Case should be fixed on an urgent basis. Any security Incidents/Case generated with this severity needs to be treated immediately. Any suspicious but potential attack will also be considered as Critical severity.
                    </td>
                </tr>
                <tr>
                    <td style="background-color: #ea580c; color: #000000; font-weight: 800; text-align: center; border: 1px solid #000000; font-size: 12px; padding: 10px;">High</td>
                    <td style="border: 1px solid #000000; font-size: 10.5px; line-height: 1.5; color: #1e293b; padding: 10px;">
                        The security risk/Incidents/Case/event is High as the ease of exploitation of the observed incidents & cases is Moderate, or the attack severity and the overall resulting impact is considerably Moderate.
                    </td>
                </tr>
                <tr>
                    <td style="background-color: #eab308; color: #000000; font-weight: 800; text-align: center; border: 1px solid #000000; font-size: 12px; padding: 10px;">Medium</td>
                    <td style="border: 1px solid #000000; font-size: 10.5px; line-height: 1.5; color: #1e293b; padding: 10px;">
                        The security risk/Incidents/Case/event is Medium as the ease of exploitation of observed incidents & cases and its exposure is Medium. Furthermore, events generated under medium severity are not having any immediate impact on the organization and its data.
                    </td>
                </tr>
                <tr>
                    <td style="background-color: #00aeef; color: #000000; font-weight: 800; text-align: center; border: 1px solid #000000; font-size: 12px; padding: 10px;">Low</td>
                    <td style="border: 1px solid #000000; font-size: 10.5px; line-height: 1.5; color: #1e293b; padding: 10px;">
                        The security risk/Incidents/Case/event is Low as the ease of exploitation of observed incidents & cases and its exposure is Low. Furthermore, events generated under Low severity are not having any immediate impact on the organization and its data.
                    </td>
                </tr>
            </tbody>
        </table>
    `;
};

// --- B. FOREWORD DESIGNS ---
window.renderForewordDesign = function(prop) {
    const designId = window.getSectionDesign('foreword');
    const client = prop.clientName || 'TENANT';

    if (designId === 'executive-split') {
        return `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 20px;">
                <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-top: 4px solid #1e3a8a; border-radius: 8px; padding: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                        <i class="fa-solid fa-bullseye" style="color: #1e3a8a; font-size: 16px;"></i>
                        <strong style="color: #1e3a8a; font-size: 13px; font-weight: 800; text-transform: uppercase;">Objectives & Goals</strong>
                    </div>
                    <p style="font-size: 10.5px; color: #334155; line-height: 1.55; margin: 0;">
                        Our consultants are highly focused towards eliminating the noise (unwanted traffic, Incidents/Cases) by identifying and prioritizing real actionable threats and help <strong>${client}</strong> to take necessary preventive actions for the reported tickets that may put the business at risk.
                    </p>
                </div>

                <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-top: 4px solid #dc2626; border-radius: 8px; padding: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                        <i class="fa-solid fa-shield-halved" style="color: #dc2626; font-size: 16px;"></i>
                        <strong style="color: #dc2626; font-size: 13px; font-weight: 800; text-transform: uppercase;">Security Operations & Reporting</strong>
                    </div>
                    <ul style="font-size: 10.5px; color: #334155; line-height: 1.55; margin: 0 0 0 16px; padding: 0;">
                        <li style="margin-bottom: 6px;">Continuous 24*7 monitoring, detection, and proactive triage across infrastructure.</li>
                        <li>Incident risk severity analysis with root-cause documentation for leadership.</li>
                    </ul>
                </div>
            </div>
        `;
    }

    if (designId === 'highlight-banner') {
        return `
            <div style="margin-top: 20px;">
                <div style="background: linear-gradient(135deg, #0b1329 0%, #1e3a8a 100%); color: #ffffff; border-radius: 8px; padding: 18px 22px; margin-bottom: 16px; box-shadow: 0 4px 14px rgba(11,19,41,0.2);">
                    <div style="font-size: 11px; font-weight: 800; color: #38bdf8; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 4px;">24*7 MDR SERVICE DIRECTIVE</div>
                    <div style="font-size: 15px; font-weight: 800; margin-bottom: 8px;">Managed Detection & Response for ${client}</div>
                    <p style="font-size: 10.5px; color: #e2e8f0; line-height: 1.5; margin: 0;">
                        Proactive threat containment, automated telemetry triage, and prioritized incident mitigation.
                    </p>
                </div>

                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px;">
                    <strong style="color: #0f172a; font-size: 11.5px; display: block; margin-bottom: 6px;">Key Service Pillars:</strong>
                    <ul style="font-size: 10.5px; color: #334155; line-height: 1.6; margin: 0 0 0 16px; padding: 0;">
                        <li>Real-time event analysis and false-positive suppression.</li>
                        <li>Top 10 Security Risks and ticket SLAs communicated systematically.</li>
                        <li>Detailed technical analysis provided with root-cause recommendations.</li>
                    </ul>
                </div>
            </div>
        `;
    }

    // Default format
    return `
        <div style="margin-top: 24px;">
            <strong style="font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #0f172a; display: block;">${client}</strong>
            <strong style="font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; color: #0f172a; display: block; margin-bottom: 14px;">SOC SERVICES:</strong>

            <strong style="color: #1e3a8a; font-size: 11px; display: block; margin-top: 14px;">Objectives & Goals:</strong>
            <p style="font-size: 10.5px; color: #334155; line-height: 1.5; margin-top: 4px;">
                Our consultants are highly focused towards eliminating the noise (unwanted traffic, Incidents/Cases) by identifying and prioritizing real actionable threats and help <strong>${client}</strong> to take necessary preventive actions for the reported tickets that may put the business at risk.
            </p>

            <strong style="color: #1e3a8a; font-size: 11px; display: block; margin-top: 14px;">Security Operations:</strong>
            <ul style="font-size: 10.5px; color: #334155; line-height: 1.6; margin: 4px 0 0 18px; padding: 0;">
                <li>Our Security Operations Center (SOC) activities and reports are tracked, reviewed, and communicated on a periodic basis to capture SOC performance and enhancements over time.</li>
                <li>Top 10 Security Risks, Daily Incidents & cases Tickets are all logged, tracked.</li>
            </ul>

            <strong style="color: #1e3a8a; font-size: 11px; display: block; margin-top: 14px;">Incidents & cases Reporting:</strong>
            <ul style="font-size: 10.5px; color: #334155; line-height: 1.6; margin: 4px 0 0 18px; padding: 0;">
                <li>Our incidents & cases reporting strategies with root cause analysis helps <strong>${client}</strong> management to document significant security risks to information processing assets.</li>
                <li>The incidents & cases reports clearly communicate incidents & cases type, incident risk & cases risk and severity, and specific event details covering a detailed technical analysis of the incidents & cases analyzed by our consultants.</li>
            </ul>
        </div>
    `;
};

// --- C. TABLE OF CONTENTS DESIGNS ---
window.renderTocDesign = function(prop) {
    const designId = window.getSectionDesign('toc');
    const items = [
        { num: '1', title: 'FOREWORD', page: '2' },
        { num: '2', title: 'RISK CALCULATION', page: '3' },
        { num: '3', title: 'TABLE OF CONTENTS', page: '4' },
        { num: '4', title: 'DOCUMENT PROPERTY & SOC ENGAGEMENT TEAM', page: '5' },
        { num: '5', title: 'CONFIDENTIALITY CLAUSE', page: '6' },
        { num: '6', title: 'OVERVIEW OF INCIDENTS & CASES', page: '7' },
        { num: '7', title: 'OPEN CASE DETAILS & OVERALL SEVERITY COUNT', page: '8' },
        { num: '8', title: 'INCIDENTS/CASES CREATED TREND', page: '9' },
        { num: '9', title: 'INCIDENTS/CASES SENT BASED ON ALERT NAMES', page: '10' },
        { num: '10', title: 'MITRE ATT&CK TACTICS & TECHNIQUES', page: '11' },
        { num: '11', title: 'INCIDENTS/CASE CATEGORY', page: '12' },
        { num: '12', title: 'INCIDENTS/CASES BASED ON ASSET TYPE', page: '13' },
        { num: '13', title: 'SLA COMPLIANCE & HOSTNAMES', page: '14' },
        { num: '14', title: 'PERFORMANCE METRICS (MTTR/MTTD/MTTA)', page: '15' },
        { num: '15', title: 'GOVERNANCE TEAM MATRIX', page: '16' }
    ];

    if (designId === 'cards-grid') {
        let cardsHtml = items.map(item => `
            <div style="background: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid #0284c7; border-radius: 6px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 4px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: 800; color: #0284c7; font-size: 11px; min-width: 18px;">${item.num}.</span>
                    <span style="font-weight: 700; color: #1e293b; font-size: 10.5px;">${item.title}</span>
                </div>
                <span style="background: #0f172a; color: #ffffff; font-weight: 800; font-size: 10px; padding: 2px 8px; border-radius: 4px;">P.${item.page}</span>
            </div>
        `).join('');
        return `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px;">${cardsHtml}</div>`;
    }

    if (designId === 'compact-badges') {
        let pillsHtml = items.map(item => `
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 20px; padding: 4px 12px; display: flex; justify-content: space-between; align-items: center; font-size: 10px;">
                <span style="font-weight: 700; color: #334155;">${item.num}. ${item.title}</span>
                <span style="font-weight: 800; color: #0284c7; margin-left: 6px;">${item.page}</span>
            </div>
        `).join('');
        return `<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 20px;">${pillsHtml}</div>`;
    }

    // Default table
    let rowsHtml = items.map(item => `
        <tr><td>${item.num}. ${item.title}</td><td style="text-align: center; font-weight: 700;">${item.page}</td></tr>
    `).join('');
    return `
        <table class="doc-table" style="margin-bottom: 20px; width: 100%;">
            <thead>
                <tr><th>Section Title</th><th width="20%" style="text-align: center;">Page No.</th></tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    `;
};

// --- D. DOCUMENT PROPERTY & SOC TEAM DESIGNS ---
window.renderDocpropDesign = function(prop) {
    const designId = window.getSectionDesign('docprop');

    if (designId === 'modern-roster') {
        return `
            <div style="margin-bottom: 22px;">
                <!-- Property Card -->
                <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 14px 18px; margin-bottom: 18px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
                    <div><span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700;">Tenant</span><div style="font-size: 12px; font-weight: 800; color: #0f172a; margin-top: 2px;">${prop.clientName}</div></div>
                    <div><span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700;">Period</span><div style="font-size: 12px; font-weight: 800; color: #0f172a; margin-top: 2px;">${prop.reportingPeriod}</div></div>
                    <div><span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700;">Contact</span><div style="font-size: 12px; font-weight: 800; color: #0284c7; margin-top: 2px;">soc@alticyber.com</div></div>
                    <div><span style="font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700;">Status</span><div style="font-size: 12px; font-weight: 800; color: #16a34a; margin-top: 2px;"><i class="fa-solid fa-circle-check"></i> ${prop.status || 'Final'}</div></div>
                </div>

                <!-- SOC Team Roster Cards -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span style="font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase;">SOC Engagement Team</span>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                    <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-left: 4px solid #1e3a8a; border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; gap: 12px;">
                        <div style="width: 36px; height: 36px; border-radius: 50%; background: #1e3a8a; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px;">SJ</div>
                        <div>
                            <div style="font-weight: 800; font-size: 12.5px; color: #0f172a;">Saachi Joshi</div>
                            <div style="font-size: 10.5px; color: #64748b; font-weight: 600;">Governance Lead</div>
                            <div style="font-size: 10px; color: #0284c7; margin-top: 2px;"><i class="fa-solid fa-envelope"></i> saachi.j@alticyber.com</div>
                        </div>
                    </div>
                    <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-left: 4px solid #0284c7; border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; gap: 12px;">
                        <div style="width: 36px; height: 36px; border-radius: 50%; background: #0284c7; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px;">SA</div>
                        <div>
                            <div style="font-weight: 800; font-size: 12.5px; color: #0f172a;">Shaktiprasad Anami</div>
                            <div style="font-size: 10.5px; color: #64748b; font-weight: 600;">SOC Manager</div>
                            <div style="font-size: 10px; color: #0284c7; margin-top: 2px;"><i class="fa-solid fa-envelope"></i> shaktiprasad.a@alticyber.com</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    if (designId === 'side-by-side') {
        return `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 22px;">
                <!-- Document Properties Column -->
                <div>
                    <div class="doc-section-heading" style="margin-bottom: 8px;">DOCUMENT PROPERTY</div>
                    <table class="doc-table">
                        <tr><th width="35%">Property</th><th>Value</th></tr>
                        <tr><td>Tenant</td><td><strong>${prop.clientName}</strong></td></tr>
                        <tr><td>Period</td><td>${prop.reportingPeriod}</td></tr>
                        <tr><td>Contact</td><td>email - soc@alticyber.com</td></tr>
                        <tr><td>Status</td><td>${prop.status || 'Final'}</td></tr>
                    </table>
                </div>

                <!-- SOC Team Column -->
                <div>
                    <div class="doc-section-heading" style="margin-bottom: 8px;">SOC ENGAGEMENT TEAM</div>
                    <table class="doc-table">
                        <thead>
                            <tr><th>Analyst Name</th><th>Roles</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>Saachi Joshi</td><td>Governance Lead</td></tr>
                            <tr><td>Shaktiprasad Anami</td><td>SOC Manager</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // Default 2 tables
    return `
        <div class="doc-section-heading" style="margin-bottom: 8px;">DOCUMENT PROPERTY</div>
        <table class="doc-table" style="margin-bottom: 18px;">
            <tr><th width="30%">Property</th><th>Value</th></tr>
            <tr><td>Tenant</td><td><strong>${prop.clientName} (Weekly - SOC)</strong></td></tr>
            <tr><td>Period</td><td>${prop.reportingPeriod}</td></tr>
            <tr><td>Contact</td><td>email - soc@alticyber.com</td></tr>
            <tr><td>Status</td><td>${prop.status || 'Final'}</td></tr>
        </table>

        <div class="doc-section-heading" style="margin-top:20px; margin-bottom: 8px;">SOC ENGAGEMENT TEAM</div>
        <table class="doc-table" style="margin-bottom: 18px;">
            <thead>
                <tr><th>Analyst Name</th><th>Roles</th><th>Email ID</th></tr>
            </thead>
            <tbody>
                <tr><td>Saachi Joshi</td><td>Governance Lead</td><td>saachi.j@alticyber.com</td></tr>
                <tr><td>Shaktiprasad Anami</td><td>SOC Manager</td><td>shaktiprasad.a@alticyber.com</td></tr>
            </tbody>
        </table>
    `;
};

// --- E. CONFIDENTIALITY CLAUSE DESIGNS ---
window.renderConfidentialityDesign = function(prop) {
    const designId = window.getSectionDesign('confidentiality');
    const client = prop.clientName || 'TENANT';

    if (designId === 'shield-box') {
        return `
            <div style="background: #ffffff; border: 2px solid #cbd5e1; border-radius: 10px; padding: 22px 26px; margin-top: 14px; margin-bottom: 22px; box-shadow: 0 4px 14px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fa-solid fa-shield-halved" style="color: #0284c7; font-size: 22px;"></i>
                        <strong style="color: #0f172a; font-size: 15px; font-weight: 800;">INFORMATION SECURITY & CONFIDENTIALITY</strong>
                    </div>
                    <span style="background: #fee2e2; color: #dc2626; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 4px; letter-spacing: 0.5px;">STRICTLY CONFIDENTIAL</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px; font-size: 11px; color: #334155; line-height: 1.55;">
                    <div>• No part of this publication may be reproduced or translated into any language in any form by any means without the written permission of ALTISEC TECHNOLOGIES PVT. LTD.</div>
                    <div>• The security tickets/events denoted in this report can be shared or used by <strong>${client}</strong> authorized personnel for their internal usage or to meet any compliance requirement.</div>
                    <div>• This document provides detailed information about security operations services offered to <strong>${client}</strong> and related Information Technology environment and is therefore considered <strong>CONFIDENTIAL</strong>.</div>
                    <div>• It also contains detailed information about some of ALTISEC TECHNOLOGIES PVT. LTD. methodologies, customer information, and relevant corporate data.</div>
                    <div>• Products or corporate names used in the report are trademarks or registered trademarks of respective companies.</div>
                </div>
            </div>
        `;
    }

    if (designId === 'executive-callout') {
        return `
            <div style="background: #f8fafc; border-left: 6px solid #dc2626; border-radius: 8px; padding: 18px 22px; margin-top: 14px; margin-bottom: 22px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                    <i class="fa-solid fa-lock" style="color: #dc2626; font-size: 16px;"></i>
                    <strong style="font-size: 13.5px; font-weight: 800; color: #0f172a; text-transform: uppercase;">Legal Notice & Non-Disclosure Declaration</strong>
                </div>
                <p style="font-size: 11px; color: #334155; line-height: 1.6; margin: 0 0 10px 0;">
                    This document and all associated telemetry records are produced exclusively for <strong>${client}</strong>. Unauthorized copying, distribution, or extraction of proprietary ALTISEC TECHNOLOGIES methodologies is strictly prohibited under international copyright law.
                </p>
                <div style="font-size: 10.5px; color: #64748b; line-height: 1.5;">
                    All trademarks and brand names referenced herein remain the property of their respective owners and are utilized for identification purposes only.
                </div>
            </div>
        `;
    }

    // Default bullet points
    return `
        <ul style="font-size: 11.5px; color: #334155; line-height: 1.65; margin: 16px 0 22px 20px; padding: 0;">
            <li style="margin-bottom: 12px;">No part of this publication may be reproduced or translated into any language in any form by any means without the written permission of ALTISEC TECHNOLOGIES PVT. LTD.</li>
            <li style="margin-bottom: 12px;">The security tickets/events denoted in this report can be shared or used by <strong>${client}</strong> authorized personnel for their internal usage or to meet any compliance requirement.</li>
            <li style="margin-bottom: 12px;">While every precaution has been taken in the preparation of this document, of ALTISEC TECHNOLOGIES PVT. LTD. assumes no responsibility for errors, omissions, or for damages resulting from the use of the information herein.</li>
            <li style="margin-bottom: 12px;">This document provides detailed information about security operations services offered to <strong>${client}</strong> and related Information Technology environment and is therefore considered <strong style="color:#dc2626;">CONFIDENTIAL</strong>. It also contains detailed information about some of ALTISEC TECHNOLOGIES PVT. LTD. methodologies. It contains customer information, resource's details, and relevant corporate information. Appropriate discretion is advised when sharing this information with third parties.</li>
            <li>Products or corporate names used in the report are trademarks or registered trademarks of respective companies and are used only for a better explanation and to the owner's benefit, without intent to infringe.</li>
        </ul>
    `;
};

// --- F. GOVERNANCE TEAM MATRIX DESIGNS ---
window.renderGovernanceDesign = function(prop) {
    const designId = window.getSectionDesign('governance');
    const members = [
        { name: "Saachi Joshi", email: "saachi.j@alticyber.com", phone: "7756830187", avail: "9:30am to 7:30pm", role: "Governance Lead", isMgr: false },
        { name: "Vaishnavi Wani", email: "vaishnavi.wani@alticyber.com", phone: "9373575754", avail: "9:30am to 7:30pm", role: "SOC Analyst", isMgr: false },
        { name: "Rushikesh Vitkar", email: "rushikesh.v@alticyber.com", phone: "9359825245", avail: "9:30am to 7:30pm", role: "Security Consultant", isMgr: false },
        { name: "Sahil Shriwas", email: "Sahil.Shriwas@alticyber.com", phone: "9322953009", avail: "9:30am to 7:30pm", role: "Incident Handler", isMgr: false },
        { name: "Shaktiprasad Anami", email: "shaktiprasad.a@alticyber.com", phone: "8088783957", avail: "24×7", role: "SOC Manager", isMgr: true }
    ];

    if (designId === 'roster-cards') {
        let cardsHtml = members.map(m => `
            <div style="background: #ffffff; border: 1.5px solid ${m.isMgr ? '#0284c7' : '#e2e8f0'}; border-radius: 8px; padding: 12px 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                    <div>
                        <strong style="font-size: 12px; color: #0f172a; display: block;">${m.name}</strong>
                        <span style="font-size: 10px; color: #64748b; font-weight: 600;">${m.role}</span>
                    </div>
                    <span style="background: ${m.avail === '24×7' ? '#dcfce7' : '#f1f5f9'}; color: ${m.avail === '24×7' ? '#15803d' : '#475569'}; font-size: 9.5px; font-weight: 800; padding: 2px 8px; border-radius: 10px;">
                        <i class="fa-solid fa-clock"></i> ${m.avail}
                    </span>
                </div>
                <div style="font-size: 10.5px; color: #334155; margin-top: 6px; display: flex; flex-direction: column; gap: 3px;">
                    <div><i class="fa-solid fa-envelope" style="color: #0284c7; width: 14px;"></i> ${m.email}</div>
                    <div><i class="fa-solid fa-phone" style="color: #16a34a; width: 14px;"></i> ${m.phone}</div>
                </div>
            </div>
        `).join('');
        return `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">${cardsHtml}</div>`;
    }

    // Default 4-column table
    if (window.AppState && window.AppState.customTableData && window.AppState.customTableData['governance']) {
        return `
            <table class="doc-table governance-matrix-table" data-table-key="governance" style="margin-bottom: 20px; width: 100%;">
                ${window.AppState.customTableData['governance']}
            </table>
        `;
    }

    let rowsHtml = members.map(m => `
        <tr>
            <td style="font-weight: 700; color: #0f172a;"><i class="fa-solid fa-circle-user" style="color:#0284c7; margin-right:6px;"></i>${m.name} ${m.isMgr ? '<span style="font-size:10px; color:#64748b; display:block;">(SOC Manager)</span>' : ''}</td>
            <td><a href="mailto:${m.email}" style="color: #0284c7; text-decoration: none;"><i class="fa-solid fa-envelope" style="margin-right:4px;"></i>${m.email}</a></td>
            <td><i class="fa-solid fa-phone" style="color:#16a34a; margin-right:4px;"></i>${m.phone}</td>
            <td style="font-weight: 700;"><i class="fa-solid fa-calendar-days" style="color:#64748b; margin-right:4px;"></i>${m.avail}</td>
        </tr>
    `).join('');
    return `
        <table class="doc-table governance-matrix-table" data-table-key="governance" style="margin-bottom: 20px; width: 100%;">
            <thead>
                <tr style="background-color: #0b1329; color: #ffffff;">
                    <th>NAME</th>
                    <th>EMAIL ID</th>
                    <th>CONTACT NUMBER</th>
                    <th>AVAILABILITY</th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    `;
};

// --- G. COVER PAGE DESIGNS ---
window.renderCoverDesign = function(prop) {
    const designId = window.getSectionDesign('cover');
    const client = (prop?.clientName || 'ALTISEC CLIENT').toUpperCase();
    const period = prop?.reportingPeriod || 'JUNE 2026';
    const date = prop?.reportDate || '11TH JUNE 2026';

    if (designId === 'cyber-red') {
        return `
            <div style="background: #09090b; border: 2px solid #ef4444; border-radius: 8px; padding: 40px 20px; text-align: center; color: #ffffff; box-shadow: 0 0 20px rgba(239,68,68,0.25);">
                <div style="color: #ef4444; font-size: 26px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase;">${client}</div>
                <div style="color: #ffffff; font-size: 18px; font-weight: 800; margin-top: 10px; letter-spacing: 1px;">SOC MDR REPORT</div>
                <div style="color: #f87171; font-size: 13px; font-weight: 700; margin-top: 14px; text-transform: uppercase;">${period}</div>
                <div style="color: #a1a1aa; font-size: 11px; margin-top: 6px;">DATE: ${date}</div>
            </div>
        `;
    }
    if (designId === 'minimalist-dark') {
        return `
            <div style="background: #020617; border-left: 6px solid #38bdf8; border-radius: 8px; padding: 40px 24px; color: #ffffff;">
                <div style="color: #38bdf8; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;">SECURITY OPERATIONS REPORT</div>
                <div style="color: #f8fafc; font-size: 26px; font-weight: 900; margin-top: 8px; text-transform: uppercase;">${client}</div>
                <div style="color: #94a3b8; font-size: 13px; font-weight: 600; margin-top: 12px;">REPORTING TIMELINE: ${period}</div>
                <div style="color: #64748b; font-size: 11px; margin-top: 4px;">ISSUANCE DATE: ${date}</div>
            </div>
        `;
    }
    if (designId === 'corporate-white') {
        return `
            <div style="background: #ffffff; border: 2px solid #0f172a; border-radius: 8px; padding: 40px 24px; text-align: center; color: #0f172a;">
                <div style="display: inline-block; background: #0f172a; color: #ffffff; font-size: 10px; font-weight: 800; padding: 4px 12px; border-radius: 20px; letter-spacing: 1px; margin-bottom: 12px;">OFFICIAL SOC AUDIT</div>
                <div style="font-size: 26px; font-weight: 900; text-transform: uppercase; color: #0f172a;">${client}</div>
                <div style="font-size: 16px; font-weight: 700; color: #0284c7; margin-top: 8px;">MDR SECURITY OPERATIONS</div>
                <div style="font-size: 12px; color: #475569; margin-top: 12px; font-weight: 600;">PERIOD: ${period}</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 4px;">DATE: ${date}</div>
            </div>
        `;
    }

    // Default
    return `
        <div style="background: linear-gradient(135deg, #0b1329 0%, #1e3a8a 100%); border-radius: 8px; padding: 40px 20px; text-align: center; color: #ffffff;">
            <div style="font-size: 26px; font-weight: 800; text-transform: uppercase; color: #ffffff; text-shadow: 0 2px 10px rgba(0,0,0,0.5);">${client}</div>
            <div style="font-size: 18px; font-weight: 800; margin-top: 10px; color: #38bdf8;">SOC REPORT</div>
            <div style="font-size: 13px; font-weight: 700; margin-top: 12px; color: #e2e8f0;">${period}</div>
            <div style="font-size: 11px; margin-top: 4px; color: #94a3b8;">DATE: ${date}</div>
        </div>
    `;
};

// --- H. EXECUTIVE TELEMETRY HIGHLIGHTS DESIGNS ---
window.renderTelemetryHighlightsDesign = function(prop, metrics) {
    const designId = window.getSectionDesign('highlights');
    prop = prop || {};
    metrics = metrics || {};
    
    const total = metrics.totalIncidents !== undefined ? Number(metrics.totalIncidents) : 0;
    const open = metrics.openIncidents !== undefined ? Number(metrics.openIncidents) : 0;
    const closed = metrics.closedIncidents !== undefined ? Number(metrics.closedIncidents) : 0;
    const closedPct = total > 0 ? Math.round((closed / total) * 100) : (total === 0 ? 100 : 0);
    const sevCrit = Number(metrics.sevCritical) || 0;
    const sevHigh = Number(metrics.sevHigh) || 0;
    const sevMed = Number(metrics.sevMedium) || 0;
    const sevLow = Number(metrics.sevLow) || 0;
    const lowMedPct = total > 0 ? (((sevMed + sevLow) / total) * 100).toFixed(1) : "0.0";

    const resText = prop.highlight1 || (
        total === 0
            ? `<strong>Zero Telemetry Recorded:</strong> No security incident tickets recorded for this reporting period. Upload an Excel spreadsheet or sync from Viz 360 to populate live operational data.`
            : (open === 0
                ? `<strong>100% Incident Resolution:</strong> All <strong>${total}</strong> security incidents logged during the reporting period have been analyzed, mitigated, and closed with zero pending customer tickets.`
                : `<strong>${closedPct}% Incident Resolution:</strong> <strong>${closed}</strong> of <strong>${total}</strong> security incidents logged during the reporting period have been resolved, with <strong>${open}</strong> open ticket(s) under active monitoring.`)
    );

    const sevText = prop.highlight2 || (
        total === 0
            ? `<strong>Severity Distribution:</strong> Telemetry registers 0 Critical, 0 High, 0 Medium, and 0 Low incidents awaiting data ingestion.`
            : `<strong>Severity Distribution:</strong> Medium (${sevMed}) and Low (${sevLow}) severity cases constituted ${lowMedPct}% of telemetry. The ${sevHigh} High severity ticket(s) and ${sevCrit} Critical ticket(s) were resolved within SOC parameters.`
    );

    const slaText = prop.highlight3 || (
        `<strong>SLA Compliance:</strong> SOC Response & Detection times maintained <strong>100% SLA Adherence</strong> with zero SLA breaches recorded.`
    );

    const btnHtml = window.renderSectionDesignsButton('highlights');

    // Layout 1: 3-Column Executive Metric Cards
    if (designId === 'modern-cards') {
        return `
            <div class="telemetry-highlights-container" style="margin-top: 10px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 14px; color: #0f172a; text-transform: uppercase;">
                        <i class="fa-solid fa-chart-line" style="color: #0284c7;"></i> EXECUTIVE TELEMETRY HIGHLIGHTS
                    </div>
                    ${btnHtml}
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                    <!-- Resolution Card -->
                    <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-top: 4px solid #16a34a; border-radius: 8px; padding: 12px 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
                        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                            <i class="fa-solid fa-circle-check" style="color: #16a34a; font-size: 13px;"></i>
                            <strong style="color: #16a34a; font-size: 11.5px; text-transform: uppercase; font-weight: 800;">Resolution Status</strong>
                        </div>
                        <div data-telemetry-highlight="resolution" style="font-size: 11px; color: #334155; line-height: 1.5;">${resText}</div>
                    </div>

                    <!-- Severity Distribution Card -->
                    <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-top: 4px solid #ea580c; border-radius: 8px; padding: 12px 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
                        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                            <i class="fa-solid fa-shield-halved" style="color: #ea580c; font-size: 13px;"></i>
                            <strong style="color: #ea580c; font-size: 11.5px; text-transform: uppercase; font-weight: 800;">Severity Breakdown</strong>
                        </div>
                        <div style="font-size: 11px; color: #334155; line-height: 1.5;">${sevText}</div>
                    </div>

                    <!-- SLA Adherence Card -->
                    <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-top: 4px solid #0284c7; border-radius: 8px; padding: 12px 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
                        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                            <i class="fa-solid fa-clock-rotate-left" style="color: #0284c7; font-size: 13px;"></i>
                            <strong style="color: #0284c7; font-size: 11.5px; text-transform: uppercase; font-weight: 800;">SLA Adherence</strong>
                        </div>
                        <div style="font-size: 11px; color: #334155; line-height: 1.5;">${slaText}</div>
                    </div>
                </div>
            </div>
        `;
    }

    // Layout 2: Stat Badges Strip & Brief
    if (designId === 'executive-badges') {
        const resLabel = total === 0 ? "0 Recorded" : (open === 0 ? "100% Closed" : `${closedPct}% Closed`);
        const sevLabel = (sevCrit === 0 && sevHigh === 0) ? "Clean Posture" : `${sevCrit} Crit / ${sevHigh} High`;
        return `
            <div class="telemetry-highlights-container" style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 14px 18px; margin-top: 10px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #f1f5f9;">
                    <div style="display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 14px; color: #0f172a; text-transform: uppercase;">
                        <i class="fa-solid fa-chart-line" style="color: #0284c7;"></i> EXECUTIVE TELEMETRY HIGHLIGHTS
                    </div>
                    ${btnHtml}
                </div>

                <!-- 3 Top Stat Badges -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px;">
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-size: 10px; font-weight: 700; color: #166534; text-transform: uppercase;">Resolution</span>
                        <span style="font-size: 12px; font-weight: 800; color: #15803d; background: #ffffff; padding: 2px 8px; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">${resLabel}</span>
                    </div>
                    <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-size: 10px; font-weight: 700; color: #9a3412; text-transform: uppercase;">Risk Exposure</span>
                        <span style="font-size: 12px; font-weight: 800; color: #c2410c; background: #ffffff; padding: 2px 8px; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">${sevLabel}</span>
                    </div>
                    <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-size: 10px; font-weight: 700; color: #075985; text-transform: uppercase;">SLA Adherence</span>
                        <span style="font-size: 12px; font-weight: 800; color: #0284c7; background: #ffffff; padding: 2px 8px; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">100% Rate</span>
                    </div>
                </div>

                <!-- Structured Bullet Brief -->
                <ul style="font-size: 12px; color: #334155; line-height: 1.6; margin: 0 0 0 16px; padding: 0;">
                    <li data-telemetry-highlight="resolution">${resText}</li>
                    <li>${sevText}</li>
                    <li>${slaText}</li>
                </ul>
            </div>
        `;
    }

    // Layout 3: Dark Cyber Defense Briefing Container
    if (designId === 'dark-cyber') {
        return `
            <div class="telemetry-highlights-container" style="background: #0f172a; border: 1.5px solid rgba(56,189,248,0.4); border-left: 5px solid #38bdf8; border-radius: 8px; padding: 14px 18px; margin-top: 10px; margin-bottom: 12px; box-shadow: 0 4px 14px rgba(0,0,0,0.25); color: #f8fafc;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 13.5px; color: #38bdf8; letter-spacing: 0.5px; text-transform: uppercase;">
                        <i class="fa-solid fa-terminal" style="color: #38bdf8;"></i> [SOC DIRECTIVE] EXECUTIVE TELEMETRY HIGHLIGHTS
                    </div>
                    ${btnHtml}
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px; line-height: 1.55; color: #cbd5e1;">
                    <div style="background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 8px 12px;" data-telemetry-highlight="resolution">
                        <i class="fa-solid fa-angle-right" style="color: #38bdf8; margin-right: 6px;"></i> ${resText}
                    </div>
                    <div style="background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 8px 12px;">
                        <i class="fa-solid fa-angle-right" style="color: #fb923c; margin-right: 6px;"></i> ${sevText}
                    </div>
                    <div style="background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 8px 12px;">
                        <i class="fa-solid fa-angle-right" style="color: #4ade80; margin-right: 6px;"></i> ${slaText}
                    </div>
                </div>
            </div>
        `;
    }

    // Layout 4: Compact Highlight Pills Strip
    if (designId === 'compact-strip') {
        return `
            <div class="telemetry-highlights-container" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; margin-top: 10px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 6px; font-weight: 800; font-size: 12.5px; color: #0f172a; text-transform: uppercase;">
                        <i class="fa-solid fa-chart-line" style="color: #0284c7;"></i> Telemetry Highlights
                    </div>
                    ${btnHtml}
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; font-size: 11px; line-height: 1.45; color: #334155;" data-telemetry-highlight="resolution">
                        ${resText}
                    </div>
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; font-size: 11px; line-height: 1.45; color: #334155;">
                        ${sevText}
                    </div>
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; font-size: 11px; line-height: 1.45; color: #334155;">
                        ${slaText}
                    </div>
                </div>
            </div>
        `;
    }

    // Default: Classic Left-Border Callout
    return `
        <div class="telemetry-highlights-box" style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-left: 5px solid #0284c7; border-radius: 8px; padding: 14px 18px; margin-top: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <div style="display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 15px; color: #0f172a; text-transform: uppercase;">
                    <i class="fa-solid fa-chart-line" style="color: #0284c7;"></i> EXECUTIVE TELEMETRY HIGHLIGHTS
                </div>
                ${btnHtml}
            </div>
            <ul style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 0 16px; padding: 0;">
                <li data-telemetry-highlight="resolution">${resText}</li>
                <li>${sevText}</li>
                <li>${slaText}</li>
            </ul>
        </div>
    `;
};

// 4. BUTTON RENDERER FOR NON-KPI SECTIONS
window.renderSectionDesignsButton = function(sectionKey) {
    if (!sectionKey || !window.SECTION_DESIGNS[sectionKey]) return '';
    return `
        <button type="button" class="btn-section-designs" onclick="openSectionDesignPicker('${sectionKey}')" title="Redesign this section with different layouts & templates" data-html2canvas-ignore="true">
            <i class="fa-solid fa-palette"></i> Designs
        </button>
    `;
};

// 5. INTERACTIVE SECTION DESIGN PICKER CONTROLLER
let activeDesignSectionKey = null;
let currentSelectedDesignId = 'default';

window.openSectionDesignPicker = function(sectionKey) {
    activeDesignSectionKey = sectionKey;
    const def = window.SECTION_DESIGNS[sectionKey];
    if (!def) return;

    currentSelectedDesignId = window.getSectionDesign(sectionKey);

    const modal = document.getElementById("sectionDesignModal");
    if (!modal) {
        initSectionDesignModalDOM();
    }
    
    document.getElementById("secDesignModalTitle").textContent = `Redesign: ${def.title}`;
    document.getElementById("secDesignModalSubtitle").textContent = def.subtitle;

    // Render cards list
    renderDesignOptionCards(def);
    // Render live preview box
    renderDesignLivePreview(sectionKey, currentSelectedDesignId);

    const m = document.getElementById("sectionDesignModal");
    if (m) {
        m.classList.remove("hidden");
        m.style.display = "flex";
    }
};

window.closeSectionDesignModal = function() {
    const modal = document.getElementById("sectionDesignModal");
    if (modal) {
        modal.classList.add("hidden");
        modal.style.display = "none";
    }
    activeDesignSectionKey = null;
};

function renderDesignOptionCards(def) {
    const container = document.getElementById("secDesignOptionsList");
    if (!container) return;

    let html = '';
    def.designs.forEach(d => {
        const isSelected = d.id === currentSelectedDesignId;
        html += `
            <div class="sec-design-card ${isSelected ? 'selected' : ''}" onclick="selectDesignOption('${d.id}')" data-design-id="${d.id}">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="radio" name="secDesignRadio" value="${d.id}" ${isSelected ? 'checked' : ''} style="cursor: pointer;">
                        <strong style="color: #f8fafc; font-size: 13.5px;">${d.name}</strong>
                    </div>
                    <span class="sec-design-badge ${d.badgeClass || ''}">${d.badge}</span>
                </div>
                <p style="font-size: 11.5px; color: #94a3b8; line-height: 1.45; margin: 0 0 0 24px;">
                    ${d.desc}
                </p>
            </div>
        `;
    });
    container.innerHTML = html;
}

window.selectDesignOption = function(designId) {
    currentSelectedDesignId = designId;
    
    // Update card selection styling
    document.querySelectorAll(".sec-design-card").forEach(c => {
        const isThis = c.dataset.designId === designId;
        c.classList.toggle("selected", isThis);
        const radio = c.querySelector("input[type=radio]");
        if (radio) radio.checked = isThis;
    });

    // Update live preview in real time
    if (activeDesignSectionKey) {
        renderDesignLivePreview(activeDesignSectionKey, designId);
    }
};

function renderDesignLivePreview(sectionKey, designId) {
    const previewContainer = document.getElementById("secDesignLivePreviewContent");
    if (!previewContainer) return;

    ensureSectionDesignsState();
    const prop = window.AppState?.properties || { clientName: 'ALTISEC CLIENT' };
    const metrics = window.AppState?.metrics || {};

    let previewHtml = '';

    // Temporarily simulate section design
    const origDesign = window.AppState.sectionDesigns ? window.AppState.sectionDesigns[sectionKey] : null;
    if (window.AppState.sectionDesigns) {
        window.AppState.sectionDesigns[sectionKey] = designId;
    }

    if (sectionKey === 'risk') {
        previewHtml = window.renderRiskCalculationDesign(prop, metrics);
    } else if (sectionKey === 'foreword') {
        previewHtml = window.renderForewordDesign(prop);
    } else if (sectionKey === 'toc') {
        previewHtml = window.renderTocDesign(prop);
    } else if (sectionKey === 'docprop') {
        previewHtml = window.renderDocpropDesign(prop);
    } else if (sectionKey === 'confidentiality') {
        previewHtml = window.renderConfidentialityDesign(prop);
    } else if (sectionKey === 'governance') {
        previewHtml = window.renderGovernanceDesign(prop);
    } else if (sectionKey === 'cover') {
        previewHtml = window.renderCoverDesign(prop);
    } else if (sectionKey === 'highlights') {
        previewHtml = window.renderTelemetryHighlightsDesign(prop, metrics);
    } else {
        previewHtml = `<div style="padding: 20px; color: #64748b; text-align: center;">Preview available for ${sectionKey} (${designId})</div>`;
    }

    // Restore state
    if (window.AppState.sectionDesigns) {
        if (origDesign) window.AppState.sectionDesigns[sectionKey] = origDesign;
        else delete window.AppState.sectionDesigns[sectionKey];
    }

    previewContainer.innerHTML = previewHtml;
}

window.applyCurrentSectionDesign = function() {
    if (!activeDesignSectionKey) return;

    if (!window.AppState.sectionDesigns) window.AppState.sectionDesigns = {};
    window.AppState.sectionDesigns[activeDesignSectionKey] = currentSelectedDesignId;
    window.saveSectionDesigns();

    // Re-render report canvas
    if (typeof renderLivePreview === 'function') {
        renderLivePreview();
    }

    const secTitle = window.SECTION_DESIGNS[activeDesignSectionKey]?.title || 'Section';
    if (typeof showToast === 'function') {
        showToast(`✨ Applied "${currentSelectedDesignId}" design to ${secTitle}!`);
    }

    closeSectionDesignModal();
};

window.resetCurrentSectionDesignToDefault = function() {
    if (!activeDesignSectionKey) return;

    if (!window.AppState.sectionDesigns) window.AppState.sectionDesigns = {};
    window.AppState.sectionDesigns[activeDesignSectionKey] = 'default';
    window.saveSectionDesigns();

    if (typeof renderLivePreview === 'function') {
        renderLivePreview();
    }

    const secTitle = window.SECTION_DESIGNS[activeDesignSectionKey]?.title || 'Section';
    if (typeof showToast === 'function') {
        showToast(`🔄 Reset ${secTitle} to default layout!`);
    }

    closeSectionDesignModal();
};

// 6. INITIALIZE MODAL DOM IF NOT PRESENT
function initSectionDesignModalDOM() {
    if (document.getElementById("sectionDesignModal")) return;

    const modal = document.createElement("div");
    modal.id = "sectionDesignModal";
    modal.className = "modal-overlay hidden";
    modal.setAttribute("data-html2canvas-ignore", "true");
    modal.style.cssText = "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(7,10,17,0.88); backdrop-filter:blur(10px); z-index:10015; display:none; align-items:center; justify-content:center; padding:20px;";

    modal.innerHTML = `
        <div class="modal-card" style="width:100%; max-width:980px; max-height:90vh; background:#0f172a; border:1px solid rgba(56,189,248,0.4); border-radius:14px; box-shadow:0 25px 60px rgba(0,0,0,0.65); display:flex; flex-direction:column; overflow:hidden;">
            <!-- Header -->
            <div style="display:flex; justify-content:space-between; align-items:center; padding:18px 24px; border-bottom:1px solid rgba(255,255,255,0.08); background:rgba(15,23,42,0.98);">
                <div>
                    <h3 id="secDesignModalTitle" style="margin:0; font-size:18px; font-weight:800; color:#f8fafc; display:flex; align-items:center; gap:10px;">
                        <i class="fa-solid fa-palette" style="color:#38bdf8;"></i> Redesign Section
                    </h3>
                    <p id="secDesignModalSubtitle" style="margin:4px 0 0 0; font-size:12.5px; color:#94a3b8;">Choose a layout template for this section</p>
                </div>
                <button type="button" onclick="closeSectionDesignModal()" style="background:transparent; border:none; color:#94a3b8; font-size:20px; cursor:pointer;" aria-label="Close modal">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <!-- Two-Column Body: Options on Left, Live Preview on Right -->
            <div style="display:grid; grid-template-columns:360px 1fr; flex:1; overflow:hidden;">
                <!-- Left: Design Options List -->
                <div style="padding:18px; border-right:1px solid rgba(255,255,255,0.08); overflow-y:auto; display:flex; flex-direction:column; gap:10px;" id="secDesignOptionsList">
                    <!-- Option cards rendered dynamically -->
                </div>

                <!-- Right: Interactive Live Preview Box -->
                <div style="padding:18px; background:#070b13; overflow-y:auto; display:flex; flex-direction:column;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <span style="font-size:11px; font-weight:800; color:#38bdf8; letter-spacing:0.5px; text-transform:uppercase;">
                            <i class="fa-solid fa-eye"></i> Live Interactive Preview
                        </span>
                        <span style="font-size:10.5px; color:#64748b;">Rendered with report data</span>
                    </div>

                    <!-- White Canvas Container simulating report page -->
                    <div style="background:#ffffff; border-radius:6px; padding:24px; box-shadow:0 8px 30px rgba(0,0,0,0.5); flex:1;" id="secDesignLivePreviewContent">
                        <!-- Preview injected dynamically -->
                    </div>
                </div>
            </div>

            <!-- Footer: Reset on Left, Cancel & Apply on Right -->
            <div style="padding:14px 24px; border-top:1px solid rgba(255,255,255,0.08); background:rgba(15,23,42,0.98); display:flex; justify-content:space-between; align-items:center;">
                <button type="button" class="btn" onclick="resetCurrentSectionDesignToDefault()" style="background:transparent; border:1px solid #475569; color:#94a3b8; padding:8px 16px; border-radius:6px; font-size:12.5px; font-weight:700; cursor:pointer;">
                    <i class="fa-solid fa-rotate-left"></i> Reset to Default
                </button>

                <div style="display:flex; gap:10px;">
                    <button type="button" class="btn" onclick="closeSectionDesignModal()" style="background:#1e293b; border:1px solid #334155; color:#f8fafc; padding:8px 18px; border-radius:6px; font-size:12.5px; font-weight:700; cursor:pointer;">
                        Cancel
                    </button>
                    <button type="button" class="btn btn-primary" onclick="applyCurrentSectionDesign()" style="background:#0284c7; border:none; color:#ffffff; padding:8px 22px; border-radius:6px; font-size:12.5px; font-weight:800; cursor:pointer; box-shadow:0 2px 8px rgba(2,132,199,0.35);">
                        <i class="fa-solid fa-check"></i> Apply Design
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener("DOMContentLoaded", initSectionDesignModalDOM);
    } else {
        initSectionDesignModalDOM();
    }
}
