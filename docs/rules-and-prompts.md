# Rules & Prompts Across the Insights Report Pipeline

This document explains how **rules files** and **prompt files** are used (and composed together) across each phase of the Insights Report process in the *Lived Experience Insights Engine*.

It is written to help you answer:
- Where do the rules and prompts live?
- What is the difference between a “rule” and a “prompt card” in this system?
- Which assets are used in which **pipeline phase**, and why?
- What is the precedence order when constraints conflict?

---

## Conceptual Model

In this system, an LLM call is governed by **four distinct constraint layers** (plus a fifth, Phase 1-only governance layer):

- **Prompt cards (`prompts/*.txt`)**: stage-specific behavioral instructions (what to do, tone/guardrails, “return JSON only”, quote handling rules).
- **Rules (`rules/*.yaml`)**: machine-readable policy and quantitative gates (thresholds, caps, required conditions, ordering logic). These are not executed as code at runtime; they are injected into the LLM context to standardize decisions.
- **Vocabularies (`vocab/*.json`)**: closed category lists that prevent category invention (enums + signal vocab lists).
- **Schemas (`schemas/*.json`)**: structural contracts enforced by the Gemini API via `responseSchema` (after being adapted to Gemini’s supported subset).
- **PDF governance rules (Phase 1 only)**: the authoritative segmentation/tagging governance document, injected verbatim into the LLM context to override other constraints when in conflict.

At runtime, each phase builds a single `systemInstruction` string by concatenating these assets plus a small amount of phase-specific inline instruction text inside the route handler.

---

## Asset Locations (Locks Pack v1.0)

All “locks” assets live under `src/lib/assets/`:

- **Prompts**: `src/lib/assets/prompts/`
  - `01_segment_into_moments.txt`
  - `03_cluster_moments.txt`
  - `04_promote_clusters_to_insights.txt`
  - `05_assemble_report_outline.txt`
  - `06_validate_insights.txt`
- **Rules**: `src/lib/assets/rules/`
  - `clustering_rules.v1.yaml`
  - `promotion_rules.v1.yaml`
  - `auto_assembly_rules.v1.yaml`
  - `validation_rules.v1.yaml`
- **Vocab**: `src/lib/assets/vocab/`
- **Schemas**: `src/lib/assets/schemas/`

The **load and composition** logic is centralized in `src/lib/assets/loader.ts`.

---

## Precedence and “Source of Truth”

When constraints conflict, the intended authority order is:

1. **PDF governance rules** *(Phase 1 only)*: `UTS Moment Extraction & Tagging Rules (v1.0).pdf`
2. **Schemas**: enforced structurally (Gemini `responseSchema`) and should be treated as non-negotiable output contracts
3. **Vocabularies**: closed enums and signal lists
4. **Rules (YAML)**: thresholds, gates, caps, ordering policies
5. **Prompt cards**: stage behavior and “how to apply” the above

In practice:
- **Schemas** are the hardest constraint (the API will reject/non-conformant output at generation time).
- **PDF rules** are only injected in Phase 1, so they only have enforcement power there.
- **YAML rules** and **prompt cards** shape model behavior; if they conflict with schema/vocab, schema/vocab wins.

---

## How Rules and Prompts Flow Through the System

### The common pattern

Each phase route handler follows the same high-level composition pattern:

- Load assets from disk via `loader.ts`
- Build a single `systemInstruction` string that includes:
  - stage prompt card
  - vocab text
  - rules text (all rules, or phase-specific subset)
  - optional phase-only context (PDF, external research text, demographics/validation summaries)
- Provide a schema-derived `responseSchema` to Gemini so outputs are structurally constrained

### Why “rules” are still text

The YAML rules are designed to be:

- **Human-editable and reviewable** (they read like policy documents with explicit thresholds and definitions).
- **Model-readable** (they are injected verbatim into `systemInstruction` so the LLM can apply them deterministically).
- **Externally auditable** (they can be versioned and cited alongside produced artifacts via `locks_version`).

They are *not* evaluated by a runtime “rules engine” in the application code. Instead:

