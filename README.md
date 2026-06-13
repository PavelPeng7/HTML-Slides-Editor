# HTML Slides Editor

AI agents are good at generating HTML slides, but tiny presentation edits should not require another prompt. This gives users a direct manipulation layer for the last mile: fix a word, replace a picture, adjust an image crop, and keep the result in the source HTML.

It ships as a Codex skill and as the [`html-slides-editor`](https://www.npmjs.com/package/html-slides-editor) npm CLI, so it works inside Codex, in any other AI coding agent, or straight from a terminal.

![HTML Slides Editor — the editor running on its own landing page](https://raw.githubusercontent.com/imvanessali/HTML-Slides-Editor/main/media/landing.jpg)

> The landing page above is itself editable — see it live at [imvanessa.li/slides](https://imvanessa.li/slides/) (desktop only).

## Features

- Direct text editing in the rendered HTML preview
- Drag and drop image replacement
- Fixed-size image frames with crop and cover behavior
- Undo and redo for editing sessions
- Pause editing to restore normal slide navigation
- Auto-save back to `index.html`

## Install and use

This skill was built for Codex, but it works with any AI coding agent or a plain terminal. Pick the path that matches your setup.

### If you use Codex

1. Add this repository as a skill source:

   ```text
   https://github.com/imvanessali/HTML-Slides-Editor
   ```

2. Then just ask:

   ```text
   Use HTML Slides Editor on this HTML slide deck.
   ```

Codex runs the CLI for you, enables autosave, starts the local preview server, and hands you the URL. You don't need to remember any commands.

### If you use another agent or a terminal

Works with Claude Code, Cursor, Windsurf, or a plain terminal — anywhere you can run `npx`. The package is published on npm as [`html-slides-editor`](https://www.npmjs.com/package/html-slides-editor):

```bash
npx html-slides-editor enable --autosave --serve path/to/index.html
```

That command injects the editor, enables saving, and starts a local preview server. Open the printed URL, usually:

```text
http://127.0.0.1:8765/
```

Other useful commands:

```bash
npx html-slides-editor disable path/to/index.html
npx html-slides-editor status path/to/index.html
npx html-slides-editor serve path/to/index.html --port 8765
```

> Working from a local checkout of this repo instead of npm? Replace `npx html-slides-editor` with `node bin/html-slides-editor.js` in any command above.

**Do not use `file://` when edits need to persist.** Browsers cannot write local files from a direct file preview, so persistent saving requires the local server from `--serve`.

---

⭐ Found this useful? Star the repo to help others find it.
