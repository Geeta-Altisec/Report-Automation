# AltiSec Report Automation Platform

A modern cybersecurity reporting suite designed for Security Operations Centers (SOC) and enterprise managed security service providers. The platform aggregates, normalizes, and visualizes security telemetry from SIEM, EDR, and perimeter firewalls, delivering high-fidelity executive reports, cadence presentations, and technical metrics.

---

## Key Capabilities

- **High-Fidelity Word (.docx) Template Mapping**:
  - Direct OpenXML parsing with pixel-perfect preservation of original margins, fonts, cover pages, headers, footers, and table styles.
  - Floating graphics and background watermark anchor normalization preventing displacement of titles and document sections.
  - Automatic filtering of empty spacer pages.

- **Exact PDF Template Rendering**:
  - Full-bleed A4 ($794\text{px} \times 1123\text{px}$) PDF template parsing with HiDPI rasterization.
  - 1:1 original layout retention without intrusive borders or unwanted generic ribbons.

- **Interactive Report Studio**:
  - Live page-synced A4 multi-page document preview.
  - Drag-and-drop intake for Excel (`.xlsx`, `.xls`, `.csv`), Word (`.docx`), and PDF templates.
  - Context-aware KPI metrics and executive forewords.

- **Universal Chart & Visualization Engine**:
  - Configurable MTTD/MTTR metrics, incident severity breakdowns, MITRE ATT&CK tactic mappings, and trend analysis.
  - In-place chart inspector for editing datasets, colors, and visualization types.

- **Enterprise Export Pipeline**:
  - Native editable Word (`.docx`) generation preserving open document XML structure via JSZip.
  - Page-by-page vector/raster PDF export with exact pagination guarantees.

---

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher recommended)

### Running the Platform

1. **Via Command Line**:
   ```bash
   npm start
   ```
   *or*
   ```bash
   node server.js
   ```

2. **Via Windows Launcher**:
   - Double-click `start.bat` in the project root.

3. Open your browser and navigate to:
   ```
   http://localhost:8000
   ```

---

## Architecture

For an in-depth technical breakdown of platform components, data schemas, and rendering pipelines, see [ARCHITECTURE_SPECIFICATION.md](ARCHITECTURE_SPECIFICATION.md).
