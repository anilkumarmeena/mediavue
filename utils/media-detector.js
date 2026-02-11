export const MEDIA_PATTERNS = {
  VIDEO: /\.(mp4|webm|ogv|mov|avi|mkv|flv|m4v)($|\?)/i,
  AUDIO: /\.(mp3|wav|m4a|aac|ogg|opus|flac|wma)($|\?)/i,
  STREAMING: /\.(m3u8|mpd)($|\?)/i,
  SUBTITLES: /\.(vtt|srt|ass|ssa)($|\?)/i
};

export function getHlsType(content) {
  if (content.includes('#EXT-X-STREAM-INF')) return 'master';
  if (content.includes('#EXT-X-TARGETDURATION')) return 'media';
  return null;
}

export function getMediaType(url) {
  if (MEDIA_PATTERNS.VIDEO.test(url)) return 'video';
  if (MEDIA_PATTERNS.AUDIO.test(url)) return 'audio';
  if (MEDIA_PATTERNS.STREAMING.test(url)) return 'streaming';
  if (MEDIA_PATTERNS.SUBTITLES.test(url)) return 'subtitle';
  return 'unknown';
}

export function isMediaUrl(url) {
  return getMediaType(url) !== 'unknown';
}

/**
 * Checks if a URL is a protected browser page (chrome://, about:, etc.)
 * where content scripts cannot be injected.
 */
export function isProtectedUrl(url) {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('view-source:')
  );
}
