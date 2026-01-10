"""Utility script to verify that all local links in the HTML files resolve.

The script crawls through every HTML file in the repository and inspects common
attributes that reference other files (such as ``href`` and ``src``). For any
relative path, it checks whether a matching file exists on disk. If any
references cannot be resolved a non-zero exit code is returned.
"""
from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable, List, Sequence, Tuple
from urllib.parse import urlparse

# Tags whose ``href`` or ``src`` attribute we want to validate.
HREF_TAGS = {"a", "link"}
SRC_TAGS = {"script", "img", "source"}


@dataclass
class Reference:
    """A reference discovered in an HTML file."""

    tag: str
    attribute: str
    value: str
    source_file: Path


class ReferenceCollector(HTMLParser):
    """Collect ``href``/``src`` attributes during HTML parsing."""

    def __init__(self, html_file: Path) -> None:
        super().__init__()
        self.html_file = html_file
        self.references: List[Reference] = []

    def handle_starttag(self, tag: str, attrs: Sequence[Tuple[str, str]]) -> None:  # type: ignore[override]
        attribute_name = None
        if tag in HREF_TAGS:
            attribute_name = "href"
        elif tag in SRC_TAGS:
            attribute_name = "src"

        if not attribute_name:
            return

        for name, value in attrs:
            if name != attribute_name or value is None:
                continue
            value = value.strip()
            if not value:
                continue
            self.references.append(
                Reference(tag=tag, attribute=attribute_name, value=value, source_file=self.html_file)
            )


def iter_html_files(root: Path) -> Iterable[Path]:
    for path in root.rglob("*.html"):
        if path.is_file():
            yield path


def resolve_reference(root: Path, reference: Reference) -> Path | None:
    parsed = urlparse(reference.value)

    # Skip remote links, anchors, javascript pseudo URLs, and protocol-relative links.
    if parsed.scheme or parsed.netloc:
        return None

    if not parsed.path or parsed.path.startswith("#"):
        return None

    if parsed.path.startswith("//") or parsed.path.startswith("javascript:"):
        return None

    # Normalise the path relative to the HTML file and resolve relative segments.
    candidate = (reference.source_file.parent / Path(parsed.path)).resolve()

    try:
        candidate.relative_to(root)
    except ValueError:
        # The reference points outside the repository (e.g., ../../etc/passwd).
        return candidate

    return candidate


def validate_references(root: Path) -> List[Reference]:
    missing: List[Reference] = []

    for html_file in iter_html_files(root):
        collector = ReferenceCollector(html_file)
        collector.feed(html_file.read_text(encoding="utf-8"))

        for reference in collector.references:
            resolved = resolve_reference(root, reference)
            if resolved is None:
                continue

            if not resolved.exists():
                missing.append(reference)

    return missing


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="Repository root directory",
    )
    args = parser.parse_args(argv)

    root = args.root.resolve()
    missing = validate_references(root)

    if not missing:
        print("All local HTML references resolved successfully.")
        return 0

    print("Found unresolved references:")
    for reference in missing:
        print(
            f" - {reference.source_file.relative_to(root)}: <{reference.tag}> "
            f"{reference.attribute}='{reference.value}'"
        )

    return 1


if __name__ == "__main__":
    sys.exit(main())
