// Global state
let buttonAdded = false;
let attemptCount = 0;
const MAX_ATTEMPTS = 15;
let refilterTimeout = null;
let processingMutations = false;

// Tab specific state
const tabStates = {
    videos: { active: false, key: 'yt-unwatched-videos-active' },
    shorts: { active: false, key: 'yt-unwatched-shorts-active' },
    live: { active: false, key: 'yt-unwatched-live-active' }
};

// Helper functions
const getTabFromPath = path => {
    if (path.includes('/shorts')) return 'shorts';
    if (path.includes('/streams') || path.includes('/live')) return 'live';
    if (path.includes('/videos')) return 'videos';
    return null;
};

const debounce = (func, delay) => {
    let timeout;
    return function () {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
};

// Reset all states to default (OFF)
function resetStoredStates() {
    Object.entries(tabStates).forEach(([key, tab]) => {
        localStorage.setItem(tab.key, 'false');
        tab.active = false;
    });
    console.log("YouTube Unwatched: Reset all states to OFF");
}

// Initialization
if (localStorage.getItem('yt-unwatched-initialized') !== 'true') {
    resetStoredStates();
    localStorage.setItem('yt-unwatched-initialized', 'true');
}

// DOM Ready handler
document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();

function init() {
    console.log("YouTube Unwatched: Initializing");

    // 重置所有状态，确保按钮默认为红色（过滤关闭）
    resetStoredStates();

    // 加载状态（现在都是false/OFF）
    loadTabStates();

    // 检查是否在频道页面
    if (isRelevantChannelPage()) {
        const currentTab = getCurrentTab();
        if (currentTab) {
            console.log(`YouTube Unwatched: On ${currentTab} tab`);
            setTimeout(() => addFilterButton(currentTab), 1000);
        }
    }

    // 设置导航监听
    setupNavigationListener();

    // 设置内容观察器
    setupContentObservers();
}

// State management
function loadTabStates() {
    // Load states from localStorage
    Object.entries(tabStates).forEach(([tabName, tabState]) => {
        const savedState = localStorage.getItem(tabState.key);
        tabState.active = savedState === 'true';
    });

    console.log("YouTube Unwatched: Loaded states:", {
        videos: tabStates.videos.active,
        shorts: tabStates.shorts.active,
        live: tabStates.live.active
    });
}

// Page detection - check if we're on a channel page with relevant tabs
function isRelevantChannelPage() {
    const url = window.location.href;

    // Check if on a channel page
    const isChannel = /\/channel\/|\/c\/|\/user\/|\/@/.test(url);

    // Check if on a relevant tab
    const hasRelevantTab = /\/videos|\/shorts|\/streams|\/live/.test(url);

    return isChannel && hasRelevantTab;
}

// Tab detection - determine which tab we're currently on
function getCurrentTab() {
    // First check URL path (most reliable)
    const path = window.location.pathname;
    if (path.includes('/shorts')) return 'shorts';
    if (path.includes('/streams') || path.includes('/live')) return 'live';
    if (path.includes('/videos')) return 'videos';

    // Fallback to DOM-based detection
    const activeTab = document.querySelector('[aria-selected="true"]')?.textContent?.toLowerCase();
    if (activeTab) {
        if (activeTab.includes('shorts')) return 'shorts';
        if (activeTab.includes('live') || activeTab.includes('stream')) return 'live';
        if (activeTab.includes('video')) return 'videos';
    }

    // If all else fails, check for specific content
    if (document.querySelector('ytd-reel-shelf-renderer')) return 'shorts';
    if (document.querySelector('ytd-channel-video-player-renderer')) return 'live';

    return 'videos'; // Default fallback
}

// Button management
function addFilterButton(tabType) {
    if (buttonAdded || attemptCount >= MAX_ATTEMPTS) return;
    attemptCount++;

    console.log(`YouTube Unwatched: Adding button for ${tabType} tab (attempt ${attemptCount})`);

    // Check if button already exists
    const existingBtn = document.getElementById('unwatched-filter-button');
    if (existingBtn) {
        console.log("YouTube Unwatched: Button already exists");
        buttonAdded = true;
        updateButtonAppearance(tabType);
        return;
    }

    try {
        // Create button with improved styling
        const btn = document.createElement('button');
        btn.id = 'unwatched-filter-button';

        // Apply styles
        Object.assign(btn.style, {
            position: 'fixed',
            top: '120px',
            right: '20px',
            padding: '10px 20px',
            borderRadius: '20px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            zIndex: '9999',
            backgroundColor: '#ff0000' // Default to red (OFF)
        });

        // Set text content and data attributes
        btn.textContent = getButtonLabel(tabType, tabStates[tabType].active);
        btn.dataset.tabType = tabType;

        // Add click handler
        btn.addEventListener('click', () => toggleFilter(tabType));

        // Add to document
        document.body.appendChild(btn);
        buttonAdded = true;

        console.log(`YouTube Unwatched: Button added for ${tabType} tab`);
    } catch (e) {
        console.error("YouTube Unwatched: Error adding button:", e);
        // Retry after short delay
        setTimeout(() => addFilterButton(tabType), 1000);
    }
}

// Get button label based on tab and state
function getButtonLabel(tabType, isActive) {
    const tabName = tabType.charAt(0).toUpperCase() + tabType.slice(1);
    return `Hide Watched ${tabName} ${isActive ? 'ON' : 'OFF'}`;
}

// Update button appearance to match state
function updateButtonAppearance(tabType) {
    const btn = document.getElementById('unwatched-filter-button');
    if (!btn) return;

    // Check for correct tab type
    const currentTab = getCurrentTab();
    if (currentTab && currentTab !== tabType) {
        console.log(`YouTube Unwatched: Correcting tab type from ${tabType} to ${currentTab}`);
        tabType = currentTab;
    }

    // Update button text and data attribute
    btn.textContent = getButtonLabel(tabType, tabStates[tabType].active);
    btn.dataset.tabType = tabType;

    // Update button color
    btn.style.backgroundColor = tabStates[tabType].active ? '#00cc00' : '#ff0000';

    console.log(`YouTube Unwatched: Button updated for ${tabType}, state: ${tabStates[tabType].active}`);
}

// Toggle filtering for the current tab
function toggleFilter(tabType) {
    // Check for correct tab type
    const currentTab = getCurrentTab();
    if (currentTab && currentTab !== tabType) {
        console.log(`YouTube Unwatched: Correcting tab type from ${tabType} to ${currentTab}`);
        tabType = currentTab;
    }

    // Toggle the state
    tabStates[tabType].active = !tabStates[tabType].active;
    localStorage.setItem(tabStates[tabType].key, tabStates[tabType].active.toString());
    console.log(`YouTube Unwatched: Toggled ${tabType} state to ${tabStates[tabType].active}`);

    // Update button and apply filtering
    updateButtonAppearance(tabType);

    if (tabStates[tabType].active) {
        filterContent(tabType);
    } else {
        showAllContent(tabType);
    }
}

// Filter out watched content
function filterContent(tabType) {
    console.log(`YouTube Unwatched: Filtering ${tabType} content`);

    // Get selectors for the current tab
    const selectors = getSelectorsForTab(tabType);
    if (!selectors || selectors.length === 0) return;

    // Find all content items
    const items = document.querySelectorAll(selectors.join(', '));
    console.log(`YouTube Unwatched: Found ${items.length} items to filter`);

    let hiddenCount = 0;

    // Process each item
    items.forEach(item => {
        const isWatched = checkWatchedStatus(item, tabType);
        if (isWatched) {
            item.style.display = 'none';
            hiddenCount++;
        } else {
            item.style.display = '';
        }
    });

    console.log(`YouTube Unwatched: Hidden ${hiddenCount} of ${items.length} items`);
}

// Show all content for the tab
function showAllContent(tabType) {
    console.log(`YouTube Unwatched: Showing all ${tabType} content`);

    // Get selectors for the current tab
    const selectors = getSelectorsForTab(tabType);
    if (!selectors || selectors.length === 0) return;

    // Find all items and reset display
    const items = document.querySelectorAll(selectors.join(', '));
    items.forEach(item => {
        item.style.display = '';
    });

    console.log(`YouTube Unwatched: Reset display for ${items.length} items`);
}

// Check if an item is watched
function checkWatchedStatus(item, tabType) {
    // Check for progress bar (works for most content)
    const progress = item.querySelector('#progress');
    if (progress && window.getComputedStyle(progress).width !== '0px') {
        return true;
    }

    // Type-specific checks
    if (tabType === 'live') {
        // Look for watched indicator on livestreams
        return !!item.querySelector('[aria-label="Watched"]') ||
            item.textContent.includes('Watched');
    } else if (tabType === 'shorts') {
        // Special short checks
        return !!item.querySelector('ytd-thumbnail-overlay-resume-playback-renderer');
    } else {
        // Regular video checks
        return !!item.querySelector('ytd-thumbnail-overlay-resume-playback-renderer');
    }
}

// Get selectors for different tab types
function getSelectorsForTab(tabType) {
    switch (tabType) {
        case 'videos':
            return ['ytd-grid-video-renderer', 'ytd-rich-item-renderer', 'ytd-video-renderer'];
        case 'shorts':
            return ['ytd-grid-video-renderer', 'ytd-reel-item-renderer', 'ytd-rich-grid-slim-media', 'ytd-rich-item-renderer'];
        case 'live':
            return ['ytd-grid-video-renderer', 'ytd-rich-item-renderer', 'ytd-video-renderer'];
        default:
            return [];
    }
}

// Listen for navigation in SPA
function setupNavigationListener() {
    let previousUrl = window.location.href;

    // Check for URL and navigation changes
    const checkNavigation = debounce(() => {
        const currentUrl = window.location.href;

        // If URL has changed
        if (currentUrl !== previousUrl) {
            console.log(`YouTube Unwatched: Navigation from ${previousUrl} to ${currentUrl}`);
            previousUrl = currentUrl;

            // Reset button state
            buttonAdded = false;
            attemptCount = 0;

            // Remove existing button
            document.getElementById('unwatched-filter-button')?.remove();

            // If on a relevant page, add button for new tab
            if (isRelevantChannelPage()) {
                const currentTab = getCurrentTab();
                if (currentTab) {
                    setTimeout(() => {
                        addFilterButton(currentTab);

                        // Apply filtering if active for this tab
                        if (tabStates[currentTab].active) {
                            setTimeout(() => filterContent(currentTab), 500);
                        }
                    }, 1000);
                }
            }
        }
    }, 500);

    // Check periodically
    setInterval(checkNavigation, 1000);
}

// Set up content observers
function setupContentObservers() {
    // Observe DOM changes
    const contentObserver = new MutationObserver(debounce(mutations => {
        if (!isRelevantChannelPage()) {
            document.getElementById('unwatched-filter-button')?.remove();
            buttonAdded = false;
            return;
        }

        const currentTab = getCurrentTab();
        if (currentTab && tabStates[currentTab].active) {
            filterContent(currentTab);
        }
    }, 300));

    // Start observing
    const container = document.querySelector('ytd-browse[page-subtype="channels"]');
    if (container) {
        contentObserver.observe(container, {
            childList: true,
            subtree: true
        });
    }

    // Also handle scroll events
    window.addEventListener('scroll', debounce(() => {
        const currentTab = getCurrentTab();
        if (currentTab && tabStates[currentTab].active) {
            filterContent(currentTab);
        }
    }, 300));
}