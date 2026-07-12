# XSL-FO Studio — PRD

## Problem Statement
Browser-based **Visual XSL-FO 1.0 Editor** (Angular 17+ SPA, frontend-only, no backend). Users upload a background image, drag/drop text and overlay images on a canvas, and get a real-time XSL-FO 1.0 XML preview — like a WYSIWYG PDF template editor.

## Target Users
- Developers / template designers who build XSL-FO PDF templates (certificates, passes, vouchers, ID cards)
- Non-technical designers who don't want to write XML by hand

## Tech Stack
- Angular 17 (standalone components) + TypeScript
- Angular Signals for state
- CSS/SCSS with a bespoke dark-mode dev-tool aesthetic (IBM Plex Sans / JetBrains Mono / Cabinet Grotesk)
- Monaco Editor for XML syntax highlighting
- localStorage for persistence
- Runs on port 3000 via supervisor (`ng serve`)

## Architecture
```
/app/frontend/src/app
├── app.component.ts/html/scss    # Header + 3-panel shell + toasts + shortcuts
├── app.config.ts                 # provideAnimations()
├── editor.store.ts               # Signal-based store, undo/redo, templates, autosave
├── xsl-fo-generator.service.ts   # DocState -> XSL-FO 1.0 XML string
├── toast.service.ts              # Ephemeral toast notifications
├── models.ts                     # Types, PAGE_PRESETS, pt/mm/cm/in conversions
└── components/
    ├── toolbox.component.*       # Left panel: doc/add/xml-src/templates
    ├── canvas.component.*        # Center WYSIWYG: drag/resize/inline-edit
    ├── properties.component.*    # Right-inner: transform/typography/image props
    └── xml-preview.component.*   # Right: Monaco live XSL-FO preview + Copy/Download
```

## Core Requirements (static)
1. Canvas / Editor with background upload, page-size presets (A4/A5/A6/Letter/Legal) + custom, unit picker (pt/mm/cm/in), zoom, grid & ruler toggles.
2. Text blocks — add/drag/resize, static + `<xsl:value-of>` dynamic mode, font family/size/weight/style/color/alignment.
3. Image blocks — add on-demand (with confirm prompt), drag/resize, placeholder name, uniform/non-uniform scaling.
4. Live XSL-FO 1.0 XML preview in Monaco (dark theme, syntax highlighted), Copy XML, Download .xsl.
5. Templates — save/load/delete via localStorage, JSON export/import, "New document" reset.
6. Undo/Redo (button + Ctrl+Z / Ctrl+Shift+Z), Delete key removes selected, Esc deselects.
7. Multi-page — tabs, add/remove pages, each with its own background & elements; generator emits one page-master + page-sequence per page.
8. Image path modes: `{placeholder}` variables, `file:///path/…`, or full base64 data URLs (user-selectable).

## What's been implemented (Jan 2026)
- ✅ Full 3-panel layout with dark developer-tool aesthetic (Cabinet Grotesk display, IBM Plex Sans body, JetBrains Mono for code/coords).
- ✅ All 24 feature groups verified end-to-end by testing agent (100% pass, no critical/minor issues).
- ✅ Header with page tabs, undo/redo/grid/rulers/zoom, brand mark.
- ✅ Toolbox: 5 sections (Document, Add elements, XML image src, Custom fonts, Templates).
- ✅ Canvas: drag & 8-way resize, inline text edit (dblclick), rulers, grid overlay, empty-state hint.
- ✅ Properties panel: transform (X/Y/W/H in pt), content mode (static vs. dynamic), full typography (built-in + uploaded custom fonts in dropdown), image scaling, duplicate/delete.
- ✅ Monaco XML preview with vs-dark theme, live-syncs via `effect()` to state signal.
- ✅ **Custom font upload** (.ttf / .otf / .woff / .woff2) — injected as `@font-face` via CustomFontService, appears in font-family dropdown grouped under "Custom".
- ✅ **Editable XML mode** — toggle read-only / edit; paste or upload an XSL-FO file, click Apply to parse via `XslFoParser` and re-render on canvas (round-trip); Revert / Copy / Apply / Load-file actions.
- ✅ localStorage autosave of current doc + named template store (customFonts included).
- ✅ Export/Import JSON, New document reset.
- ✅ Multi-page tabs with per-page background/elements; generator produces valid XSL-FO 1.0.
- ✅ GitHub Pages deploy workflow at `.github/workflows/deploy.yml` — auto-detects repo name for base-href.

## Backlog / P1
- Debounce autosave to reduce localStorage writes during drag (reviewer note).
- Optional toggle: emit background `<fo:external-graphic>` only when a real background image has been uploaded.
- Deep-clone state in `loadTemplate` for defensive isolation.
- Configurable static-text emission (raw text vs. `<xsl:text>` wrapping) for direct-FOP pipelines.

## P2 / Future
- Pan canvas with space+drag or middle mouse.
- Snap-to-grid + smart alignment guides between elements.
- Layers panel (reorder z-index, hide/lock elements).
- Basic barcode / QR block presets for ID-card templates.
- Cloud sync (would require backend — out of current scope).

## Test Report
`/app/test_reports/iteration_1.json` — 24/24 feature groups verified, no critical or minor bugs.
