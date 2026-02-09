/**
 * MediaVue Content Script
 * Responsibilities:
 * - Extract media URLs from DOM elements (<video>, <audio>, <source>, <track>, <a>)
 * - Convert relative URLs to absolute URLs
 */

// Use an IIFE and a global flag to prevent multiple listener registrations
(function() {
  if (window.mediaVueInjected) {
    return;
  }
  window.mediaVueInjected = true;

  const MEDIA_PATTERNS = {
    VIDEO: /\.(mp4|webm|ogv|mov|avi|mkv|flv|m4v)($|\?)/i,
    AUDIO: /\.(mp3|wav|m4a|aac|ogg|opus|flac|wma)($|\?)/i,
    STREAMING: /\.(m3u8|mpd)($|\?)/i,
    SUBTITLES: /\.(vtt|srt|ass|ssa)($|\?)/i
  };

  function getMediaType(url) {
    if (MEDIA_PATTERNS.VIDEO.test(url)) return 'video';
    if (MEDIA_PATTERNS.AUDIO.test(url)) return 'audio';
    if (MEDIA_PATTERNS.STREAMING.test(url)) return 'streaming';
    if (MEDIA_PATTERNS.SUBTITLES.test(url)) return 'subtitle';
    return null;
  }

  function extractMediaFromDOM() {
    const results = [];
    const seenUrls = new Set();

    const addUniqueMedia = (url, type, element) => {
      if (!url || typeof url !== 'string' || url.startsWith('javascript:') || url.startsWith('data:') || url.startsWith('blob:')) {
        return;
      }

      try {
        const absoluteUrl = new URL(url, document.baseURI).href;
        
        // Skip if already seen to prevent duplicates within the DOM scan
        if (seenUrls.has(absoluteUrl)) {
          return;
        }

        const detectedType = type || getMediaType(absoluteUrl);
        
        if (detectedType) {
          seenUrls.add(absoluteUrl);
          results.push({
            url: absoluteUrl,
            type: detectedType,
            source: 'dom',
            tagName: element ? element.tagName.toLowerCase() : 'heuristic'
          });
        }
      } catch (e) {
        // Invalid URL, ignore
      }
    };

    // 1. Extract from <video> and <audio> elements
    document.querySelectorAll('video, audio').forEach(mediaEl => {
      // Direct src attribute
      if (mediaEl.src) {
        addUniqueMedia(mediaEl.src, mediaEl.tagName.toLowerCase(), mediaEl);
      }
      
      // <source> tags
      mediaEl.querySelectorAll('source').forEach(source => {
        if (source.src) {
          addUniqueMedia(source.src, mediaEl.tagName.toLowerCase(), source);
        }
      });

      // <track> tags for subtitles
      mediaEl.querySelectorAll('track').forEach(track => {
        if (track.src) {
          addUniqueMedia(track.src, 'subtitle', track);
        }
      });
    });

    // 2. Extract from <a> tags (links to media files)
    document.querySelectorAll('a[href]').forEach(link => {
      addUniqueMedia(link.href, null, link);
    });

    // 3. Heuristic: Scan script tags and serialized JSON data
    try {
      const urlRegex = /(?:https?:\/\/|www\.)[^\s"']+\.(?:mp4|webm|m3u8|mpd|mp3|wav|m4a|vtt|srt)(?:\?[\w=&.]+)?/gi;
      
      // Process script tags
      document.querySelectorAll('script').forEach(script => {
        try {
          const content = script.textContent;
          if (!content || script.type === 'application/json' || script.type === 'application/ld+json') return;
          
          const matches = content.match(urlRegex);
          if (matches) {
            matches.forEach(match => addUniqueMedia(match, null, { tagName: 'script' }));
          }
        } catch (scriptErr) {
          // Individual script error shouldn't stop others
        }
      });

      // Process nested JSON objects in script tags
      document.querySelectorAll('script[type*="json"]').forEach(script => {
        try {
          const data = JSON.parse(script.textContent);
          const findUrls = (obj, depth = 0) => {
            if (depth > 10) return; // Prevent stack overflow on deep objects
            if (typeof obj === 'string') {
              if (getMediaType(obj)) addUniqueMedia(obj, null, { tagName: 'json-data' });
            } else if (typeof obj === 'object' && obj !== null) {
              Object.values(obj).forEach(val => findUrls(val, depth + 1));
            }
          };
          findUrls(data);
        } catch (e) {
          // Silently skip invalid JSON
        }
      });
    } catch (heuristicErr) {
      console.error('MediaVue heuristic scan failed:', heuristicErr);
    }

    return results;
  }

  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extract_dom_media') {
      const media = extractMediaFromDOM();
      sendResponse(media);
    }
    // Return true if we were to send an async response, 
    // but here we send it immediately
  });

  // Silent injection for production
})();
