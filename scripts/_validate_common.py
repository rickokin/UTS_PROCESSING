import json
from pathlib import Path
from jsonschema import Draft202012Validator

def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)

def load_schema(schema_path: Path):
    return load_json(schema_path)

def validate_json(instance, schema):
    v = Draft202012Validator(schema)
    errors = sorted(v.iter_errors(instance), key=lambda e: e.path)
    return errors

def print_errors(errors, file_path: str):
    for e in errors:
        loc = ".".join([str(x) for x in e.path]) if e.path else "<root>"
        print(f"- {file_path} :: {loc} :: {e.message}")