- The system uses **schemas** to enforce structure.
- The system uses **vocab** to restrict categories.
- The model is instructed to apply **rules** (YAML) and **prompt cards** (TXT) to make decisions inside the allowed schema/vocab envelope.

This is a deliberate design: the LLM remains the decision-maker, but it operates inside a locked, versioned governance pack.

---

## Phase-by-Phase: Which Rules and Prompts Apply

Below is the authoritative mapping of which rule files and prompt cards are used in each pipeline phase, and what they control.

### Phase 1 — Segment (Transcript → Moments)

- **Route**: `POST /api/phase1/segment` (`src/app/api/phase1/segment/route.ts`)
- **Prompt card**: `prompts/01_segment_into_moments.txt`
- **Rules injected**: **all YAML rules** (via `loadAllRulesText()`), even though only some are relevant at this stage
- **PDF governance injected**: **yes** (`loadPdfRules()` reads `UTS Moment Extraction & Tagging Rules (v1.0).pdf`)
- **Vocab injected**: yes (all vocab text)
- **Schema enforced**: `moment.schema.v1.json` (wrapped as `{ moments: Moment[] }`)

**What the prompt card controls**
- Segmentation behavior: “atomic Moments”, **verbatim** `moment_text`, “return valid JSON only”.
- Tagging discipline: signals must be drawn from the allowed vocab lists.
- Eligibility instruction: compute `insight_eligible` and `eligibility_rationale` using promotion criteria.

**What the YAML rules control**
- **Promotion gates** (from `promotion_rules.v1.yaml`) indirectly influence Phase 1 by governing how the model sets `insight_eligible` and `eligibility_rationale`.
- Other YAML rule files are present in context but are not the primary decision drivers for segmentation.

**Why the PDF is only here**
- The PDF defines “Moment” boundary rules and tagging governance and is the top-level authority during *moment creation*. Downstream phases operate on already-structured artifacts.

**Composition order (high level)**
- Stage prompt → vocab → PDF rules → YAML rules → inline phase directives (episode id, verbatim requirement, eligibility requirement).

---

### Phase 2a — Cluster (Moments → Clusters)

- **Route**: `POST /api/phase2/cluster` (`src/app/api/phase2/cluster/route.ts`)
- **Prompt card**: `prompts/03_cluster_moments.txt`
- **Rules injected**: **all YAML rules** (via `loadAllRulesText()`)
- **PDF governance injected**: no
- **Vocab injected**: yes
- **Schema enforced**: `cluster.schema.v1.json` (wrapped as `{ clusters: Cluster[] }`)

**What the prompt card controls**
- The clustering task framing (cluster eligible moments into candidate clusters, return JSON only).

**What the YAML rules control**
- `clustering_rules.v1.yaml` defines:
  - allowed moments (must be `insight_eligible`)
  - similarity drivers (primary vs secondary, plus forbidden drivers)
  - caps and thresholds (cluster size, coherence bands, merge/split triggers)

**Important pipeline behavior**
- The route filters to **only** `insight_eligible` moments before calling the model, meaning clustering rules and prompt instructions are never applied to ineligible moments.

---

### Phase 2a — Promote (Clusters → Insights)

- **Route**: `POST /api/phase2/promote` (`src/app/api/phase2/promote/route.ts`)
- **Prompt card**: `prompts/04_promote_clusters_to_insights.txt`
- **Rules injected**: **all YAML rules** (via `loadAllRulesText()`)
- **PDF governance injected**: no
- **Vocab injected**: yes
- **Schema enforced**: `insight.schema.v1.json` (wrapped as `{ insights: Insight[] }`)

**What the prompt card controls**
- The “promotion” framing: clusters become Insight objects conforming to the schema.
- Quote discipline: quotes must be verbatim substrings of provided `moment_text`.

**What the YAML rules control**
- `promotion_rules.v1.yaml` defines promotion gates and confidence assignment, including:
  - minimum distinct episodes
  - dominance caps
  - confidence tiers (high/medium/emerging) based on coherence and coverage

**Key design detail: quote provenance**
- Before promotion, the route enriches clusters with `member_moments_data` containing `moment_text` so the model has the only allowable source material for representative quotes. The prompt and inline route instructions reinforce “verbatim only”.

