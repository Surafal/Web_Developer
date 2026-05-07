Master Prompt: Accessibility Audit & Compliance Dashboard

 

  Objective:
  Create a full-stack dashboard (FastAPI backend, Vanilla JS/Tailwind frontend) to visualize and manage accessibility audit reports (JSON) and visual evidence (Screenshots/ZIPs).

 

  1. Core Requirements & Data Structure:
   * Input: The app must parse JSON files containing pageUrl, violations (with nodes and impact), and summary.
   * Screenshot Linking: Screenshots are stored in a dedicated folder. Link them to reports by folder name or fuzzy matching of the JSON filename.
   * Functional Areas: Group reports by their parent directory name. Individual file uploads should be labeled as "Single Upload."

 

  2. Backend (FastAPI + Python):
   * Endpoints:
       * POST /api/import: Support multi-file uploads (JSON, ZIP screenshot bundles, and raw Images). Extract ZIPs into the screenshot directory.
       * POST /api/sync-workspace: Automatically scan the local project for existing .json and .zip files to populate the dashboard.
       * GET /api/metrics/summary: Aggregate total violations, severity counts, and calculate a "Compliance Health Score" (weighted by critical/serious issues).
       * GET /api/metrics/violations: Provide a detailed breakdown of pages, their functional areas, and specific violations.
       * DELETE /api/files/batch: Support deleting multiple selected files at once.
       * DELETE /api/clear: Wipe all data for a fresh start.
       * PDF Export: Create a GET /api/export/pdf endpoint using fpdf2.
           * Layout: Landscape orientation.
           * Content: Executive summary, technical charts (as tables), and detailed page-level findings.
           * Resilience: Use character-level auto-wrapping for long URLs and code snippets to prevent horizontal cutoff. Include embedded screenshots as "Visual Evidence."

 

  3. Frontend (HTML5 + Tailwind CSS + Chart.js):
   * Tabbed Interface:
       1. Compliance Health Summary: Display key KPIs and doughnut/bar charts for severity and functional areas.
       2. Defect Technical Analysis: A searchable grid table (Functional Area, URL, Critical/Serious counts).
       3. Manage Audit Data: A file list with checkboxes, "Select All," "Delete Selected," "Reset to Default," and "Import Folder."
   * Technical Detail Modal:
       * Clicking "View Details" opens a modal.
       * Gallery First: Show a "Page Context & Visual Evidence" gallery at the very top of the modal.
       * Violation List: Show impact tags, remediation guides (links), and failing code snippets with target selectors.

 

  4. Design Aesthetic:
   * Modern, clean CLI-inspired dashboard.
   * Use Tailwind colors: Blue for info, Red for critical issues, Orange for serious issues, Purple for exports, and Teal/Green for imports.
   * Responsive layout with fixed navigation and scrollable modals.

 

  ---

 

  Recommended File Structure for the Prompt:
   * Dashboard/backend/main.py: FastAPI server and API logic.
   * Dashboard/backend/parser.py: Logic for aggregating JSON data and fuzzy-linking images.
   * Dashboard/backend/exporter.py: PDF generation logic using fpdf2 (Landscape).
   * Dashboard/frontend/index.html: Main UI structure.
   * Dashboard/frontend/app.js: Data fetching, Chart.js initialization, and modal rendering.
   * Dashboard/backend/requirements.txt: fastapi, uvicorn, python-multipart, fpdf2, pydantic.
