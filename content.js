// content.js - Updated to only show the button on channel pages with Videos/Shorts/Live tabs

// Global state
let buttonAdded = false;
let attemptCount = 0;
const MAX_ATTEMPTS = 20;
let refilterTimeout = null;
let processingMutations = false;

// Tab specific state
const tabStates = {
    videos: { active: false, key: 'yt-unwatched-videos-active' },
    shorts: { active: false, key: 'yt-unwatched-shorts-active' },
    live: { active: false, key: 'yt-unwatched-live-active' }
};

// Helper function - get tab type from path
function getTabFromPath(path) {
    if (path.includes('/shorts')) {
        return 'shorts';
    } else if (path.includes('/streams') || path.includes('/live')) {
        return 'live';
    } else if (path.includes('/videos')) {
        return 'videos';
    }

    return null;
}

// Helper function - debounce
function debounce(func, delay) {
    let timeout;
    return function () {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

// Remove any problematic saved states (for fresh install)
function resetStoredStates() {
    // Clear any existing states that might be causing problems
    localStorage.removeItem(tabStates.videos.key);
    localStorage.removeItem(tabStates.shorts.key);
    localStorage.removeItem(tabStates.live.key);

    // Set defaults explicitly
    localStorage.setItem(tabStates.videos.key, 'false');
    localStorage.setItem(tabStates.shorts.key, 'false');
    localStorage.setItem(tabStates.live.key, 'false');

    console.log("YouTube Unwatched: Reset all stored states to OFF");
}

// For first-time installations, reset any stored states
if (localStorage.getItem('yt-unwatched-initialized') !== 'true') {
    resetStoredStates();
    localStorage.setItem('yt-unwatched-initialized', 'true');
}

// Run when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    // Already loaded
    init();
}

// Main function to run after page load
function init() {
    console.log("YouTube Unwatched: Extension initialized");

    // 重置所有存储的状态，确保所有按钮默认为红色（过滤关闭）
    resetStoredStates();

    // 加载已保存的状态（现在都会是false/OFF）
    loadAllTabStates();

    // 检查是否在频道页面上的相关标签页
    if (isOnRelevantChannelPage()) {
        console.log("YouTube Unwatched: On a relevant channel page");
        const currentTab = getCurrentTab();

        if (currentTab) {
            // 特别处理当前是Live标签页的情况
            if (currentTab === 'live') {
                console.log(`YouTube Unwatched: Currently on Live tab, state:`, tabStates.live.active);
            }

            setTimeout(() => {
                addFilterButton(currentTab);
            }, 2000);
        }
    } else {
        console.log("YouTube Unwatched: Not on a relevant channel page, button will not be added");
    }

    // Set up navigation listener for SPA
    listenForNavigation();

    // Set up scroll and mutation observers for dynamic content loading
    setupDynamicContentObservers();
}

// Check if we're on a channel page with Videos, Shorts, or Live tabs
function isOnRelevantChannelPage() {
    const url = window.location.href;

    // First check if we're on a channel page
    const isChannelPage = url.includes('/channel/') ||
        url.includes('/c/') ||
        url.includes('/user/') ||
        url.includes('/@');

    if (!isChannelPage) {
        console.log("YouTube Unwatched: Not on a channel page");
        return false;
    }

    // Now check if we're on a relevant tab
    const isVideosTab = url.includes('/videos');
    const isShortsTab = url.includes('/shorts');
    const isLiveTab = url.includes('/streams') || url.includes('/live');

    const isRelevantTab = isVideosTab || isShortsTab || isLiveTab;

    if (!isRelevantTab) {
        console.log("YouTube Unwatched: On channel page but not on Videos/Shorts/Live tab");
    }

    return isRelevantTab;
}

// Load saved states for all tabs
function loadAllTabStates() {
    // 添加调试信息来查看实际的本地存储值
    console.log("YouTube Unwatched: Raw localStorage values:", {
        videos: localStorage.getItem(tabStates.videos.key),
        shorts: localStorage.getItem(tabStates.shorts.key),
        live: localStorage.getItem(tabStates.live.key)
    });

    // Load Videos state - default to FALSE if not set or null
    const videosState = localStorage.getItem(tabStates.videos.key);
    tabStates.videos.active = videosState === 'true'; // This will be false for null, undefined, or any value other than 'true'

    // Load Shorts state - default to FALSE if not set or null
    const shortsState = localStorage.getItem(tabStates.shorts.key);
    tabStates.shorts.active = shortsState === 'true';

    // Load Live state - default to FALSE if not set or null
    const liveState = localStorage.getItem(tabStates.live.key);
    tabStates.live.active = liveState === 'true';

    console.log("YouTube Unwatched: Loaded saved states:", {
        videos: tabStates.videos.active,
        shorts: tabStates.shorts.active,
        live: tabStates.live.active
    });

    // Initialize localStorage with default values if not set
    if (videosState === null) {
        localStorage.setItem(tabStates.videos.key, 'false');
    }
    if (shortsState === null) {
        localStorage.setItem(tabStates.shorts.key, 'false');
    }
    if (liveState === null) {
        localStorage.setItem(tabStates.live.key, 'false');
    }

    // 如果shorts标签页的状态错误地被设为true，强制修正为false
    if (tabStates.shorts.active === true) {
        console.log("YouTube Unwatched: Correcting shorts tab state from ON to OFF");
        tabStates.shorts.active = false;
        localStorage.setItem(tabStates.shorts.key, 'false');
    }
}

// Get the current tab type from URL and DOM elements
function getCurrentTab() {
    // 添加更详细的日志
    console.log("YouTube Unwatched: Detecting current tab from", window.location.pathname);

    const path = window.location.pathname;

    // 首先通过URL路径来确定标签类型（最可靠的方法）
    if (path.includes('/shorts')) {
        console.log("YouTube Unwatched: Detected Shorts tab from URL path");
        return 'shorts';
    } else if (path.includes('/streams') || path.includes('/live')) {
        console.log("YouTube Unwatched: Detected Live tab from URL path");
        return 'live';
    } else if (path.includes('/videos')) {
        console.log("YouTube Unwatched: Detected Videos tab from URL path");
        return 'videos';
    }

    // 如果无法从URL确定，检查DOM元素特征
    console.log("YouTube Unwatched: URL path did not conclusively identify tab, checking DOM elements");

    // 检查页面标题或面包屑导航中的标签指示器
    const pageTitle = document.title || '';
    if (pageTitle.includes('Shorts')) {
        console.log("YouTube Unwatched: Detected Shorts tab from page title");
        return 'shorts';
    } else if (pageTitle.includes('Live') || pageTitle.includes('Streams')) {
        console.log("YouTube Unwatched: Detected Live tab from page title");
        return 'live';
    }

    // 检查导航标签的激活状态
    const tabElements = document.querySelectorAll('paper-tab, tp-yt-paper-tab');
    for (const tab of tabElements) {
        const tabText = tab.textContent.trim().toLowerCase();
        const isSelected = tab.getAttribute('aria-selected') === 'true' ||
            tab.classList.contains('iron-selected') ||
            tab.classList.contains('selected');

        if (isSelected) {
            console.log(`YouTube Unwatched: Found selected tab with text: ${tabText}`);
            if (tabText.includes('shorts')) {
                return 'shorts';
            } else if (tabText.includes('live') || tabText.includes('stream')) {
                return 'live';
            } else if (tabText.includes('video')) {
                return 'videos';
            }
        }
    }

    // 最后一种检测方法：查找特定的页面元素
    if (document.querySelector('ytd-reel-shelf-renderer') || document.querySelector('ytd-shorts')) {
        console.log("YouTube Unwatched: Detected Shorts tab from shorts-specific elements");
        return 'shorts';
    } else if (document.querySelector('ytd-channel-video-player-renderer')) {
        console.log("YouTube Unwatched: Detected Live tab from live-specific elements");
        return 'live';
    }

    console.log("YouTube Unwatched: Unable to determine current tab, defaulting to Videos");
    return 'videos'; // 默认假设是Videos标签
}

// Get current tab state
function getCurrentState() {
    const tab = getCurrentTab();
    return tab ? tabStates[tab].active : false;
}

// Get button label based on tab type and state
function getButtonLabel(tabType, isActive) {
    let tabLabel = tabType.charAt(0).toUpperCase() + tabType.slice(1); // Capitalize first letter

    return isActive ?
        `Hide Watched ${tabLabel} ON` :
        `Hide Watched ${tabLabel} OFF`;
}

// Add filter button for specific tab
function addFilterButton(tabType) {
    if (buttonAdded || attemptCount >= MAX_ATTEMPTS) return;

    console.log(`YouTube Unwatched: Attempt ${attemptCount + 1} to add button for ${tabType} tab`);
    attemptCount++;

    // Check if we're on a relevant channel page before adding the button
    if (!isOnRelevantChannelPage()) {
        console.log("YouTube Unwatched: Not on a relevant channel page, button will not be added");
        return;
    }

    // Check if button already exists
    if (document.querySelector('#unwatched-filter-button')) {
        console.log("YouTube Unwatched: Button already exists");
        buttonAdded = true;

        // Update the button appearance to match current state
        updateButtonAppearance(tabType);
        return;
    }

    // 特别针对Shorts标签页，确保状态正确
    if (tabType === 'shorts' && tabStates.shorts.active === true) {
        console.log("YouTube Unwatched: Correcting shorts tab state in addFilterButton");
        tabStates.shorts.active = false;
        localStorage.setItem(tabStates.shorts.key, 'false');
    }

    try {
        // Create our button
        const filterButton = document.createElement('button');
        filterButton.id = 'unwatched-filter-button';

        // Style the button
        filterButton.style.position = 'fixed';  // Fixed position so it stays visible
        filterButton.style.top = '120px';       // Position below the channel header
        filterButton.style.right = '20px';      // Align to right side
        filterButton.style.padding = '10px 20px';
        filterButton.style.borderRadius = '20px';
        filterButton.style.border = 'none';
        filterButton.style.cursor = 'pointer';
        filterButton.style.fontWeight = 'bold';
        filterButton.style.fontSize = '14px';
        filterButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        filterButton.style.zIndex = '9999';     // Ensure it's on top

        // Set button text based on tab and state
        const isActive = tabStates[tabType].active;
        filterButton.textContent = getButtonLabel(tabType, isActive);

        // Set initial appearance based on current state
        if (isActive) {
            filterButton.style.backgroundColor = '#00cc00';
        } else {
            filterButton.style.backgroundColor = '#ff0000';
        }

        // Add click handler for the specific tab
        filterButton.addEventListener('click', () => toggleFilter(tabType));

        // Add to document body
        document.body.appendChild(filterButton);

        console.log(`YouTube Unwatched: Button successfully added for ${tabType}, initial state:`, tabStates[tabType].active);
        buttonAdded = true;

        // Store the current tab type as a data attribute for validation
        filterButton.dataset.tabType = tabType;

        // If we were previously filtering, reapply the filter
        if (tabStates[tabType].active) {
            setTimeout(() => filterUnwatchedContent(tabType), 500);
        }
    } catch (e) {
        console.error("YouTube Unwatched: Error adding button:", e);
        setTimeout(() => addFilterButton(tabType), 1000);
    }
}

// Update button appearance to match current tab state
function updateButtonAppearance(tabType) {
    const button = document.querySelector('#unwatched-filter-button');
    if (!button) return;

    // 再次验证当前标签类型，确保使用正确的标签
    const currentTabFromPath = getCurrentTab();
    if (currentTabFromPath && currentTabFromPath !== tabType) {
        console.log(`YouTube Unwatched: Correcting tab type in updateButtonAppearance from ${tabType} to ${currentTabFromPath}`);
        tabType = currentTabFromPath;
    }

    // Update the tab type data attribute
    button.dataset.tabType = tabType;

    // Get the active state for this tab
    const isActive = tabStates[tabType].active;

    // Update button text with new naming scheme
    button.textContent = getButtonLabel(tabType, isActive);

    // Update button appearance
    if (isActive) {
        button.style.backgroundColor = '#00cc00';
        console.log(`YouTube Unwatched: Button updated to GREEN (ON) for ${tabType}`);
    } else {
        button.style.backgroundColor = '#ff0000';
        console.log(`YouTube Unwatched: Button updated to RED (OFF) for ${tabType}`);
    }

    console.log(`YouTube Unwatched: Button appearance updated for ${tabType}, state:`, tabStates[tabType].active);
}

// Toggle filtering function for specific tab
function toggleFilter(tabType) {
    console.log(`YouTube Unwatched: Toggle filter clicked for ${tabType}, current state:`, tabStates[tabType].active);

    // 获取当前正确的标签类型（防止错误的标签被传递）
    const currentTabFromPath = getCurrentTab();
    if (currentTabFromPath && currentTabFromPath !== tabType) {
        console.log(`YouTube Unwatched: Correcting tab type from ${tabType} to ${currentTabFromPath}`);
        tabType = currentTabFromPath;
    }

    // Toggle the active state for this tab
    tabStates[tabType].active = !tabStates[tabType].active;

    console.log(`YouTube Unwatched: New state for ${tabType}:`, tabStates[tabType].active);

    // 强制延迟，确保DOM操作顺序正确
    setTimeout(() => {
        if (tabStates[tabType].active) {
            console.log(`YouTube Unwatched: Filtering unwatched ${tabType}`);
            filterUnwatchedContent(tabType);
        } else {
            console.log(`YouTube Unwatched: Showing all ${tabType}`);
            showAllContent(tabType);
        }

        // Update button appearance
        updateButtonAppearance(tabType);

        // Store the filter state for this tab
        localStorage.setItem(tabStates[tabType].key, tabStates[tabType].active.toString());
        console.log(`YouTube Unwatched: Filter state saved for ${tabType}:`, tabStates[tabType].active);
    }, 50);
}

// Filter out watched content based on tab type
function filterUnwatchedContent(tabType) {
    // Cancel any pending refilter operations
    if (refilterTimeout) {
        clearTimeout(refilterTimeout);
        refilterTimeout = null;
    }

    try {
        // 再次验证当前标签类型，确保使用正确的标签
        const currentTabFromPath = getCurrentTab();
        if (currentTabFromPath && currentTabFromPath !== tabType) {
            console.log(`YouTube Unwatched: Correcting tab type in filterUnwatchedContent from ${tabType} to ${currentTabFromPath}`);
            tabType = currentTabFromPath;
        }

        // 确保按钮状态与过滤状态一致
        const button = document.querySelector('#unwatched-filter-button');
        if (button) {
            // 确保当前标签的状态是true
            if (!tabStates[tabType].active) {
                console.log(`YouTube Unwatched: Fixing inconsistent filter state for ${tabType}`);
                tabStates[tabType].active = true;
                localStorage.setItem(tabStates[tabType].key, 'true');

                // 更新按钮显示
                updateButtonAppearance(tabType);
            }
        }

        // Different selectors for different tab types
        const selectors = getSelectorsForTab(tabType);

        console.log(`YouTube Unwatched: Filtering content on ${tabType} tab using selectors:`, selectors);

        const contentItems = document.querySelectorAll(selectors.join(', '));
        console.log(`YouTube Unwatched: Found ${contentItems.length} items to filter on ${tabType} tab`);

        let hiddenCount = 0;

        // Loop through content
        contentItems.forEach(item => {
            // Use the appropriate check function based on tab type
            let isWatched = false;

            if (tabType === 'live') {
                isWatched = isLiveStreamWatched(item);
            } else if (tabType === 'shorts') {
                isWatched = isShortWatched(item);
            } else {
                isWatched = isVideoWatched(item);
            }

            if (isWatched) {
                item.style.display = 'none';
                hiddenCount++;
            } else {
                item.style.display = '';
            }
        });

        console.log(`YouTube Unwatched: Hidden ${hiddenCount} watched items out of ${contentItems.length} total on ${tabType} tab`);
    } catch (e) {
        console.error(`YouTube Unwatched: Error during filtering on ${tabType} tab:`, e);
    }
}

// Check if a video is watched (for Videos tab)
function isVideoWatched(item) {
    // Check for any of the progress indicators
    const progressBar = item.querySelector('#progress');
    const resumePlayback = item.querySelector('ytd-thumbnail-overlay-resume-playback-renderer');

    // If there's a progress bar with any width, it's watched
    if (progressBar) {
        const style = window.getComputedStyle(progressBar);
        if (parseInt(style.width) > 0) {
            return true;
        }
    }

    // If there's a resume playback overlay, it's watched
    if (resumePlayback) {
        return true;
    }

    return false;
}

// Check if a short is watched
function isShortWatched(item) {
    // For shorts, we need to check for different indicators
    const progressBar = item.querySelector('#progress');
    const watchedIndicator = item.querySelector('.ytd-thumbnail-overlay-resume-playback-renderer');

    // Check if there's a "watched" indicator in the thumbnail
    if (watchedIndicator) {
        return true;
    }

    // Check if it has a progress bar
    if (progressBar) {
        const style = window.getComputedStyle(progressBar);
        if (parseInt(style.width) > 0) {
            return true;
        }
    }

    return false;
}

// Specialized function to check if a livestream is watched
function isLiveStreamWatched(item) {
    // Check for progress indicator
    const progressBar = item.querySelector('#progress');
    if (progressBar) {
        const style = window.getComputedStyle(progressBar);
        // Only count as watched if there's an actual width
        if (parseInt(style.width) > 0) {
            return true;
        }
    }

    // Check for a "Watched" badge on livestreams
    const metadata = item.querySelector('#metadata, #meta');
    if (metadata) {
        const watchedText = metadata.textContent.includes('Watched');
        if (watchedText) {
            return true;
        }
    }

    // Look for "LIVE" badge - if it has a LIVE badge, it's current and not watched
    const liveBadge = item.querySelector('ytd-thumbnail-overlay-time-status-renderer[overlay-style="LIVE"]');
    if (liveBadge) {
        return false; // Current livestreams are not "watched"
    }

    // If it says "Streamed X time ago" and has a progress indicator, it's watched
    const hasStreamedText = item.textContent.includes('Streamed ') && progressBar;

    return hasStreamedText && progressBar;
}

// Show all content for specific tab
function showAllContent(tabType) {
    // Cancel any pending refilter operations
    if (refilterTimeout) {
        clearTimeout(refilterTimeout);
        refilterTimeout = null;
    }

    try {
        // 再次验证当前标签类型，确保使用正确的标签
        const currentTabFromPath = getCurrentTab();
        if (currentTabFromPath && currentTabFromPath !== tabType) {
            console.log(`YouTube Unwatched: Correcting tab type in showAllContent from ${tabType} to ${currentTabFromPath}`);
            tabType = currentTabFromPath;
        }

        // 确保按钮状态与过滤状态一致
        const button = document.querySelector('#unwatched-filter-button');
        if (button) {
            // 确保当前标签的状态是false
            if (tabStates[tabType].active) {
                console.log(`YouTube Unwatched: Fixing inconsistent filter OFF state for ${tabType}`);
                tabStates[tabType].active = false;
                localStorage.setItem(tabStates[tabType].key, 'false');

                // 更新按钮显示
                updateButtonAppearance(tabType);
            }
        }

        // Different selectors for different tab types
        const selectors = getSelectorsForTab(tabType);

        console.log(`YouTube Unwatched: Resetting display for all content on ${tabType} tab using selectors:`, selectors);

        // Find all items on the page that match our selectors
        const items = document.querySelectorAll(selectors.join(', '));
        console.log(`YouTube Unwatched: Found ${items.length} items to reset`);

        // Reset all display styles to show everything
        items.forEach(item => {
            if (item.style.display === 'none') {
                item.style.display = '';
                console.log("YouTube Unwatched: Restored hidden item:", item);
            }
        });

        // For Live tab, we need an extra comprehensive search
        if (tabType === 'live') {
            // Try even broader selectors to make sure we catch everything
            const contentContainer = document.querySelector('#contents');
            if (contentContainer) {
                // Get all potential video items in the container
                const allItems = contentContainer.querySelectorAll('*');
                console.log(`YouTube Unwatched: Checking ${allItems.length} potential items in content container`);

                allItems.forEach(item => {
                    // Only target elements that might be video items
                    if (item.tagName && item.tagName.toLowerCase().includes('renderer')) {
                        if (item.style.display === 'none') {
                            item.style.display = '';
                            console.log("YouTube Unwatched: Restored hidden item from content container:", item);
                        }
                    }
                });
            }
        }

        console.log(`YouTube Unwatched: Reset display of all content on ${tabType} tab`);
    } catch (e) {
        console.error(`YouTube Unwatched: Error showing all content on ${tabType} tab:`, e);
    }
}

// Set up observers for dynamic content
function setupDynamicContentObservers() {
    let contentObserverThrottleTimer = null;

    // Create a mutation observer to watch for new content loaded
    const contentObserver = new MutationObserver((mutations) => {
        // Avoid processing mutations too frequently
        if (processingMutations) return;
        if (contentObserverThrottleTimer) return;

        contentObserverThrottleTimer = setTimeout(() => {
            contentObserverThrottleTimer = null;

            // Set processing flag
            processingMutations = true;

            try {
                // First check if we're on a relevant channel page
                if (!isOnRelevantChannelPage()) {
                    // If button exists but we're not on a relevant page, remove it
                    const button = document.querySelector('#unwatched-filter-button');
                    if (button) {
                        console.log("YouTube Unwatched: Not on a relevant channel page, removing button");
                        button.remove();
                        buttonAdded = false;
                    }
                    return;
                }

                // Check if we've changed tabs
                const currentTab = getCurrentTab();
                const button = document.querySelector('#unwatched-filter-button');

                // If we have a button and it's showing the wrong tab, update it
                if (button && button.dataset.tabType !== currentTab && currentTab) {
                    console.log(`YouTube Unwatched: Tab type mismatch - button shows ${button.dataset.tabType}, but we're on ${currentTab}`);
                    updateButtonAppearance(currentTab);
                }

                // Only process if we're on a supported tab and filtering is active for that tab
                if (currentTab && tabStates[currentTab].active) {
                    // Check if mutations contain content items
                    let shouldRefilter = false;

                    for (const mutation of mutations) {
                        if (mutation.addedNodes.length > 0) {
                            // Check if any added nodes are or contain video elements
                            for (const node of mutation.addedNodes) {
                                if (node.nodeType === 1) { // Element node
                                    const selectors = getSelectorsForTab(currentTab);
                                    const hasVideoContent = selectors.some(sel =>
                                        node.tagName && node.tagName.toLowerCase() === sel.toLowerCase() ||
                                        (node.querySelector && node.querySelector(sel))
                                    );

                                    if (hasVideoContent) {
                                        shouldRefilter = true;
                                        break;
                                    }
                                }
                            }
                        }

                        if (shouldRefilter) break;
                    }

                    // Reapply filter if needed, with throttling
                    if (shouldRefilter) {
                        // Cancel any pending refilter operations
                        if (refilterTimeout) {
                            clearTimeout(refilterTimeout);
                        }

                        // Set a new timeout to refilter
                        refilterTimeout = setTimeout(() => {
                            console.log(`YouTube Unwatched: New content detected on ${currentTab} tab, reapplying filter`);
                            filterUnwatchedContent(currentTab);
                            refilterTimeout = null;
                        }, 1000);
                    }
                }

                // Check if we need to add the button (in case it was removed)
                if (currentTab && !document.querySelector('#unwatched-filter-button')) {
                    buttonAdded = false;
                    addFilterButton(currentTab);
                }
            } finally {
                // Clear processing flag
                processingMutations = false;
            }
        }, 500);
    });

    // Start observing with a delay to let the page settle
    setTimeout(() => {
        contentObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }, 3000);

    // Also add a scroll event listener to catch lazy-loaded content
    window.addEventListener('scroll', debounce(() => {
        // First check if we're on a relevant channel page
        if (!isOnRelevantChannelPage()) {
            return;
        }

        const currentTab = getCurrentTab();
        if (currentTab && tabStates[currentTab].active) {
            // Only refilter if we're not already processing mutations
            if (!processingMutations && !refilterTimeout) {
                console.log(`YouTube Unwatched: Scroll detected on ${currentTab} tab, reapplying filter`);
                filterUnwatchedContent(currentTab);
            }
        }
    }, 500));
}

// Helper function - get selectors for a specific tab
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

// Listen for page navigation
function listenForNavigation() {
    let previousUrl = window.location.href;

    // Function to handle navigation events
    const navigationHandler = debounce(() => {
        const currentUrl = window.location.href;

        // If URL has changed
        if (currentUrl !== previousUrl) {
            const previousPath = new URL(previousUrl).pathname;
            const currentPath = new URL(currentUrl).pathname;

            console.log(`YouTube Unwatched: Navigation detected from ${previousPath} to ${currentPath}`);
            previousUrl = currentUrl;

            // Cancel any pending refilter operations
            if (refilterTimeout) {
                clearTimeout(refilterTimeout);
                refilterTimeout = null;
            }

            // Check if we're on a relevant channel page
            const isRelevant = isOnRelevantChannelPage();

            // Remove the old button
            const button = document.querySelector('#unwatched-filter-button');
            if (button) {
                button.remove();
            }

            // Reset button state
            buttonAdded = false;
            attemptCount = 0;

            // If not on a relevant page, don't add the button
            if (!isRelevant) {
                console.log("YouTube Unwatched: Not on a relevant channel page after navigation");
                return;
            }

            // Get the previous and current tab types
            const previousTab = getTabFromPath(previousPath);
            const currentTab = getTabFromPath(currentPath);

            // 确保当前状态与localStorage一致（修复可能的不同步）
            if (currentTab) {
                const savedState = localStorage.getItem(tabStates[currentTab].key);
                if (savedState === 'true') {
                    tabStates[currentTab].active = true;
                } else if (savedState === 'false') {
                    tabStates[currentTab].active = false;
                }
                console.log(`YouTube Unwatched: Tab ${currentTab} state loaded from storage:`, tabStates[currentTab].active);
            }

            // 处理导航到Shorts标签页的情况
            if (currentTab === 'shorts') {
                // 确保Shorts标签页的状态是关闭的
                if (tabStates.shorts.active === true) {
                    console.log("YouTube Unwatched: Correcting shorts tab state during navigation");
                    tabStates.shorts.active = false;
                    localStorage.setItem(tabStates.shorts.key, 'false');
                }
            }

            // 修复：确保Live标签页的状态与localStorage同步
            if (currentTab === 'live') {
                console.log(`YouTube Unwatched: Synchronizing Live tab state with localStorage: ${tabStates.live.active}`);
            }

            // If we're on a supported tab, add the appropriate button
            if (currentTab) {
                console.log(`YouTube Unwatched: Navigation to ${currentTab} tab detected, state:`, tabStates[currentTab].active);
                setTimeout(() => {
                    addFilterButton(currentTab);

                    // Apply filter if it's active for this tab
                    if (tabStates[currentTab].active) {
                        setTimeout(() => filterUnwatchedContent(currentTab), 1000);
                    }
                }, 2000);
            }
        }
    });

    // Start listening for navigation events
    navigationHandler();
}