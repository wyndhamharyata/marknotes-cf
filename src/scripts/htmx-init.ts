import htmx from 'htmx.org';

// Configure htmx defaults
htmx.config.historyCacheSize = 10;
htmx.config.refreshOnHistoryMiss = true;

// Handle full-page responses from prerendered pages
// Extract just the #main-content innerHTML when we receive a full HTML page
document.addEventListener('htmx:beforeSwap', (evt: Event) => {
  const detail = (evt as CustomEvent).detail;
  const response = detail.serverResponse as string;

  // Check if response is a full HTML page (has doctype or html tag)
  if (response && (response.includes('<!doctype html>') || response.includes('<!DOCTYPE html>') || response.includes('<html'))) {
    // Parse the response and extract just the main content
    const parser = new DOMParser();
    const doc = parser.parseFromString(response, 'text/html');
    const mainContent = doc.querySelector('#main-content');

    if (mainContent) {
      // Replace the response with just the inner content
      detail.serverResponse = mainContent.innerHTML;

      // Update the document title
      const title = doc.querySelector('title');
      if (title) {
        document.title = title.textContent || '';
      }
    }
  }
});

// Update active navigation link styling after page swaps
document.addEventListener('htmx:afterSettle', () => {
  const currentPath = window.location.pathname;

  document.querySelectorAll('[data-nav-link]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const isActive = href === currentPath ||
      (href !== '/' && currentPath.startsWith(href));

    if (isActive) {
      link.classList.add('btn', 'btn-accent');
    } else {
      link.classList.remove('btn', 'btn-accent');
    }
  });
});

// Make htmx available globally for debugging
declare global {
  interface Window {
    htmx: typeof htmx;
  }
}
window.htmx = htmx;
