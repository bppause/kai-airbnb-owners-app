// v74 UI Adapter
// This bridges the legacy App.jsx to new components without breaking runtime.

export function extractCountsFromDOM() {
  const text = document.body?.innerText || ''
  const get = (label) => {
    const match = text.match(new RegExp(label + '.*?(\\d+)', 'i'))
    return match ? Number(match[1]) : 0
  }
  return {
    reports: get('reports'),
    alerts: get('alerts'),
    listings: get('listing'),
    registrations: get('registration'),
  }
}

export function attachHeaderBridge() {
  // placeholder for future replacement
  document.documentElement.dataset.kaiV74Header = 'ready'
}

export function attachDashboardBridge() {
  document.documentElement.dataset.kaiV74Dashboard = 'ready'
}
