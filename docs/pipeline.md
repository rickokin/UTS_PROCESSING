# Pipeline Stages

The engine runs a two-phase analytical pipeline that transforms raw `.docx` interview transcripts into structured insights and publication-ready reports.

```
Phase 1                          Phase 2
───────                          ───────
                                 2a. Cluster
.docx → text → Moments    ──▶   2a. Promote    ──▶   2c. Assemble ──▶ Report
                                 2b. Validate (opt.)
```

## Phase 1 — Segment

**Goal:** Extract structured **Moment** objects from each transcript.

**Route:** `POST /api/phase1/segment`

### Process

1. **Text extraction** — The `.docx` file is converted to plain text via mammoth (`/api/parse-docx`).
2. **Chunking** — The transcript is split into ~10,000-character chunks on paragraph boundaries to stay within Gemini's output token limits.
3. **LLM segmentation** — Each chunk is sent to Gemini with:
   - The `01_segment_into_moments.txt` system prompt
   - All vocabularies and rules (loaded via `loader.ts`)
   - The PDF extraction rules
   - A `responseSchema` built from `moment.schema.v1.json`
4. **Streaming** — Progress is streamed to the client as NDJSON:
   - `{ type: "progress", progress: 25 }` — percentage complete
   - `{ type: "heartbeat" }` — keep-alive during long chunks
   - `{ type: "complete", moments: [...] }` — final result
5. **Output** — Moments are saved as `{episodeId}_moments_tagged.json` in the output directory.

### What a Moment Contains

Each Moment is a tagged, classified segment of the transcript. Key fields:

| Field | Description |
|-------|-------------|
| `moment_id` | Unique identifier within the episode (e.g. `M001`) |
| `episode_id` | Source transcript identifier |
| `moment_text` | Verbatim text from the transcript |
| `moment_type` | Classification: `lived_experience`, `reflection`, `barrier_encounter`, etc. |
| `life_stage` | Life stage context: `adolescence`, `reproductive_years`, `menopause_transition`, etc. |
| `emotional_signals` | Array of emotions detected (from closed vocabulary) |
| `agency_signals` | Array of agency behaviors detected (from closed vocabulary) |
| `barrier_signals` | Array of barriers detected (from closed vocabulary) |
| `insight_eligible` | Boolean — whether this moment qualifies for clustering |
| `risk_flags` | Sensitivity markers: `mental_health_sensitivity`, `medical_trauma`, etc. |

See [Data Formats](./data-formats.md) for the complete schema.

---

## Phase 2a — Cluster

**Goal:** Group insight-eligible moments from across all transcripts into thematic **Clusters**.

**Route:** `POST /api/phase2/cluster`

### Process

1. **Moment aggregation** — All `*_moments_tagged.json` files are read and merged (`/api/phase2/read-moments`).
2. **Filtering** — Only moments with `insight_eligible: true` are sent to the LLM.
3. **LLM clustering** — Gemini groups moments based on similarity drivers:
   - **Primary:** barrier type, agency pattern, system interaction
   - **Secondary:** life stage, dominant emotion
4. **Output** — Clusters are saved as `clusters.json`.

### What a Cluster Contains

| Field | Description |
|-------|-------------|
| `cluster_id` | Unique identifier (e.g. `CL001`) |
| `member_moment_ids` | Array of moment IDs belonging to this cluster |
| `episode_coverage` | Which episodes contribute moments to this cluster |
| `dominant_barriers` | Most common barrier signals across member moments |
| `dominant_agency` | Most common agency signals |
| `dominant_emotions` | Most common emotional signals |
| `cluster_coherence_score` | 0–1 score indicating how tightly related the moments are |

---

## Phase 2a — Promote

**Goal:** Elevate clusters into formal **Insight** objects with evidence, quotes, and actionable framing.

**Route:** `POST /api/phase2/promote`

### Process

