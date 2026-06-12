# HTML Slides Editor Spec

This spec is the source of truth for the `html-slides-editor` skill. The final product is a distributable Codex skill for people who make slide decks as HTML and want to manually polish those decks in the browser preview.

## Product Goal

HTML Slides Editor turns an AI-generated HTML slide deck into a directly editable preview. Users should be able to make last-mile changes without asking the AI agent for every small revision:

- edit visible slide text directly;
- replace existing images by dragging a new image onto them;
- keep each replacement image inside the old image area;
- crop replacement images visually;
- undo and redo editing actions;
- save edits back to the HTML file when autosave is enabled.

The skill must not be an HTML checker. It must not require a Chrome extension. It must work by embedding a runtime into the target HTML and, for persistence, using a local save server.

## Target Users

- People generating HTML slide decks with AI agents.
- People who need quick manual edits to copy, imagery, and image crops.
- People who want the edited result to remain an ordinary HTML deck that can be committed, shared, or hosted.

## Non-Goals

- Do not build a general-purpose web page builder.
- Do not edit canvas pixels, video frames, WebGL scenes, or screenshots.
- Do not invent slide content or rewrite the deck unless the user asks.
- Do not require browser extensions, external cloud services, or hosted accounts.
- Do not save temporary editor UI into the final HTML.

## Feature Specs

### 1. Enable And Disable Editor

**Trigger:** Codex uses this skill on a target `index.html` or other HTML slide file.

**Behavior:**

- The switch script copies the runtime into a nearby `assets/` directory.
- The script injects exactly one runtime `<script>` tag.
- With `--autosave`, the script also injects exactly one autosave snippet and copies a local save server.
- Re-running enable must not duplicate script tags or autosave snippets.
- Disable removes the runtime tag and autosave snippet.

**Acceptance:**

- Enable twice produces one runtime tag.
- Enable twice with autosave produces one autosave block.
- Disable twice is a no-op.
- The target HTML still loads as normal HTML after disabling.

### 2. Editor Banner

**Behavior:**

- A fixed top banner appears in the preview when the runtime loads.
- The banner name is `HTML Slides Editor`.
- The banner shows an `Editing` state when active.
- The active state uses a small breathing dot.
- The banner includes undo and redo controls.
- The editing toggle is a single control: active editing can be paused, paused editing can resume.
- The banner itself must not be editable text.

**Acceptance:**

- Clicking text outside the banner edits slide content.
- Clicking banner controls never inserts text into the page.
- Undo/redo controls are visible and do not shift layout.
- The banner does not become part of saved HTML output.

### 3. Text Editing

**Behavior:**

- While active, users can click visible text and type directly in the preview.
- Text editing should feel like editing a document.
- Common slide keyboard shortcuts are blocked while editing, so editing text does not accidentally switch slides.
- Wheel and touch swipe gestures remain available in both Editing and Paused states.
- Pausing editing restores normal deck interactions.
- Pausing editing should actively restore common generated slide controls such as `#nav .dot[data-i]` when possible.
- While editing is active, blocked link, button, or scripted interactive clicks should stay quiet. Guidance lives on the center status control instead of a separate popup.

**Acceptance:**

- Typed text appears in place.
- Undo restores prior text.
- Redo reapplies text.
- Arrow/page/space navigation does not change slides while editing is active.
- Wheel and touch swipe gestures can still change slides while editing is active.
- Normal slide controls work again after editing is paused.
- Bottom slide dots work again after editing is paused.
- When paused, hovering the center status control shows `Editing is paused. You can interact with elements normally.`

### 4. Image Replacement

**Behavior:**

- Users can drag an image file onto an existing visual.
- Supported visual targets:
  - `<img>`;
  - `<picture>` fallback `<img>`;
  - inline `<svg>`;
  - SVG `<image>`;
  - elements with CSS `background-image`.
- While dragging over a valid target, the old image area clearly changes state:
  - a light black overlay appears;
  - the text says `Drop your new image here`;
  - no extra outline is added.
- Dropping an image replaces the old visual.

**Critical requirement:**

The old visual's displayed area is the frame. The frame size must not change just because the new image has a different aspect ratio.

**Acceptance:**

- Dropping a tall image onto a wide old image keeps the old wide area.
- Dropping a wide image onto a tall old image keeps the old tall area.
- The new image fills the old area using cover behavior.
- Overflow is clipped.
- The target does not resize to the new image's natural dimensions.
- Replacement images use persistent `data:` URLs when edits need to survive reloads; never use `blob:` URLs for persisted replacements.

