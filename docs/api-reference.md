# API Reference

All routes are **POST** handlers under `/api/`. No authentication middleware is applied. The server holds the `GEMINI_API_KEY` and proxies all LLM calls (BFF pattern).

---

## File Operations

### `POST /api/list-files`

List `.docx` transcript files in a directory.

**Request:**

```json
{ "uploadDir": "./uploads" }
```

**Response:**

```json
{ "files": ["interview_01.docx", "interview_02.docx"] }
```

Returns an empty array if the directory does not exist.

---

### `POST /api/parse-docx`

Extract plain text from a `.docx` file.

**Request (JSON):**

```json
{ "filePath": "./uploads/interview_01.docx" }
```

**Request (multipart):**

```
Content-Type: multipart/form-data
file: <binary .docx>
```

**Response:**

```json
{ "text": "Full transcript text content..." }
```

Uses mammoth for DOCX-to-text extraction.

---

### `POST /api/save-file`

Write a JSON artifact to the output directory.

**Request:**

```json
{
  "filename": "EP001",
  "stage": "moments_tagged",
  "data": { "moments": [...] },
  "outputDir": "./output"
}
```

**Response:**

```json
{ "path": "./output/EP001_moments_tagged.json" }
```

The `stage` parameter is optional. If provided, the file is named `{filename}_{stage}.json`; otherwise `{filename}.json`.

---

### `POST /api/upload-demographics`

Upload and parse a demographics CSV file.

**Request:**

```
Content-Type: multipart/form-data
file: <demographics.csv>
outputDir: "./output"
```

**Response:**

```json
{ "rowCount": 12, "filename": "demographics.csv" }
```

Writes `demographics.json` to the output directory. The CSV parser auto-detects columns using flexible header aliases (e.g. "participant name", "age", "city/state", "ethnicity").

---

### `POST /api/upload-research`

Upload an external research document for validation.

**Request:**

```
Content-Type: multipart/form-data
file: <research.pdf | research.docx | research.txt>
outputDir: "./output"
```

**Response:**

```json
{ "charCount": 45230, "filename": "research.pdf" }
```

Extracts text from PDF (via pdf-parse), DOCX (via mammoth), or plain text files. Writes `external_research.json` to the output directory.

---

## Phase 1 — Segmentation

### `POST /api/phase1/segment`

Segment a transcript into Moment objects via Gemini.

**Request:**

```json
{
  "text": "Full transcript text...",
  "episodeId": "EP001"
}
```

**Response:** NDJSON stream (newline-delimited JSON)

```
{"type":"progress","progress":0}
{"type":"progress","progress":50}
{"type":"heartbeat"}
{"type":"complete","moments":[{...}, {...}]}
```

| Event | Description |
|-------|-------------|
| `progress` | Percentage of chunks processed (0–100) |
| `heartbeat` | Keep-alive signal during long Gemini calls |
| `complete` | Final result with the full moments array |
| `error` | Error message if processing fails |

The transcript is chunked into ~10,000-character segments split on paragraph boundaries. Each chunk is processed with a separate Gemini call, and results are concatenated.

---

## Phase 2 — Analysis & Reporting

### `POST /api/phase2/read-moments`

Aggregate all moment files from the output directory.

**Request:**

```json
{ "outputDir": "./output" }
```

**Response:**

```json
{ "moments": [{...}, {...}, ...] }
```

Reads all `*_moments_tagged.json` files and merges their moment arrays.

---

### `POST /api/phase2/cluster`

Cluster insight-eligible moments via Gemini.

**Request:**

```json
{ "moments": [{...}, {...}, ...] }
```

**Response:** Streaming JSON with heartbeats

```json
{ "clusters": [{...}, {...}] }
```

Only moments with `insight_eligible: true` are included. Moments are clustered by barrier type, agency pattern, system interaction, life stage, and emotion.

---

### `POST /api/phase2/promote`

Promote clusters to formal Insight objects via Gemini.

**Request:**

```json
{
  "clusters": [{...}, {...}],
  "moments": [{...}, {...}]
}
```

**Response:** Streaming JSON

```json
{ "insights": [{...}, {...}] }
```

Each cluster is elevated into an Insight with title, statement, supporting evidence, quotes, impact analysis, and confidence level.

---

### `POST /api/phase2/read-promoted`

Read promoted insights from the output directory.

**Request:**

```json
{ "outputDir": "./output" }
```

**Response:**

```json
{ "insights": [{...}, {...}] }
```

Reads `promoted_clusters.json`.

---

### `POST /api/phase2/validate`

Validate insights against external research via Gemini.

**Request:**

```json
{
  "insights": [{...}, {...}],
  "outputDir": "./output"
}
```

**Response:**

```json
{ "validation": {...} }
```

Loads `external_research.json` from the output directory, sends insights + research text to Gemini, and produces a validation object. Also generates DOCX and PDF validation reports. Writes `validation.json` to the output directory.

---

### `POST /api/phase2/read-validation`

Check for existing validation results and external research.

**Request:**

```json
{ "outputDir": "./output" }
```

**Response:**

```json
{
  "validation": {...},
  "hasExternalResearch": true
}
```

Returns `null` for `validation` if no `validation.json` exists.

---

### `POST /api/phase2/assemble`

Assemble the final report via Gemini, then generate DOCX and PDF.

**Request:**

```json
{
  "insights": [{...}, {...}],
  "outputDir": "./output"
}
```

**Response:** Streaming JSON

```json
{ "report": {...} }
```

Loads demographics and validation from the output directory if available. Gemini assembles a structured report object. The route then generates:
- `report.json` in the output directory
- A branded `.docx` in `reports/`
- A branded `.pdf` in `reports/` (via Puppeteer)

---

### `POST /api/phase2/download-report`

Download the report as a PDF.

**Request:**

```json
{ "report": {...} }
```

**Response:** Binary PDF with `Content-Disposition: attachment; filename="report.pdf"`

Renders the report object to a branded PDF using Puppeteer and returns the binary.

---

### `POST /api/phase2/download-validation`

Download the validation report as a PDF.

**Request:**

```json
{ "validation": {...} }
```

**Response:** Binary PDF with `Content-Disposition: attachment; filename="validation_report.pdf"`

Same rendering pipeline as the report download, using the validation-specific template.

---

## Error Handling

All endpoints return standard JSON error responses:

```json
{ "error": "Description of what went wrong" }
```

| Status | Meaning |
|--------|---------|
| `400` | Missing or invalid request body |
| `500` | Server error (Gemini failure, file I/O error, etc.) |

Gemini-related errors are retried automatically by `callGeminiWithRetry` (up to 5 attempts with exponential backoff for 429, 5xx, and network errors) before surfacing to the client.
