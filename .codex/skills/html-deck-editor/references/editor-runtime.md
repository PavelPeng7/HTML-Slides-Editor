# Embedded Editor Runtime Notes

The runtime in `assets/html-slides-editor-runtime.js` is meant to be added to generated HTML slides. It creates a fixed top banner and enables manual DOM editing in the preview.

## Expected User Experience

- User opens the HTML preview.
- Banner appears at the top.
- Banner says `Editing`.
- User clicks text directly and types.
- User drags an image file onto an existing image/visual to replace it.
- User can undo, redo, and stop editing from the banner.

## Integration Options

Single-file HTML:

```html
<script>
/* paste assets/html-slides-editor-runtime.js here */
</script>
</body>
```

Multi-file HTML:

```html
<script src="./html-slides-editor-runtime.js"></script>
</body>
```

## Durable Export Caveat

Object URLs created by `URL.createObjectURL(file)` do not survive reloads. If persistent export is required, adjust the image replacement path to read the file as a Data URL and set `src` / `backgroundImage` to that Data URL.