1. Clusters and their constituent moments are sent to Gemini.
2. Gemini produces Insight objects that synthesize the cluster's theme into a formal finding.
3. Each Insight includes:
   - A title and statement
   - Supporting moments with summaries
   - Representative quotes (selected from the original transcript text)
   - Impact analysis at system, human, and equity levels
   - Suggested calls to action
   - A confidence level (`high`, `medium`, `emerging`)
4. **Output** — Insights are saved as `promoted_clusters.json`.

### What an Insight Contains

| Field | Description |
|-------|-------------|
| `insight_id` | Unique identifier (e.g. `INS001`) |
| `insight_title` | Human-readable title |
| `insight_statement` | One-paragraph synthesis of the finding |
| `insight_type` | Classification: `systemic_pattern`, `relational_pattern`, `knowledge_gap_pattern`, etc. |
| `derived_from_episodes` | Which transcripts contributed evidence |
| `supporting_moments` | Array of moment references with summaries |
| `representative_quotes` | Primary, secondary, and contrast quotes with selection rationale |
| `why_it_matters` | Impact framing at `system_level`, `human_level`, `equity_or_preventive_level` |
| `impact_vectors` | Expected outcomes: `increased_self_advocacy`, `peer_support`, `policy_awareness`, etc. |
| `confidence_level` | `high`, `medium`, or `emerging` |

---

## Phase 2b — Validate (Optional)

**Goal:** Cross-reference extracted insights against uploaded external research literature.

**Route:** `POST /api/phase2/validate`

### Process

1. The user uploads a research document (PDF, DOCX, or TXT) via `/api/upload-research`, which extracts the text and saves it as `external_research.json`.
2. Insights and the external research text are sent to Gemini.
3. Gemini produces a **Validation** object that maps each insight to the external evidence:
   - `supported` — external research corroborates the insight
   - `partially_supported` — some overlap, some gaps
   - `not_supported` — external evidence contradicts or doesn't address the insight
   - `not_addressed` — the external research doesn't cover this topic
4. The validation also identifies:
   - Insights not found in the external research
   - External findings not captured by the extracted insights
5. **Output** — Saved as `validation.json`, plus DOCX and PDF validation reports.

---

## Phase 2c — Assemble

**Goal:** Compile insights, demographics, and validation into a final structured **Report** with DOCX and PDF outputs.

**Route:** `POST /api/phase2/assemble`

### Process

1. **Input gathering:**
   - Promoted insights (`promoted_clusters.json`)
   - Demographics summary (computed from `demographics.json` if uploaded)
   - Validation results (`validation.json` if Phase 2b was run)
2. **LLM assembly** — Gemini produces a structured report object with:
   - Executive summary
   - Insight ordering and section alignment
   - Confidence distribution
   - Participant demographics (if available)
3. **Document generation:**
   - The report JSON is saved as `report.json`
   - A branded **DOCX** is generated using the `docx` library
   - A branded **PDF** is generated via Puppeteer (HTML → PDF with Montserrat/Inter fonts, brand colors, logo header)
4. **Output** — Saved to the `reports/` directory.

### Report Outputs

| Format | Description |
|--------|-------------|
| `report.json` | Structured JSON matching `report.schema.v1.json` |
| `reports/*.docx` | Formatted Word document with executive summary, insights, quotes, and calls to action |
| `reports/*.pdf` | Branded PDF with logo, typography, and page numbers |

---

## Pipeline State Recovery

When the output directory changes (or on page load), the UI scans for existing artifacts:

| Check | API Call | State Flag |
|-------|----------|------------|
| Moments exist? | `/api/phase2/read-moments` | `hasMoments` |
| Promoted insights exist? | `/api/phase2/read-promoted` | `hasPromoted` |
| Validation exists? | `/api/phase2/read-validation` | `hasValidation` |
| External research uploaded? | `/api/phase2/read-validation` | `hasExternalResearch` |

This allows the user to resume the pipeline from any stage without re-running prior steps.
