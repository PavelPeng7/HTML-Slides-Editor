(() => {
  const BAR_ID = "__html_presentation_editor_bar";
  const STYLE_ID = "__html_presentation_editor_styles";
  const DROP_OVERLAY_ID = "__html_presentation_editor_drop_overlay";
  const CROP_HANDLE_CLASS = "__hpe_crop_handle";
  const CROP_ACTIVE_CLASS = "__hpe_crop_active";
  const CROP_FRAME_CLASS = "__hpe_crop_frame";
  const CROP_HANDLE_ICON = `<svg t="1781145929185" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="5179" width="200" height="200"><path d="M793.002667 853.333333l-97.834667-97.834666a42.666667 42.666667 0 0 1 60.330667-60.330667L853.333333 793.002667V725.333333a42.666667 42.666667 0 0 1 85.333334 0v213.333334h-213.333334a42.666667 42.666667 0 0 1 0-85.333334h67.669334z m0-682.666666H725.333333a42.666667 42.666667 0 0 1 0-85.333334h213.333334v213.333334a42.666667 42.666667 0 0 1-85.333334 0V230.997333l-97.834666 97.834667a42.666667 42.666667 0 0 1-60.330667-60.330667L793.002667 170.666667zM170.666667 230.997333V298.666667a42.666667 42.666667 0 1 1-85.333334 0V85.333333h213.333334a42.666667 42.666667 0 1 1 0 85.333334H230.997333l97.834667 97.834666a42.666667 42.666667 0 0 1-60.330667 60.330667L170.666667 230.997333zM230.997333 853.333333H298.666667a42.666667 42.666667 0 0 1 0 85.333334H85.333333v-213.333334a42.666667 42.666667 0 0 1 85.333334 0v67.669334l97.834666-97.834667a42.666667 42.666667 0 1 1 60.330667 60.330667L230.997333 853.333333z" fill="currentColor" p-id="5180"></path></svg>`;
  const CLICK_BLOCK_EVENTS = ["click", "dblclick", "auxclick"];
  const POINTER_BLOCK_EVENTS = ["pointerdown", "mousedown", "touchstart", "pointerup", "mouseup", "touchend"];
  const GESTURE_BLOCK_EVENTS = ["wheel", "touchstart", "touchmove", "touchend"];
  const ACTIVE_CAPTURE_OPTIONS = { capture: true, passive: false };
  const MAX_HISTORY = 60;
  const HISTORY_INPUT_DELAY = 500;
  const MAX_CROP_SCALE = 4;
  const INTERACTIVE_SELECTOR = [
    "a",
    "button",
    "input",
    "select",
    "textarea",
    "label",
    "summary",
    "[role='button']",
    "[role='link']",
    "[onclick]",
    "[tabindex]"
  ].join(",");
  const VISUAL_SELECTOR = "img, picture, svg, image";

  if (window.__htmlPresentationEditor) {
    window.__htmlPresentationEditor.enable();
    return;
  }

  const state = {
    active: false,
    undoStack: [],
    redoStack: [],
    pendingPreState: null,
    commitTimer: null,
    restoring: false,
    dotRAF: 0,
    highlightedElement: null,
    dragClearTimer: 0,
    cropDrag: null,
    cropFrame: null,
    resizeTimer: 0
  };

  function enable() {
    if (state.active) return;
    state.active = true;
    document.designMode = "on";
    document.body.classList.add("__hpe_editing");
    injectStyles();
    showBar();
    addHistoryListeners();
    addInteractionBlockers();
    document.addEventListener("dragenter", onDragOver, ACTIVE_CAPTURE_OPTIONS);
    document.addEventListener("dragover", onDragOver, ACTIVE_CAPTURE_OPTIONS);
    document.addEventListener("drop", onDrop, ACTIVE_CAPTURE_OPTIONS);
    document.addEventListener("dragleave", onDragLeave, ACTIVE_CAPTURE_OPTIONS);
    document.addEventListener("dragend", clearHighlights, ACTIVE_CAPTURE_OPTIONS);
    document.addEventListener("pointerdown", onCropPointerDown, ACTIVE_CAPTURE_OPTIONS);
    document.addEventListener("pointermove", onCropPointerMove, ACTIVE_CAPTURE_OPTIONS);
    document.addEventListener("pointerup", onCropPointerUp, ACTIVE_CAPTURE_OPTIONS);
    document.addEventListener("pointercancel", onCropPointerUp, ACTIVE_CAPTURE_OPTIONS);
    document.addEventListener("dragstart", onCropDragStart, ACTIVE_CAPTURE_OPTIONS);
    window.addEventListener("resize", scheduleCropRefresh);
    applyAllCrops();
  }

  function disable() {
    commitPendingInput();
    state.active = false;
    document.designMode = "off";
    document.body.classList.remove("__hpe_editing");
    removeHistoryListeners();
    removeInteractionBlockers();
    document.removeEventListener("dragenter", onDragOver, ACTIVE_CAPTURE_OPTIONS);
    document.removeEventListener("dragover", onDragOver, ACTIVE_CAPTURE_OPTIONS);
    document.removeEventListener("drop", onDrop, ACTIVE_CAPTURE_OPTIONS);
    document.removeEventListener("dragleave", onDragLeave, ACTIVE_CAPTURE_OPTIONS);
    document.removeEventListener("dragend", clearHighlights, ACTIVE_CAPTURE_OPTIONS);
    document.removeEventListener("pointerdown", onCropPointerDown, ACTIVE_CAPTURE_OPTIONS);
    document.removeEventListener("pointermove", onCropPointerMove, ACTIVE_CAPTURE_OPTIONS);
    document.removeEventListener("pointerup", onCropPointerUp, ACTIVE_CAPTURE_OPTIONS);
    document.removeEventListener("pointercancel", onCropPointerUp, ACTIVE_CAPTURE_OPTIONS);
    document.removeEventListener("dragstart", onCropDragStart, ACTIVE_CAPTURE_OPTIONS);
    window.removeEventListener("resize", scheduleCropRefresh);
    clearTimeout(state.resizeTimer);
    deactivateCropFrame();
    clearHighlights();
    updateBar();
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes __hpe_breathe {
        0%, 100% {
          opacity: 1;
          transform: scale(1);
          box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.42);
        }
        50% {
          opacity: .62;
          transform: scale(.78);
          box-shadow: 0 0 0 5px rgba(255, 255, 255, 0);
        }
      }
      #${BAR_ID} {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 2147483647;
        height: 56px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        align-items: center;
        column-gap: 14px;
        padding: 0 16px;
        background: transparent;
        color: #fff;
        border-bottom: 0;
        box-shadow: none;
        font: 500 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: 0;
        user-select: none;
      }
      #${BAR_ID}::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        background: linear-gradient(90deg,
          #00c853 0%,
          #00bcd4 30%,
          #2979ff 62%,
          #ff4fd8 100%
        );
        -webkit-mask-image: linear-gradient(180deg, #000 0%, rgba(0, 0, 0, 0) 100%);
        mask-image: linear-gradient(180deg, #000 0%, rgba(0, 0, 0, 0) 100%);
      }
      #${BAR_ID} * { box-sizing: border-box; }
      #${BAR_ID} > * {
        position: relative;
        z-index: 1;
        transform: translateY(-3px);
      }
      #${BAR_ID} .__hpe_title {
        font-weight: 700;
        justify-self: start;
      }
      #${BAR_ID} .__hpe_toggle {
        margin-left: 0;
        justify-self: center;
        position: relative;
        min-width: 82px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.72);
        background: transparent;
        color: #fff;
        font-weight: 650;
      }
      #${BAR_ID} .__hpe_toggle:hover {
        background: transparent;
        opacity: 1;
      }
      #${BAR_ID} .__hpe_toggle::after {
        content: attr(data-hpe-tip);
        position: absolute;
        top: calc(100% + 8px);
        left: 50%;
        transform: translateX(-50%) translateY(-2px);
        width: max-content;
        max-width: calc(100vw - 32px);
        padding: 8px 11px;
        border-radius: 10px;
        background: rgba(20, 20, 24, 0.84);
        color: #fff;
        font-size: 12px;
        line-height: 1.35;
        font-weight: 500;
        white-space: normal;
        overflow-wrap: break-word;
        pointer-events: none;
        opacity: 0;
        transition: opacity .16s ease, transform .16s ease;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
      }
      #${BAR_ID} .__hpe_toggle:hover::after,
      #${BAR_ID} .__hpe_toggle:focus-visible::after {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      #${BAR_ID} .__hpe_state_dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        border: 1px solid currentColor;
        flex: 0 0 auto;
      }
      #${BAR_ID} .__hpe_toggle.__hpe_active .__hpe_state_dot {
        border-color: transparent;
        background: currentColor;
        animation: __hpe_breathe 1.6s ease-in-out infinite;
      }
      body.low-power #${BAR_ID} .__hpe_toggle.__hpe_active .__hpe_state_dot {
        animation: __hpe_breathe 1.6s ease-in-out infinite !important;
      }
      #${BAR_ID} .__hpe_toggle.__hpe_paused .__hpe_state_dot {
        background: transparent;
        animation: none;
      }
      #${BAR_ID} .__hpe_actions {
        justify-self: end;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      #${BAR_ID} button {
        height: 30px;
        border: 0;
        border-radius: 8px;
        padding: 0 11px;
        color: #fff;
        background: transparent;
        font: inherit;
        cursor: pointer;
      }
      #${BAR_ID} button:hover {
        background: transparent;
        opacity: .78;
      }
      [data-hpe-highlight="true"] {
        outline: 0 !important;
        box-shadow: none !important;
      }
      #${DROP_OVERLAY_ID} {
        position: fixed;
        z-index: 2147483646;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        border: 0;
        background: rgba(0, 0, 0, 0.32);
        color: #fff;
        font: 700 14px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: .01em;
        text-align: center;
        text-shadow: 0 1px 8px rgba(0, 0, 0, 0.45);
        will-change: left, top, width, height;
      }
      .${CROP_ACTIVE_CLASS} {
        overflow: hidden !important;
      }
      img[data-hpe-crop="true"] {
        -webkit-user-select: none;
        user-select: none;
        caret-color: transparent;
      }
      .${CROP_ACTIVE_CLASS} img[data-hpe-crop="true"] {
        cursor: grab;
        touch-action: none;
        will-change: transform, object-position;
      }
      body.__hpe_crop_dragging .${CROP_ACTIVE_CLASS} img[data-hpe-crop="true"] {
        cursor: grabbing;
      }
      .${CROP_HANDLE_CLASS} {
        position: absolute;
        right: 8px;
        bottom: 8px;
        z-index: 2147483645;
        width: 26px;
        height: 26px;
        display: grid;
        place-items: center;
        border: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        color: #fff;
        cursor: nwse-resize;
        pointer-events: auto;
      }
      .${CROP_HANDLE_CLASS} svg {
        width: 22px;
        height: 22px;
        display: block;
        filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.72));
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  function showBar() {
    let bar = document.getElementById(BAR_ID);
    if (!bar) {
      bar = document.createElement("div");
      bar.id = BAR_ID;
      bar.contentEditable = "false";
      bar.innerHTML = `
        <div class="__hpe_title">HTML Slides Editor</div>
        <button type="button" class="__hpe_toggle __hpe_active" data-hpe-action="toggle" data-hpe-tip="Edit text freely. Drag and drop to replace an image.">
          <span class="__hpe_state_dot" aria-hidden="true"></span>
          <span data-hpe-toggle-label>Editing</span>
        </button>
        <div class="__hpe_actions">
          <button type="button" data-hpe-action="undo">Undo</button>
          <button type="button" data-hpe-action="redo">Redo</button>
        </div>
      `;
      bar.addEventListener("click", onBarClick, true);
      bar.addEventListener("mousedown", stopBarEvent, true);
      bar.addEventListener("pointerdown", stopBarEvent, true);
      document.body.prepend(bar);
    }
    updateBar();
  }

  function updateBar() {
    const bar = document.getElementById(BAR_ID);
    if (!bar) return;
    const toggle = bar.querySelector("[data-hpe-action='toggle']");
    const label = bar.querySelector("[data-hpe-toggle-label]");
    if (toggle) {
      toggle.classList.toggle("__hpe_active", state.active);
      toggle.classList.toggle("__hpe_paused", !state.active);
      toggle.dataset.hpeTip = state.active
        ? "Edit text freely. Drag and drop to replace an image."
        : "Editing is paused. You can interact with elements normally.";
    }
    if (label) label.textContent = state.active ? "Editing" : "Paused";
    state.active ? startDotBreathing() : stopDotBreathing();
  }

  function startDotBreathing() {
    if (state.dotRAF) return;
    const bar = document.getElementById(BAR_ID);
    const dot = bar && bar.querySelector(".__hpe_state_dot");
    if (!dot) return;

    const start = performance.now();
    const tick = (now) => {
      if (!state.active || !dot.isConnected) {
        state.dotRAF = 0;
        return;
      }
      const wave = (Math.sin((now - start) / 260) + 1) / 2;
      const opacity = 0.58 + wave * 0.42;
      const scale = 0.78 + wave * 0.22;
      dot.style.opacity = opacity.toFixed(3);
      dot.style.transform = `scale(${scale.toFixed(3)})`;
      dot.style.boxShadow = `0 0 0 ${Math.round(1 + wave * 5)}px rgba(255, 255, 255, ${(0.18 * (1 - wave)).toFixed(3)})`;
      state.dotRAF = requestAnimationFrame(tick);
    };
    state.dotRAF = requestAnimationFrame(tick);
  }

  function stopDotBreathing() {
    if (state.dotRAF) cancelAnimationFrame(state.dotRAF);
    state.dotRAF = 0;
    const dot = document.querySelector(`#${BAR_ID} .__hpe_state_dot`);
    if (!dot) return;
    dot.style.opacity = "";
    dot.style.transform = "";
    dot.style.boxShadow = "";
  }

  function onBarClick(event) {
    const button = event.target.closest("[data-hpe-action]");
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const action = button.dataset.hpeAction;
    if (action === "undo") undo();
    if (action === "redo") redo();
    if (action === "toggle") state.active ? disable() : enable();
  }

  function stopBarEvent(event) {
    event.stopPropagation();
  }

  function addHistoryListeners() {
    window.addEventListener("keydown", blockDeckShortcuts, true);
    document.addEventListener("beforeinput", onBeforeInput, true);
    document.addEventListener("keydown", onHistoryKeyDown, true);
    document.addEventListener("keydown", blockDeckShortcuts, true);
    document.addEventListener("keydown", blockProtectedVisualEditing, true);
  }

  function removeHistoryListeners() {
    window.removeEventListener("keydown", blockDeckShortcuts, true);
    document.removeEventListener("beforeinput", onBeforeInput, true);
    document.removeEventListener("keydown", onHistoryKeyDown, true);
    document.removeEventListener("keydown", blockDeckShortcuts, true);
    document.removeEventListener("keydown", blockProtectedVisualEditing, true);
    clearTimeout(state.commitTimer);
  }

  function onBeforeInput(event) {
    if (!state.active || state.restoring || isBarElement(event.target)) return;
    if (event.inputType && event.inputType.startsWith("delete") && touchesProtectedVisual(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (state.pendingPreState === null) state.pendingPreState = createCleanSnapshot();
    clearTimeout(state.commitTimer);
    state.commitTimer = setTimeout(commitPendingInput, HISTORY_INPUT_DELAY);
  }

  function onHistoryKeyDown(event) {
    if (!state.active || isBarElement(event.target)) return;
    const modifier = event.metaKey || event.ctrlKey;
    if (!modifier) return;
    const key = event.key.toLowerCase();
    const isUndo = key === "z" && !event.shiftKey;
    const isRedo = key === "y" || (key === "z" && event.shiftKey);
    if (!isUndo && !isRedo) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    isUndo ? undo() : redo();
  }

  function blockDeckShortcuts(event) {
    if (!state.active || isBarElement(event.target)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Escape"];
    if (!keys.includes(event.key)) return;
    event.stopImmediatePropagation();
  }

  function blockProtectedVisualEditing(event) {
    if (!state.active || isBarElement(event.target)) return;
    if (event.key !== "Backspace" && event.key !== "Delete") return;
    if (!touchesProtectedVisual(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function touchesProtectedVisual(target) {
    if (isProtectedVisualNode(target)) return true;
    const selection = window.getSelection && window.getSelection();
    if (!selection || !selection.rangeCount) return false;
    for (let i = 0; i < selection.rangeCount; i += 1) {
      const range = selection.getRangeAt(i);
      if (isProtectedVisualNode(range.commonAncestorContainer)) return true;
      const protectedNodes = document.querySelectorAll(VISUAL_SELECTOR);
      for (const node of protectedNodes) {
        try {
          if (range.intersectsNode(node)) return true;
        } catch (_error) {
          // Ignore detached nodes from transient browser selections.
        }
      }
    }
    return false;
  }

  function isProtectedVisualNode(node) {
    const el = node && (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement);
    return !!(el && el.closest && el.closest(`${VISUAL_SELECTOR}, .${CROP_HANDLE_CLASS}`));
  }

  function commitPendingInput() {
    clearTimeout(state.commitTimer);
    state.commitTimer = null;
    const pre = state.pendingPreState;
    if (pre === null) return;
    const current = createCleanSnapshot();
    if (current !== pre) {
      pushHistory(state.undoStack, pre);
      state.redoStack = [];
    }
    state.pendingPreState = null;
  }

  function recordHistoryBoundary() {
    commitPendingInput();
    const snapshot = createCleanSnapshot();
    if (snapshot !== state.undoStack[state.undoStack.length - 1]) {
      pushHistory(state.undoStack, snapshot);
      state.redoStack = [];
    }
  }

  function pushHistory(stack, snapshot) {
    stack.push(snapshot);
    if (stack.length > MAX_HISTORY) stack.shift();
  }

  function undo() {
    commitPendingInput();
    const previous = state.undoStack.pop();
    if (!previous) return;
    pushHistory(state.redoStack, createCleanSnapshot());
    restoreSnapshot(previous);
  }

  function redo() {
    commitPendingInput();
    const next = state.redoStack.pop();
    if (!next) return;
    pushHistory(state.undoStack, createCleanSnapshot());
    restoreSnapshot(next);
  }

  function createCleanSnapshot() {
    const body = document.body.cloneNode(true);
    body.querySelector(`#${BAR_ID}`)?.remove();
    body.querySelector("#__html_presentation_editor_interaction_hint")?.remove();
    body.querySelectorAll(`.${CROP_HANDLE_CLASS}`).forEach((el) => el.remove());
    body.querySelectorAll(`.${CROP_ACTIVE_CLASS}`).forEach((el) => {
      el.classList.remove(CROP_ACTIVE_CLASS);
    });
    body.querySelectorAll("[data-hpe-highlight]").forEach((el) => {
      el.removeAttribute("data-hpe-highlight");
    });
    return body.innerHTML;
  }

  function restoreSnapshot(snapshot) {
    state.restoring = true;
    clearTimeout(state.commitTimer);
    state.pendingPreState = null;
    document.body.innerHTML = snapshot;
    showBar();
    applyAllCrops();
    if (state.active) document.designMode = "on";
    state.restoring = false;
  }

  function addInteractionBlockers() {
    CLICK_BLOCK_EVENTS.forEach((type) => {
      window.addEventListener(type, blockPageAction, true);
      document.addEventListener(type, blockPageAction, true);
    });
    POINTER_BLOCK_EVENTS.forEach((type) => {
      window.addEventListener(type, stopInteractiveHandlers, true);
      document.addEventListener(type, stopInteractiveHandlers, true);
    });
    GESTURE_BLOCK_EVENTS.forEach((type) => {
      window.addEventListener(type, blockDeckGesture, ACTIVE_CAPTURE_OPTIONS);
      document.addEventListener(type, blockDeckGesture, ACTIVE_CAPTURE_OPTIONS);
    });
    document.addEventListener("submit", blockPageAction, true);
  }

  function removeInteractionBlockers() {
    CLICK_BLOCK_EVENTS.forEach((type) => {
      window.removeEventListener(type, blockPageAction, true);
      document.removeEventListener(type, blockPageAction, true);
    });
    POINTER_BLOCK_EVENTS.forEach((type) => {
      window.removeEventListener(type, stopInteractiveHandlers, true);
      document.removeEventListener(type, stopInteractiveHandlers, true);
    });
    GESTURE_BLOCK_EVENTS.forEach((type) => {
      window.removeEventListener(type, blockDeckGesture, ACTIVE_CAPTURE_OPTIONS);
      document.removeEventListener(type, blockDeckGesture, ACTIVE_CAPTURE_OPTIONS);
    });
    document.removeEventListener("submit", blockPageAction, true);
  }

  function blockPageAction(event) {
    if (!state.active || isBarElement(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function stopInteractiveHandlers(event) {
    if (!state.active || isBarElement(event.target)) return;
    if (!event.target.closest || !event.target.closest(INTERACTIVE_SELECTOR)) return;
    event.stopImmediatePropagation();
  }

  function blockDeckGesture(event) {
    if (!state.active || isBarElement(event.target)) return;
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
  }

  function isBarElement(target) {
    return Boolean(target && target.closest && target.closest(`#${BAR_ID}`));
  }

  function onDragOver(event) {
    if (!state.active || isBarElement(event.target) || !hasFileDrag(event)) {
      clearHighlights();
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    document.body.classList.add("__hpe_file_dragging");
    scheduleDragClear();
    const visual = findReplaceableVisual(event.target, event.clientX, event.clientY);
    if (visual) highlightVisual(visual);
    else clearHighlights();
  }

  function onDragLeave(event) {
    const outside =
      event.clientX <= 0 ||
      event.clientY <= 0 ||
      event.clientX >= window.innerWidth ||
      event.clientY >= window.innerHeight;
    if (outside) clearHighlights();
    if (state.highlightedElement && !rectContainsPoint(state.highlightedElement.getBoundingClientRect(), event.clientX, event.clientY)) {
      clearHighlights();
    }
  }

  function onDrop(event) {
    if (!state.active || isBarElement(event.target)) return;
    const file = getImageFile(event);
    if (!file) return;
    event.preventDefault();
    clearHighlights();
    const visual = findReplaceableVisual(event.target, event.clientX, event.clientY);
    if (visual) replaceVisual(visual, file);
  }

  function getImageFile(event) {
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    return file && file.type.startsWith("image/") ? file : null;
  }

  function hasFileDrag(event) {
    const dataTransfer = event.dataTransfer;
    if (!dataTransfer) return false;
    const items = Array.from(dataTransfer.items || []);
    if (items.length) return items.some((item) => item.kind === "file");
    return Array.from(dataTransfer.types || []).includes("Files");
  }

  function findReplaceableVisual(element, x, y) {
    return findVisualAtPoint(x, y);
  }

  function findVisualAtPoint(x, y) {
    if (typeof x !== "number" || typeof y !== "number") return null;
    const pointVisual = document.elementsFromPoint(x, y).map(getVisualForPointElement).find(Boolean);
    if (pointVisual) return pointVisual;
    return [...document.querySelectorAll(`.frame-img, ${VISUAL_SELECTOR}`)]
      .filter((element) => rectContainsPoint(element.getBoundingClientRect(), x, y))
      .map(getVisualForPointElement)
      .filter(Boolean)
      .sort((a, b) => rectArea(getDropOverlayElement(a).getBoundingClientRect()) - rectArea(getDropOverlayElement(b).getBoundingClientRect()))[0] || null;
  }

  function getVisualForPointElement(el) {
    const visual = getVisualForElement(el);
    if (visual) return visual;
    const frame = el && el.closest && el.closest(".frame-img");
    if (!frame || isBarElement(frame)) return null;
    return getFrameVisual(frame);
  }

  function getFrameVisual(frame) {
    const visual = getVisualForElement(frame);
    if (visual) return visual;
    const visuals = frame.querySelectorAll(VISUAL_SELECTOR);
    return visuals.length === 1 ? getVisualForElement(visuals[0]) : null;
  }

  function getVisualForElement(el) {
    if (!el || !el.tagName || isBarElement(el)) return null;
    const tagName = el.tagName.toLowerCase();
    if (tagName === "img") return { type: "img", element: el };
    if (tagName === "picture") {
      const img = el.querySelector("img");
      if (img) return { type: "img", element: img };
    }
    if (tagName === "image") return { type: "svg-image", element: el };
    if (tagName === "svg") return { type: "inline-svg", element: el };
    const svg = el.closest && el.closest("svg");
    if (svg && !isBarElement(svg)) return { type: "inline-svg", element: svg };
    const backgroundImage = getComputedStyle(el).backgroundImage;
    if (backgroundImage && backgroundImage !== "none") return { type: "background", element: el };
    return null;
  }

  function replaceVisual(visual, file) {
    recordHistoryBoundary();
    readFileAsDataURL(file, (url) => applyVisualURL(visual, url));
  }

  function readFileAsDataURL(file, onLoad) {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") onLoad(reader.result);
    }, { once: true });
    reader.readAsDataURL(file);
  }

  function applyVisualURL(visual, url) {
    const { type, element } = visual;

    if (type === "svg-image") {
      element.setAttributeNS("http://www.w3.org/1999/xlink", "href", url);
      element.setAttribute("href", url);
      return;
    }

    if (type === "inline-svg") {
      const img = document.createElement("img");
      img.alt = element.getAttribute("aria-label") || "Replaced image";
      img.className = element.getAttribute("class") || "";
      img.style.cssText = element.getAttribute("style") || "";
      img.style.width = img.style.width || "100%";
      img.style.height = img.style.height || "auto";
      img.style.display = img.style.display || "block";
      element.replaceWith(img);
      replaceImageSource(img, url);
      return;
    }

    if (type === "background") {
      element.style.backgroundImage = `url("${url}")`;
      element.style.backgroundSize = "cover";
      element.style.backgroundPosition = "center center";
      return;
    }

    replaceImageSource(element, url);
  }

  function replaceImageSource(img, url) {
    ensureCropFrame(img, { freeze: true });
    let applied = false;
    const applyAfterLoad = () => {
      if (applied) return;
      applied = true;
      setupCropImage(img, { reset: true });
      activateCropImage(img);
    };
    img.addEventListener("load", applyAfterLoad, { once: true });
    resetCropData(img);
    img.dataset.hpeCrop = "true";
    img.draggable = false;
    img.src = url;
    if (img.complete && img.naturalWidth) requestAnimationFrame(applyAfterLoad);
  }

  function clearHighlights() {
    clearTimeout(state.dragClearTimer);
    state.dragClearTimer = 0;
    document.querySelectorAll("[data-hpe-highlight]").forEach((el) => {
      el.removeAttribute("data-hpe-highlight");
    });
    state.highlightedElement = null;
    document.body.classList.remove("__hpe_file_dragging");
    document.getElementById(DROP_OVERLAY_ID)?.remove();
  }

  function highlightVisual(visual) {
    const element = getDropOverlayElement(visual);
    if (!element) return;
    if (state.highlightedElement && state.highlightedElement !== element) {
      state.highlightedElement.removeAttribute("data-hpe-highlight");
    }
    state.highlightedElement = element;
    element.setAttribute("data-hpe-highlight", "true");
    showDropOverlay(element);
  }

  function showDropOverlay(element) {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      clearHighlights();
      return;
    }
    let overlay = document.getElementById(DROP_OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = DROP_OVERLAY_ID;
      overlay.textContent = "Drop your new image here";
      overlay.contentEditable = "false";
      document.body.appendChild(overlay);
    }
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.borderRadius = getComputedStyle(element).borderRadius || "4px";
  }

  function getDropOverlayElement(visual) {
    if (!visual || !visual.element) return null;
    return visual.element.closest && visual.element.closest(".frame-img") || visual.element;
  }

  function scheduleDragClear() {
    clearTimeout(state.dragClearTimer);
    state.dragClearTimer = window.setTimeout(clearHighlights, 500);
  }

  function onCropPointerDown(event) {
    if (!state.active || isBarElement(event.target)) return;
    const target = event.target;
    const handle = target.closest && target.closest(`.${CROP_HANDLE_CLASS}`);
    const img = handle ? getCropImageForFrame(handle.closest(`.${CROP_FRAME_CLASS}, .frame-img`)) : target.closest && target.closest('img[data-hpe-crop="true"]');
    if (!img) {
      if (target.closest && target.closest(VISUAL_SELECTOR)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      if (state.cropFrame && !(target.closest && target.closest(`.${CROP_ACTIVE_CLASS}`))) deactivateCropFrame();
      return;
    }
    const frame = getCropFrame(img);
    if (!frame) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setupCropImage(img);
    activateCropFrame(frame, img);
    state.cropDrag = {
      mode: handle ? "scale" : "pan",
      img,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScale: readCropNumber(img, "hpeCropScale", 1),
      startPositionX: readCropNumber(img, "hpeCropPositionX", 50),
      startPositionY: readCropNumber(img, "hpeCropPositionY", 50),
      startTranslateX: readCropNumber(img, "hpeCropTranslateX", 0),
      startTranslateY: readCropNumber(img, "hpeCropTranslateY", 0),
      cover: getCoverExcess(img, frame),
      historyRecorded: false
    };
    document.body.classList.add("__hpe_crop_dragging");
  }

  function onCropPointerMove(event) {
    const drag = state.cropDrag;
    if (!drag) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const { img } = drag;
    const frame = getCropFrame(img);
    if (!frame) return;
    const dx = event.clientX - drag.startClientX;
    const dy = event.clientY - drag.startClientY;
    if (!drag.historyRecorded && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
      recordHistoryBoundary();
      drag.historyRecorded = true;
    }
    if (drag.mode === "scale") {
      const nextScale = drag.startScale + (dx + dy) / 180;
      img.dataset.hpeCropScale = String(clampNumber(nextScale, 1, MAX_CROP_SCALE));
    } else {
      if (drag.cover.excessX > 1) {
        img.dataset.hpeCropPositionX = String(clampNumber(drag.startPositionX - dx / drag.cover.excessX * 100, 0, 100));
      }
      if (drag.cover.excessY > 1) {
        img.dataset.hpeCropPositionY = String(clampNumber(drag.startPositionY - dy / drag.cover.excessY * 100, 0, 100));
      }
      img.dataset.hpeCropTranslateX = String(drag.startTranslateX + dx);
      img.dataset.hpeCropTranslateY = String(drag.startTranslateY + dy);
    }
    applyCrop(img);
  }

  function onCropPointerUp(event) {
    if (!state.cropDrag) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    applyCrop(state.cropDrag.img);
    state.cropDrag = null;
    document.body.classList.remove("__hpe_crop_dragging");
  }

  function onCropDragStart(event) {
    if (event.target && event.target.closest && event.target.closest('img[data-hpe-crop="true"]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  function resetCropData(img) {
    img.dataset.hpeCropScale = "1";
    img.dataset.hpeCropPositionX = "50";
    img.dataset.hpeCropPositionY = "50";
    img.dataset.hpeCropTranslateX = "0";
    img.dataset.hpeCropTranslateY = "0";
  }

  function setupCropImage(img, options = {}) {
    const frame = ensureCropFrame(img);
    if (!frame) return;
    if (options.reset) resetCropData(img);
    img.dataset.hpeCrop = "true";
    img.draggable = false;
    img.contentEditable = "false";
    img.setAttribute("contenteditable", "false");
    frame.style.overflow = "hidden";
    if (getComputedStyle(frame).position === "static") frame.style.position = "relative";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.maxWidth = "none";
    img.style.objectFit = "cover";
    img.style.display = img.style.display || "block";
    img.style.verticalAlign = "top";
    applyCrop(img);
  }

  function applyAllCrops() {
    document.querySelectorAll('img[data-hpe-crop="true"]').forEach((img) => {
      setupCropImage(img);
    });
  }

  function applyCrop(img) {
    const frame = getCropFrame(img);
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const scale = clampNumber(readCropNumber(img, "hpeCropScale", 1), 1, MAX_CROP_SCALE);
    const positionX = clampNumber(readCropNumber(img, "hpeCropPositionX", 50), 0, 100);
    const positionY = clampNumber(readCropNumber(img, "hpeCropPositionY", 50), 0, 100);
    const maxTranslateX = Math.max(0, (scale - 1) * rect.width / 2);
    const maxTranslateY = Math.max(0, (scale - 1) * rect.height / 2);
    const translateX = clampNumber(readCropNumber(img, "hpeCropTranslateX", 0), -maxTranslateX, maxTranslateX);
    const translateY = clampNumber(readCropNumber(img, "hpeCropTranslateY", 0), -maxTranslateY, maxTranslateY);
    img.dataset.hpeCropScale = String(scale);
    img.dataset.hpeCropPositionX = String(positionX);
    img.dataset.hpeCropPositionY = String(positionY);
    img.dataset.hpeCropTranslateX = String(translateX);
    img.dataset.hpeCropTranslateY = String(translateY);
    img.style.objectPosition = `${positionX}% ${positionY}%`;
    img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    img.style.transformOrigin = "center center";
  }

  function activateCropImage(img) {
    const frame = getCropFrame(img);
    if (frame) activateCropFrame(frame, img);
  }

  function activateCropFrame(frame, img) {
    if (state.cropFrame && state.cropFrame !== frame) deactivateCropFrame();
    state.cropFrame = frame;
    frame.classList.add(CROP_ACTIVE_CLASS);
    let handle = frame.querySelector(`.${CROP_HANDLE_CLASS}`);
    if (!handle) {
      handle = document.createElement("div");
      handle.className = CROP_HANDLE_CLASS;
      handle.contentEditable = "false";
      handle.title = "Drag to resize crop";
      frame.appendChild(handle);
    }
    if (handle.innerHTML !== CROP_HANDLE_ICON) handle.innerHTML = CROP_HANDLE_ICON;
    if (img) setupCropImage(img);
  }

  function deactivateCropFrame() {
    if (state.cropFrame) {
      state.cropFrame.classList.remove(CROP_ACTIVE_CLASS);
      state.cropFrame.querySelectorAll(`.${CROP_HANDLE_CLASS}`).forEach((el) => el.remove());
    }
    state.cropFrame = null;
    state.cropDrag = null;
    document.body.classList.remove("__hpe_crop_dragging");
  }

  function getCropFrame(img) {
    if (!img || !img.closest) return null;
    return img.closest(`.${CROP_FRAME_CLASS}, .frame-img`);
  }

  function ensureCropFrame(img, options = {}) {
    if (!img) return null;
    let frame = getCropFrame(img);
    if (!frame) {
      const parent = img.parentElement && img.parentElement.tagName && img.parentElement.tagName.toLowerCase() === "picture"
        ? img.parentElement.parentElement
        : img.parentElement;
      if (!parent || parent === document.body || parent === document.documentElement || isBarElement(parent)) return null;
      frame = parent;
      frame.classList.add(CROP_FRAME_CLASS);
    }
    if (options.freeze) freezeFrameToCurrentRect(frame);
    return frame;
  }

  function freezeFrameToCurrentRect(frame) {
    if (!frame || frame.classList.contains("frame-img")) return;
    const rect = frame.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    frame.style.width = `${Math.round(rect.width)}px`;
    frame.style.height = `${Math.round(rect.height)}px`;
    frame.style.maxWidth = "100%";
    if (getComputedStyle(frame).display === "inline") frame.style.display = "inline-block";
    if (getComputedStyle(frame).position === "static") frame.style.position = "relative";
  }

  function getCropImageForFrame(frame) {
    return frame && frame.querySelector('img[data-hpe-crop="true"]');
  }

  function getCoverExcess(img, frame) {
    const rect = frame.getBoundingClientRect();
    if (!rect.width || !rect.height || !img.naturalWidth || !img.naturalHeight) {
      return { excessX: 0, excessY: 0 };
    }
    const frameRatio = rect.width / rect.height;
    const imageRatio = img.naturalWidth / img.naturalHeight;
    if (imageRatio > frameRatio) {
      return { excessX: rect.height * imageRatio - rect.width, excessY: 0 };
    }
    return { excessX: 0, excessY: rect.width / imageRatio - rect.height };
  }

  function scheduleCropRefresh() {
    clearTimeout(state.resizeTimer);
    state.resizeTimer = window.setTimeout(applyAllCrops, 80);
  }

  function readCropNumber(img, key, fallback) {
    const value = Number.parseFloat(img.dataset[key]);
    return Number.isFinite(value) ? value : fallback;
  }

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function rectContainsPoint(rect, x, y) {
    return rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function rectArea(rect) {
    return rect.width * rect.height;
  }

  window.__htmlPresentationEditor = { enable, disable, undo, redo };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enable, { once: true });
  } else {
    enable();
  }
})();
