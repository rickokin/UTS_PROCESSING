# Architecture

## System Overview

The engine is a **Next.js 16 App Router** application that orchestrates a multi-stage analytical pipeline. The browser-side React UI communicates with server-side API route handlers, which in turn call **Google Gemini 2.5 Pro** to perform qualitative analysis. Every Gemini call is constrained by the **Locks Pack** — a versioned set of JSON Schemas, closed vocabularies, YAML rules, and prompt templates.

There is **no database**. All persistence uses the local filesystem (JSON artifacts, DOCX, PDF). There is **no authentication** layer built in.

```
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js App Router                        │
│                                                                │
│  ┌────────────────┐       ┌──────────────────────────────────┐ │
│  │   React SPA    │──────▶│  /api/* Route Handlers (POST)    │ │
│  │   (page.tsx)   │◀──────│  Backend-for-Frontend pattern    │ │
│  │                │       │  (server holds GEMINI_API_KEY)   │ │
│  │  ┌──────────┐  │       └──────────┬───────────────────────┘ │
│  │  │UploadUI  │  │                  │                         │
│  │  │ResultsUI │  │       ┌──────────▼───────────────┐         │
│  │  │Validation│  │       │   Locks Pack Loader      │         │
│  │  │   UI     │  │       │  schemas / vocab / rules │         │
│  │  └──────────┘  │       │  / prompts               │         │
│  └────────────────┘       └──────────┬───────────────┘         │
│                                      │                         │
│                           ┌──────────▼───────────────┐         │
│                           │   gemini.ts               │         │
│                           │   callGeminiWithRetry()   │         │
│                           │   cleanGeminiSchema()     │         │
│                           └──────────┬───────────────┘         │
│                                      │                         │
│                           ┌──────────▼───────────────┐         │
│                           │   Google Gemini API       │         │
│                           │   (responseSchema-        │         │
│                           │    constrained output)    │         │
│                           └──────────────────────────┘         │
└──────────────┬──────────────────────────────┬──────────────────┘
               │                              │
          ┌────▼──────┐                 ┌─────▼───────┐
          │  uploads/  │                │   output/    │
          │  (.docx)   │                │   (.json)    │
          └────────────┘                │   reports/   │
                                        │   (.pdf/.docx)│
                                        └──────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4, Lucide icons |
| Language | TypeScript 5 (strict mode) |
| LLM | Google Gemini 2.5 Pro via `@google/genai` |
| Schema enforcement | JSON Schema (Draft 2020-12), Zod, `zod-to-json-schema` |
| DOCX I/O | mammoth (extract text), docx (generate reports) |
| PDF | pdf-parse (extract text), Puppeteer (render HTML → PDF) |
| Rules engine | js-yaml for YAML rule files |
| Offline validation | Python 3 + jsonschema |
| Database | None — filesystem-backed JSON artifacts |

## Component Responsibilities

### Client Layer

| Component | File | Role |
|-----------|------|------|
| Home (orchestrator) | `src/app/page.tsx` | Single-page app root. Manages all pipeline state via `useState`. Coordinates uploads, segmentation, clustering, promotion, validation, and assembly by calling `/api/*` routes. |
| UploadUI | `src/components/UploadUI.tsx` | Phase 1 interface. Directory scanning, file listing, per-file DOCX parsing and Gemini segmentation with NDJSON streaming progress. |
| ResultsUI | `src/components/ResultsUI.tsx` | Phase 2 interface. Cluster, promote, and assemble pipeline steps with streaming progress and report display. |
| ValidationUI | `src/components/ValidationUI.tsx` | Phase 2b interface. External research upload, validation trigger, results display. |

### Server Layer

| Module | File | Role |
|--------|------|------|
| Gemini client | `src/lib/gemini.ts` | Initializes `GoogleGenAI`, provides `callGeminiWithRetry` (exponential backoff for 429/5xx/network errors) and `cleanGeminiSchema` (adapts JSON Schema for Gemini's `responseSchema` format). |
| PDF generator | `src/lib/pdfGenerator.ts` | Launches headless Puppeteer, renders branded HTML templates to PDF. Two entry points: `generatePDF` (insight reports) and `generateValidationPDF`. |
| Asset loader | `src/lib/assets/loader.ts` | Central I/O layer for the Locks Pack. Loads schemas, vocab, rules, and prompts from disk. Also parses demographics CSVs, computes demographic summaries, and reads pipeline artifacts back from the output directory. |
| API routes | `src/app/api/*/route.ts` | 15 POST route handlers implementing file operations and each pipeline stage. See [API Reference](./api-reference.md). |

### Offline Tooling

| Script | File | Role |
|--------|------|------|
| Moment validator | `scripts/validate_moments.py` | Validates `*_moments_tagged.json` against `moment.schema.v1.json` |
| Insight validator | `scripts/validate_insights.py` | Validates insight JSON against `insight.schema.v1.json` |
| Report validator | `scripts/validate_report.py` | Validates report JSON against `report.schema.v1.json` |
| Runner | `scripts/run_all_validations.py` | Orchestrates all validators against test fixtures |

## Key Design Decisions

1. **Backend-for-Frontend (BFF)** — The Gemini API key never reaches the client. All LLM calls are proxied through Next.js API routes.

2. **Schema-locked LLM output** — Gemini's `responseSchema` parameter is set on every call, forcing structured JSON output that conforms to the Locks Pack schemas. The `cleanGeminiSchema` function bridges standard JSON Schema to Gemini's subset.

3. **Filesystem persistence** — No database. Artifacts are written as JSON files to a user-configurable output directory. This makes the pipeline inspectable (every intermediate result is a file) but limits deployment to hosts with persistent disk.

4. **Streaming responses** — Long-running pipeline steps (segment, cluster, promote, assemble) use NDJSON or heartbeat-based streaming to avoid HTTP timeouts and provide real-time progress to the UI.

5. **Chunked processing** — Transcripts are split into ~10,000-character chunks to stay within Gemini's output token limits. Chunks are split on paragraph boundaries to avoid cutting mid-sentence.

6. **Versioned constraints** — Every schema, vocab file, and rule file carries a `v1.0` version tag. The `locks_version` field in every output object traces which constraint set produced it.
