# Lived Experience Insights Engine

An end-to-end pipeline that transforms qualitative interview transcripts into structured, schema-validated insights and publication-ready reports — powered by Google Gemini and a locked specification pack (UTS Locks Pack v1.0).

Built for the UTS research initiative: *Documenting and amplifying women's lived experiences.*

---

## What Problem It Solves

Qualitative researchers working with dozens of long-form interview transcripts face a manual, error-prone process: reading, coding, clustering themes, and writing reports. This tool automates that pipeline while enforcing strict schema contracts at every stage, ensuring reproducibility and auditability of the analytical process.

The engine ingests `.docx` transcripts and produces:

- **Moment objects** — tagged, classified segments of each transcript
- **Clusters** — groups of insight-eligible moments with coherence scores
- **Insights** — promoted findings with supporting evidence and representative quotes
- **Reports** — structured JSON, DOCX, and PDF outputs
- **Validation artifacts** — optional comparison against external research literature

---

## Key Features

- **Two-phase pipeline** — Phase 1 segments transcripts into Moments; Phase 2 clusters, promotes, optionally validates, and assembles reports
- **Schema-locked LLM output** — Gemini responses are constrained by JSON Schema + closed vocabularies + YAML rules (the "Locks Pack"), preventing hallucination of categories or structure
- **Streaming progress** — NDJSON streaming for long-running segmentation; heartbeat-based streaming for clustering and assembly
- **Demographics integration** — Upload a participant CSV to inject demographic context into reports
- **External research validation** — Upload a PDF/DOCX/TXT research document; the engine cross-references extracted insights against published findings
- **Report generation** — Produces both DOCX and PDF reports via Puppeteer
- **Offline validation** — Python scripts validate output JSON against the same schemas used at runtime

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4 |
| Language | TypeScript 5 |
| LLM | Google Gemini 2.5 Pro via `@google/genai` |
| Schema enforcement | JSON Schema (Draft 2020-12), Zod |
| DOCX I/O | mammoth (extract), docx (generate) |
| PDF | pdf-parse (extract), Puppeteer (render) |
| Rules engine | js-yaml for YAML rule specs |
| Offline validation | Python 3 |
| Database | None — filesystem-backed JSON artifacts |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js App Router                    │
│  ┌───────────┐    ┌──────────────────────────────────┐  │
│  │  React UI │───▶│  /api/* Route Handlers (POST)    │  │
│  │  (SPA)    │◀───│  (BFF — server holds API key)    │  │
│  └───────────┘    └──────────┬───────────────────────┘  │
│                              │                          │
│                   ┌──────────▼───────────┐              │
│                   │   Locks Pack Loader  │              │
│                   │  schemas / vocab /   │              │
│                   │  rules / prompts     │              │
│                   └──────────┬───────────┘              │
│                              │                          │
│                   ┌──────────▼───────────┐              │
│                   │   Google Gemini API  │              │
│                   │  (constrained by     │              │
│                   │   responseSchema)    │              │
│                   └──────────────────────┘              │
└─────────────────────────────────────────────────────────┘
         │                                    │
    ┌────▼─────┐                       ┌──────▼──────┐
    │ uploads/ │                       │  output/    │
    │ (.docx)  │                       │  (.json)    │
    └──────────┘                       │  reports/   │
                                       │  (.pdf/.docx│)
                                       └─────────────┘
```

**Pipeline stages:**

1. **Phase 1 — Segment**: Each `.docx` transcript → chunked text → Gemini extracts Moment objects → `*_moments_tagged.json`
2. **Phase 2a — Cluster & Promote**: All insight-eligible moments → clustered → promoted to Insight objects
3. **Phase 2b — Validate** *(optional)*: Insights compared against uploaded external research → `validation.json`
4. **Phase 2c — Assemble**: Insights + demographics + validation → structured report → DOCX + PDF

---

## Folder Structure

```
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (Geist fonts, Tailwind)
│   │   ├── page.tsx                # Main SPA — orchestrates the full pipeline
│   │   ├── globals.css             # Tailwind v4 styles
│   │   └── api/                    # 15 POST route handlers (see API section)
│   ├── components/
│   │   ├── UploadUI.tsx            # Phase 1 — file listing, parsing, segmentation
│   │   ├── ResultsUI.tsx           # Phase 2 — clustering, promotion, report assembly
│   │   └── ValidationUI.tsx        # Phase 2b — external research validation UI
│   └── lib/
│       ├── gemini.ts               # Gemini client, schema cleaning, retry logic
│       ├── pdfGenerator.ts         # Puppeteer HTML → PDF rendering
│       └── assets/                 # UTS Locks Pack (v1.0)
│           ├── schemas/            # JSON Schema contracts (moment, cluster, insight, report, validation)
│           ├── vocab/              # Closed enum/vocabulary lists
│           ├── rules/              # YAML extraction & tagging rules
│           ├── prompts/            # Prompt cards for each pipeline stage
│           ├── data/               # Sample demographic CSV
│           └── loader.ts           # Loads all lock assets + helper utilities
├── scripts/                        # Python validation CLIs
├── tests/fixtures/                 # JSON fixtures for offline validation
├── uploads/                        # Input .docx transcripts (user-configurable)
├── output/                         # Generated JSON artifacts (user-configurable)
├── reports/                        # Generated PDF/DOCX reports
├── LOCKS_SPEC_v1.md                # Specification for the Locks Pack
├── next.config.ts                  # serverExternalPackages for pdf-parse
└── package.json
```

---

## Setup Instructions

### Prerequisites

- **Node.js** ≥ 18
- **npm** (ships with Node)
- **Google Gemini API key** — obtain from [Google AI Studio](https://aistudio.google.com/)
- **Python 3** *(optional, for offline validation scripts)*
- **Chromium-compatible browser** *(Puppeteer will download one automatically on `npm install`)*

### Installation

```bash
git clone <repository-url>
cd UTS_PROCESSING
npm install
```

### Environment Configuration

Create a `.env.local` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for LLM calls |

No `NEXT_PUBLIC_*` variables are used — all LLM calls happen server-side.

---

## How to Run Locally

```bash
# Development (hot reload)
npm run dev

# Production build
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000).

### Using the Pipeline

1. **Set directories** — Configure the upload and output directory paths in the UI (defaults: `./uploads` and `./output`)
2. **Phase 1 — Segment transcripts**
   - Place `.docx` transcript files in the upload directory, or use the file browser
   - Click "Scan Directory" to list available files
   - Select files and run segmentation — each file produces a `*_moments_tagged.json`
3. **Phase 2 — Generate insights**
   - *(Optional)* Upload a demographics CSV and/or external research document
   - Click "Cluster" to group insight-eligible moments
   - Click "Promote" to elevate clusters into formal Insight objects
   - *(Optional)* Run "Validate" to compare insights against external research
   - Click "Assemble" to generate the final report (JSON + DOCX + PDF)
4. **Download** — Export the report or validation artifacts as PDF

### Offline Validation (Python)

```bash
python scripts/run_all_validations.py
python scripts/validate_moments.py output/episode1_moments_tagged.json
python scripts/validate_insights.py output/insights.json
```

---

## Deployment

No platform-specific configuration (Dockerfile, `vercel.json`, etc.) is included. Key constraints for deployment:

| Concern | Requirement |
|---|---|
| **Filesystem access** | The app reads/writes `uploads/`, `output/`, and `reports/` as local paths. Serverless platforms (Vercel, AWS Lambda) have ephemeral filesystems — you need persistent storage or a dedicated VM/container. |
| **Puppeteer** | Requires a Chromium binary. Serverless environments may need `@sparticuz/chromium` or a headless Chrome layer. |
| **Environment** | Set `GEMINI_API_KEY` in the host's environment variables. |
| **Authentication** | None is built in. Add authentication middleware or edge-layer auth before exposing publicly. |

**Recommended deployment targets:** VPS, Docker container, or a long-running Node.js host with persistent disk.

---

## API Endpoints

All routes are **POST** under `/api/`. No authentication middleware is applied.

### File Operations

| Endpoint | Body | Response |
|---|---|---|
| `/api/list-files` | `{ uploadDir }` | `{ files: string[] }` — lists `.docx` files |
| `/api/parse-docx` | `{ filePath }` or multipart `file` | `{ text }` — extracted transcript text |
| `/api/save-file` | `{ filename, stage?, data, outputDir }` | `{ path }` — writes JSON artifact |
| `/api/upload-demographics` | multipart: `file` (CSV) + `outputDir` | `{ rowCount, filename }` — writes `demographics.json` |
| `/api/upload-research` | multipart: `file` (PDF/DOCX/TXT) + `outputDir` | `{ charCount, filename }` — writes `external_research.json` |

### Phase 1 — Segmentation

| Endpoint | Body | Response |
|---|---|---|
| `/api/phase1/segment` | `{ text, episodeId }` | NDJSON stream: `progress` → `heartbeat` → `complete` with `{ moments }` |

### Phase 2 — Analysis & Reporting

| Endpoint | Body | Response |
|---|---|---|
| `/api/phase2/read-moments` | `{ outputDir }` | `{ moments }` — merged from all `*_moments_tagged.json` |
| `/api/phase2/cluster` | `{ moments }` | Streaming JSON: `{ clusters }` |
| `/api/phase2/promote` | `{ clusters, moments }` | Streaming JSON: `{ insights }` |
| `/api/phase2/read-promoted` | `{ outputDir }` | `{ insights }` from `promoted_clusters.json` |
| `/api/phase2/validate` | `{ insights, outputDir }` | `{ validation }` — writes `validation.json` |
| `/api/phase2/read-validation` | `{ outputDir }` | `{ validation, hasExternalResearch }` |
| `/api/phase2/assemble` | `{ insights, outputDir }` | Streaming JSON: `{ report }` — writes DOCX + PDF to `reports/` |
| `/api/phase2/download-report` | `{ report }` | PDF binary (attachment) |
| `/api/phase2/download-validation` | `{ validation }` | PDF binary (attachment) |

---

## Example Usage

### Segment a transcript via API

```bash
# Extract text from a DOCX file
curl -X POST http://localhost:3000/api/parse-docx \
  -H "Content-Type: application/json" \
  -d '{"filePath": "./uploads/interview_01.docx"}'

# Segment the extracted text into Moments
curl -X POST http://localhost:3000/api/phase1/segment \
  -H "Content-Type: application/json" \
  -d '{"text": "<extracted text>", "episodeId": "EP001"}'
```

### Run the full pipeline via the UI

1. Navigate to `http://localhost:3000`
2. Enter `./uploads` as the transcript directory and `./output` as the output directory
3. Scan → select files → segment each transcript
4. Upload demographics CSV *(optional)*
5. Upload external research PDF *(optional)*
6. Cluster → Promote → Validate *(optional)* → Assemble
7. Download the final report as PDF

### Validate output offline

```bash
python scripts/validate_moments.py output/EP001_moments_tagged.json
# ✓ All moments valid against moment.schema.v1.json
```

---

## Locks Pack (v1.0)

The engine's analytical rigor comes from the **UTS Locks Pack** — a versioned set of constraints that bind every LLM call:

| Asset | Purpose |
|---|---|
| `schemas/` | JSON Schema contracts defining the exact shape of Moments, Clusters, Insights, Reports, and Validation objects |
| `vocab/` | Closed vocabulary lists (emotion types, barrier categories, life stages, etc.) — the LLM cannot invent new categories |
| `rules/` | YAML extraction and tagging rules governing how transcripts are segmented and classified |
| `prompts/` | Structured prompt cards injected as Gemini `systemInstruction` for each pipeline stage |

See [`LOCKS_SPEC_v1.md`](./LOCKS_SPEC_v1.md) for the full specification.

---

## License

Private repository. See project governance for usage terms.
