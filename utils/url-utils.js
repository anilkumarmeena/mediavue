export function normalizeUrl(url, base) {
  try {
    return new URL(url, base).href;
  } catch (e) {
    return url;
  }
}

export function deduplicateMedia(medialist) {
  const seen = new Set();
  return medialist.filter(item => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

export function cleanUrl(url) {
  try {
    const u = new URL(url);
    // Remove common cache-busting params if needed, 
    // but the plan says "Preserve full URLs including query parameters (important for signed URLs)"
    return u.href;
  } catch (e) {
    return url;
  }
}
