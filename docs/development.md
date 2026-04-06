# Development Guide

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | >= 18 | Required for Next.js 16 |
| npm | Ships with Node | Package manager |
| Google Gemini API key | — | Obtain from [Google AI Studio](https://aistudio.google.com/) |
| Python 3 | Optional | Only needed for offline validation scripts |
| Chromium | Auto-installed | Puppeteer downloads it during `npm install` |

## Setup

```bash
# Clone and install
git clone <repository-url>
cd UTS_PROCESSING
npm install

# Configure environment
echo "GEMINI_API_KEY=your_key_here" > .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for all LLM calls |

No `NEXT_PUBLIC_*` variables are used — all LLM calls happen server-side.

## npm Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `next dev` | Start development server with hot reload |
| `build` | `next build` | Production build |
| `start` | `next start` | Start production server |
| `lint` | `eslint` | Run ESLint |

All scripts set `NODE_OPTIONS='--dns-result-order=ipv4first'` to avoid DNS resolution issues with the Gemini API in some environments.

## Project Structure

```
UTS_PROCESSING/
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout (fonts, logo, metadata)
│   │   ├── page.tsx                   # Main SPA — pipeline orchestrator
│   │   ├── globals.css                # Tailwind v4 + theme tokens
│   │   └── api/                       # 15 POST route handlers
│   │       ├── list-files/
│   │       ├── parse-docx/
│   │       ├── save-file/
│   │       ├── upload-demographics/
│   │       ├── upload-research/
│   │       ├── phase1/
│   │       │   └── segment/
│   │       └── phase2/
│   │           ├── cluster/
│   │           ├── promote/
│   │           ├── validate/
│   │           ├── assemble/
│   │           ├── read-moments/
│   │           ├── read-promoted/
│   │           ├── read-validation/
│   │           ├── download-report/
│   │           └── download-validation/
│   ├── components/
│   │   ├── UploadUI.tsx               # Phase 1 UI
│   │   ├── ResultsUI.tsx              # Phase 2 UI
│   │   └── ValidationUI.tsx           # Validation UI
│   └── lib/
│       ├── gemini.ts                  # Gemini client + retry logic
│       ├── pdfGenerator.ts            # Puppeteer HTML → PDF
│       └── assets/                    # UTS Locks Pack (v1.0)
│           ├── schemas/               # JSON Schema contracts
│           ├── vocab/                 # Closed vocabulary lists
│           ├── rules/                 # YAML analytical rules
│           ├── prompts/               # System prompt templates
│           ├── data/                  # Reference data (demographics CSV)
│           └── loader.ts              # Asset loading utilities
├── scripts/                           # Python offline validators
├── tests/fixtures/                    # JSON test fixtures
├── uploads/                           # Input .docx transcripts
├── output/                            # Generated JSON artifacts
├── reports/                           # Generated PDF/DOCX reports
├── LOCKS_SPEC_v1.md                   # Locks Pack specification
└── package.json
```

## Key Source Files

### `src/app/page.tsx`

The single-page application root. This `"use client"` component:

- Manages all pipeline state via `useState` (files, clusters, insights, report, validation, demographics, research)
- Scans the output directory on mount to detect existing artifacts and resume pipeline state
- Coordinates user actions by calling `/api/*` routes and updating state with responses
- Renders three child components: `UploadUI`, `ResultsUI`, `ValidationUI`

### `src/lib/gemini.ts`

Two exports:

- **`cleanGeminiSchema(schema)`** — Recursively adapts JSON Schema for Gemini's `responseSchema` parameter (strips unsupported fields, converts `const` → `enum`, enforces `additionalProperties: false`)
- **`callGeminiWithRetry(params, retries?)`** — Wraps `GoogleGenAI.generateContent` with exponential backoff retry logic for 429 (rate limit), 5xx (server error), and network errors (ECONNRESET, ETIMEDOUT)

### `src/lib/assets/loader.ts`

Central I/O layer that loads all Locks Pack assets from disk and provides helpers for reading pipeline artifacts:

- Schema, vocab, rules, and prompt loaders
- Demographics CSV parsing with flexible column detection
- Demographics summary computation (age brackets, ethnicity breakdown, geographic scope)
- External research and validation artifact readers

### `src/lib/pdfGenerator.ts`

Renders branded PDF documents using Puppeteer:

- Launches headless Chromium
- Builds multi-page HTML with Montserrat/Inter fonts, brand pink (`#E91E8C`), logo header, and page numbers
- Separate templates for insight reports and validation reports

## Coding Conventions

### TypeScript

- **Strict mode** enabled (`tsconfig.json`)
- Path alias: `@/*` maps to `./src/*`
- Module resolution: `bundler`

### Styling

- **Tailwind CSS v4** via PostCSS (no `tailwind.config.js` — configuration is in `globals.css`)
- Theme tokens defined as CSS variables in a `@theme inline` block
- Brand color scale: `--color-brand-50` through `--color-brand-950`
- Geist Sans + Geist Mono system fonts, Inter + Montserrat for PDF output

### API Routes

- All routes are POST-only
- Request validation at the top of each handler
- Gemini calls wrapped in `callGeminiWithRetry`
- Long-running routes use streaming responses (NDJSON or heartbeat-based)
- Artifacts written to the filesystem via `fs.writeFile`

## Offline Validation (Python)

The Python scripts in `scripts/` validate output artifacts against the Locks Pack schemas using `jsonschema.Draft202012Validator`:

```bash
# Install the Python dependency
pip install jsonschema

# Validate a single moments file
python scripts/validate_moments.py output/EP001_moments_tagged.json

# Validate insights
python scripts/validate_insights.py output/promoted_clusters.json

# Validate a report
python scripts/validate_report.py output/report.json

# Run all validators against test fixtures
python scripts/run_all_validations.py
```

Pass `--schema` to override the default schema path if needed.

## Adding a New Pipeline Stage

1. **Create the schema** — Add `{name}.schema.v1.json` to `src/lib/assets/schemas/`
2. **Create the prompt** — Add a prompt card to `src/lib/assets/prompts/`
3. **Update the loader** — Add loading functions in `loader.ts`
4. **Create the API route** — Add `src/app/api/{phase}/{stage}/route.ts`
5. **Update the UI** — Add controls and state management in `page.tsx` or a new component
6. **Add offline validation** — Create `scripts/validate_{name}.py`
