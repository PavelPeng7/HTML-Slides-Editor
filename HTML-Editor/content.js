// HTML Edit — Content Script
// Turns page into editable mode with drag-to-replace images

(() => {
const CLICK_BLOCK_EVENTS = ['click', 'dblclick', 'auxclick'];
const POINTER_STOP_EVENTS = ['pointerdown', 'mousedown', 'touchstart', 'pointerup', 'mouseup', 'touchend'];
const MAX_HISTORY = 50;
const HISTORY_INPUT_DELAY = 500;
const INTERACTIVE_SELECTOR = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[onclick]',
  '[tabindex]'
].join(',');
const VISUAL_SELECTOR = 'img, picture, svg, image';

if (!window.__freeEditState) {
  window.__freeEditState = {
    active: false,
    messageListenerAdded: false,
    undoStack: [],
    redoStack: [],
    pendingPreState: null,
    commitTimer: null,
    restoring: false
  };
}

enable();

function enable() {
  if (window.__freeEditState.active) {
    document.designMode = 'on';
    showIndicator();
    return;
  }

  window.__freeEditState.active = true;
  document.designMode = 'on';
  document.addEventListener('dragover', onDragOver);
  document.addEventListener('drop', onDrop);
  document.addEventListener('dragleave', onDragLeave, true);
  addHistoryListeners();
  addInteractionBlockers();
  showIndicator();

  if (!window.__freeEditState.messageListenerAdded) {
    chrome.runtime.onMessage.addListener(onMessage);
    window.__freeEditState.messageListenerAdded = true;
  }
}

function disable() {
  document.designMode = 'off';
  document.removeEventListener('dragover', onDragOver);
  document.removeEventListener('drop', onDrop);
  document.removeEventListener('dragleave', onDragLeave, true);
  removeHistoryListeners();
  removeInteractionBlockers();
  clearOutlines();
  removeIndicator();
  window.__freeEditState.active = false;
}

// Walk up from event target to find the nearest replaceable visual.
// Handles: <img>, <picture>-><img>, wrapped images, inline <svg>, SVG <image>,
// and CSS background images. A coordinate fallback catches pointer-events:none art.
function findReplaceableVisual(el, x, y) {
  return findVisualFromElement(el) || findVisualAtPoint(x, y);
}

function findVisualFromElement(el) {
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
  if (typeof x !== 'number' || typeof y !== 'number') return null;

  const pointVisual = document
    .elementsFromPoint(x, y)
    .map(getVisualForElement)
    .find(Boolean);

  if (pointVisual) return pointVisual;

  return [...document.querySelectorAll(`${VISUAL_SELECTOR}, *`)]
    .map(getVisualForElement)
    .filter(Boolean)
    .filter(({ element }) => rectContainsPoint(element.getBoundingClientRect(), x, y))
    .sort((a, b) => rectArea(a.element.getBoundingClientRect()) - rectArea(b.element.getBoundingClientRect()))[0] || null;
}

function getVisualForElement(el) {
  if (!el || !el.tagName) return null;

  const tagName = el.tagName.toLowerCase();

  if (tagName === 'img') return { type: 'img', element: el };

  if (tagName === 'picture') {
    const img = el.querySelector('img');
    if (img) return { type: 'img', element: img };
  }

  if (tagName === 'image') return { type: 'svg-image', element: el };

  if (tagName === 'svg') return { type: 'inline-svg', element: el };

  const svg = el.closest && el.closest('svg');
  if (svg) return { type: 'inline-svg', element: svg };

  const backgroundImage = getComputedStyle(el).backgroundImage;
  if (backgroundImage && backgroundImage !== 'none') {
    return { type: 'background', element: el };
  }

  return null;
}

function rectContainsPoint(rect, x, y) {
  return rect.width > 0 &&
    rect.height > 0 &&
    x >= rect.left &&
    x <= rect.right &&
    y >= rect.top &&
    y <= rect.bottom;
}

function rectArea(rect) {
  return rect.width * rect.height;
}

function clearOutlines() {
  document.querySelectorAll('[data-free-edit-highlight]').forEach(el => {
    el.style.outline = el.dataset.freeEditPrevOutline || '';
    el.style.outlineOffset = el.dataset.freeEditPrevOutlineOffset || '';
    el.style.boxShadow = el.dataset.freeEditPrevBoxShadow || '';
    el.removeAttribute('data-free-edit-highlight');
    el.removeAttribute('data-free-edit-prev-outline');
    el.removeAttribute('data-free-edit-prev-outline-offset');
    el.removeAttribute('data-free-edit-prev-box-shadow');
  });
}

function replaceVisual(visual, file) {
  recordHistoryBoundary();

  const url = URL.createObjectURL(file);
  const { type, element } = visual;

  if (type === 'svg-image') {
    element.setAttributeNS('http://www.w3.org/1999/xlink', 'href', url);
    element.setAttribute('href', url);
    return;
  }

  if (type === 'inline-svg') {
    const img = document.createElement('img');
    img.src = url;
    img.alt = element.getAttribute('aria-label') || 'Replaced image';
    img.className = element.getAttribute('class') || '';
    img.style.cssText = element.getAttribute('style') || '';
    img.style.width = img.style.width || '100%';
    img.style.height = img.style.height || 'auto';
    img.style.display = img.style.display || 'block';
    element.replaceWith(img);
    return;
  }

  if (type === 'background') {
    element.style.backgroundImage = `url("${url}")`;
    return;
  }

  element.src = url;
}

function highlightVisual(visual) {
  if (!visual) return;

  const { element } = visual;
  if (!element.hasAttribute('data-free-edit-highlight')) {
    element.dataset.freeEditPrevOutline = element.style.outline || '';
    element.dataset.freeEditPrevOutlineOffset = element.style.outlineOffset || '';
    element.dataset.freeEditPrevBoxShadow = element.style.boxShadow || '';
  }

  element.dataset.freeEditHighlight = 'true';
  element.style.outline = '3px solid #34A853';
  element.style.outlineOffset = '4px';
  element.style.boxShadow = '0 0 0 4px rgba(52, 168, 83, 0.25)';
}

function getDroppedImageFile(e) {
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  return file && file.type.startsWith('image/') ? file : null;
}

function onDragOver(e) {
  e.preventDefault();
  clearOutlines();
  highlightVisual(findReplaceableVisual(e.target, e.clientX, e.clientY));
}

function onDragLeave(e) {
  if (e.relatedTarget) return;
  clearOutlines();
}

function onDrop(e) {
  e.preventDefault();
  clearOutlines();

  const visual = findReplaceableVisual(e.target, e.clientX, e.clientY);
  const file = getDroppedImageFile(e);
  if (visual && file) replaceVisual(visual, file);
}

function addInteractionBlockers() {
  CLICK_BLOCK_EVENTS.forEach(type => {
    window.addEventListener(type, blockClickAction, true);
    document.addEventListener(type, blockClickAction, true);
  });

  POINTER_STOP_EVENTS.forEach(type => {
    window.addEventListener(type, stopInteractivePageHandlers, true);
    document.addEventListener(type, stopInteractivePageHandlers, true);
  });

  document.addEventListener('submit', blockClickAction, true);
}

function removeInteractionBlockers() {
  CLICK_BLOCK_EVENTS.forEach(type => {
    window.removeEventListener(type, blockClickAction, true);
    document.removeEventListener(type, blockClickAction, true);
  });

  POINTER_STOP_EVENTS.forEach(type => {
    window.removeEventListener(type, stopInteractivePageHandlers, true);
    document.removeEventListener(type, stopInteractivePageHandlers, true);
  });

  document.removeEventListener('submit', blockClickAction, true);
}

function addHistoryListeners() {
  document.addEventListener('beforeinput', onBeforeInput, true);
  document.addEventListener('keydown', onHistoryKeyDown, true);
}

function removeHistoryListeners() {
  document.removeEventListener('beforeinput', onBeforeInput, true);
  document.removeEventListener('keydown', onHistoryKeyDown, true);
  clearTimeout(window.__freeEditState.commitTimer);
}

function onBeforeInput() {
  if (!window.__freeEditState.active || window.__freeEditState.restoring) return;

  // Capture the DOM state BEFORE this input mutates anything.
  if (window.__freeEditState.pendingPreState === null) {
    window.__freeEditState.pendingPreState = createCleanSnapshot();
  }

  // Coalesce a burst of typing into a single undo step; commit after a pause.
  clearTimeout(window.__freeEditState.commitTimer);
  window.__freeEditState.commitTimer = setTimeout(commitPendingInput, HISTORY_INPUT_DELAY);
}

function commitPendingInput() {
  clearTimeout(window.__freeEditState.commitTimer);
  window.__freeEditState.commitTimer = null;

  const pre = window.__freeEditState.pendingPreState;
  if (pre === null) return;

  const current = createCleanSnapshot();
  if (current !== pre) {
    pushHistory(window.__freeEditState.undoStack, pre);
    window.__freeEditState.redoStack = [];
  }
  window.__freeEditState.pendingPreState = null;
}

function recordHistoryBoundary() {
  // Called right BEFORE an explicit non-text mutation (e.g. image replace).
  commitPendingInput();

  const snapshot = createCleanSnapshot();
  if (snapshot !== lastHistoryItem(window.__freeEditState.undoStack)) {
    pushHistory(window.__freeEditState.undoStack, snapshot);
    window.__freeEditState.redoStack = [];
  }
}

function undoEdit() {
  commitPendingInput();

  const previous = window.__freeEditState.undoStack.pop();
  if (!previous) return false;

  pushHistory(window.__freeEditState.redoStack, createCleanSnapshot());
  restoreSnapshot(previous);
  return true;
}

function redoEdit() {
  commitPendingInput();

  const next = window.__freeEditState.redoStack.pop();
  if (!next) return false;

  pushHistory(window.__freeEditState.undoStack, createCleanSnapshot());
  restoreSnapshot(next);
  return true;
}

function onHistoryKeyDown(e) {
  if (!window.__freeEditState.active) return;

  const modifier = e.metaKey || e.ctrlKey;
  if (!modifier) return;

  const key = e.key.toLowerCase();
  const isUndo = key === 'z' && !e.shiftKey;
  const isRedo = key === 'y' || (key === 'z' && e.shiftKey);
  if (!isUndo && !isRedo) return;

  e.preventDefault();
  e.stopImmediatePropagation();

  if (isUndo) {
    undoEdit();
  } else {
    redoEdit();
  }
}

function pushHistory(stack, snapshot) {
  stack.push(snapshot);
  if (stack.length > MAX_HISTORY) stack.shift();
}

function lastHistoryItem(stack) {
  return stack[stack.length - 1];
}

function createCleanSnapshot() {
  const body = document.body.cloneNode(true);
  const indicator = body.querySelector('#__free-edit-bar');
  if (indicator) indicator.remove();

  body.querySelectorAll('[data-free-edit-highlight]').forEach(el => {
    el.style.outline = el.dataset.freeEditPrevOutline || '';
    el.style.outlineOffset = el.dataset.freeEditPrevOutlineOffset || '';
    el.style.boxShadow = el.dataset.freeEditPrevBoxShadow || '';
    el.removeAttribute('data-free-edit-highlight');
    el.removeAttribute('data-free-edit-prev-outline');
    el.removeAttribute('data-free-edit-prev-outline-offset');
    el.removeAttribute('data-free-edit-prev-box-shadow');
  });

  return body.innerHTML;
}

function restoreSnapshot(snapshot) {
  window.__freeEditState.restoring = true;
  clearTimeout(window.__freeEditState.commitTimer);
  window.__freeEditState.pendingPreState = null;
  removeIndicator();
  document.body.innerHTML = snapshot;
  document.designMode = 'on';
  showIndicator();
  clearOutlines();
  window.__freeEditState.restoring = false;
}

function isToolbarElement(target) {
  if (!target || !target.closest) return false;
  return Boolean(target.closest('#__free-edit-bar'));
}

function blockClickAction(e) {
  if (!window.__freeEditState.active) return;
  if (isToolbarElement(e.target)) return;

  e.preventDefault();
  e.stopImmediatePropagation();
}

function stopInteractivePageHandlers(e) {
  if (!window.__freeEditState.active) return;
  if (isToolbarElement(e.target)) return;
  if (!isInteractiveTarget(e.target)) return;

  e.stopImmediatePropagation();
}

function isInteractiveTarget(target) {
  if (!target || !target.closest) return false;
  return Boolean(target.closest(INTERACTIVE_SELECTOR));
}

function injectToolbarStyles() {
  if (document.getElementById('__free-edit-styles')) return;

  const style = document.createElement('style');
  style.id = '__free-edit-styles';
  style.textContent = `
    @keyframes __fe-slide-in {
      from { transform: translateY(-100%); opacity: 0; }
      to   { transform: translateY(0);     opacity: 1; }
    }
    @keyframes __fe-breathe {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%      { opacity: 0.55; transform: scale(0.92); }
    }
    #__free-edit-bar {
      position: fixed; top: 0; left: 0; right: 0;
      z-index: 2147483647;
      display: flex; align-items: center;
      gap: 24px;
      padding: 14px 28px;
      background: rgba(255, 255, 255, 0.82);
      -webkit-backdrop-filter: saturate(180%) blur(24px);
      backdrop-filter: saturate(180%) blur(24px);
      border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03),
                  0 8px 28px rgba(0, 0, 0, 0.05);
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif;
      font-feature-settings: 'ss01', 'cv11';
      color: #1d1d1f;
      user-select: none;
      -webkit-user-select: none;
      animation: __fe-slide-in 0.4s cubic-bezier(0.32, 0.72, 0, 1);
    }
    #__free-edit-bar * { box-sizing: border-box; }

    .__fe-brand {
      display: flex; align-items: center; gap: 10px;
    }
    .__fe-logo {
      width: 24px; height: 24px;
      border-radius: 7px;
      background: linear-gradient(135deg, #FF9F0A 0%, #FF6B35 100%);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 1px 2px rgba(255, 107, 53, 0.25),
                  inset 0 0.5px 0 rgba(255, 255, 255, 0.4);
    }
    .__fe-logo svg {
      width: 13px; height: 13px;
      stroke: #fff; stroke-width: 2;
      stroke-linecap: round; stroke-linejoin: round;
      fill: none;
    }
    .__fe-title {
      font-size: 14px; font-weight: 600; letter-spacing: -0.2px;
      color: #1d1d1f;
    }

    .__fe-status {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; font-weight: 500; letter-spacing: -0.08px;
      color: #86868b;
    }
    .__fe-status-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: #FF6B35;
      box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.15);
      animation: __fe-breathe 2.4s ease-in-out infinite;
    }

    .__fe-spacer { flex: 1; }

    .__fe-actions {
      display: flex; align-items: center; gap: 6px;
    }
    .__fe-btn {
      display: inline-flex; align-items: center; justify-content: center;
      gap: 6px;
      height: 32px; padding: 0 14px;
      border: none;
      border-radius: 16px;
      background: rgba(0, 0, 0, 0.04);
      color: #1d1d1f;
      font: 500 13px/1 -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
      letter-spacing: -0.1px;
      cursor: pointer;
      transition: background 0.18s cubic-bezier(0.32, 0.72, 0, 1),
                  transform 0.12s ease,
                  box-shadow 0.18s ease;
      outline: none;
      white-space: nowrap;
    }
    .__fe-btn:hover {
      background: rgba(0, 0, 0, 0.07);
    }
    .__fe-btn:active {
      background: rgba(0, 0, 0, 0.1);
      transform: scale(0.97);
    }
    .__fe-btn.__fe-close {
      background: #FF6B35;
      color: #ffffff;
      padding: 0 16px;
      margin-left: 10px;
      box-shadow: 0 1px 2px rgba(255, 107, 53, 0.2);
    }
    .__fe-btn.__fe-close:hover {
      background: #FF5722;
      box-shadow: 0 2px 10px rgba(255, 107, 53, 0.3);
    }
    .__fe-btn.__fe-close:active {
      background: #E64A19;
    }
    .__fe-btn svg {
      width: 15px; height: 15px;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
      flex-shrink: 0;
    }
  `;
  document.head.appendChild(style);
}

function removeToolbarStyles() {
  const style = document.getElementById('__free-edit-styles');
  if (style) style.remove();
}

function showIndicator() {
  removeIndicator();
  injectToolbarStyles();

  const isMac = /Mac|iPhone|iPad/i.test(navigator.userAgent);
  const mod = isMac ? '⌘' : 'Ctrl';

  const bar = document.createElement('div');
  bar.id = '__free-edit-bar';
  bar.contentEditable = 'false';
  bar.innerHTML = `
    <div class="__fe-brand">
      <div class="__fe-logo">
        <svg viewBox="0 0 24 24"><path d="M14 4l6 6-11 11H3v-6L14 4z"/><path d="M13 5l6 6"/></svg>
      </div>
      <span class="__fe-title">HTML Edit</span>
    </div>

    <div class="__fe-status">
      <span class="__fe-status-dot"></span>
      <span>编辑中</span>
    </div>

    <div class="__fe-spacer"></div>

    <div class="__fe-actions">
      <button class="__fe-btn" data-action="undo" title="撤回 (${mod}+Z)">
        <svg viewBox="0 0 24 24"><path d="M9 14l-5-4 5-4"/><path d="M4 10h9a5 5 0 0 1 5 5v1a5 5 0 0 1-5 5h-3"/></svg>
        撤回
      </button>
      <button class="__fe-btn" data-action="redo" title="重做 (${mod}+⇧+Z)">
        <svg viewBox="0 0 24 24"><path d="M15 14l5-4-5-4"/><path d="M20 10h-9a5 5 0 0 0-5 5v1a5 5 0 0 0 5 5h3"/></svg>
        重做
      </button>
      <button class="__fe-btn __fe-close" data-action="close" title="关闭编辑">
        <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
        完成
      </button>
    </div>
  `;

  bar.addEventListener('mousedown', e => e.stopPropagation(), true);
  bar.addEventListener('click', onToolbarClick, true);

  document.body.prepend(bar);
}

function onToolbarClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  e.preventDefault();
  e.stopImmediatePropagation();

  const action = btn.dataset.action;
  if (action === 'undo') undoEdit();
  if (action === 'redo') redoEdit();
  if (action === 'close') {
    disable();
    try {
      chrome.runtime.sendMessage({ action: 'editClosed' });
    } catch (_) {}
  }
}

function removeIndicator() {
  const el = document.getElementById('__free-edit-bar');
  if (el) el.remove();
  removeToolbarStyles();
}

function onMessage(msg) {
  if (msg.action === 'disable') disable();
  if (msg.action === 'undo') undoEdit();
  if (msg.action === 'redo') redoEdit();
  return true;
}
})();
