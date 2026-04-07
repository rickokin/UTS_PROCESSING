# How the UTS Moment Extraction & Tagging Rules (v1.0) PDF Is Used

> **Audience:** Developers, data engineers, and research analysts working with the Lived Experience Insights Engine.

---

## 1. Purpose and Authority

The file `UTS Moment Extraction & Tagging Rules (v1.0).pdf` is the **supreme governance document** for the entire pipeline. It defines how raw interview transcripts are segmented into atomic analytical units ("Moments") and how those Moments are tagged with structured metadata.

When any other constraint source — prompt cards, YAML rules, JSON schemas, or vocabulary files — conflicts with the PDF, **the PDF takes precedence**. This hierarchy is codified in Section 7 of the document itself and is enforced by injecting the full PDF text into the LLM's system instruction ahead of other constraint material.

### What the PDF Defines

| Section | Content | Downstream Effect |
|---------|---------|-------------------|
| Core Principles | No rewriting speaker language; evidence mandatory for every tag; no inference of diagnosis or identity | Every prompt inherits these constraints; the LLM is forbidden from paraphrasing or guessing |
| Moment Definition | A moment is a coherent narrative unit (experience, insight, turning point, barrier, reflection, or advice); 90–180 word target; 60–250 word range; no splitting mid-paragraph | Governs how the segmentation prompt slices transcripts |
| Boundary Rules | Moments must not cross intro/ad/outro boundaries | Prevents structural contamination of analytical units |
| Tagging Limits | Max 5 themes, 3 emotions, 5 context markers, 5 risk flags per moment; every label requires `evidence_quote` + `why_it_supports` | Constrains tagging density; forces evidence grounding |
| Controlled Vocabulary | Canonical lists for themes, emotions, context markers, risk flags | Source of truth for the `vocab/` JSON files |
| Moment of Impact | Must have evidence; `moment_of_impact = true` only if substantiated | Quality gate for high-signal moments |
| Output Standards | Valid JSON only; no commentary outside JSON; no empty objects | Parsing reliability across the pipeline |
| Governance | v1.0 rules; no new labels without explicit approval; PDF supersedes prompts | Version control and change governance |

---

## 2. Where the PDF Lives

**Expected location:** Project root — `./UTS Moment Extraction & Tagging Rules (v1.0).pdf`

The path is resolved at runtime by `loader.ts`:

```7:7:src/lib/assets/loader.ts
  const fullPath = path.join(process.cwd(), 'UTS Moment Extraction & Tagging Rules (v1.0).pdf');
```

If the file is absent, `loadPdfRules()` logs an error and returns an empty string. Phase 1 will still run but without the governance constraints, which degrades extraction quality and removes the precedence override.

---

## 3. How the PDF Enters the Pipeline

### 3.1 Extraction at Load Time

The `loadPdfRules()` function in `src/lib/assets/loader.ts` is the single entry point:

```6:17:src/lib/assets/loader.ts
export async function loadPdfRules(): Promise<string> {
  const fullPath = path.join(process.cwd(), 'UTS Moment Extraction & Tagging Rules (v1.0).pdf');
  try {
    const dataBuffer = await fs.readFile(fullPath);
    const parser = new PDFParse({ data: dataBuffer });
    const data = await parser.getText();
    return data.text;
  } catch (error) {
    console.error('Error loading PDF rules:', error);
    return '';
  }
}
```

**Mechanism:** The function reads the binary PDF from disk, uses the `pdf-parse` library to extract its full text content, and returns that text as a plain string. No summarization, filtering, or transformation is applied — the entire document is injected verbatim.

### 3.2 Injection into the LLM System Prompt

The extracted text is used exclusively in **Phase 1 — Segment** (`src/app/api/phase1/segment/route.ts`). The route handler calls `loadPdfRules()` alongside the other constraint loaders:

```9:13:src/app/api/phase1/segment/route.ts
    const prompts = await loadPrompts();
    const schemas = await loadSchemas();
    const vocab = await loadAllVocabText();
    const rules = await loadAllRulesText();
    const pdfRules = await loadPdfRules();
```

These are assembled into a single system instruction string:

```15:34:src/app/api/phase1/segment/route.ts
    const systemPrompt = `
