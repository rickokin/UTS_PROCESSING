# How Constraint Files Drive the Insights Report

This document explains how five categories of constraint files govern every stage of the pipeline, from raw transcript to publication-ready report.

```
                                        ┌─────────────────────────────┐
                                        │  UTS Moment Extraction &    │
                                        │  Tagging Rules (v1.0).pdf   │
                                        │  ── master governance ──    │
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

All files live under `src/lib/assets/` and are loaded at runtime by `loader.ts`.  Every output object carries a `locks_version: "v1.0"` field that traces it back to the constraint set that produced it.

---

## 1. UTS Moment Extraction & Tagging Rules (v1.0).pdf

**Location:** Project root — `UTS Moment Extraction & Tagging Rules (v1.0).pdf`

**Role:** Supreme governance document. When this PDF conflicts with any prompt or rule file, the PDF takes precedence.

### What It Defines

| Section | Content | Downstream Effect |
|---------|---------|-------------------|
| Core Principles | No rewriting speaker language; evidence mandatory for every tag; no inference of diagnosis or identity | Every prompt inherits these constraints; the LLM is forbidden from paraphrasing or guessing |
| Moment Definition | A moment is a coherent narrative unit (experience, insight, turning point, barrier, reflection, or advice); 90–180 word target; 60–250 word range; no splitting mid-paragraph | Governs how the segmentation prompt slices transcripts in Phase 1 |
| Boundary Rules | Moments must not cross intro/ad/outro boundaries | Prevents structural contamination of analytical units |
| Tagging Limits | Max 5 themes, 3 emotions, 5 context markers, 5 risk flags per moment; every label requires `evidence_quote` + `why_it_supports` | Constrains tagging density; forces evidence grounding |
| Controlled Vocabulary | Canonical lists for themes, emotions, context markers, risk flags | These are the *source of truth*; the `vocab/` JSON files are the machine-readable implementation |
| Moment of Impact | Must have evidence; `moment_of_impact = true` only if substantiated | Adds an additional quality gate for high-signal moments |
| Output Standards | Valid JSON only; no commentary outside JSON; no empty objects | Enforces parsing reliability across the pipeline |
| Governance | v1.0 rules; no new labels without explicit approval; PDF supersedes prompts | Establishes version control and change governance |

### How It Enters the Pipeline

The `loadPdfRules()` function in `loader.ts` reads the PDF, extracts its text, and injects the full content into the system instruction of **Phase 1 (Segment)** under the header `PDF RULES & GUIDELINES`. This is the only stage that receives the PDF text directly, because it is the stage where moments are created and tagged — the very operations the PDF governs.

---

## 2. Rules Directory

**Location:** `src/lib/assets/rules/`

Four YAML files encode the quantitative and procedural logic that governs clustering, promotion, report assembly, and external validation. These are injected into every Gemini call (Phases 1 through 2c) via `loadAllRulesText()`, which concatenates them under labeled headers.

### 2.1 clustering_rules.v1.yaml

**Used in:** Phase 2a — Cluster (`/api/phase2/cluster`)

**Principle:** *"Clusters are built around shared signals + shared context, not keywords."*

| Concern | Rule | Value |
|---------|------|-------|
| Eligibility | Only moments with `insight_eligible: true` and evidence gate passed | — |
| Membership | A single moment may belong to at most 2 clusters (primary + secondary) | `max_clusters_per_moment: 2` |
| Similarity Drivers | Primary: barrier signal overlap, agency signal overlap, system interaction match | — |
| Similarity Drivers | Secondary: life stage, emotional signal overlap, health domain proximity | — |
| Forbidden Drivers | Keyword overlap only, sentiment only, ad-hoc topics | Prevents shallow groupings |
| Seeding | Min 2 seed moments from at least 2 distinct episodes sharing barrier or agency signals | `min_seed_moments: 2` |
| Growth | New moments must match the dominant barrier/agency AND system interaction or life stage | — |
| Dominant Signature | A signal must appear in ≥60% of cluster members to be considered dominant | `threshold_pct: 0.60` |
| Episode Dominance Cap | No single episode may contribute >50% of a cluster's moments | `episode_dominance_cap_pct: 0.50` |
| Split Triggers | Dual signature conflict (40–60% split); >2 system interactions without a dominant; ≥4 life stages without a cross-stage narrative | — |
| Cluster Size | Max 15 moments; min 4 to persist; min 2 distinct episodes to persist | — |
| Coherence Score | Strong ≥0.70; Acceptable ≥0.60 | — |

### 2.2 promotion_rules.v1.yaml

**Used in:** Phase 2a — Promote (`/api/phase2/promote`) and Phase 1 — Segment (for setting `insight_eligible`)

**Principle:** *"No promotion without multi-episode evidence and explicit signal support."*

This file operates at two levels:

1. **Moment Eligibility (Gate A)** — Applied during Phase 1 segmentation to set `insight_eligible` on each moment. Requires structural completeness (10 required fields) and evidence (barrier signals, agency signals, or emotional signals paired with a non-none system interaction).

2. **Cluster Promotion (Gates B–D)** — Applied during Phase 2a promotion to decide whether a cluster becomes an Insight.

| Gate | Rule | Threshold |
|------|------|-----------|
| B1 — Multi-episode | Cluster must span ≥2 distinct episodes | `min_distinct_episodes: 2` |
| B2 — Pattern coherence | Dominant feature must appear in ≥60% of members | `dominant_feature_threshold_pct: 0.60` |
| B3 — Episode dominance cap | No episode >50% of cluster | — |
| C1 — Standard path | ≥5 moments, ≥3 episodes, ≥2 speaker roles | — |
| C2 — Cross life-stage path | ≥6 moments, ≥3 episodes, ≥2 life stages | — |
| C3 — Clinician-corroborated | ≥4 moments, ≥2 episodes, at least 1 clinician moment + 2 patient moments | — |
| D — Disqualifiers | Inference risk, weak evidence density, overbreadth | Blocks promotion |

**Confidence assignment:**

| Level | Criteria |
|-------|----------|
| High | Passes any promotion path + ≥0.70 coherence + ≥3 episodes |
| Medium | ≥4 moments + ≥2 episodes + 0.60–0.69 coherence |
| Emerging | Multi-episode signal present but insufficient evidence or coherence |

### 2.3 auto_assembly_rules.v1.yaml

**Used in:** Phase 2c — Assemble (`/api/phase2/assemble`)

**Principle:** *"Narrative first, evidence always."*

This file dictates report structure, minimum viability, and section-level constraints.

**Minimum Viable Report:**
- ≥5 total insights, ≥3 high-confidence, ≥2 life stages covered
- At least one insight of type `relational_pattern` or `protective_factor`

**Canonical Section Order:**
1. Cover & Framing
2. Executive Summary
3. Participant Demographics
4. Why This Moment Matters
5. Key Insights
6. Life-Stage Patterns
7. Quotes That Stay With Us
8. From Voice to Action
9. What Comes Next
10. Methodology & Guardrails

Key section constraints:
- **Executive Summary:** 3–5 insights, ordered by confidence → episode coverage → life stage coverage → type mix; one sentence each; no quotes, no statistics, no recommendations
- **Participant Demographics:** Optional; only included when demographics CSV is uploaded; factual data only; no LLM interpretation; presented as summary cards
- **Key Insights:** All promoted insights included; ordered by confidence then narrative flow (problem → opportunity); max 2 quotes per insight
- **Quotes That Stay With Us:** 4–6 verbatim quotes from ≥3 distinct episodes and ≥2 speaker roles
- **From Voice to Action:** Max 3 headers; non-directive, empowering tone

**Auto-Stop Conditions:** Contradictory insights without resolution, missing quote approvals, or all-emerging confidence distribution.

### 2.4 validation_rules.v1.yaml

**Used in:** Phase 2b — Validate (`/api/phase2/validate`)

**Principle:** *"Evidence-grounded validation — honest assessment, no fabrication."*

| Concern | Rule |
|---------|------|
| Scope | Every insight must be evaluated; none skipped |
| Status Definitions | `supported` (direct corroboration), `partially_supported` (related but with caveats), `not_supported` (contradictory evidence), `not_addressed` (no coverage at all) |
| Excerpts | Verbatim only; must be exact substrings of external document; no paraphrasing; max 3 per insight; min 20 chars each |
| Gap Analysis | All `not_addressed` insights listed; gap note explains why coverage is absent |
| External Findings | Substantive only; must be relevant to the study domain; must suggest an insight type from the enum |
| Summary | Max 6 sentences; highlight strongest corroborations and notable gaps; balanced tone |
| Temperature | 0 (deterministic) |

---

## 3. Prompts Directory

**Location:** `src/lib/assets/prompts/`

Five text files provide stage-specific instructions injected as Gemini's `systemInstruction`. Each prompt is brief and directive — it tells the model what to do, then defers to the rules, vocabularies, and schemas for *how* to do it.

### How Prompts Are Composed at Runtime

Every pipeline stage assembles its system instruction from multiple layers:

```
systemInstruction =
    Prompt card (stage-specific)
  + All vocabularies (enums + signal lists)
  + All YAML rules (clustering, promotion, assembly, validation)
  + PDF rules (Phase 1 only)
  + Inline route-handler instructions
