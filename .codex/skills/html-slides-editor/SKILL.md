---
name: html-slides-editor
description: Add an embedded manual editing layer to AI-generated HTML slides so the preview itself shows a top editing banner with editing status, pause/resume editing, undo/redo, direct text editing, drag-to-replace images, and auto-save back to disk.
metadata:
  short-description: Embedded editor for HTML slides
---

# HTML Slides Editor

Use this skill when the user wants to manually polish AI-generated HTML slides directly in the browser preview.

## Guardrails

- Do not build a Chrome extension.
- Do not treat this as an HTML checker.
- Do not rewrite slide content unless the user asks.
- Preserve the user's HTML as a normal local file.
- Use a local server, not `file://`, when edits need to save back to disk.

## Default Flow

1. Find the target HTML file.
2. Enable the editor with autosave and a local preview server.
3. Give the user the printed `http://127.0.0.1:<port>/` URL.
4. Verify the top editor banner appears.

After npm publishing, prefer:

```bash
npx html-slides-editor enable --autosave --serve path/to/index.html
```

Inside this repository checkout, use:

```bash
node bin/html-slides-editor.js enable --autosave --serve path/to/index.html
```

To turn the editor off:

```bash
npx html-slides-editor disable path/to/index.html
```

Local checkout equivalent:

```bash
node bin/html-slides-editor.js disable path/to/index.html
```

## When Editing The Skill

Before changing runtime behavior, autosave behavior, the switch script, CLI distribution, or public packaging, read `references/spec.md` and verify against its regression checklist.

Key requirements live there, including direct text editing, image replacement, crop behavior, persistent save cleanup, and navigation compatibility.

## Report Back

Tell the user:

- whether the editor is enabled or disabled;
- which URL to open;
- whether edits are persistent;
- which files changed.
