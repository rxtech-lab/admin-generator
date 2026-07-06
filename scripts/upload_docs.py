#!/usr/bin/env python3
"""Upload repository docs to the RxLab docs service."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


BATCH_SIZE = 50
DEFAULT_ENDPOINT = "https://autopilot.rxlab.app"


class DocError(Exception):
    pass


def parse_frontmatter(text: str, path: Path) -> tuple[dict[str, str], str] | None:
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---\n", 4)
    if end == -1:
        raise DocError(f"{path}: frontmatter starts with --- but never closes")

    raw = text[4:end]
    body = text[end + len("\n---\n") :]
    meta: dict[str, str] = {}
    for line_number, line in enumerate(raw.splitlines(), start=2):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if ":" not in stripped:
            raise DocError(f"{path}:{line_number}: expected 'key: value' frontmatter")
        key, value = stripped.split(":", 1)
        meta[key.strip()] = value.strip().strip("\"'")
    return meta, body


def collect_docs(docs_dir: Path) -> list[dict[str, str]]:
    if not docs_dir.exists():
        raise DocError(f"{docs_dir}: docs directory does not exist")

    documents: list[dict[str, str]] = []
    seen: dict[str, Path] = {}
    for path in sorted(docs_dir.rglob("*.md")):
        parsed = parse_frontmatter(path.read_text(encoding="utf-8"), path)
        if parsed is None:
            continue
        meta, body = parsed
        slug = meta.get("slug", "").strip()
        if not slug:
            continue
        if slug in seen:
            raise DocError(f"{path}: duplicate slug {slug!r}; first seen in {seen[slug]}")
        seen[slug] = path
        documents.append({"docId": slug, "content": body})
    return documents


def batches(items: list[dict[str, str]], size: int) -> Iterable[list[dict[str, str]]]:
    for index in range(0, len(items), size):
        yield items[index : index + size]


def upload_batch(endpoint: str, repository: str, token: str, batch: list[dict[str, str]]) -> dict[str, object]:
    encoded_repo = quote(repository, safe="")
    url = f"{endpoint.rstrip('/')}/api/v1/docs/repositories/{encoded_repo}/documents"
    request = Request(
        url,
        data=json.dumps({"documents": batch}).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=60) as response:
            payload = response.read().decode("utf-8")
            if response.status < 200 or response.status >= 300:
                raise DocError(f"upload failed: HTTP {response.status}: {payload}")
            if not payload:
                return {"status": response.status}
            return json.loads(payload)
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise DocError(f"upload failed: HTTP {exc.code}: {detail}") from exc
    except URLError as exc:
        raise DocError(f"upload failed: {exc.reason}") from exc


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload markdown docs to the docs service.")
    parser.add_argument("--dry-run", action="store_true", help="Parse and batch docs without uploading.")
    parser.add_argument("--docs-dir", default="docs", help="Documentation directory. Defaults to docs.")
    args = parser.parse_args()

    endpoint = os.environ.get("DOCS_ENDPOINT", DEFAULT_ENDPOINT)
    repository = os.environ.get("DOCS_REPOSITORY_ID")
    token = os.environ.get("DOCS_UPLOAD_TOKEN")

    if not repository:
        print("DOCS_REPOSITORY_ID is required", file=sys.stderr)
        return 2
    if not args.dry_run and not token:
        print("DOCS_UPLOAD_TOKEN is required unless --dry-run is used", file=sys.stderr)
        return 2

    try:
        documents = collect_docs(Path(args.docs_dir))
        if not documents:
            raise DocError("no markdown documents with slug frontmatter found")

        batch_count = (len(documents) + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"repository: {repository}")
        print(f"endpoint: {endpoint.rstrip('/')}")
        print(f"documents: {len(documents)}")
        print(f"batches: {batch_count}")
        for document in documents:
            print(f"- {document['docId']}")

        if args.dry_run:
            print("dry run: no upload performed")
            return 0

        for index, batch in enumerate(batches(documents, BATCH_SIZE), start=1):
            result = upload_batch(endpoint, repository, token or "", batch)
            print(f"uploaded batch {index}/{batch_count}: {json.dumps(result, sort_keys=True)}")
        return 0
    except DocError as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