SYSTEM INSTRUCTIONS:
${prompts.segmentIntoMoments}

VOCABULARIES & ENUMS:
${vocab}

PDF RULES & GUIDELINES:
${pdfRules}

RULES:
${rules}

EXTRACTION & TAGGING RULES:
- Extract exact verbatim paragraphs as moments.
- episode_id: ${episodeId}
- Fill in required structural fields.
- Tag each moment with emotional_signals, agency_signals, and barrier_signals based ONLY on the vocabularies.
- Update the insight_eligible flag and eligibility_rationale based on the promotion rules.
`.trim();
```

The PDF text appears under the `PDF RULES & GUIDELINES` header, positioned between the vocabulary lists and the YAML rules. This placement ensures the LLM processes the governance constraints after understanding the available vocabulary and before applying the procedural rules.

### 3.3 Why Only Phase 1?

The PDF governs **moment creation and tagging** — operations that occur exclusively during transcript segmentation. Downstream phases (clustering, promotion, validation, assembly) operate on already-tagged Moment objects and are governed by YAML rules and JSON schemas instead. Injecting the PDF into later stages would increase token consumption without adding value, since those stages do not create or re-tag moments.

---

## 4. Relationship to Other Constraint Files

The PDF sits at the top of a five-layer constraint hierarchy:

```
                                    ┌─────────────────────────────┐
                                    │  UTS Moment Extraction &    │
                                    │  Tagging Rules (v1.0).pdf   │
                                    │  ── supreme governance ──   │
                                    └─────────────┬───────────────┘
                                                  │ Overrides all
                                                  ▼
┌─────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   Prompts   │   │    Rules     │   │   Schemas    │   │    Vocab     │
│  (5 cards)  │   │  (4 YAML)   │   │  (5 JSON)   │   │  (5 JSON)   │
└──────┬──────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                 │                   │                  │
       └────────┬────────┴───────────┬───────┴──────────┬───────┘
                │                    │                  │
                ▼                    ▼                  ▼
         systemInstruction     responseSchema     enum constraints
         (Gemini API)         (Gemini API)        (embedded in both)
```

| Priority | Source | Role |
|----------|--------|------|
| 1 (highest) | **PDF Rules** | Master governance — defines principles, moment boundaries, tagging limits, and vocabulary authority |
| 2 | **YAML Rules** (`rules/*.yaml`) | Quantitative thresholds and procedural logic for clustering, promotion, assembly, validation |
| 3 | **JSON Schemas** (`schemas/*.json`) | Structural contracts enforced at the Gemini API level via `responseSchema` |
| 4 | **Prompt Cards** (`prompts/*.txt`) | Stage-specific behavioral instructions |
| 5 | **Vocab Files** (`vocab/*.json`) | Closed categorical lists enforced by both schemas and prompts |

The PDF's controlled vocabulary definitions are the **source of truth** for the machine-readable `vocab/*.json` files. If a vocabulary term exists in the PDF but not in the JSON file (or vice versa), the PDF is authoritative.

---

## 5. End-to-End Data Flow

The following diagram shows where the PDF rules participate in the full pipeline:

```
 .docx Transcripts (uploads/)
       │
       ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │ PHASE 1 — SEGMENT                                              │
 │                                                                 │
 │  Inputs:  Transcript text                                      │
 │           + PDF rules        ◀── governance document           │
 │           + all vocab        ◀── closed signal lists           │
 │           + all YAML rules   ◀── procedural constraints        │
 │           + prompt card      ◀── stage instructions            │
 │  Schema:  moment.schema.v1.json  (enforced via responseSchema) │
 │  Output:  {episodeId}_moments_tagged.json                      │
 └─────────────────────┬───────────────────────────────────────────┘
                       │
            (PDF rules are NOT passed beyond this point)
                       │
                       ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │ PHASE 2a — CLUSTER → PROMOTE                                   │
 │  Governed by: YAML rules + schemas + vocab (no PDF)            │
 │  Output: clusters.json → promoted_clusters.json                │
 └─────────────────────┬───────────────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
 ┌────────────────────┐   ┌─────────────────────────────────────┐
 │ PHASE 2b — VALIDATE│   │ PHASE 2c — ASSEMBLE                │
 │ (optional)         │   │  Output: report.json + DOCX + PDF   │
 │ Output:            │──▶│                                     │
 │  validation.json   │   │  Governed by: YAML rules + schemas  │
 └────────────────────┘   └─────────────────────────────────────┘
```

