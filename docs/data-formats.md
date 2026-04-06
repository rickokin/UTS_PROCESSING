# Data Formats

All pipeline artifacts are JSON files written to the user-configurable output directory (default: `./output`). Every object carries a `locks_version` field (`"v1.0"`) tracing which constraint set produced it.

## File Naming Conventions

| File Pattern | Stage | Example |
|-------------|-------|---------|
| `{episodeId}_moments_tagged.json` | Phase 1 — Segment | `EP001_moments_tagged.json` |
| `clusters.json` | Phase 2a — Cluster | — |
| `promoted_clusters.json` | Phase 2a — Promote | — |
| `validation.json` | Phase 2b — Validate | — |
| `report.json` | Phase 2c — Assemble | — |
| `demographics.json` | Demographics upload | — |
| `external_research.json` | Research upload | — |
| `reports/*.pdf` | PDF report output | `reports/report.pdf` |
| `reports/*.docx` | DOCX report output | `reports/report.docx` |

---

## Moment Object

**Schema:** `src/lib/assets/schemas/moment.schema.v1.json`

A tagged, classified segment of a transcript.

| Field | Type | Description |
|-------|------|-------------|
| `locks_version` | `string` | Always `"v1.0"` |
| `moment_id` | `string` | Unique within episode (e.g. `"M001"`) |
| `episode_id` | `string` | Source transcript identifier |
| `season` | `string` | Season/series identifier |
| `source_file` | `string` | Original filename |
| `speaker_id` | `string` | Speaker identifier |
| `speaker_role` | `enum` | `patient`, `clinician`, `caregiver`, `advocate`, `educator`, `host` |
| `timestamp_start` | `string` | Start position in transcript |
| `timestamp_end` | `string` | End position in transcript |
| `paragraph_ids` | `string[]` | Paragraph reference IDs |
| `moment_text` | `string` | Verbatim text from the transcript |
| `moment_type` | `enum` | `lived_experience`, `reflection`, `realization`, `barrier_encounter`, `validation`, `advocacy`, `education`, `system_observation` |
| `life_stage` | `enum` | `adolescence`, `reproductive_years`, `pregnancy`, `postpartum`, `menopause_transition`, `post_menopause`, `midlife`, `aging`, `cross_life_stage` |
| `health_domain` | `string` | Free-text health domain |
| `system_interaction` | `enum` | `healthcare_provider`, `education_system`, `peer_community`, `family`, `workplace`, `media`, `medical_training`, `community`, `none` |
| `emotional_signals` | `enum[]` | From closed vocabulary (24 values, see below) |
| `agency_signals` | `enum[]` | From closed vocabulary (15 values, see below) |
| `barrier_signals` | `enum[]` | From closed vocabulary (18 values, see below) |
| `insight_eligible` | `boolean` | Whether this moment qualifies for clustering |
| `eligibility_rationale` | `string` | Why eligible/ineligible |
| `risk_flags` | `enum[]` | `none`, `mental_health_sensitivity`, `medical_trauma`, `sexual_health`, `grief_loss`, `violence_abuse` |
| `notes_for_reviewer` | `string` | Free-text notes |

---

## Cluster Object

**Schema:** `src/lib/assets/schemas/cluster.schema.v1.json`

A group of thematically related insight-eligible moments.

| Field | Type | Description |
|-------|------|-------------|
| `locks_version` | `string` | Always `"v1.0"` |
| `cluster_id` | `string` | Unique identifier (e.g. `"CL001"`) |
| `member_moment_ids` | `string[]` | Moment IDs belonging to this cluster |
| `episode_coverage` | `string[]` | Episodes contributing to this cluster |
| `dominant_barriers` | `string[]` | Most common barrier signals |
| `dominant_agency` | `string[]` | Most common agency signals |
| `dominant_system_interaction` | `string` | Primary system interaction type |
| `life_stage_coverage` | `enum[]` | Life stages represented |
| `dominant_emotions` | `string[]` | Most common emotional signals |
| `cluster_coherence_score` | `number` | 0–1 coherence score |

---

## Insight Object

**Schema:** `src/lib/assets/schemas/insight.schema.v1.json`

A formal finding promoted from a cluster.

| Field | Type | Description |
|-------|------|-------------|
| `locks_version` | `string` | Always `"v1.0"` |
| `insight_id` | `string` | Unique identifier (e.g. `"INS001"`) |
| `insight_title` | `string` | Human-readable title |
| `insight_statement` | `string` | One-paragraph synthesis |
| `insight_type` | `enum` | `systemic_pattern`, `relational_pattern`, `knowledge_gap_pattern`, `behavioral_pattern`, `emotional_pattern`, `protective_factor`, `risk_factor` |
| `derived_from_episodes` | `string[]` | Source transcript IDs |
| `supporting_moments` | `object[]` | Array of moment references (see below) |
| `life_stages_covered` | `enum[]` | Life stages represented |
| `dominant_emotions` | `string[]` | Key emotions across supporting moments |
| `barrier_types` | `string[]` | Key barriers across supporting moments |
| `why_it_matters` | `object` | Impact framing with `system_level`, `human_level`, `equity_or_preventive_level` |
| `impact_vectors` | `enum[]` | `increased_self_advocacy`, `peer_support`, `behavior_change`, `preventive_action`, `health_literacy`, `community_building`, `policy_awareness`, `care_seeking` |
| `representative_quotes` | `object[]` | Quotes with `quote_type` (`primary`/`secondary`/`contrast`), `episode_id`, `speaker_role`, `quote_usage`, `selection_rationale` |
| `report_section_alignment` | `string[]` | Suggested report sections |
| `suggested_calls_to_action` | `string[]` | Actionable recommendations |
| `confidence_level` | `enum` | `high`, `medium`, `emerging` |
| `notes_for_editor` | `string` | Editorial notes |

