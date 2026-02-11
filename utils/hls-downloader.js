/**
 * HLS Downloader Utility
 * Fetches and joins MPEG-TS segments into a single file.
 */

export async function downloadHlsStream(url, filename, onProgress, signal) {
  try {
    // 1. Fetch the manifest
    let currentUrl = url;
    let response = await fetch(currentUrl, { signal });
    if (!response.ok) throw new Error('Failed to fetch manifest');
    let text = await response.text();

    // 2. Handle Master Playlist
    if (text.includes('#EXT-X-STREAM-INF')) {
      const lines = text.split('\n');
      let streamPath = null;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].trim() && !lines[j].startsWith('#')) {
              streamPath = lines[j].trim();
              break;
            }
          }
          if (streamPath) break;
        }
      }
      
      if (streamPath) {
        currentUrl = new URL(streamPath, currentUrl).href;
        response = await fetch(currentUrl, { signal });
        if (!response.ok) throw new Error('Failed to fetch media playlist');
        text = await response.text();
      } else {
        throw new Error('No streams found in master playlist');
      }
    }

    // 3. Extract segments
    const lines = text.split('\n');
    const segmentUrls = [];
    for (const line of lines) {
      if (line.trim() && !line.startsWith('#')) {
        try {
          segmentUrls.push(new URL(line.trim(), currentUrl).href);
        } catch (e) {
          console.error('Invalid segment URL:', line);
        }
      }
    }

    if (segmentUrls.length === 0) throw new Error('No segments found in manifest');

    // 3. Download segments
    const segments = [];
    const total = segmentUrls.length;
    
    for (let i = 0; i < segmentUrls.length; i++) {
      if (signal?.aborted) throw new Error('Download aborted');
      if (onProgress) onProgress(i, total);
      
      const segRes = await fetch(segmentUrls[i], { signal });
      if (!segRes.ok) throw new Error(`Failed to fetch segment ${i}`);
      const buffer = await segRes.arrayBuffer();
      segments.push(buffer);
    }

    if (onProgress) onProgress(total, total);

    // 4. Join and download
    const blob = new Blob(segments, { type: 'video/mp2t' });
    const blobUrl = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename.endsWith('.ts') ? filename : filename + '.ts';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    
    return true;
  } catch (error) {
    console.error('HLS Download Error:', error);
    throw error;
  }
}