---

### Phase 2b — Validate (Optional) (Insights ↔ External Research)

- **Route**: `POST /api/phase2/validate` (`src/app/api/phase2/validate/route.ts`)
- **Prompt card**: `prompts/06_validate_insights.txt`
- **Rules injected**: **validation rules only** (`rules/validation_rules.v1.yaml`), not the full rules pack
- **PDF governance injected**: no
- **Vocab injected**: yes (enums still help constrain fields like status enums, types, etc.)
- **Schema enforced**: `validation.schema.v1.json` (wrapped as `{ validation: Validation }`)

**What the prompt card controls**
- The validation workflow: evaluate each insight, provide alignment notes, extract verbatim external excerpts, and produce the required “gaps” arrays.

**What the YAML rules control**
- `validation_rules.v1.yaml` defines:
  - the meaning of each validation status
  - strict excerpt constraints (must be exact substrings of the external text; no paraphrase)
  - summary length/tone constraints

**Why validation uses only validation rules**
- Validation is a distinct task with a distinct policy surface area; injecting unrelated rule files is unnecessary token spend and increases the risk of instruction collisions.

---

### Phase 2c — Assemble (Insights → Report JSON + DOCX/PDF)

- **Route**: `POST /api/phase2/assemble` (`src/app/api/phase2/assemble/route.ts`)
- **Prompt card**: `prompts/05_assemble_report_outline.txt`
- **Rules injected**: **all YAML rules** (via `loadAllRulesText()`)
- **PDF governance injected**: no
- **Vocab injected**: yes
- **Schema enforced**: `report.schema.v1.json` (with route-level extension for UI fields)

**What the prompt card controls**
- Report assembly behavior: structure, quote handling, and conditional demographics narrative rules.

**What the YAML rules control**
- `auto_assembly_rules.v1.yaml` defines:
  - minimum viable report requirements
  - canonical section order
  - executive summary constraints
  - quote limits and presentation rules
  - stop conditions and report completeness expectations

**Deterministic injections (non-LLM)**
- Even though demographics and validation context are described in prompts, the route enforces key “do not fabricate” rules by:
  - computing demographics deterministically and injecting into the final report object post-generation
  - overriding “methodology” stats with actual computed counts
  - injecting a computed external validation summary when validation is present

This pattern is intentional: use the LLM for narrative/structure, but compute sensitive counts and summaries deterministically to avoid hallucination risk.

---

## Design Guidance: When to Change a Prompt vs a Rule

Use this as a maintenance rubric:

- **Change a prompt card when** you need to adjust *behavioral instruction* (tone, ordering emphasis, what to include/exclude, clarifying “return JSON only”, quote provenance reminders).
- **Change a YAML rule when** you need to adjust *policy thresholds* or *gates* (minimum episodes, coherence bands, caps, what counts as “supported”, section ordering logic).
- **Change a schema when** you need to adjust *data contracts* (field additions/removals/types). Treat this as a versioned breaking change.
- **Change vocab when** you need to adjust *category sets*. This impacts tagging, clustering semantics, and schema enum enforcement and should be versioned carefully.

---

## Quick Reference Table

| Phase | Output artifact | Prompt card | Rules injected | Notes |
|---|---|---|---|---|
| Phase 1 — Segment | `*_moments_tagged.json` | `01_segment_into_moments.txt` | all rules + PDF | PDF governance only applies here |
| Phase 2a — Cluster | `clusters.json` | `03_cluster_moments.txt` | all rules | Uses `clustering_rules.v1.yaml` most directly |
| Phase 2a — Promote | `promoted_clusters.json` | `04_promote_clusters_to_insights.txt` | all rules | Uses `promotion_rules.v1.yaml` + strict verbatim quoting |
| Phase 2b — Validate (opt.) | `validation.json` | `06_validate_insights.txt` | validation rules only | Includes external research full text in prompt |
| Phase 2c — Assemble | `report.json` (+ DOCX/PDF) | `05_assemble_report_outline.txt` | all rules | Uses `auto_assembly_rules.v1.yaml`; deterministic injection for demographics/stats |