### 5. Image Crop And Resize

**Behavior:**

- After a replacement image is inserted, it fills the old frame with `object-fit: cover`.
- The frame clips overflow.
- A white four-arrow crop/resize handle appears at the bottom-right of the image frame.
- The handle has no circular white background.
- The handle has a shadow so it stays visible on photos.
- Dragging the image pans the crop within the fixed frame.
- Dragging the bottom-right handle scales the image up to crop tighter.
- The kept portion is whatever remains visible inside the original frame.

**Acceptance:**

- Right-bottom crop handle appears after replacing an image.
- The handle also appears when selecting an already-croppable replacement image.
- Dragging the handle scales the image without resizing the frame.
- Dragging the image pans the crop where there is excess image area.
- Crop state is stored in data attributes and survives autosave/reload.

### 6. Image Protection In Editing Mode

**Behavior:**

- Images and crop handles must behave like protected visual objects, not editable text.
- Clicking an image should not place a text cursor into or beside the image.
- Backspace/Delete must not remove images.
- A user should replace an image by drag and drop, not accidentally delete it through designMode selection.

**Acceptance:**

- No visible text caret appears on image click.
- Backspace/Delete does not remove the selected image.
- Backspace/Delete still works for normal text editing.
- Crop controls remain draggable.

### 7. Undo And Redo

**Behavior:**

- Text edits and image replacements create undo history.
- Typing bursts are coalesced into reasonable undo steps.
- Crop changes create undo history when the crop actually changes.
- Undo/redo restores content and image crop state.

**Acceptance:**

- Undo reverts a text edit.
- Undo reverts an image replacement.
- Undo/redo does not restore temporary editor UI into the document.

### 8. Persistence

**Behavior:**

- Preview-only editing may exist, but durable editing requires autosave and a local save server.
- Autosave waits briefly after changes, then posts a cleaned HTML clone to `/save`.
- The server writes that cleaned HTML back to `index.html`.
- A `Saved` label appears briefly in the editor banner after successful save.

**Clean save must keep:**

- user-edited text;
- image `src`;
- SVG image `href`;
- CSS background image URLs;
- crop data attributes;
- inline styles needed to preserve fixed image frames and crop presentation.

**Clean save must strip:**

- editor banner;
- runtime style tag;
- drop overlay;
- crop handles;
- autosave status label;
- pause-to-interact hint;
- drag highlight attributes;
- common script-generated slide controls when the deck rebuilds them on load, such as generated `#nav .dot[data-i]` buttons and generated `#overview` panels;
- transient active/crop body classes.

**Acceptance:**

- A text edit survives reload.
- An image replacement survives reload.
- Crop position/scale survives reload.
- Saved HTML does not contain the editor banner markup.
- Saved HTML does not contain duplicate runtime or autosave snippets.

### 9. Distribution Requirements

**Behavior:**

- The skill folder is `.codex/skills/html-slides-editor`.
- `SKILL.md` has `name: html-slides-editor`.
- Runtime assets live in `assets/`.
- Deterministic scripts live in `scripts/`.
- The repository exposes an npm CLI named `html-slides-editor` for non-Codex agents.
- Detailed specs live in `references/`.
- The repository has an MIT license and a README explaining what the skill does.

**Acceptance:**

- A user can install the repo as a skill source.
- A user can run `npx html-slides-editor enable --autosave --serve path/to/index.html`.
- Codex can discover the skill by name and description.
- The skill instructions are concise; long product details live in this spec.

## Regression Checklist

Before declaring the skill done, verify:

- `npm run check` succeeds.
- `npm pack --dry-run --cache /private/tmp/html-slides-editor-npm-cache` includes the CLI and `.codex/skills/html-slides-editor`.
- `python3 .codex/skills/html-slides-editor/scripts/slides_editor_switch.py enable --autosave path/to/index.html` succeeds.
- The generated page shows the editor banner.
- Text can be edited directly.
- Dragging over an image shows the drop overlay.
- Dropping a new image keeps the old frame size.
- The new image cover-fills the old frame and is clipped.
- The crop handle appears at bottom-right.
- Dragging the handle scales the image inside the fixed frame.
- Clicking an image does not show a text caret.
- Delete/Backspace does not remove images.
- Undo/redo work for text and image replacement.
- Autosave persists text, image, and crop changes.
- Saved HTML is clean and does not contain temporary editor UI.
