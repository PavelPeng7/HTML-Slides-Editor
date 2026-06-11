# HTML Slides Editor

HTML Slides Editor is a Codex skill for making AI-generated HTML slide decks editable directly inside their browser preview.

It adds a small editor bar to an existing `index.html`, lets users edit rendered text like a document, drag and drop images to replace existing visuals, undo and redo changes, and persist edits back to disk through a local save server.

## Why This Skill Exists

AI agents are good at generating HTML slides, but tiny presentation edits should not require another prompt. This skill gives users a direct manipulation layer for the last mile: fix a word, replace a picture, adjust an image crop, and keep the result in the source HTML.

## Features

- Direct text editing in the rendered HTML preview
- Drag and drop image replacement
- Fixed-size image frames with crop and cover behavior
- Undo and redo for editing sessions
- Pause editing to restore normal slide navigation
- Auto-save back to `index.html`

## Skill Location

The distributable skill lives at:

```text
.codex/skills/html-slides-editor/
```

The skill entry point is:

```text
.codex/skills/html-slides-editor/SKILL.md
```

## Install

In Codex, install this repository as a skill source:

```text
https://github.com/imvanessali/HTML-Slides-Editor
```

Then ask Codex:

```text
Use HTML Slides Editor on this HTML slide deck.
```

For a local checkout, the core command is:

```bash
python3 .codex/skills/html-slides-editor/scripts/slides_editor_switch.py enable --autosave path/to/index.html
node path/to/html-slides-editor-server.js 8765
```

Open the generated local server URL, such as:

```text
http://127.0.0.1:8765/
```

Do not use `file://` when edits need to persist. Browsers cannot write local files from a direct file preview.

## Distribution Checklist

Use this checklist when submitting to a skill store:

- Skill folder is `.codex/skills/html-slides-editor`
- `SKILL.md` has a stable `name: html-slides-editor`
- The README explains the user value, install path, and persistence model
- License is MIT
- No Chrome extension dependency
- Runtime assets are bundled under `assets/`
- Switch script is bundled under `scripts/`
- Store card metadata is present in `agents/openai.yaml`
- The sample decks demonstrate both a general slide deck and a travel deck

## Repository Page

The GitHub Pages site source is in:

```text
docs/index.html
```

Enable GitHub Pages from the repository settings and choose the `docs/` folder as the source.

## License

MIT License. See [LICENSE](LICENSE).
