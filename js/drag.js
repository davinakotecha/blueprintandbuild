/*
 * drag.js (frontend-builder). Drag a card to the desktop to save its file, in Chromium browsers (Chrome, Edge)
 * through the DownloadURL drag type. Other browsers do not support it: no draggable attribute is set, and the
 * visible Download button stays the way to get the file.
 */
function canDragDownload() {
  const brands = navigator.userAgentData && navigator.userAgentData.brands;
  return Array.isArray(brands) && brands.some((entry) => entry.brand === 'Chromium');
}

export function enableDragDownload(node, href) {
  if (!canDragDownload()) return;
  const url = new URL(href, window.location.href);
  const name = decodeURIComponent(url.pathname.split('/').pop() || 'download');
  const mime = name.endsWith('.zip') ? 'application/zip' : 'application/octet-stream';
  node.draggable = true;
  node.addEventListener('dragstart', (event) => {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData('DownloadURL', `${mime}:${name}:${url.href}`);
    event.dataTransfer.effectAllowed = 'copy';
  });
}
