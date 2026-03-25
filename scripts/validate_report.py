#!/usr/bin/env python3
import argparse
from pathlib import Path
from _validate_common import load_json, load_schema, validate_json, print_errors

def main():
    ap = argparse.ArgumentParser(description="Validate report assembly JSON against report.schema.v1.json")
    ap.add_argument("input", help="Path to a report JSON file OR folder")
    ap.add_argument("--schema", default=str(Path(__file__).resolve().parent.parent / "schemas" / "report.schema.v1.json"))
    args = ap.parse_args()

    schema = load_schema(Path(args.schema))
    in_path = Path(args.input)
    targets = list(in_path.rglob("*.json")) if in_path.is_dir() else [in_path]

    any_errors = False
    for t in targets:
        data = load_json(t)
        items = data if isinstance(data, list) else [data]
        for i, obj in enumerate(items):
            errors = validate_json(obj, schema)
            if errors:
                any_errors = True
                print(f"Errors in {t} [item {i}]:")
                print_errors(errors, str(t))
    if any_errors:
        raise SystemExit(1)
    print("OK: all reports valid")

if __name__ == "__main__":
    main()
