#!/usr/bin/env python3
from __future__ import annotations
import argparse, concurrent.futures, json, os, re, subprocess, tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def repo_root() -> Path:
    try: return Path(subprocess.check_output(["git","rev-parse","--show-toplevel"], text=True).strip())
    except Exception: return Path(__file__).resolve().parents[1]

def normalize_tag(v: Any) -> str:
    return re.sub(r"\s+", "-", str(v or "").strip().lower())

def normalize_tags(vals: Any) -> list[str]:
    
    if not isinstance(vals, list): return []
    return sorted({t for t in (normalize_tag(v) for v in vals) if t})

def load_json(p: Path, default: Any) -> Any:
    try:
        with p.open(encoding="utf-8") as f: return json.load(f)
    except FileNotFoundError: return default

def atomic_write(p: Path, data: Any) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=f".{p.name}.", suffix=".tmp", dir=p.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2); f.write("\n"); f.flush(); os.fsync(f.fileno())
        os.replace(tmp, p)
    except BaseException:
        Path(tmp).unlink(missing_ok=True); raise

def merge_entry(works: dict[str, Any], slug: str, tags: Any, source: str) -> bool:
    if not slug: return False
    entry = works.setdefault(slug, {"tags": [], "sources": [], "updated_at": None})
    before = (tuple(entry.get("tags", [])), tuple(entry.get("sources", [])))
    entry["tags"] = normalize_tags([*entry.get("tags", []), *normalize_tags(tags)])
    entry["sources"] = normalize_tags([*entry.get("sources", []), source])
    entry.setdefault("updated_at", None)
    return before != (tuple(entry["tags"]), tuple(entry["sources"]))

def catalog_from_local(data_dir: Path) -> tuple[dict[str, Any], dict[str, int]]:
    catalog = load_json(data_dir/"tags.json", {"version":1,"works":{}})
    works = catalog.setdefault("works", {}) if isinstance(catalog, dict) else {}
    counts = {"existing": len(works), "manifest_files":0, "imported_entries":0, "changed_entries":0}
    for path in sorted((data_dir/"works").glob("*.json")):
        counts["manifest_files"] += 1
        item = load_json(path, {})
        if isinstance(item, dict) and merge_entry(works, str(item.get("slug") or path.stem), item.get("tags"), "manifest"):
            counts["changed_entries"] += 1
    for name, source in [("fetch.json","fetch"),("rotunda.json","rotunda")]:
        data = load_json(data_dir/name, {})
        rows = data.get("works", []) if isinstance(data, dict) else data if isinstance(data, list) else []
        for item in rows:
            if isinstance(item, dict) and merge_entry(works, str(item.get("slug") or ""), item.get("tags"), source):
                counts["changed_entries"] += 1
    counts["imported_entries"] = len(works)
    return {"version":1, "works": {k: works[k] for k in sorted(works)}}, counts

def rclone_cat(remote_file: str) -> tuple[str, Any|None, str|None]:
    try:
        r = subprocess.run(["rclone","cat",remote_file], text=True, capture_output=True, check=False, timeout=30)
        if r.returncode: return remote_file, None, r.stderr.strip() or "rclone failed"
        return remote_file, json.loads(r.stdout), None
    except Exception as e: return remote_file, None, str(e)

def merge_r2(catalog: dict[str, Any], remote: str, workers: int) -> dict[str, int]:
    counts={"examined":0,"imported":0,"skipped":0,"malformed":0,"failed":0}
    ls = subprocess.run(["rclone","lsf","--recursive",remote.rstrip("/")], text=True, capture_output=True, check=False)
    if ls.returncode: raise SystemExit("rclone lsf failed; check remote configuration")
    files=[f"{remote.rstrip('/')}/{line}" for line in ls.stdout.splitlines() if line.endswith("details.json")]
    counts["examined"] = len(files)
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, workers)) as ex:
        for _name, data, err in ex.map(rclone_cat, files):
            if err: counts["failed"] += 1; continue
            if not isinstance(data, dict): counts["malformed"] += 1; continue
            work = data.get("work") if isinstance(data.get("work"), dict) else data
            slug = work.get("slug") if isinstance(work, dict) else None
            tags = work.get("tags") if isinstance(work, dict) else []
            if slug and merge_entry(catalog.setdefault("works",{}), slug, tags, "r2-details"): counts["imported"] += 1
            elif slug: counts["skipped"] += 1
            else: counts["malformed"] += 1
    return counts

def main(argv=None):
    ap=argparse.ArgumentParser()
    ap.add_argument("--data-dir", default="src/data"); ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--from-r2-details", action="store_true"); ap.add_argument("--remote", default="animeplex.lol:extended/works"); ap.add_argument("--workers", type=int, default=8)
    args=ap.parse_args(argv); data_dir=(repo_root()/args.data_dir).resolve()
    catalog, counts = catalog_from_local(data_dir)
    if args.from_r2_details: counts.update({f"r2_{k}":v for k,v in merge_r2(catalog,args.remote,args.workers).items()})
    for entry in catalog["works"].values(): entry["tags"] = normalize_tags(entry.get("tags")); entry["sources"] = normalize_tags(entry.get("sources")); entry.setdefault("updated_at", None)
    print(json.dumps(counts, indent=2))
    if args.dry_run: print("Dry run only; tags.json not written."); return 0
    atomic_write(data_dir/"tags.json", catalog); print(f"wrote {data_dir/'tags.json'}")
if __name__ == "__main__": raise SystemExit(main())
