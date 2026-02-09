/**
 * MediaVue Popup Script
 * Responsibilities:
 * - Trigger media scan through background script
 * - Display and categorize results
 * - Provide copy and open actions
 */

document.addEventListener('DOMContentLoaded', async () => {
  const scanBtn = document.getElementById('scanBtn');
  const copyAllBtn = document.getElementById('copyAllBtn');
  const downloadAllBtn = document.getElementById('downloadAllBtn');
  const openSidepanelBtn = document.getElementById('openSidepanelBtn');
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
   * Download all visible items
   */
  downloadAllBtn.addEventListener('click', () => {
    const filtered = getFilteredResults();
    if (filtered.length === 0) return;

    if (!confirm(`This will download ${filtered.length} files. Continue?`)) return;

    filtered.forEach((item, index) => {
      // Small delay between downloads to prevent browser issues
      setTimeout(() => {
        chrome.downloads.download({
          url: item.url,
          conflictAction: 'uniquify'
        });
      }, index * 200);
    });

    const originalText = downloadAllBtn.textContent;
    downloadAllBtn.textContent = 'Started!';
    setTimeout(() => downloadAllBtn.textContent = originalText, 2000);
  });

  /**
   * Open Side Panel
   */
  openSidepanelBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.sidePanel.open({ tabId: tab.id });
      window.close(); // Close popup after opening side panel
    }
  });

  /**
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
   * Main scan trigger
   */
  scanBtn.addEventListener('click', async () => {
    // UI Feedback for loading
    scanBtn.disabled = true;
    copyAllBtn.style.display = 'none';
    downloadAllBtn.style.display = 'none';
    const originalBtnText = scanBtn.textContent;
    scanBtn.textContent = 'Scanning...';
    status.textContent = 'Analyzing page content and network cache...';
    
    resultsList.innerHTML = `
      <div class="empty-state">
        <div class="loading-spinner"></div>
        <p>Searching for media...</p>
      </div>
    `;

    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        throw new Error('Unable to find active tab');
      }

      // Request scan from background service worker
      chrome.runtime.sendMessage({ action: 'scan_page', tabId: tab.id }, (response) => {
        scanBtn.disabled = false;
        scanBtn.textContent = originalBtnText;

        if (chrome.runtime.lastError) {
          showError(`Connection error: ${chrome.runtime.lastError.message}`);
          return;
        }

        if (response && response.error) {
          showError(response.error);
          return;
        }

        const results = response ? (response.results || []) : [];
        currentResults = results;
        
        if (results.length > 0) {
          copyAllBtn.style.display = 'block';
          downloadAllBtn.style.display = 'block';
        } else {
          copyAllBtn.style.display = 'none';
          downloadAllBtn.style.display = 'none';
        }

        renderResults(getFilteredResults());
      });
    } catch (err) {
      console.error('Scan error:', err);
      scanBtn.disabled = false;
      copyAllBtn.style.display = 'none';
      downloadAllBtn.style.display = 'none';
      scanBtn.textContent = originalBtnText;
      showError(err.message || 'An unexpected error occurred.');
    }
  });

  /**
   * Render the list of discovered media items
   */
  function renderResults(results) {
    resultsList.innerHTML = '';
    
    if (results.length === 0) {
      status.textContent = 'No media found.';
      resultsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <p>No media detected on this page.<br><small>Try playing the video/audio if it's streaming.</small></p>
        </div>
      `;
      return;
    }

    // Sort results: type first, then source
    const sorted = [...results].sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.source.localeCompare(b.source);
    });

    status.textContent = `Found ${sorted.length} item${sorted.length === 1 ? '' : 's'}`;

    sorted.forEach(item => {
      const clone = template.content.cloneNode(true);
      
      // Setup Badge
      const badge = clone.querySelector('.media-type-badge');
      badge.textContent = item.type;
      badge.classList.add(`badge-${item.type}`);

      // Setup URL
      const urlSpan = clone.querySelector('.media-url');
      urlSpan.textContent = truncateUrl(item.url);
      urlSpan.title = item.url;

      // Setup Metadata
      const metaSpan = clone.querySelector('.media-meta');
      const ext = getFileExtension(item.url);
      const sourceInfo = item.source === 'dom' ? `DOM (${item.tagName})` : 'Network';
      const sizeInfo = item.size ? ` • ${formatSize(item.size)}` : '';
      metaSpan.textContent = `${ext} • ${sourceInfo}${sizeInfo}`;

      // Action: Copy
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

      // Action: Open
      clone.querySelector('.open-btn').addEventListener('click', () => {
        chrome.tabs.create({ url: item.url });
      });

      resultsList.appendChild(clone);
    });
  }

  function showError(msg) {
    status.textContent = 'Error occurred.';
    resultsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon" style="color: #ef4444">⚠️</div>
        <p>${msg}</p>
      </div>
    `;
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
