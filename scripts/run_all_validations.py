#!/usr/bin/env python3
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
FIX = ROOT / "tests" / "fixtures"

def run(cmd):
    print(">", " ".join(cmd))
    return subprocess.call(cmd)

def main():
    rc = 0
    rc |= run([sys.executable, str(ROOT/"scripts"/"validate_moments.py"), str(FIX/"moment_fixture.json")])
    rc |= run([sys.executable, str(ROOT/"scripts"/"validate_insights.py"), str(FIX/"insight_fixture.json")])
    rc |= run([sys.executable, str(ROOT/"scripts"/"validate_report.py"), str(FIX/"report_fixture.json")])
    if rc != 0:
        raise SystemExit(rc)
    print("OK: all fixture validations passed")

if __name__ == "__main__":
    main()
