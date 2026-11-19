"""Extract text and page images from the archived reference documents.

* Text for every page of every PDF is written to references/text/<docId>/page-NNN.txt
  (small, committed, used to curate src/data).
* WebP page images are rendered only for pages cited in src/data/lines/*.json
  (field `sources[].page`) and written to public/references/<docId>/page-N.webp,
  so the deployed site can show them.
* Standalone images (jpg/png/...) that are cited are converted to WebP the same way (page 1).
* The page count of each PDF is written back to references/manifest.json.

Run: .venv/bin/python -I scripts/extract_references.py [--all-images DOC_ID ...]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "references" / "manifest.json"
TEXT_DIR = ROOT / "references" / "text"
IMG_DIR = ROOT / "public" / "references"
DATA_DIR = ROOT / "src" / "data" / "lines"

MAX_WIDTH = 1600
WEBP_QUALITY = 70
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".gif", ".webp"}


def cited_pages() -> dict[str, set[int]]:
    """Collect {docId: {pages}} for every source cited in src/data/lines/*.json."""
    cited: dict[str, set[int]] = {}

    def visit(node: object) -> None:
        if isinstance(node, dict):
            if "docId" in node and isinstance(node.get("docId"), str):
                page = node.get("page")
                cited.setdefault(node["docId"], set()).add(page if isinstance(page, int) else 1)
            for value in node.values():
                visit(value)
        elif isinstance(node, list):
            for value in node:
                visit(value)

    for file in sorted(DATA_DIR.glob("*.json")):
        visit(json.loads(file.read_text(encoding="utf-8")))
    return cited


def save_webp(image: Image.Image, target: Path) -> None:
    """Save an image as WebP, downscaled to MAX_WIDTH."""
    if image.width > MAX_WIDTH:
        image = image.resize((MAX_WIDTH, round(image.height * MAX_WIDTH / image.width)))
    target.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(target, "WEBP", quality=WEBP_QUALITY, method=6)


def render_pdf_page(doc: pymupdf.Document, page_number: int, target: Path) -> None:
    """Render one (1-based) PDF page to WebP."""
    page = doc[page_number - 1]
    zoom = min(4.0, MAX_WIDTH / max(page.rect.width, 1))
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
    save_webp(Image.frombytes("RGB", (pix.width, pix.height), pix.samples), target)


def main() -> int:
    """Entry point."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--all-images", nargs="*", default=[], help="doc ids to render every page for")
    parser.add_argument("--skip-text", action="store_true")
    args = parser.parse_args()

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    cited = cited_pages()
    for doc_id in args.all_images:
        cited.setdefault(doc_id, set()).add(-1)

    for entry in manifest["documents"]:
        path = ROOT / entry["path"]
        suffix = path.suffix.lower()
        doc_id = entry["id"]
        if suffix == ".pdf":
            try:
                doc = pymupdf.open(path)
            except Exception as error:
                print(f"skip {entry['path']}: {error}", file=sys.stderr)
                continue
            entry["pages"] = doc.page_count
            if not args.skip_text:
                out = TEXT_DIR / doc_id
                out.mkdir(parents=True, exist_ok=True)
                for index, page in enumerate(doc, start=1):
                    (out / f"page-{index:03d}.txt").write_text(page.get_text(), encoding="utf-8")
            pages = cited.get(doc_id, set())
            if -1 in pages:
                pages = set(range(1, doc.page_count + 1))
            for page_number in sorted(pages):
                if 1 <= page_number <= doc.page_count:
                    target = IMG_DIR / doc_id / f"page-{page_number}.webp"
                    if not target.exists():
                        render_pdf_page(doc, page_number, target)
        elif suffix in IMAGE_EXTS and doc_id in cited:
            target = IMG_DIR / doc_id / "page-1.webp"
            if not target.exists():
                with Image.open(path) as image:
                    save_webp(image, target)

    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"processed {len(manifest['documents'])} documents")
    return 0


if __name__ == "__main__":
    sys.exit(main())
