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

// Installation tracking functionality

// Your server endpoint URL
const TRACKING_SERVER_URL = 'https://your-extension-tracker.herokuapp.com/api/track-install';

// Listen for extension installation
chrome.runtime.onInstalled.addListener(function (details) {
    if (details.reason === "install") {
        console.log('Extension installed!');
        trackInstallation();
    }
});

// Function to send installation data to your tracking server
function trackInstallation() {
    fetch(TRACKING_SERVER_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            extensionId: chrome.runtime.id,
            installTime: new Date().toISOString(),
            userAgent: navigator.userAgent
        }),
    })
        .then(response => response.json())
        .then(data => {
            console.log('Installation tracked successfully:', data);
        })
        .catch(error => {
            console.error('Error tracking installation:', error);
        });
}
