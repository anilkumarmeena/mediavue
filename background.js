import { isMediaUrl, getMediaType, getHlsType } from './utils/media-detector.js';

// Cache for media URLs captured from network requests, keyed by tabId
const tabMediaCache = new Map();

// Auto-refresh tabs when the extension is updated to ensure content scripts are fresh
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'update' || details.reason === 'install') {
    chrome.tabs.query({ url: ["http://*/*", "https://*/*"] }, (tabs) => {
      tabs.forEach(tab => {
        try {
          chrome.tabs.reload(tab.id);
        } catch (e) {
          console.error(`Failed to reload tab ${tab.id}:`, e);
        }
      });
    });
  }
  
  // Configure Side Panel to open on action (icon) click
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('Failed to set panel behavior:', error));
});

// Listen for network requests to capture media files and manifests
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    // Ignore requests not associated with a tab (e.g., background requests) or internal ones
    if (details.tabId < 0) return;
    
    const url = details.url;
    if (url.startsWith('blob:')) return;
    
    if (isMediaUrl(url)) {
      if (!tabMediaCache.has(details.tabId)) {
        tabMediaCache.set(details.tabId, []);
      }
      
      const cache = tabMediaCache.get(details.tabId);
      // Check for exact URL match to avoid duplicates in the network cache
      if (!cache.some(item => item.url === url)) {
        cache.push({
          url,
          type: getMediaType(url),
          source: 'network',
          timestamp: Date.now()
        });
        
        // Notify Side Panel of new discovery
        chrome.runtime.sendMessage({ 
          action: 'new_media_detected', 
          tabId: details.tabId,
          url: url 
        }).catch(() => {
          // Ignore error if side panel is not open
        });
        
        // As per plan: Keep the last 100 requests per tab to manage memory
        if (cache.length > 100) {
          cache.shift();
        }
      }
    }
  },
  { urls: ["<all_urls>"] }
);

// Clean up cache when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabMediaCache.delete(tabId);
});

// Handle requests from the popup UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scan_page') {
    const tabId = message.tabId || sender?.tab?.id;
    if (!tabId) {
      sendResponse({ error: 'No tab ID specified' });
      return;
    }

    // Step 1: Inject content script dynamically
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    })
    .then(() => {
      // Step 2: Request DOM extraction from the injected content script
      chrome.tabs.sendMessage(tabId, { action: 'extract_dom_media' }, (domMedia) => {
        // If message fails (e.g. content script didn't load in time), fall back to empty list
        const domResults = domMedia || [];
        const networkResults = tabMediaCache.get(tabId) || [];
        
        // Step 3: Merge and deduplicate results
        const combined = mergeAndDeduplicate(domResults, networkResults);
        
        // Step 4: Enrich visible results with metadata (sizes)
        enrichResults(combined).then(enriched => {
          sendResponse({ results: enriched });
        });
      });
    })
    .catch(err => {
      console.error('Execution failed: ', err);
      sendResponse({ error: 'Failed to scan page. Extension may not have access to this page.' });
    });

    return true; // Keep message channel open for async response
  }
});

async function enrichResults(results) {
  const enrichmentPromises = results.map(async (item) => {
    // 1. Handle regular media sizes
    if (item.type === 'video' || item.type === 'audio') {
      try {
        const size = await fetchFileSize(item.url);
        if (size) item.size = size;
      } catch (e) {}
    }

    // 2. Handle HLS Streaming analysis
    if (item.type === 'streaming' && item.url.includes('.m3u8')) {
      try {
        const content = await fetchHlsContent(item.url);
        if (content) {
          const hlsType = getHlsType(content);
          if (hlsType) {
            item.hlsType = hlsType; // 'master' or 'media'
            
            // 3. Heuristic: If it's a media playlist, suggest a master URL
            if (hlsType === 'media') {
              const suggestedMaster = suggestMasterUrl(item.url);
              if (suggestedMaster) {
                item.suggestedMaster = suggestedMaster;
              }
            }
          }
        }
      } catch (e) {}
    }
    return item;
  });

  return Promise.all(enrichmentPromises);
}

async function fetchHlsContent(url) {
  try {
    const response = await fetch(url);
    if (response.ok) {
      // We only need the first 1KB to identify the type
      const text = await response.text();
      return text.substring(0, 1024);
    }
  } catch (e) {}
  return null;
}

function suggestMasterUrl(mediaUrl) {
  try {
    const url = new URL(mediaUrl);
    const parts = url.pathname.split('/');
    // Pop the filename (e.g., level_0.m3u8)
    parts.pop();
    const baseDir = parts.join('/');
    
    // Common master playlist filenames
    const candidates = ['master.m3u8', 'playlist.m3u8', 'index.m3u8', 'manifest.m3u8'];
    // We'll just return the first one as a suggestion
    // In a real scenario, we might want to HEAD check these, but for now, we suggest the most likely one
    return `${url.origin}${baseDir}/${candidates[0]}`;
  } catch (e) {}
  return null;
}

async function fetchFileSize(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000); // 2s timeout
    
    const response = await fetch(url, { 
      method: 'HEAD',
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (response.ok) {
      const contentLength = response.headers.get('content-length');
      return contentLength ? parseInt(contentLength, 10) : null;
    }
  } catch (e) {
    // Return null on any fetch error
  }
  return null;
}

function mergeAndDeduplicate(dom, network) {
  const seenUrls = new Set();
  const merged = [];

  // Helper to add unique items
  const addIfUnique = (item) => {
    if (!seenUrls.has(item.url)) {
      seenUrls.add(item.url);
      merged.push(item);
    }
  };

  // Add DOM results first, then network (DOM might provide better metadata if we add it later)
  dom.forEach(addIfUnique);
  network.forEach(addIfUnique);

  return merged;
}
