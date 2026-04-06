# Locks Pack

The **UTS Locks Pack (v1.0)** is a versioned bundle of constraints that binds every LLM call in the pipeline. It prevents Gemini from hallucinating categories, inventing structure, or deviating from the analytical framework.

## Why It Exists

Large language models produce plausible but unpredictable output. In a research context, this is unacceptable — categories must be consistent, schemas must be stable, and tagging must draw from a fixed vocabulary. The Locks Pack solves this by providing:

1. **JSON Schemas** that define the exact shape of every output object
2. **Closed vocabularies** that restrict enum values to a fixed set
3. **YAML rules** that govern analytical logic (clustering thresholds, promotion criteria, etc.)
4. **Prompt cards** that inject domain-specific instructions as Gemini `systemInstruction`

Every output object carries a `locks_version: "v1.0"` field, creating an audit trail back to the constraint set that produced it.

## Directory Layout

```
src/lib/assets/
├── schemas/                          # JSON Schema contracts
│   ├── moment.schema.v1.json
│   ├── cluster.schema.v1.json
│   ├── insight.schema.v1.json
│   ├── report.schema.v1.json
│   └── validation.schema.v1.json
├── vocab/                            # Closed vocabulary lists
│   ├── enums.v1.json                 # Master enum definitions
│   ├── signals.emotional.v1.json     # 24 emotional signal types
│   ├── signals.agency.v1.json        # 15 agency signal types
│   ├── signals.barrier.v1.json       # 18 barrier signal types
│   └── signals.theme.v1.json         # Theme signal types
├── rules/                            # YAML analytical rules
│   ├── clustering_rules.v1.yaml
│   ├── promotion_rules.v1.yaml
│   ├── auto_assembly_rules.v1.yaml
│   └── validation_rules.v1.yaml
├── prompts/                          # System prompt templates
│   ├── 01_segment_into_moments.txt
│   ├── 03_cluster_moments.txt
│   ├── 04_promote_clusters_to_insights.txt
│   ├── 05_assemble_report_outline.txt
│   └── 06_validate_insights.txt
├── data/                             # Reference data
│   └── UTS_S4_Demographics.csv
└── loader.ts                         # Asset loading utilities
```

## How Assets Are Loaded

The `loader.ts` module provides functions that read each asset type from disk:

| Function | Returns |
|----------|---------|
| `loadSchemas()` | All five schema objects (`moment`, `cluster`, `insight`, `report`, `validation`) |
| `loadAllVocabText()` | Concatenated text of all vocabulary files |
| `loadAllRulesText()` | Concatenated text of all YAML rule files |
| `loadPrompts()` | All prompt card texts keyed by stage name |
| `loadPdfRules()` | Extracted text from the PDF rules document |
| `loadJson(path)` | Parse a single JSON asset |
| `loadYaml(path)` | Parse a single YAML asset |

## How Schemas Constrain Gemini

Each API route constructs a Gemini request with a `responseSchema` built from the Locks Pack schemas. The flow:

```
moment.schema.v1.json
        │
        ▼
cleanGeminiSchema()          ◀── Strips $schema, $id, title, default
        │                         Converts const → enum
        ▼                         Sets additionalProperties: false
responseSchema parameter           Forces all properties required
        │
        ▼
Gemini API call
        │
        ▼
Structured JSON output       ◀── Gemini is forced to conform
```

The `cleanGeminiSchema()` function in `gemini.ts` adapts standard JSON Schema to Gemini's supported subset:

- Removes `$schema`, `$id`, `title`, `default` (unsupported metadata)
- Converts `const` values to single-element `enum` arrays
- Sets `additionalProperties: false` on all objects
- Ensures all properties are listed in `required`
- Recurses into nested objects and arrays

## How Prompts Are Injected

Each pipeline stage has a dedicated prompt card (`.txt` file) that is injected as the Gemini `systemInstruction`. The prompt is composed from multiple sources:

```
systemInstruction = [
  Stage-specific prompt card       (e.g. 01_segment_into_moments.txt)
  + All vocabularies               (enums + signal lists)
  + All YAML rules                 (clustering, promotion, assembly, validation)
  + PDF extraction rules           (loaded from the PDF spec)
  + Stage-specific instructions    (inline in the route handler)
]
```

This ensures every Gemini call receives the full analytical context regardless of which stage is running.

## Schemas

Five schemas define the pipeline's data contracts:

| Schema | Object | Key Constraints |
|--------|--------|----------------|
| `moment.schema.v1.json` | Moment | 30 required fields, closed enums for all signal arrays, `additionalProperties: false` |
| `cluster.schema.v1.json` | Cluster | Coherence score 0–1, at least 1 member moment, life stage enum |
| `insight.schema.v1.json` | Insight | At least 1 supporting moment, quote typing (`primary`/`secondary`/`contrast`), three-tier impact framing |
| `report.schema.v1.json` | Report | Confidence distribution (`high`/`medium`/`emerging` counts), optional demographics |
| `validation.schema.v1.json` | Validation | Four-level validation status, bidirectional gap analysis |

## Vocabularies

The `enums.v1.json` file defines the master set of enum values used across all schemas:

| Enum | Values |
|------|--------|
| `speaker_role` | patient, clinician, caregiver, advocate, educator, host |
| `moment_type` | lived_experience, reflection, realization, barrier_encounter, validation, advocacy, education, system_observation |
| `life_stage` | adolescence, reproductive_years, pregnancy, postpartum, menopause_transition, post_menopause, midlife, aging, cross_life_stage |
| `system_interaction` | healthcare_provider, education_system, peer_community, family, workplace, media, medical_training, community, none |
| `risk_flags` | none, mental_health_sensitivity, medical_trauma, sexual_health, grief_loss, violence_abuse |
| `insight_type` | systemic_pattern, relational_pattern, knowledge_gap_pattern, behavioral_pattern, emotional_pattern, protective_factor, risk_factor |
| `impact_vectors` | increased_self_advocacy, peer_support, behavior_change, preventive_action, health_literacy, community_building, policy_awareness, care_seeking |
| `quote_type` | primary, secondary, contrast |
| `confidence_level` | high, medium, emerging |

Signal-specific vocabularies (`signals.emotional.v1.json`, `signals.agency.v1.json`, `signals.barrier.v1.json`) provide the closed lists for moment tagging. See [Data Formats](./data-formats.md) for the full lists.

## Rules

YAML rule files encode the analytical logic that governs each pipeline stage:

| Rule File | Governs |
|-----------|---------|
| `clustering_rules.v1.yaml` | How moments are grouped into clusters — similarity drivers, minimum cluster size, coherence thresholds |
| `promotion_rules.v1.yaml` | Which clusters qualify as insights — episode coverage, signal diversity, confidence scoring |
| `auto_assembly_rules.v1.yaml` | How insights are ordered and formatted in the final report — section alignment, executive summary generation |
| `validation_rules.v1.yaml` | How insights are compared to external research — validation status criteria, gap analysis |

## Offline Validation

The same schemas used at runtime are also used by Python validation scripts in `scripts/`:

```bash
# Validate moments against the schema
python scripts/validate_moments.py output/EP001_moments_tagged.json

# Validate insights
python scripts/validate_insights.py output/promoted_clusters.json

# Run all validators against test fixtures
python scripts/run_all_validations.py
```

These scripts use `jsonschema.Draft202012Validator` to validate output artifacts against the Lock Pack schemas, providing a second layer of conformance checking independent of the Gemini pipeline.

## Versioning

All assets follow the naming convention `{name}.v1.{ext}`. When updating the analytical framework:

1. Create new asset files with an incremented version (e.g. `moment.schema.v2.json`)
2. Update `loader.ts` to load the new versions
3. Update the `locks_version` constant from `"v1.0"` to `"v2.0"`
4. Existing output artifacts retain their `locks_version` field, making it clear which version produced them