---

## 6. What the PDF Controls at Runtime

During Phase 1 segmentation, the PDF text governs the LLM's behavior in the following concrete ways:

### 6.1 Moment Boundaries
The LLM segments transcript text into discrete moments. The PDF specifies:
- Target length of 90–180 words per moment (hard range: 60–250 words)
- No splitting mid-paragraph
- No crossing intro/ad/outro boundaries

### 6.2 Verbatim Extraction
The `moment_text` field must contain exact, unmodified text from the transcript. The PDF forbids paraphrasing, summarizing, or rewriting speaker language in any form.

### 6.3 Signal Tagging
Each moment receives arrays of `emotional_signals`, `agency_signals`, and `barrier_signals` drawn from closed vocabularies. The PDF enforces:
- Tag density limits (e.g., max 3 emotions per moment)
- Evidence requirements — every tag must be traceable to a specific quote and rationale
- No inference of conditions, diagnoses, or identities not explicitly stated by the speaker

### 6.4 Insight Eligibility
The PDF, combined with the promotion rules YAML, governs the `insight_eligible` boolean flag. A moment must meet structural completeness requirements and demonstrate sufficient signal presence to be marked eligible for downstream clustering.

### 6.5 Output Format
The PDF mandates that the LLM return valid JSON only, with no commentary, explanation, or empty objects outside the schema structure. This is reinforced by Gemini's `responseSchema` parameter.

---

## 7. Failure Mode: Missing PDF

If the PDF file is not present at the expected path, `loadPdfRules()` catches the error and returns an empty string:

```13:16:src/lib/assets/loader.ts
  } catch (error) {
    console.error('Error loading PDF rules:', error);
    return '';
  }
```

**Consequences:**
- The `PDF RULES & GUIDELINES` section of the system prompt will be empty
- Phase 1 will still execute using the prompt card, YAML rules, vocab, and schema constraints
- The LLM loses the governance override — moment boundary rules, tagging density limits, and the verbatim extraction mandate become weaker without the PDF's explicit instructions
- The constraint hierarchy loses its top layer, meaning YAML rules and prompt cards become the de facto highest authority
- No user-facing error is raised; the only indication is a server-side console error

---

## 8. Maintenance and Versioning

- The PDF is versioned as **v1.0**. All output objects carry a `locks_version: "v1.0"` field that traces them back to this constraint set.
- Any changes to the PDF that alter moment boundaries, tagging rules, or vocabulary definitions constitute a **breaking change** and require incrementing the major version (e.g., v2.0).
- New vocabulary terms cannot be added without explicit approval, as stated in the PDF's governance section.
- The `vocab/*.json` files must be kept in sync with the PDF's canonical vocabulary lists. If they diverge, the PDF is authoritative but the JSON files are what the schema actually enforces at runtime.

---

## 9. Technical Dependencies

| Component | Role |
|-----------|------|
| `pdf-parse` (npm) | Extracts text from the PDF binary at runtime |
| `next.config.ts` | Lists `pdf-parse` and `pdfjs-dist` in `serverExternalPackages` so they are not bundled by webpack |
| `src/lib/assets/loader.ts` | `loadPdfRules()` — the sole function that reads and returns the PDF text |
| `src/app/api/phase1/segment/route.ts` | The sole consumer — injects PDF text into the Gemini system prompt |

---

## 10. Summary

The `UTS Moment Extraction & Tagging Rules (v1.0).pdf` serves as the authoritative governance document for the Lived Experience Insights Engine. At runtime, its full text is extracted by `pdf-parse`, injected into the Phase 1 segmentation prompt under the `PDF RULES & GUIDELINES` header, and used by Google Gemini to control how interview transcripts are segmented into Moments and tagged with structured metadata. It overrides all other constraint sources when conflicts arise, and its absence degrades — but does not break — the pipeline's analytical rigor.
