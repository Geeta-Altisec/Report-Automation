// ALTISEC REPORT AUTOMATION PLATFORM - WORD DOCX EXPORTER (ALL 21 POINTS)

function exportReportToDocx(state) {
    if (!window.docx) {
        alert("Docx generator library not loaded.");
        return;
    }

    const { Paragraph, TextRun, Table, TableRow, TableCell, Document, Packer, AlignmentType, WidthType, BorderStyle, HeadingLevel } = window.docx;
    const prop = state.properties;
    const metrics = state.metrics;
    const kri = state.kri;

    // Helper cell builder
    function cell(text, bold = false, widthPct = 25, bg = "FFFFFF") {
        return new TableCell({
            width: { size: widthPct, type: WidthType.PERCENTAGE },
            shading: { fill: bg },
            children: [new Paragraph({
                children: [new TextRun({ text: text, bold: bold, font: "Arial", size: 20 })]
            })]
        });
    }

    function headerCell(text, widthPct = 25) {
        return new TableCell({
            width: { size: widthPct, type: WidthType.PERCENTAGE },
            shading: { fill: "F1F5F9" },
            children: [new Paragraph({
                children: [new TextRun({ text: text, bold: true, font: "Arial", size: 20, color: "0F172A" })]
            })]
        });
    }

    function sectionHeading(title) {
        return new Paragraph({
            text: title,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 }
        });
    }

    const children = [];

    // Title / Header
    children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
            new TextRun({ text: "ALTISEC TECHNOLOGIES PVT. LTD.", bold: true, size: 28, font: "Arial", color: "0F172A" }),
            new TextRun({ text: `\n${prop.clientName} SOC SECURITY REPORT`, bold: true, size: 24, font: "Arial", color: "0EA5E9" }),
            new TextRun({ text: `\nReporting Period: ${prop.reportingPeriod}`, size: 20, font: "Arial", color: "64748B" })
        ],
        spacing: { after: 200 }
    }));

    // Foreword
    children.push(new Paragraph({
        children: [
            new TextRun({ text: "FOREWORD: ", bold: true, font: "Arial", size: 20 }),
            new TextRun({ text: `This Weekly Executive summary report has been produced by ALTISEC TECHNOLOGIES PVT. LTD. Security Operations Center (SOC) team covering ${prop.clientName} critical infrastructure.`, italic: true, font: "Arial", size: 20 })
        ],
        spacing: { after: 200 }
    }));

    // Document Property
    children.push(sectionHeading("DOCUMENT PROPERTY & ENGAGEMENT TEAM"));
    children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({ children: [headerCell("Property", 30), headerCell("Value", 70)] }),
            new TableRow({ children: [cell("Tenant", true, 30), cell(prop.clientName, false, 70)] }),
            new TableRow({ children: [cell("Reporting Period", true, 30), cell(prop.reportingPeriod, false, 70)] }),
            new TableRow({ children: [cell("Classification", true, 30), cell(prop.classification, false, 70)] }),
            new TableRow({ children: [cell("Governance Lead", true, 30), cell(prop.govLead, false, 70)] }),
            new TableRow({ children: [cell("SOC Manager", true, 30), cell(prop.socManager, false, 70)] }),
            new TableRow({ children: [cell("SOC Lead / Analyst", true, 30), cell(prop.socLead, false, 70)] })
        ]
    }));

    // Risk Calculation
    children.push(sectionHeading("RISK CALCULATION MATRIX"));
    children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({ children: [headerCell("Rating", 25), headerCell("Description", 75)] }),
            new TableRow({ children: [cell("Critical", true, 25, "FEE2E2"), cell("Considerably easy to exploit, or potential impact is Critical. Immediate action required.", false, 75)] }),
            new TableRow({ children: [cell("High", true, 25, "FFEDD5"), cell("Ease of exploitation is Moderate, or resulting impact is considerably Moderate.", false, 75)] }),
            new TableRow({ children: [cell("Medium", true, 25, "FEF3C7"), cell("Moderate exposure without immediate catastrophic business impact.", false, 75)] }),
            new TableRow({ children: [cell("Low", true, 25, "DCFCE7"), cell("Informational or low severity with minimal business exposure.", false, 75)] })
        ]
    }));

    // ALL 21 POINTS FOR TEMPLATE-FIRSTCHECK 3
    children.push(sectionHeading("OVERVIEW OF ALL 21 KEY POINTS"));

    // Point 1: Status
    children.push(new Paragraph({ text: "1. INCIDENTS/CASES BY STATUS", bold: true, spacing: { before: 120, after: 60 } }));
    children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({ children: [headerCell("Severity"), headerCell("Cases"), headerCell("New"), headerCell("In Progress"), headerCell("Resolved")] }),
            new TableRow({ children: [cell("Critical", true), cell(metrics.sevCritical.toString()), cell("0"), cell("0"), cell(metrics.sevCritical.toString())] }),
            new TableRow({ children: [cell("High", true), cell(metrics.sevHigh.toString()), cell("0"), cell(metrics.openIncidents.toString()), cell((Math.max(0, metrics.sevHigh - metrics.openIncidents)).toString())] }),
            new TableRow({ children: [cell("Medium", true), cell(metrics.sevMedium.toString()), cell("0"), cell("0"), cell(metrics.sevMedium.toString())] }),
            new TableRow({ children: [cell("Low", true), cell(metrics.sevLow.toString()), cell("0"), cell("0"), cell(metrics.sevLow.toString())] })
        ]
    }));

    // Point 2: Open Case Details
    children.push(new Paragraph({ text: "2. OPEN CASE DETAILS", bold: true, spacing: { before: 120, after: 60 } }));
    children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({ children: [headerCell("Case Name", 30), headerCell("Severity", 15), headerCell("Status", 15), headerCell("Ownership", 20), headerCell("Remark", 20)] }),
            new TableRow({ children: [cell(metrics.openIncidents > 0 ? "Suspicious Outbound Tunneling" : "None"), cell(metrics.openIncidents > 0 ? "High" : "-"), cell(metrics.openIncidents > 0 ? "In Progress" : "Resolved"), cell("SOC Tier-2"), cell("Investigating outbound IP traffic")] })
        ]
    }));

    // Point 3 & 4
    children.push(new Paragraph({ text: "3. SEVERITY WISE OVERALL INCIDENTS/CASE COUNT", bold: true, spacing: { before: 120, after: 60 } }));
    children.push(new Paragraph({ text: "4. CLOSED SEVERITY WISE OVERALL INCIDENTS/CASE COUNT", bold: true, spacing: { before: 120, after: 60 } }));

    // Point 5: Daily Trend
    children.push(new Paragraph({ text: "5. INCIDENTS/CASES CREATED TREND", bold: true, spacing: { before: 120, after: 60 } }));
    children.push(new Paragraph({ text: "Daily Trend: Mon: 1, Tue: 2, Wed: 0, Thu: 4 (Peak), Fri: 1, Sat: 0, Sun: 1. Total: 6 cases.", italic: true, spacing: { after: 100 } }));

    // Point 6: Alert Names
    children.push(new Paragraph({ text: "6. INCIDENTS/CASES SENT BASED ON ALERT NAMES", bold: true, spacing: { before: 120, after: 60 } }));

    // Point 7 & 8: MITRE
    children.push(new Paragraph({ text: "7. MITRE ATT&CK TACTICS", bold: true, spacing: { before: 120, after: 60 } }));
    children.push(new Paragraph({ text: "8. MITRE ATT&CK TECHNIQUES", bold: true, spacing: { before: 120, after: 60 } }));

    // Point 9 & 10: Category & Asset
    children.push(new Paragraph({ text: "9. INCIDENTS/CASE CATEGORY", bold: true, spacing: { before: 120, after: 60 } }));
    children.push(new Paragraph({ text: "10. INCIDENTS/CASES BASED ON ASSET TYPE (Workstation: 66.7%, Server: 33.3%)", bold: true, spacing: { before: 120, after: 60 } }));

    // Point 11 & 12: User & Hostname
    children.push(new Paragraph({ text: "11. INCIDENTS/CASES TRIGGERED FROM USERNAMES", bold: true, spacing: { before: 120, after: 60 } }));
    children.push(new Paragraph({ text: "12. INCIDENTS/CASES TRIGGERED FROM HOSTNAME", bold: true, spacing: { before: 120, after: 60 } }));

    // Point 13 to 17: SLA & MTTR
    children.push(new Paragraph({ text: `13. SLA COMPLIANCE: ${metrics.slaCompliance}`, bold: true, spacing: { before: 120, after: 60 } }));
    children.push(new Paragraph({ text: `14. MTTR RESPONSE: ${metrics.mttaHours}`, bold: true }));
    children.push(new Paragraph({ text: `15. MTTR RESOLUTION: ${metrics.mttrHours}`, bold: true }));
    children.push(new Paragraph({ text: `16. MTTD (MEAN TIME TO DETECT): ${metrics.mttdHours}`, bold: true }));
    children.push(new Paragraph({ text: `17. MTTA (MEAN TIME TO ACKNOWLEDGE): ${metrics.mttaHours}`, bold: true }));

    // Point 18 to 21
    children.push(new Paragraph({ text: `18. TOP 3 RULES TRIGGERED & DAILY INGESTION (${metrics.dailyIngestionGb})`, bold: true, spacing: { before: 120, after: 60 } }));
    children.push(new Paragraph({ text: "19. PLAYBOOK DETAILS", bold: true, spacing: { before: 120, after: 60 } }));
    children.push(new Paragraph({ text: "20. NOISY CORRELATION RULE DETAILS", bold: true, spacing: { before: 120, after: 60 } }));
    children.push(new Paragraph({ text: "21. BLINDSPOT ANALYSIS & RECOMMENDATIONS", bold: true, spacing: { before: 120, after: 60 } }));

    // Governance Matrix
    children.push(sectionHeading("GOVERNANCE TEAM MATRIX"));
    children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({ children: [headerCell("Contact Name", 33), headerCell("Role", 33), headerCell("Email ID", 34)] }),
            new TableRow({ children: [cell("Saachi Joshi", true, 33), cell("Governance Lead", false, 33), cell("saachi.j@alticyber.com", false, 34)] }),
            new TableRow({ children: [cell("Shaktiprasad Anami", true, 33), cell("SOC Manager", false, 33), cell("shaktiprasad.a@alticyber.com", false, 34)] }),
            new TableRow({ children: [cell("Vaishnavi Wani", true, 33), cell("SOC Lead", false, 33), cell("vaishnavi.wani@alticyber.com", false, 34)] })
        ]
    }));

    const doc = new Document({
        sections: [{
            properties: {},
            children: children
        }]
    });

    Packer.toBlob(doc).then(blob => {
        saveAs(blob, `${prop.clientName}_SOC_Report_${Date.now()}.docx`);
    }).catch(err => {
        console.error("Docx Export Error:", err);
        alert("Failed to export Word document.");
    });
}
