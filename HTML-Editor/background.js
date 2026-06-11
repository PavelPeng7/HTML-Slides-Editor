const STATE_KEY = (tabId) => `html-edit-${tabId}`;

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;

  const key = STATE_KEY(tab.id);
  const stored = await chrome.storage.session.get(key);
  const wasActive = !!stored[key];
  const willActivate = !wasActive;

  await chrome.storage.session.set({ [key]: willActivate });

  if (willActivate) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (error) {
      console.warn('HTML Edit injection failed', error);
      await chrome.storage.session.set({ [key]: false });
    }
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'disable' });
  } catch (error) {
    // tab may have navigated; nothing to disable
  }
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.action === 'editClosed' && sender.tab) {
    chrome.storage.session.set({ [STATE_KEY(sender.tab.id)]: false });
  }
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(STATE_KEY(tabId));
});
