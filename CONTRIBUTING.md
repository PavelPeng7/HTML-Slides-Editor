# Maintainer Notes

Internal notes for maintaining and distributing this project. End users do not need any of this — see [README.md](README.md) for install and usage.

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
