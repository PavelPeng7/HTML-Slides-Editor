(() => {
  const BAR_ID = "__html_presentation_editor_bar";
  const STYLE_ID = "__html_presentation_editor_styles";
  const CLICK_BLOCK_EVENTS = ["click", "dblclick", "auxclick"];
  const POINTER_BLOCK_EVENTS = ["pointerdown", "mousedown", "touchstart", "pointerup", "mouseup", "touchend"];
  const GESTURE_BLOCK_EVENTS = ["wheel", "touchstart", "touchmove", "touchend"];
  const ACTIVE_CAPTURE_OPTIONS = { capture: true, passive: false };
  const MAX_HISTORY = 60;
  const HISTORY_INPUT_DELAY = 500;
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
    restoring: false
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
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    document.addEventListener("dragleave", onDragLeave, true);
  }

  function disable() {
    commitPendingInput();
    state.active = false;
    document.designMode = "off";
    document.body.classList.remove("__hpe_editing");
    removeHistoryListeners();
    removeInteractionBlockers();
    document.removeEventListener("dragover", onDragOver);
    document.removeEventListener("drop", onDrop);
    document.removeEventListener("dragleave", onDragLeave, true);
    clearHighlights();
    updateBar();
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${BAR_ID} {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 2147483647;
        height: 56px;
        display: flex;
        align-items: center;
        gap: 14px;
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
          #7c4dff 100%
        );
        -webkit-mask-image: linear-gradient(180deg, #000 0%, rgba(0, 0, 0, 0) 100%);
        mask-image: linear-gradient(180deg, #000 0%, rgba(0, 0, 0, 0) 100%);
      }
      #${BAR_ID} * { box-sizing: border-box; }
      #${BAR_ID} > * {
        position: relative;
        z-index: 1;
      }
      #${BAR_ID} .__hpe_title {
        font-weight: 700;
      }
      #${BAR_ID} .__hpe_toggle {
        margin-left: 0;
        background: rgba(255, 255, 255, 0.82);
        color: #151518;
        border-color: rgba(255, 255, 255, 0.5);
        font-weight: 650;
      }
      #${BAR_ID} .__hpe_toggle:hover {
        background: rgba(255, 255, 255, 0.95);
      }
      #${BAR_ID} .__hpe_spacer { flex: 1; }
      #${BAR_ID} button {
        height: 30px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 8px;
        padding: 0 11px;
        color: #fff;
        background: rgba(255, 255, 255, 0.1);
        font: inherit;
        cursor: pointer;
      }
      #${BAR_ID} button:hover { background: rgba(255, 255, 255, 0.17); }
      [data-hpe-highlight="true"] {
        outline: 3px solid #34c759 !important;
        outline-offset: 4px !important;
        box-shadow: 0 0 0 4px rgba(52, 199, 89, 0.24) !important;
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
        <div class="__hpe_title">HTML Deck Editor</div>
        <button type="button" class="__hpe_toggle" data-hpe-action="toggle">▶️ 编辑中</button>
        <div class="__hpe_spacer"></div>
        <button type="button" data-hpe-action="undo">撤销</button>
        <button type="button" data-hpe-action="redo">重做</button>
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
    if (toggle) toggle.textContent = state.active ? "▶️ 编辑中" : "⏸️ 暂停编辑";
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
  }

  function removeHistoryListeners() {
    window.removeEventListener("keydown", blockDeckShortcuts, true);
    document.removeEventListener("beforeinput", onBeforeInput, true);
    document.removeEventListener("keydown", onHistoryKeyDown, true);
    document.removeEventListener("keydown", blockDeckShortcuts, true);
    clearTimeout(state.commitTimer);
  }

  function onBeforeInput(event) {
    if (!state.active || state.restoring || isBarElement(event.target)) return;
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
    if (!state.active || isBarElement(event.target)) return;
    const file = getImageFile(event);
    if (!file) return;
    event.preventDefault();
    clearHighlights();
    const visual = findReplaceableVisual(event.target, event.clientX, event.clientY);
    if (visual) visual.element.setAttribute("data-hpe-highlight", "true");
  }

  function onDragLeave(event) {
    if (!event.relatedTarget) clearHighlights();
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

  function findReplaceableVisual(element, x, y) {
    return findVisualFromElement(element) || findVisualAtPoint(x, y);
  }

  function findVisualFromElement(element) {
    let el = element;
    while (el && el !== document.body) {
      const visual = getVisualForElement(el);
      if (visual) return visual;
      if (el.querySelectorAll) {
        const visuals = el.querySelectorAll(VISUAL_SELECTOR);
        if (visuals.length === 1) return getVisualForElement(visuals[0]);
      }
      el = el.parentElement;
    }
    return null;
  }

  function findVisualAtPoint(x, y) {
    if (typeof x !== "number" || typeof y !== "number") return null;
    const pointVisual = document.elementsFromPoint(x, y).map(getVisualForElement).find(Boolean);
    if (pointVisual) return pointVisual;
    return [...document.querySelectorAll(`${VISUAL_SELECTOR}, *`)]
      .map(getVisualForElement)
      .filter(Boolean)
      .filter(({ element }) => rectContainsPoint(element.getBoundingClientRect(), x, y))
      .sort((a, b) => rectArea(a.element.getBoundingClientRect()) - rectArea(b.element.getBoundingClientRect()))[0] || null;
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
    const url = URL.createObjectURL(file);
    const { type, element } = visual;

    if (type === "svg-image") {
      element.setAttributeNS("http://www.w3.org/1999/xlink", "href", url);
      element.setAttribute("href", url);
      return;
    }

    if (type === "inline-svg") {
      const img = document.createElement("img");
      img.src = url;
      img.alt = element.getAttribute("aria-label") || "Replaced image";
      img.className = element.getAttribute("class") || "";
      img.style.cssText = element.getAttribute("style") || "";
      img.style.width = img.style.width || "100%";
      img.style.height = img.style.height || "auto";
      img.style.display = img.style.display || "block";
      element.replaceWith(img);
      return;
    }

    if (type === "background") {
      element.style.backgroundImage = `url("${url}")`;
      return;
    }

    element.src = url;
  }

  function clearHighlights() {
    document.querySelectorAll("[data-hpe-highlight]").forEach((el) => {
      el.removeAttribute("data-hpe-highlight");
    });
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