```

### 3.1 01_segment_into_moments.txt

**Stage:** Phase 1 — Segment

**Receives additionally:** PDF rules, all vocab, all rules

**Key Instructions:**
- Output a JSON array of Moment Objects conforming to `moment.schema.v1.json`
- `moment_text` must be verbatim (no paraphrasing)
- Use ONLY the allowed signal vocabularies for `emotional_signals`, `agency_signals`, `barrier_signals`
- Evaluate `insight_eligible` and provide `eligibility_rationale` based on the promotion rules
- Default to `cross_life_stage` and `system_interaction=none` when uncertain

### 3.2 03_cluster_moments.txt

**Stage:** Phase 2a — Cluster

**Receives additionally:** All vocab, all rules

**Key Instructions:**
- Cluster eligible moments using `clustering_rules.v1.yaml` constraints
- Output a JSON array of cluster objects matching `cluster.schema.v1.json`
- Include a coherence score (0–1) for each cluster

### 3.3 04_promote_clusters_to_insights.txt

**Stage:** Phase 2a — Promote

**Receives additionally:** All vocab, all rules

**Key Instructions:**
- Promote candidate clusters into Insight Objects using `promotion_rules.v1.yaml`
- Conform to `insight.schema.v1.json`
- Select up to 2 representative quotes per insight — must be exact verbatim substrings from `moment_text`
- NEVER invent, hallucinate, alter, or paraphrase quotes
- `quote_usage` must be an exact substring; `episode_id` must match the source episode

### 3.4 05_assemble_report_outline.txt

**Stage:** Phase 2c — Assemble

**Receives additionally:** All vocab, all rules, demographics context (if available), validation context (if available)

**Key Instructions:**
- Assemble the report using `auto_assembly_rules.v1.yaml`
- Do NOT generate new quotes — use only the `representative_quotes` from the input Insights
- Map quotes directly without altering a single word; verify `episode_id` and `speaker_role` match
- If demographics context is provided, reference participant diversity in the Executive Summary
- If no demographics data, omit all demographic references
- Output report JSON matching `report.schema.v1.json`

### 3.5 06_validate_insights.txt

**Stage:** Phase 2b — Validate

**Receives additionally:** All vocab, validation rules, full external research document text

**Key Instructions:**
- Cross-reference each promoted insight against the external research document
- For each insight: determine validation status, write evidence summary, note caveats, extract verbatim excerpts
- Populate `insights_not_in_external` for insights with zero external coverage
- Populate `external_findings_not_in_extracted` for substantive external themes not captured
- Write an `overall_alignment_summary`
- All excerpts must be exact substrings of the external document — no fabrication
- Output validation JSON matching `validation.schema.v1.json`

---

## 4. Schemas Directory

**Location:** `src/lib/assets/schemas/`

Five JSON Schema files (draft 2020-12) define the exact shape of every data object in the pipeline. They serve a dual purpose:

1. **Runtime enforcement** — Schemas are passed to Gemini via the `responseSchema` parameter after being cleaned by `cleanGeminiSchema()`. This forces the LLM to produce output that conforms to the schema's structure, types, and enum constraints.
2. **Offline validation** — The same schemas are used by Python scripts in `scripts/` (`jsonschema.Draft202012Validator`) to independently verify output artifacts.

### Schema Transformation for Gemini

Before a schema is sent to Gemini, `cleanGeminiSchema()` in `gemini.ts` adapts it:
- Removes unsupported metadata: `$schema`, `$id`, `title`, `default`
- Converts `const` to single-element `enum` arrays
- Sets `additionalProperties: false` on all objects
- Ensures all properties are listed in `required`
- Recurses into nested objects and arrays

### 4.1 moment.schema.v1.json

**Consumed by:** Phase 1 — Segment

Defines the atomic unit of the pipeline — a tagged transcript segment. 30 required fields including `moment_text` (verbatim), three signal arrays (`emotional_signals`, `agency_signals`, `barrier_signals`) with closed enums, `life_stage`, `system_interaction`, and `insight_eligible`.

### 4.2 cluster.schema.v1.json

**Consumed by:** Phase 2a — Cluster

Defines a group of related moments. Key constraint: `cluster_coherence_score` must be a number between 0 and 1. `life_stage_coverage` uses the same closed enum as the moment schema.

### 4.3 insight.schema.v1.json

**Consumed by:** Phase 2a — Promote

The most complex schema. Defines a formal research finding with:
- `insight_type` enum (7 values: `systemic_pattern`, `relational_pattern`, etc.)
- `supporting_moments` array with per-moment references (moment_id, episode_id, speaker_role, life_stage, system_interaction, signal_type, summary)
- `representative_quotes` array with `quote_type` (`primary`/`secondary`/`contrast`), episode attribution, and selection rationale
- `why_it_matters` with three-tier impact framing (system, human, equity/preventive)
- `impact_vectors` enum (8 values)
- `confidence_level` enum (`high`/`medium`/`emerging`)

### 4.4 report.schema.v1.json

**Consumed by:** Phase 2c — Assemble

Defines report metadata: title, included/excluded insight IDs, life stage coverage, and confidence distribution (`high`/`medium`/`emerging` as integer counts). Includes an optional `participant_demographics` object with age statistics, ethnicity breakdown, and geographic scope — this is injected deterministically by the server, never generated by the LLM.

### 4.5 validation.schema.v1.json

**Consumed by:** Phase 2b — Validate

Defines the external research validation output: per-insight validation with status (`supported`/`partially_supported`/`not_supported`/`not_addressed`), bidirectional gap analysis (insights missing from external research and external findings missing from the analysis), and an overall alignment summary.

---

## 5. Vocab Directory

**Location:** `src/lib/assets/vocab/`

Five JSON files define the closed vocabularies that constrain all categorical values across the pipeline. Every Gemini call receives the full vocabulary set via `loadAllVocabText()`, which concatenates the files and injects them into the system instruction under labeled headers.

### 5.1 enums.v1.json — Master Enum Registry

The central registry of all categorical types used across schemas. Contains 10 enums:

| Enum | Count | Purpose |
|------|-------|---------|
| `speaker_role` | 6 | Who is speaking: patient, clinician, caregiver, advocate, educator, host |
| `moment_type` | 8 | What kind of narrative unit: lived_experience, reflection, realization, barrier_encounter, etc. |
| `life_stage` | 9 | Temporal context: adolescence through cross_life_stage |
| `system_interaction` | 9 | What system the speaker interacted with: healthcare_provider, education_system, workplace, etc. |
| `risk_flags` | 6 | Sensitivity markers for content moderation |
| `insight_type` | 7 | Classification of promoted insights |
| `impact_vectors` | 8 | Expected downstream effects of an insight |
| `quote_type` | 3 | Quote role within an insight: primary, secondary, contrast |
| `confidence_level` | 3 | Evidence strength: high, medium, emerging |

### 5.2 signals.emotional.v1.json — Emotional Signal Vocabulary

**Type:** Closed list (26 values)

Spans a spectrum from distress to empowerment: `confusion`, `fear`, `anxiety`, `overwhelm`, `frustration`, `anger`, `sadness`, `grief`, `shame`, `embarrassment`, `isolation`, `loneliness`, `self_doubt`, `hopelessness`, `resignation`, `relief`, `validation`, `recognition`, `connection`, `belonging`, `confidence`, `empowerment`, `hope`, `calm`, `clarity`, `trust`.

**Used to populate:** `emotional_signals` on Moment objects; `dominant_emotions` on Cluster and Insight objects.

### 5.3 signals.agency.v1.json — Agency Signal Vocabulary

**Type:** Closed list (16 values)

Captures both active and constrained agency: `self_advocacy`, `speaking_up`, `asking_questions`, `seeking_information`, `seeking_care`, `seeking_support`, `tracking_symptoms`, `sharing_story`, `setting_boundaries`, `making_decisions`, `changing_providers`, `avoidance`, `silence`, `withdrawing`, `enduring`, `self_blame`.

**Used to populate:** `agency_signals` on Moment objects; `dominant_agency` on Clusters; a primary clustering driver.

### 5.4 signals.barrier.v1.json — Barrier Signal Vocabulary

**Type:** Closed list (19 values)

Catalogs systemic and interpersonal barriers: `provider_dismissal`, `symptoms_normalized_without_context`, `misdiagnosis`, `delayed_diagnosis`, `lack_of_information`, `lack_of_language`, `lack_of_validation`, `access_barrier`, `time_constraint`, `cost_constraint`, `stigma`, `shame_culture`, `silence`, `fear_of_judgment`, `education_gap`, `training_gap`, `system_navigation_difficulty`, `fragmented_care`, `social_isolation`, `lack_of_support`.

**Used to populate:** `barrier_signals` on Moment objects; `dominant_barriers` on Clusters; `barrier_types` on Insights; a primary clustering driver.

### 5.5 signals.theme.v1.json — Theme Signal Vocabulary

**Type:** Closed list (29 values)

Higher-order thematic labels such as `mental_health_stigma`, `provider_dismissal_and_gaslighting`, `hormonal_health_intersectionality`, `lived_experience_as_expertise`, `community_as_a_protective_factor`, `breast_cancer_journey_and_aftercare`, and `digital_wellness_and_social_media_impact`.

**Used for:** Broader thematic classification and narrative alignment during report assembly.

---

## End-to-End: How the Files Interact Across Pipeline Stages

The following table shows which files are consumed at each stage and what role they play.

| Stage | Prompt Card | Rules Injected | Schema Enforced | Vocab Injected | PDF Rules |
|-------|-------------|----------------|-----------------|----------------|-----------|
| **Phase 1 — Segment** | `01_segment_into_moments.txt` | All 4 YAML files | `moment.schema.v1.json` | All 5 vocab files | Yes |
| **Phase 2a — Cluster** | `03_cluster_moments.txt` | All 4 YAML files | `cluster.schema.v1.json` | All 5 vocab files | No |
| **Phase 2a — Promote** | `04_promote_clusters_to_insights.txt` | All 4 YAML files | `insight.schema.v1.json` | All 5 vocab files | No |
| **Phase 2b — Validate** | `06_validate_insights.txt` | `validation_rules.v1.yaml` | `validation.schema.v1.json` | All 5 vocab files | No |
| **Phase 2c — Assemble** | `05_assemble_report_outline.txt` | All 4 YAML files | `report.schema.v1.json` (extended) | All 5 vocab files | No |

### Data Flow Between Stages

```
 .docx Transcripts
       │
       ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │ PHASE 1 — SEGMENT                                              │
 │                                                                 │
 │  Inputs:  Transcript text, PDF rules, all vocab, all rules     │
 │  Schema:  moment.schema.v1.json                                │
 │  Output:  {episodeId}_moments_tagged.json  (per transcript)    │
 └─────────────────────┬───────────────────────────────────────────┘
                       │ All moments (insight_eligible filtered)
                       ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │ PHASE 2a — CLUSTER                                             │
 │                                                                 │
 │  Inputs:  Eligible moments, all vocab, all rules               │
 │  Schema:  cluster.schema.v1.json                               │
 │  Output:  clusters.json                                        │
 └─────────────────────┬───────────────────────────────────────────┘
                       │ Clusters + source moments
                       ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │ PHASE 2a — PROMOTE                                             │
 │                                                                 │
 │  Inputs:  Clusters enriched with moment text, all vocab, rules │
 │  Schema:  insight.schema.v1.json                               │
 │  Output:  promoted_clusters.json                               │
 └──────────┬──────────────────────────────────────────────────────┘
            │ Promoted insights
            ├──────────────────────────┐
            ▼                          ▼
 ┌────────────────────────┐  ┌─────────────────────────────────────┐
 │ PHASE 2b — VALIDATE    │  │ PHASE 2c — ASSEMBLE                │
 │ (optional)             │  │                                     │
 │                        │  │  Inputs:  Insights, demographics,   │
 │  Inputs:  Insights,    │  │           validation (if run),      │
 │    external research,  │  │           all vocab, all rules      │
 │    validation rules,   │  │  Schema:  report.schema.v1.json     │
 │    all vocab           │──▶  Output:  report.json + DOCX + PDF  │
 │  Schema:  validation   │  │                                     │
 │    .schema.v1.json     │  └─────────────────────────────────────┘
 │  Output:  validation   │
 │    .json + DOCX + PDF  │
 └────────────────────────┘
```

### The Constraint Hierarchy

When conflicts arise between constraint sources, the following precedence applies:

1. **PDF Rules** — The governance document is the supreme authority
2. **YAML Rules** — Quantitative thresholds and procedural logic
3. **JSON Schemas** — Structural contracts enforced at the API level
4. **Prompt Cards** — Stage-specific behavioral instructions
5. **Vocab Files** — Closed categorical lists (enforced by both schemas and prompts)

This hierarchy is explicitly stated in Section 7 of the PDF: *"If rules conflict with a prompt, this document takes precedence."*
