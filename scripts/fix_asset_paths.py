"""Normalise asset paths in HTML files so they point to the repository assets directory.

Many of the generated study notes include static ``href``/``src`` attributes that
attempt to reference ``assets/`` from deep within ``content``. In several cases
these relative paths are incorrect, which breaks styling/scripts when the pages
are opened directly. This script rewrites those attributes so that they point to
the correct location based on each file’s depth.
"""
from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Iterable

ASSET_ATTR_PATTERN = re.compile(r'(?P<attr>href|src)="(?P<path>[^"]*)"')


def iter_html_files(root: Path) -> Iterable[Path]:
    for path in root.rglob("*.html"):
        if path.is_file():
            yield path


def rewrite_attribute(path: str, html_file: Path, assets_dir: Path) -> tuple[str, bool]:
    # Ignore absolute URLs and external references.
    if path.startswith(("http://", "https://", "//", "mailto:", "javascript:")):
        return path, False

    asset_marker = "assets/"
    marker_index = path.find(asset_marker)
    if marker_index == -1:
        return path, False

    rest = path[marker_index + len(asset_marker) :]
    if not rest:
        return path, False

    relative_assets = Path(os.path.relpath(assets_dir, html_file.parent))
    corrected = (relative_assets / rest).as_posix()

    if corrected == path:
        return path, False

    return corrected, True


def fix_file(html_file: Path, assets_dir: Path) -> bool:
    original = html_file.read_text(encoding="utf-8")
    changed = False

    def substitute(match: re.Match[str]) -> str:
        nonlocal changed
        attr = match.group("attr")
        value = match.group("path")
        new_value, updated = rewrite_attribute(value, html_file, assets_dir)
        if updated:
            changed = True
            return f'{attr}="{new_value}"'
        return match.group(0)

    rewritten = ASSET_ATTR_PATTERN.sub(substitute, original)

    if changed:
        html_file.write_text(rewritten, encoding="utf-8")

    return changed


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    assets_dir = root / "assets"
    html_root = root / "content"

    changed_files = []
    for html_file in iter_html_files(html_root):
        if fix_file(html_file, assets_dir):
            changed_files.append(html_file.relative_to(root))

    if not changed_files:
        print("No asset paths required updates.")
    else:
        print("Updated asset paths in the following files:")
        for file in changed_files:
            print(f" - {file}")


if __name__ == "__main__":
    main()
