// Chromium normally keeps keyboard focus in the omnibox on a new tab.
// Reload once with a marker so the page receives keyboard focus on the second load.
if (location.search !== '?focus=page') {
  location.replace(location.pathname + '?focus=page');
  throw new Error('Reloading new tab to move keyboard focus to the page.');
}
