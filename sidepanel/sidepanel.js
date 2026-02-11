/**
 * MediaVue Side Panel Script
 * Mirrors popup logic but optimized for sidebar persistence.
 */

import { downloadHlsStream } from '../utils/hls-downloader.js';
import { isProtectedUrl } from '../utils/media-detector.js';

// Persistent tracking of active HLS downloads
const activeDownloads = new Map();

document.addEventListener('DOMContentLoaded', async () => {
  const copyAllBtn = document.getElementById('copyAllBtn');
  const searchInput = document.getElementById('searchInput');
  const filterTabs = document.querySelectorAll('.filter-tab');
  const resultsList = document.getElementById('resultsList');
  const status = document.getElementById('status');
  const template = document.getElementById('mediaItemTemplate');

  let currentResults = [];
  let activeFilter = 'all';
  let searchTerm = '';

  /**
   * Copy all found URLs to clipboard
   */
  copyAllBtn.addEventListener('click', () => {
    const filtered = getFilteredResults();
    if (filtered.length === 0) return;
    
    const allUrls = filtered.map(item => item.url).join('\n');
    navigator.clipboard.writeText(allUrls).then(() => {
      const originalText = copyAllBtn.textContent;
      copyAllBtn.textContent = 'Copied!';
      copyAllBtn.style.color = 'var(--accent)';
      
      setTimeout(() => {
        copyAllBtn.textContent = originalText;
        copyAllBtn.style.color = '';
      }, 2000);
    });
  });

  /**
   * Live Search
   * Live Search
   */
  searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value.toLowerCase();
    renderResults(getFilteredResults());
  });

  /**
   * Type Filters
   */
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeFilter = tab.dataset.type;
      renderResults(getFilteredResults());
    });
  });

  function getFilteredResults() {
    return currentResults.filter(item => {
      const matchesType = activeFilter === 'all' || item.type === activeFilter;
      const matchesSearch = !searchTerm || 
        item.url.toLowerCase().includes(searchTerm) || 
        (item.tagName && item.tagName.toLowerCase().includes(searchTerm));
      return matchesType && matchesSearch;
    });
  }

  /**
   * Main scan logic (Auto-triggered)
   */
  async function performScan() {
    copyAllBtn.style.display = 'none';
    status.textContent = 'Syncing media...';
    
    // Show spinner only on initial/full scan
    if (resultsList.children.length === 0 || resultsList.querySelector('.empty-state')) {
      resultsList.innerHTML = `
        <div class="empty-state">
          <div class="loading-spinner"></div>
          <p>Searching for media...</p>
        </div>
      `;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      if (isProtectedUrl(tab.url)) {
        showProtectedPageMessage();
        return;
      }

      chrome.runtime.sendMessage({ action: 'scan_page', tabId: tab.id }, (response) => {
        if (chrome.runtime.lastError) {
          showError(`Sync error: ${chrome.runtime.lastError.message}`);
          return;
        }

        if (response && response.error) {
          showError(response.error);
          return;
        }

        const results = response ? (response.results || []) : [];
        currentResults = results;
        
        // Store tab info for better filenames
        window.activeTabTitle = tab.title;
        
        if (results.length > 0) {
          copyAllBtn.style.display = 'block';
        } else {
          copyAllBtn.style.display = 'none';
        }

        renderResults(getFilteredResults());
      });
    } catch (err) {
      console.error('Auto-scan error:', err);
      showError('Unable to sync with page.');
    }
  }

  // 1. Initial Scan on Load
  performScan();

  // 2. Re-scan when switching tabs or navigating
  chrome.tabs.onActivated.addListener(performScan);
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
      performScan();
    }
  });

  // 3. Listen for live discoveries from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'new_media_detected') {
      // Re-scan to get the full enriched object with size
      performScan();
    }
  });

  function renderResults(results) {
    resultsList.innerHTML = '';
    
    if (results.length === 0) {
      status.textContent = 'No media found.';
      resultsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <p>No media detected on this page.</p>
        </div>
      `;
      return;
    }

    const sorted = [...results].sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.source.localeCompare(b.source);
    });

    status.textContent = `Found ${sorted.length} item${sorted.length === 1 ? '' : 's'}`;

    sorted.forEach(item => {
      const clone = template.content.cloneNode(true);
      
      const badge = clone.querySelector('.media-type-badge');
      let typeLabel = item.type;
      
      // Enhance label for HLS
      if (item.type === 'streaming' && item.hlsType) {
        typeLabel = `HLS (${item.hlsType.toUpperCase()})`;
      }
      
      badge.textContent = typeLabel;
      badge.classList.add(`badge-${item.type}`);

      const urlSpan = clone.querySelector('.media-url');
      urlSpan.textContent = truncateUrl(item.url);
      urlSpan.title = item.url;

      const metaSpan = clone.querySelector('.media-meta');
      const ext = getFileExtension(item.url);
      const sourceInfo = item.source === 'dom' ? `DOM (${item.tagName})` : 'Network';
      const sizeInfo = item.size ? ` • ${formatSize(item.size)}` : '';
      const durationInfo = item.duration ? ` • ${formatDuration(item.duration)}` : '';
      
      // Add info about suggested master playlist if applicable
      let suggestionInfo = '';
      if (item.suggestedMaster) {
        suggestionInfo = ` • Likely Master found`;
      }
      
      metaSpan.textContent = `${ext} • ${sourceInfo}${sizeInfo}${durationInfo}${suggestionInfo}`;
      if (item.suggestedMaster) {
        metaSpan.title = `Common master playlist patterns detected in this directory. Likely: ${item.suggestedMaster}`;
        metaSpan.style.cursor = 'help';
        metaSpan.style.textDecoration = 'underline dotted';
      }

      const copyBtn = clone.querySelector('.copy-btn');
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(item.url).then(() => {
          const originalContent = copyBtn.innerHTML;
          copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';
          copyBtn.style.color = 'var(--accent)';
          copyBtn.style.borderColor = 'var(--accent)';
          setTimeout(() => {
            copyBtn.innerHTML = originalContent;
            copyBtn.style.color = '';
            copyBtn.style.borderColor = '';
          }, 1500);
        });
      });

      clone.querySelector('.open-btn').addEventListener('click', () => {
        chrome.tabs.create({ url: item.url });
      });

      const downloadBtn = clone.querySelector('.download-btn');
      const cancelBtn = clone.querySelector('.cancel-btn');
      const progressBar = clone.querySelector('.progress-bar');
      const mediaItem = clone.querySelector('.media-item');
      
      // Restore state if currently downloading
      if (activeDownloads.has(item.url)) {
        const state = activeDownloads.get(item.url);
        mediaItem.classList.add('downloading');
        progressBar.style.width = `${state.percent || 0}%`;
        // Update state with new DOM elements
        state.progressBar = progressBar;
        state.mediaItem = mediaItem;
      }

      // Special Handling for HLS
      if (item.type === 'streaming' && item.url.includes('.m3u8')) {
        const isLong = item.duration && item.duration >= 7200; // 2 hours
        
        if (isLong) {
          downloadBtn.title = 'Copy FFmpeg Command (Video is > 2h)';
          downloadBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-9 12H9.5v-2h-2v2H6V9h1.5v2.5h2V9H11v7zm7-1c0 .55-.45 1-1 1h-4V9h1c.55 0 1 .45 1 1v1c0 .55-.45 1-1 1h-1v2h3v-1h-1V12h2c.55 0 1 .45 1 1v2z"/></svg>';
        }

        downloadBtn.addEventListener('click', async () => {
          if (isLong) {
            // Copy FFmpeg Command
            const filename = getSuggestedFilename(item.url).replace(/\.[^/.]+$/, "");
            const command = `ffmpeg -i "${item.url}" -c copy "${filename}.mp4"`;
            await navigator.clipboard.writeText(command);
            showSuccess(downloadBtn);
          } else {
            // In-browser Joiner
            const filename = getSuggestedFilename(item.url).replace(/\.[^/.]+$/, "");
            const controller = new AbortController();
            activeDownloads.set(item.url, { 
              controller, 
              percent: 0, 
              progressBar, 
              mediaItem 
            });

            try {
              mediaItem.classList.add('downloading');
              progressBar.style.width = '0%';
              
              await downloadHlsStream(item.url, filename, (current, total) => {
                const percent = Math.round((current / total) * 100);
                const state = activeDownloads.get(item.url);
                if (state) {
                  state.percent = percent;
                  if (state.progressBar) {
                    state.progressBar.style.width = `${percent}%`;
                  }
                }
              }, controller.signal);
              
              showSuccess(downloadBtn);
            } catch (err) {
              if (err.message === 'Download aborted') {
                console.log('Download cancelled by user');
              } else {
                console.error('HLS Download Failed:', err);
              }
            } finally {
              const state = activeDownloads.get(item.url);
              if (state) {
                if (state.mediaItem) state.mediaItem.classList.remove('downloading');
                if (state.progressBar) state.progressBar.style.width = '0%';
              }
              // Also clean up current scope references just in case
              mediaItem.classList.remove('downloading');
              progressBar.style.width = '0%';
              activeDownloads.delete(item.url);
            }
          }
        });

        cancelBtn.addEventListener('click', () => {
          const state = activeDownloads.get(item.url);
          if (state && state.controller) {
            state.controller.abort();
          }
        });

      } else {
        // Regular Download
        downloadBtn.addEventListener('click', () => {
          const filename = getSuggestedFilename(item.url);
          chrome.downloads.download({
            url: item.url,
            filename: filename,
            conflictAction: 'uniquify'
          }, (downloadId) => {
            if (chrome.runtime.lastError) {
              console.error('Download error:', chrome.runtime.lastError);
              return;
            }
            showSuccess(downloadBtn);
          });
        });
      }

      resultsList.appendChild(clone);
    });
  }

  function showSuccess(btn) {
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';
    btn.style.color = 'var(--accent)';
    btn.style.borderColor = 'var(--accent)';
    setTimeout(() => {
      btn.innerHTML = originalContent;
      btn.style.color = '';
      btn.style.borderColor = '';
    }, 1500);
  }

  function getSuggestedFilename(url) {
    try {
      const u = new URL(url);
      let filename = u.pathname.split('/').pop() || '';
      
      // Remove extensions and generic names
      const cleanName = filename.replace(/\.(m3u8|ts|mp4|m4s|mp3)$/i, '');
      const isGeneric = !cleanName || ['master', 'index', 'playlist', 'stream', 'chunk'].includes(cleanName.toLowerCase());

      if (isGeneric && window.activeTabTitle) {
        // Use page title if filename is generic
        return window.activeTabTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
      }

      if (!filename || filename.length < 3) {
        filename = u.hostname.replace(/\./g, '_') + '.file';
      }
      // Remove query params
      filename = filename.split('?')[0].split('#')[0];
      return filename;
    } catch(e) {
      return 'media_file';
    }
  }

  function formatDuration(seconds) {
    if (!seconds) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function showError(msg) {
    status.textContent = 'Error occurred.';
    resultsList.innerHTML = `<div class="empty-state"><p>${msg}</p></div>`;
  }

  function showProtectedPageMessage() {
    status.textContent = 'Protected page.';
    resultsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔒</div>
        <p>This is a protected browser page.<br>
        <small>MediaVue cannot scan internal pages like <code>chrome://</code> for security reasons.</small></p>
      </div>
    `;
    copyAllBtn.style.display = 'none';
  }

  function truncateUrl(url) {
    try {
      const u = new URL(url);
      const filename = u.pathname.split('/').pop();
      if (filename && filename.length > 5) return filename;
      return u.hostname + u.pathname;
    } catch(e) {
      return url.length > 50 ? url.substring(0, 47) + '...' : url;
    }
  }

  function getFileExtension(url) {
    try {
      const path = new URL(url).pathname;
      const ext = path.split('.').pop().toUpperCase();
      if (ext && ext.length < 5) return ext;
      return 'FILE';
    } catch(e) {
      return 'URL';
    }
  }

  function formatSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
});
