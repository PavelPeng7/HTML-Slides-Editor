# HTML Slides Editor

AI agents are good at generating HTML slides, but tiny presentation edits should not require another prompt. This gives users a direct manipulation layer for the last mile: fix a word, replace a picture, adjust an image crop, and keep the result in the source HTML.

It ships as a Codex skill and as the [`html-slides-editor`](https://www.npmjs.com/package/html-slides-editor) npm CLI, so it works inside Codex, in any other AI coding agent, or straight from a terminal.

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

## Distribution Checklist

Use this checklist when submitting to a skill store:

- Skill folder is `.codex/skills/html-slides-editor`
- `SKILL.md` has a stable `name: html-slides-editor`
- The README explains the user value, install path, and persistence model
- License is MIT
- No Chrome extension dependency
- Runtime assets are bundled under `assets/`
- Switch script is bundled under `scripts/`
- npm CLI is exposed as `html-slides-editor`
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
