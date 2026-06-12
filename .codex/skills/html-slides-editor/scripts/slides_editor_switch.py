#!/usr/bin/env python3
"""Enable or disable the embedded HTML Slides Editor for an HTML slides file."""

from __future__ import annotations

import argparse
import re
import shutil
from pathlib import Path


RUNTIME_NAME = "html-slides-editor-runtime.js"
RUNTIME_VERSION = "20260612-green-blue-pink"
SCRIPT_SRC = f"./assets/{RUNTIME_NAME}?v={RUNTIME_VERSION}"
SCRIPT_TAG = f'<script src="{SCRIPT_SRC}"></script>'
AUTOSAVE_NAME = "html-slides-editor-autosave.html"
SAVE_SERVER_NAME = "html-slides-editor-server.js"
AUTOSAVE_START = "<!-- HTML Slides Editor autosave start -->"
AUTOSAVE_END = "<!-- HTML Slides Editor autosave end -->"


def skill_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def default_slides(root: Path) -> Path:
    return root / "PPT for HTML/decks/ai-workflow-methodology/ppt/index.html"


def runtime_source() -> Path:
    return skill_dir() / "assets" / RUNTIME_NAME


def autosave_source() -> Path:
    return skill_dir() / "assets" / AUTOSAVE_NAME


def save_server_source() -> Path:
    return skill_dir() / "assets" / SAVE_SERVER_NAME


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


def copy_save_server(html_path: Path) -> Path:
    src = save_server_source()
    if not src.exists():
        raise FileNotFoundError(f"Save server not found: {src}")

    dest = html_path.parent / SAVE_SERVER_NAME
    shutil.copy2(src, dest)
    return dest


def autosave_snippet() -> str:
    src = autosave_source()
    if not src.exists():
        raise FileNotFoundError(f"Autosave snippet not found: {src}")
    return src.read_text(encoding="utf-8").strip() + "\n"


def insert_before_body(html: str, snippet: str) -> str:
    if "</body>" not in html:
        return html.rstrip() + "\n" + snippet
    return html.replace("</body>", snippet + "</body>", 1)


def enable_editor(html_path: Path, autosave: bool = False) -> str:
    if not html_path.exists():
        raise FileNotFoundError(f"HTML file not found: {html_path}")

    copy_runtime(html_path)
    html = html_path.read_text(encoding="utf-8")
    original_html = html

    pattern = runtime_script_pattern()
    if SCRIPT_TAG in html:
        result = "already-enabled"
    elif pattern.search(html):
        html = pattern.sub(f"\n{SCRIPT_TAG}\n", html, count=1)
        result = "updated"
    else:
        html = insert_before_body(html, SCRIPT_TAG + "\n")
        result = "enabled"

    if autosave:
        copy_save_server(html_path)
        html = autosave_pattern().sub("\n", html)
        html = legacy_autosave_pattern().sub("\n", html)
        html = insert_before_body(html, autosave_snippet())
        if result == "already-enabled":
            result = "autosave-enabled"

    if html != original_html:
        html_path.write_text(html, encoding="utf-8")
    return result


def disable_editor(html_path: Path) -> str:
    if not html_path.exists():
        raise FileNotFoundError(f"HTML file not found: {html_path}")

    html = html_path.read_text(encoding="utf-8")
    pattern = runtime_script_pattern()
    new_html, count = pattern.subn("\n", html)
    new_html, autosave_count = autosave_pattern().subn("\n", new_html)
    new_html, legacy_autosave_count = legacy_autosave_pattern().subn("\n", new_html)
    if count or autosave_count or legacy_autosave_count:
        html_path.write_text(new_html, encoding="utf-8")
        return "disabled"
    return "already-disabled"


def runtime_script_pattern() -> re.Pattern[str]:
    return re.compile(
        r"\n?\s*<script\s+src=[\"']\.?/assets/html-(?:slides|deck)-editor-runtime\.js(?:\?[^\"']*)?[\"']>\s*</script>\s*",
        re.IGNORECASE,
    )


def autosave_pattern() -> re.Pattern[str]:
    return re.compile(
        r"\n?\s*" + re.escape(AUTOSAVE_START) + r"[\s\S]*?" + re.escape(AUTOSAVE_END) + r"\s*",
        re.IGNORECASE,
    )


def legacy_autosave_pattern() -> re.Pattern[str]:
    return re.compile(
        r"\n?\s*<script>\s*\(function\s*\(\)\s*\{\s*var\s+saveTimer[\s\S]*?fetch\([\"']/save[\"'][\s\S]*?\}\)\(\);\s*</script>\s*",
        re.IGNORECASE,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["enable", "disable", "on", "off"], help="Turn the embedded editor on or off.")
    parser.add_argument("html", nargs="?", help="Path to the slides index.html. Defaults to the sample slides.")
    parser.add_argument("--autosave", action="store_true", help="Also inject autosave and copy the local save server.")
    parse_args = getattr(parser, "parse_intermixed_args", parser.parse_args)
    args = parse_args()

    root = Path.cwd().resolve()
    html_path = normalize_html_path(args.html, root)
    mode = "enable" if args.mode in {"enable", "on"} else "disable"
    result = enable_editor(html_path, autosave=args.autosave) if mode == "enable" else disable_editor(html_path)

    print(f"{result}: {html_path}")
    if mode == "enable":
        print(f"runtime: {html_path.parent / 'assets' / RUNTIME_NAME}")
        if args.autosave:
            print(f"save server: node {html_path.parent / SAVE_SERVER_NAME} 8765")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
