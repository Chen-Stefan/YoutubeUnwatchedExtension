// Initialize extension state when installed
chrome.runtime.onInstalled.addListener(() => {
    // Set the default global filter state to enabled
    chrome.storage.local.set({ globalFilterEnabled: true });
    console.log('YouTube Unwatched Videos extension installed. Global filtering enabled by default.');
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle any background script actions if needed
    if (message.action === 'getGlobalState') {
        chrome.storage.local.get(['globalFilterEnabled'], (result) => {
            sendResponse({
                enabled: result.globalFilterEnabled !== undefined ? result.globalFilterEnabled : true
            });
        });
        return true; // Required for async sendResponse
    }
});