### Supporting Moment Reference

| Field | Type | Description |
|-------|------|-------------|
| `moment_id` | `string` | Reference to the source moment |
| `episode_id` | `string` | Source episode |
| `speaker_role` | `enum` | Speaker's role |
| `life_stage` | `enum` | Life stage context |
| `health_domain` | `string` | Health domain |
| `system_interaction` | `enum` | System interaction type |
| `signal_type` | `string` | Primary signal driving inclusion |
| `moment_summary` | `string` | Brief summary of the moment |

---

## Report Object

**Schema:** `src/lib/assets/schemas/report.schema.v1.json`

The final assembled report metadata.

| Field | Type | Description |
|-------|------|-------------|
| `locks_version` | `string` | Always `"v1.0"` |
| `report_id` | `string` | Unique report identifier |
| `report_title` | `string` | Report title |
| `insight_ids_included` | `string[]` | Insights included in the report |
| `excluded_insights` | `string[]` | Insights excluded (with rationale) |
| `life_stage_coverage` | `enum[]` | Life stages covered by included insights |
| `confidence_distribution` | `object` | `{ high: int, medium: int, emerging: int }` |
| `assembly_notes` | `string` | Notes on report assembly |
| `participant_demographics` | `object?` | Optional demographics summary (see below) |

### Demographics Summary (optional)

| Field | Type | Description |
|-------|------|-------------|
| `total_participants` | `integer` | Number of participants |
| `age` | `object` | `{ min, max, mean, median }` |
| `age_brackets` | `object[]` | `[{ bracket: "25-34", count: 4 }, ...]` |
| `ethnicity_breakdown` | `object[]` | `[{ group: "...", count: 3, pct: 25.0 }, ...]` |
| `geographic_scope` | `object` | `{ domestic_count, international_count, regions: [...] }` |

---

## Validation Object

**Schema:** `src/lib/assets/schemas/validation.schema.v1.json`

Cross-reference of insights against external research.

| Field | Type | Description |
|-------|------|-------------|
| `locks_version` | `string` | Always `"v1.0"` |
| `validation_id` | `string` | Unique identifier |
| `external_source_summary` | `string` | Summary of the uploaded research document |
| `insight_validations` | `object[]` | Per-insight validation results (see below) |
| `insights_not_in_external` | `object[]` | Insights with no external coverage |
| `external_findings_not_in_extracted` | `object[]` | External findings missing from the analysis |
| `overall_alignment_summary` | `string` | High-level alignment assessment |
| `validation_notes` | `string` | Additional notes |

### Per-Insight Validation

| Field | Type | Description |
|-------|------|-------------|
| `insight_id` | `string` | Reference to the insight |
| `insight_title` | `string` | Insight title |
| `validation_status` | `enum` | `supported`, `partially_supported`, `not_supported`, `not_addressed` |
| `external_evidence_summary` | `string` | What the external research says |
| `alignment_notes` | `string` | Notes on alignment or divergence |
| `relevant_external_excerpts` | `string[]` | Relevant passages from the research |

---

## Supplementary Files

### `demographics.json`

Array of `DemographicRow` objects parsed from the uploaded CSV:

```json
[
  {
    "filename": "EP001",
    "name": "Participant A",
    "age": 34,
    "location": "New York, NY",
    "ethnicity": "Hispanic"
  }
]
```

### `external_research.json`

```json
{
  "filename": "research_paper.pdf",
  "extracted_text": "Full text content of the research document...",
  "uploaded_at": "2025-01-15T10:30:00.000Z"
}
```

---

## Closed Vocabularies

All signal arrays draw from fixed enum lists defined in `src/lib/assets/vocab/`. The LLM cannot invent values outside these lists.

### Emotional Signals (24 values)

`confusion`, `fear`, `anxiety`, `overwhelm`, `frustration`, `anger`, `sadness`, `grief`, `shame`, `embarrassment`, `isolation`, `loneliness`, `self_doubt`, `hopelessness`, `resignation`, `relief`, `validation`, `recognition`, `connection`, `belonging`, `confidence`, `empowerment`, `hope`, `calm`, `clarity`, `trust`

### Agency Signals (15 values)

`self_advocacy`, `speaking_up`, `asking_questions`, `seeking_information`, `seeking_care`, `seeking_support`, `tracking_symptoms`, `sharing_story`, `setting_boundaries`, `making_decisions`, `changing_providers`, `avoidance`, `silence`, `withdrawing`, `enduring`, `self_blame`

### Barrier Signals (18 values)

`provider_dismissal`, `symptoms_normalized_without_context`, `misdiagnosis`, `delayed_diagnosis`, `lack_of_information`, `lack_of_language`, `lack_of_validation`, `access_barrier`, `time_constraint`, `cost_constraint`, `stigma`, `shame_culture`, `silence`, `fear_of_judgment`, `education_gap`, `training_gap`, `system_navigation_difficulty`, `fragmented_care`, `social_isolation`, `lack_of_support`
