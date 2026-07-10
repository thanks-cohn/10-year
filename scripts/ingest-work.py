#!/usr/bin/env python3
"""AnimePlex work ingestion wizard and one-command runner."""
from __future__ import annotations

import argparse, json, os, re, shutil, subprocess, sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
DEFAULT_CDN = "https://cdn.animeplex.lol/works"

@dataclass
class Chapter:
    rel: str; path: Path; images: list[Path]; pages: int; padding: int; extension: str

def ask(prompt: str, default: str|None=None) -> str:
    suffix = f" [{default}]" if default not in (None, "") else ""
    value = input(f"{prompt}{suffix}: ").strip()
    return value or (default or "")

def ask_bool(prompt: str, default: bool=False) -> bool:
    d = "Y/n" if default else "y/N"
    return ask(f"{prompt} ({d})", "y" if default else "n").lower() in {"y","yes","true","1"}

def load_json(path: Path, fallback: Any) -> Any:
    if not path.exists(): return fallback
    with path.open(encoding="utf-8") as f: return json.load(f)

def write_json(path: Path, data: Any, dry: bool=False) -> None:
    if dry: return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2); f.write("\n")

def natural_key(path: Path) -> list[Any]:
    return [int(x) if x.isdigit() else x.lower() for x in re.split(r"(\d+)", path.name)]

def detect_chapters(root: Path) -> list[Chapter]:
    chapters=[]
    for d in sorted([p for p in root.rglob("*") if p.is_dir()]):
        imgs=sorted([p for p in d.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTS], key=natural_key)
        if not imgs: continue
        rel=d.relative_to(root).as_posix()
        nums=[re.match(r"^(\d+)", p.stem) for p in imgs]
        padding=max((len(m.group(1)) for m in nums if m), default=0)
        ext=imgs[0].suffix.lower().lstrip(".")
        chapters.append(Chapter(rel,d,imgs,len(imgs),padding,ext))
    return chapters

def require_pillow() -> Any:
    try:
        from PIL import Image
        return Image
    except ImportError as e:
        raise SystemExit("Image resize/thumb generation requires Pillow. Install with: python -m pip install Pillow") from e

def normalize_images(chapters: list[Chapter], width: int|None, quality: int, convert: str|None, delete_originals: bool, dry: bool) -> None:
    if not width and not convert: return
    Image=require_pillow()
    for ch in chapters:
        new=[]
        for img in ch.images:
            out=img.with_suffix(f".{convert}") if convert else img
            if dry:
                new.append(out); continue
            with Image.open(img) as im:
                if width and im.width > width:
                    h=round(im.height * (width / im.width)); im=im.resize((width,h))
                save_kwargs={"quality": quality} if out.suffix.lower() in {".jpg",".jpeg",".webp"} else {}
                if out.suffix.lower()==".webp" and im.mode not in {"RGB","RGBA"}: im=im.convert("RGB")
                im.save(out, **save_kwargs)
            if convert and delete_originals and out != img: img.unlink()
            new.append(out)
        ch.images=sorted(new, key=natural_key); ch.extension=ch.images[0].suffix.lower().lstrip(".")

def generate_thumb(root: Path, chapters: list[Chapter], quality: int, dry: bool) -> Path:
    if not chapters: raise SystemExit("No chapters detected; cannot generate thumbnail.")
    thumb=root/"thumb.webp"
    if dry: return thumb
    Image=require_pillow()
    with Image.open(chapters[0].images[0]) as im:
        if im.mode not in {"RGB","RGBA"}: im=im.convert("RGB")
        im.thumbnail((600, 900))
        im.save(thumb, quality=quality)
    return thumb

def pointer(slug, display, source, cdn):
    return {"slug":slug,"display":display,"source":source,"manifest":f"works/{slug}.json","thumb":f"{cdn.rstrip('/')}/{slug}/thumb.webp"}

