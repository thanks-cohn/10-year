#!/usr/bin/env python3
"""Compatibility wrapper for src/tools/generate_search.py."""
from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).resolve().parents[1] / "src" / "tools" / "generate_search.py"), run_name="__main__")
