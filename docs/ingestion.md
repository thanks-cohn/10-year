# Doku-Doujin ingestion

`python scripts/ingest-work.py` ingests a curated local work folder into Doku-Doujin data files and can optionally upload the completed work folder and commit/push repository JSON changes.

## Prerequisites

- A curated work folder containing volume/chapter folders and page images.
- GitHub access for optional commit/push.
- R2/CDN access through `rclone` or `rsync` for optional upload.
- Optional Pillow (`python -m pip install Pillow`) when resizing, converting, or generating `thumb.webp`.

Do not put credentials in CLI arguments or tracked files. Use environment variables instead:

```sh
export GITHUB_TOKEN="fake_example_token"
export R2_ACCESS_KEY_ID="fake_example_access_key"
export R2_SECRET_ACCESS_KEY="fake_example_secret_key"
export R2_ENDPOINT="https://fake-example.r2.cloudflarestorage.com"
export R2_BUCKET="extended"
```

The ingestion script does not print full secret values.

## Folder layout

Example input:

```text
~/works/A_Certain_Magical_Index/
  volume_1/
    chapter_1/
      001.jpg
      002.jpg
      003.jpg
    chapter_2/
      001.jpg
      002.jpg
  volume_2/
    chapter_3/
      001.jpg
```

The script detects chapter folders by finding directories with image files. For every chapter folder it deduces page count, image extension, filename padding, and the chapter CDN `base_url`.

## Guided mode

Run:

```sh
python scripts/ingest-work.py
```

The wizard asks for the work folder, slug, title, source, optional parent work id, CDN base, data folder, image processing choices, catalog/search updates, upload settings, and optional GitHub commit/push settings.

## One-command mode

```sh
python scripts/ingest-work.py ~/works/A_Certain_Magical_Index \
  --slug A_Certain_Magical_Index \
  --display "A Certain Magical Index" \
  --source e \
  --parent-work-id 28345984 \
  --cdn-base https://cdn.animeplex.lol/works \
  --repo-data src/data \
  --resize-width 600 \
  --quality 85 \
  --convert webp \
  --generate-thumb \
  --update-fetch \
  --update-rotunda \
  --generate-search \
  --upload rclone \
  --remote animeplex-r2:works \
  --yes
```

## Safety flags

- `--dry-run`: print commands and calculate outputs without writing/uploading.
- `--yes`: reserved for non-interactive confirmations.
- `--no-upload`: skip upload even if `--upload` is present.
- `--no-search`: skip search regeneration.
- `--no-rotunda`: skip `rotunda.json` update.
- `--no-fetch-update`: skip `fetch.json` update.
- `--force`: reserved for overwrite workflows.
- `--delete-originals`: only delete originals after conversion when this flag is explicitly set.

## Generated files

Each detected chapter receives a local `item.json` before upload, for example:

```text
volume_1/chapter_1/item.json
volume_1/chapter_2/item.json
```

Each `item.json` contains only that chapter's metadata: `version`, `id`, optional `parent_work_id`, `parent_work_slug`, `slug`, `type`, `title`, `subtitle`, `base_url`, `pages`, `padding`, and `extension`.

The script also writes a pointer work manifest:

```text
src/data/works/<slug>.json
```

and can upsert matching pointer entries into:

```text
src/data/fetch.json
src/data/rotunda.json
```

## Search generation

After updating `fetch.json`, the script can run:

```sh
python scripts/generate_search.py \
  --fetch src/data/fetch.json \
  --storage src/data/storage.json \
  --out src/data/search.index.json \
  --source e
```

`generate_search.py` supports both legacy embedded `chapters` arrays and pointer entries that use `"manifest": "works/<slug>.json"`. Pointer manifests are loaded from the data directory next to `fetch.json`.

## Upload order

The script intentionally performs upload last:

1. Validate folder.
2. Normalize/resize images if requested.
3. Generate `thumb.webp` if requested.
4. Generate one `item.json` per chapter folder.
5. Generate `src/data/works/<slug>.json`.
6. Update `fetch.json`.
7. Update `rotunda.json`.
8. Regenerate `search.index.json`.
9. Upload the completed work folder to R2/CDN.
10. Optionally commit/push GitHub changes.

## Upload examples

Rclone:

```sh
rclone copy ~/works/A_Certain_Magical_Index animeplex-r2:works/A_Certain_Magical_Index --progress
```

Rsync:

```sh
rsync -av --progress ~/works/A_Certain_Magical_Index/ <remote>/A_Certain_Magical_Index/
```
