#!/usr/bin/env python3
"""Enable or disable the embedded HTML Slides Editor for an HTML slides file."""

from __future__ import annotations

import argparse
import re
import shutil
from pathlib import Path


RUNTIME_NAME = "html-slides-editor-runtime.js"
RUNTIME_VERSION = "20260611-drag-overlay"
SCRIPT_SRC = f"./assets/{RUNTIME_NAME}?v={RUNTIME_VERSION}"
SCRIPT_TAG = f'<script src="{SCRIPT_SRC}"></script>'


def skill_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def default_slides(root: Path) -> Path:
    return root / "PPT for HTML/decks/ai-workflow-methodology/ppt/index.html"


def runtime_source() -> Path:
    return skill_dir() / "assets" / RUNTIME_NAME


def normalize_html_path(path_arg: str | None, root: Path) -> Path:
    path = Path(path_arg).expanduser() if path_arg else default_slides(root)
    if not path.is_absolute():
        path = root / path
    return path.resolve()


def copy_runtime(html_path: Path) -> Path:
    src = runtime_source()
    if not src.exists():
        raise FileNotFoundError(f"Runtime not found: {src}")

    assets_dir = html_path.parent / "assets"
    assets_dir.mkdir(exist_ok=True)
    dest = assets_dir / RUNTIME_NAME
    shutil.copy2(src, dest)
    return dest


def enable_editor(html_path: Path) -> str:
    if not html_path.exists():
        raise FileNotFoundError(f"HTML file not found: {html_path}")

    copy_runtime(html_path)
    html = html_path.read_text(encoding="utf-8")

    pattern = runtime_script_pattern()
    if SCRIPT_TAG in html:
        return "already-enabled"

    if pattern.search(html):
        html_path.write_text(pattern.sub(f"\n{SCRIPT_TAG}\n", html, count=1), encoding="utf-8")
        return "updated"

    if "</body>" not in html:
        html = html.rstrip() + "\n" + SCRIPT_TAG + "\n"
    else:
        html = html.replace("</body>", f"{SCRIPT_TAG}\n</body>", 1)

    html_path.write_text(html, encoding="utf-8")
    return "enabled"


def disable_editor(html_path: Path) -> str:
    if not html_path.exists():
        raise FileNotFoundError(f"HTML file not found: {html_path}")

    html = html_path.read_text(encoding="utf-8")
    pattern = runtime_script_pattern()
    new_html, count = pattern.subn("\n", html)
    if count:
        html_path.write_text(new_html, encoding="utf-8")
        return "disabled"
    return "already-disabled"


def runtime_script_pattern() -> re.Pattern[str]:
    return re.compile(
        r"\n?\s*<script\s+src=[\"']\.?/assets/html-(?:slides|deck)-editor-runtime\.js(?:\?[^\"']*)?[\"']>\s*</script>\s*",
        re.IGNORECASE,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["enable", "disable", "on", "off"], help="Turn the embedded editor on or off.")
    parser.add_argument("html", nargs="?", help="Path to the slides index.html. Defaults to the sample slides.")
    args = parser.parse_args()

    root = Path.cwd().resolve()
    html_path = normalize_html_path(args.html, root)
    mode = "enable" if args.mode in {"enable", "on"} else "disable"
    result = enable_editor(html_path) if mode == "enable" else disable_editor(html_path)

    print(f"{result}: {html_path}")
    if mode == "enable":
        print(f"runtime: {html_path.parent / 'assets' / RUNTIME_NAME}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