def upsert_pointer(path: Path, entry: dict[str,Any], dry: bool):
    data=load_json(path,{"version":2,"default":{},"works":[]})
    works=data.setdefault("works", [])
    for i,w in enumerate(works):
        if isinstance(w,dict) and w.get("slug")==entry["slug"]:
            works[i]=entry; break
    else: works.append(entry)
    write_json(path,data,dry)

def run(cmd: list[str], dry: bool):
    print("$ "+" ".join(cmd))
    if not dry: subprocess.run(cmd, check=True)

def main():
    ap=argparse.ArgumentParser(description="Ingest a curated AnimePlex work folder.")
    ap.add_argument("folder", nargs="?"); ap.add_argument("--slug"); ap.add_argument("--display"); ap.add_argument("--source", default="e")
    ap.add_argument("--parent-work-id", type=int); ap.add_argument("--cdn-base", default=DEFAULT_CDN); ap.add_argument("--repo-data", default="src/data")
    ap.add_argument("--resize-width", type=int); ap.add_argument("--quality", type=int, default=85); ap.add_argument("--convert", choices=["webp"])
    ap.add_argument("--generate-thumb", action="store_true"); ap.add_argument("--delete-originals", action="store_true")
    ap.add_argument("--update-fetch", action="store_true"); ap.add_argument("--update-rotunda", action="store_true"); ap.add_argument("--generate-search", action="store_true")
    ap.add_argument("--upload", choices=["rclone","rsync"]); ap.add_argument("--remote"); ap.add_argument("--yes", action="store_true"); ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-upload", action="store_true"); ap.add_argument("--no-search", action="store_true"); ap.add_argument("--no-rotunda", action="store_true"); ap.add_argument("--no-fetch-update", action="store_true"); ap.add_argument("--force", action="store_true")
    ap.add_argument("--commit-push", action="store_true"); ap.add_argument("--github-repo"); ap.add_argument("--github-token-env", default="GITHUB_TOKEN")
    args=ap.parse_args()
    guided=not args.folder
    if guided:
        args.folder=ask("Where is the curated work folder?", "~/works/A_Certain_Magical_Index"); args.slug=ask("Work slug?", Path(args.folder).name); args.display=ask("Display title?", args.slug.replace("_"," "))
        args.source=ask("Source letter?", "e"); p=ask("Parent work id?", ""); args.parent_work_id=int(p) if p else None; args.cdn_base=ask("CDN base URL?", DEFAULT_CDN); args.repo_data=ask("Repo data folder?", "src/data")
        if ask_bool("Resize images?", False): args.resize_width=int(ask("Width?","600")); args.quality=int(ask("Quality?","85")); args.convert="webp" if ask_bool("Convert to webp?", False) else None; args.delete_originals=ask_bool("Delete originals after conversion?", False)
        args.generate_thumb=ask_bool("Generate thumb.webp?", True); args.update_fetch=ask_bool("Update fetch.json?", True); args.update_rotunda=ask_bool("Update rotunda.json?", True); args.generate_search=ask_bool("Regenerate search.index.json?", True)
        if ask_bool("Upload to R2/CDN?", False): args.upload=ask("Upload method?", "rclone"); args.remote=ask("Upload remote?", "animeplex-r2:works")
        args.commit_push=ask_bool("Commit/push to GitHub?", False); args.github_repo=ask("GitHub repo?", "") if args.commit_push else None; args.github_token_env=ask("GitHub token env var?", "GITHUB_TOKEN") if args.commit_push else args.github_token_env
    root=Path(args.folder).expanduser().resolve(); slug=args.slug or root.name; display=args.display or slug.replace("_"," "); data=Path(args.repo_data)
    chapters=detect_chapters(root)
    if not chapters: raise SystemExit(f"No image chapter folders found under {root}")
    normalize_images(chapters,args.resize_width,args.quality,args.convert,args.delete_originals,args.dry_run)
    if args.generate_thumb: generate_thumb(root,chapters,args.quality,args.dry_run)
    for ch in chapters:
        ch.pages=len(ch.images); ch.padding=max([len(m.group(1)) for p in ch.images if (m:=re.match(r"^(\d+)",p.stem))] or [ch.padding]); ch.extension=ch.images[0].suffix.lower().lstrip(".")
        item={"version":1,"id":f"{slug}-{ch.rel.replace('/','-')}","parent_work_slug":slug,"slug":Path(ch.rel).name,"type":"chapter","title":display,"subtitle":Path(ch.rel).name.replace("_"," ").title(),"base_url":f"{args.cdn_base.rstrip('/')}/{slug}/{ch.rel}","pages":ch.pages,"padding":ch.padding,"extension":ch.extension}
        if args.parent_work_id is not None: item["parent_work_id"]=args.parent_work_id
        write_json(ch.path/"item.json", item, args.dry_run)
    manifest={"version":1,"slug":slug,"display":display,"source":args.source,"thumb":f"{args.cdn_base.rstrip('/')}/{slug}/thumb.webp","chapters":[c.rel for c in chapters]}
    write_json(data/"works"/f"{slug}.json", manifest, args.dry_run)
    ent=pointer(slug,display,args.source,args.cdn_base)
    if args.update_fetch and not args.no_fetch_update: upsert_pointer(data/"fetch.json",ent,args.dry_run)
    if args.update_rotunda and not args.no_rotunda: upsert_pointer(data/"rotunda.json",ent,args.dry_run)
    if args.generate_search and not args.no_search: run([sys.executable,"scripts/generate_search.py","--fetch",str(data/"fetch.json"),"--storage",str(data/"storage.json"),"--out",str(data/"search.index.json"),"--source",args.source], args.dry_run)
    uploaded=False
    if args.upload and not args.no_upload:
        if not args.remote: raise SystemExit("--remote is required for upload")
        dest=f"{args.remote.rstrip('/')}/{slug}"
        cmd=["rclone","copy",str(root),dest,"--progress"] if args.upload=="rclone" else ["rsync","-av","--progress",str(root)+"/",dest+"/"]
        run(cmd,args.dry_run); uploaded=True
    if args.commit_push:
        token=os.getenv(args.github_token_env or "GITHUB_TOKEN")
        if not token: raise SystemExit(f"GitHub token env var {args.github_token_env} is not set")
        run(["git","add",str(data/"fetch.json"),str(data/"rotunda.json"),str(data/"search.index.json"),str(data/"works"/f"{slug}.json")],args.dry_run)
        run(["git","commit","-m",f"Add AnimePlex work {display}"],args.dry_run)
        run(["git","push"],args.dry_run)
    print(f"\nAnimePlex ingest complete.\n\nDetected:\n- Work: {display}\n- Slug: {slug}\n- Source: {args.source}\n- Chapters: {len(chapters)}\n- Pages: {sum(c.pages for c in chapters)}\n- Extension: {chapters[0].extension}\n- Padding: {max(c.padding for c in chapters)}\n\nGenerated:\n- item.json files: {len(chapters)}\n" + ("- thumb.webp\n" if args.generate_thumb else "") + f"- {data/'works'/f'{slug}.json'}\n\nUpdated:\n" + (f"- {data/'fetch.json'}\n" if args.update_fetch and not args.no_fetch_update else "") + (f"- {data/'rotunda.json'}\n" if args.update_rotunda and not args.no_rotunda else "") + (f"- {data/'search.index.json'}\n" if args.generate_search and not args.no_search else "") + (f"\nUploaded:\n- {root}\n  -> {args.remote.rstrip('/')+'/'+slug}\n" if uploaded else "\nUploaded:\n- skipped\n") + ("\nGitHub:\n- committed changed JSON files\n- pushed to selected branch\n" if args.commit_push else "\nGitHub:\n- skipped\n"))
if __name__ == "__main__": main()
