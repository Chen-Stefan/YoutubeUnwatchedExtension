// Get the toggle element
const globalToggle = document.getElementById('globalToggle');
const statusMessage = document.getElementById('statusMessage');

// When the popup is opened, set the toggle to match the stored state
document.addEventListener('DOMContentLoaded', async () => {
  // Get the stored global state from Chrome storage
  chrome.storage.local.get(['globalFilterEnabled'], (result) => {
    // If no setting exists yet, default to enabled
    const isEnabled = result.globalFilterEnabled !== undefined ? result.globalFilterEnabled : true;
    
    // Set the toggle to match the stored state
    globalToggle.checked = isEnabled;
    
    // Update the status message
    updateStatusMessage(isEnabled);
  });
});

// When the toggle is clicked, update the stored state
globalToggle.addEventListener('change', () => {
  const isEnabled = globalToggle.checked;
  
  // Save the new state to Chrome storage
  chrome.storage.local.set({ globalFilterEnabled: isEnabled });
  
  // Update the status message
  updateStatusMessage(isEnabled);
  
  // Send a message to content scripts to update their behavior
  sendUpdateToContentScripts(isEnabled);
});

// Update the status message based on current state
function updateStatusMessage(isEnabled) {
  if (isEnabled) {
    statusMessage.textContent = 'Extension is currently active. The filter button will appear on YouTube channel pages.';
    statusMessage.style.color = '#007700';
  } else {
    statusMessage.textContent = 'Extension is currently disabled. No filtering will occur.';
    statusMessage.style.color = '#cc0000';
  }
}

// Send a message to any active content scripts
function sendUpdateToContentScripts(isEnabled) {
  chrome.tabs.query({ url: '*://*.youtube.com/*' }, (tabs) => {
    // Send message to each YouTube tab
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { 
        action: 'updateGlobalState', 
        enabled: isEnabled 
      }).catch(err => {
        // Ignore errors from inactive tabs
        console.log('Could not send message to tab: ', err);
      });
    });
  });
}