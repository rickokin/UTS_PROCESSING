# UTS Locks Pack (v1.0)

This pack codifies the **locked schemas, vocabularies, and rules** used to extract:
- Moment Objects
- Insight Objects
- Insight Candidate Clusters
- Insight Report assembly contracts

## Versioning
- `locks_version`: `v1.0`
- Any breaking changes must increment MAJOR version (e.g., v2.0).

## Folder overview
- `schemas/` JSON Schemas (Draft 2020-12)
- `vocab/` Closed vocab lists + enums
- `rules/` Machine-readable YAML rule specs
- `prompts/` Validator-friendly prompt cards
- `tests/` Minimal fixtures
- `scripts/` Validation CLIs

## Validation quickstart
```bash
python scripts/run_all_validations.py
```

Validate your outputs:
```bash
python scripts/validate_moments.py /path/to/moments.json
python scripts/validate_insights.py /path/to/insights.json
python scripts/validate_report.py /path/to/report.json
```

## Greenfield usage pattern
1) Normalize transcript → generate Moment Objects
2) Validate moments (schema + vocab)
3) Cluster eligible moments → validate cluster objects
4) Promote to Insight Objects → validate insights
5) Assemble report outline → validate report contract
