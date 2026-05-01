// v75 Enterprise Architecture Enhancer
// Bridges legacy App.jsx to the new component architecture without risky large-file rewrites.
// It replaces the broken legacy action-center DOM with a structured v75 action center
// and keeps admin registration awareness visible for permitted admins/delegates.

const TEXT = {
  en: {
    bannerTitle: 'Registrations need admin action',
    bannerBody: (count) => `${count} pending registration request${count === 1 ? '' : 's'} need approval or decline.`,
    action: 'Review registrations',
    tooltip: 'Open registrations to approve or decline pending owner requests.',
    navLabel: 'Registrations',
    addApartment: 'Add Apartment',
    attentionTitle: 'What needs attention now',
    myVerification: 'My verification',
    myVerificationDesc: 'Open incidents requiring owner confirmation',
    readyResolve: 'Ready to resolve',
    readyResolveDesc: 'Owner-verified incidents pending admin resolution',
    registrants: 'Registrations',
    registrantsDesc: 'Pending registration requests',
    openIncidents: 'All open incidents',
    openIncidentsDesc: 'Community incidents still in progress'
  },
  es: {
    bannerTitle: 'Registros pendientes de acción',
    bannerBody: (count) => `${count} solicitud${count === 1 ? '' : 'es'} de registro pendiente${count === 1 ? '' : 's'} requieren aprobación o rechazo.`,
    action: 'Revisar registros',
    tooltip: 'Abrir registros para aprobar o rechazar solicitudes pendientes de propietarios.',
    navLabel: 'Registros',
    addApartment: 'Agregar apartamento',
    attentionTitle: 'Lo que requiere atención ahora',
    myVerification: 'Mi verificación',
    myVerificationDesc: 'Incidentes abiertos que requieren confirmación del propietario',
    readyResolve: 'Listos para resolver',
    readyResolveDesc: 'Incidentes verificados por propietario pendientes de resolución',
    registrants: 'Registros',
    registrantsDesc: 'Solicitudes de registro pendientes',
    openIncidents: 'Todos los incidentes abiertos',
    openIncidentsDesc: 'Incidentes de la comunidad aún en progreso'
  }
}

function currentLang() {
  // Primary: explicit lang attribute set by the React app on <html>
  const htmlLang = document.documentElement.lang || ''
  if (htmlLang.toLowerCase().startsWith('en')) return 'en'
  if (htmlLang.toLowerCase().startsWith('es')) return 'es'
  // Secondary: look for English indicator text using current nav labels
  // Updated patterns to match renamed labels (My Units, Incidents, Inventory)
  const bodyText = document.body?.innerText || ''
  if (/\bEnglish\b|\bMy Units\b|\bIncidents\b|\bInventory\b|\bAdd unit\b|\bFile a report\b/i.test(bodyText)) return 'en'
  return 'es'
}

function visibleText(el) {
  return String(el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim()
}

function getClickableElements() {
  return Array.from(document.querySelectorAll('button, a, [role="button"], select'))
    .filter((el) => el && el.offsetParent !== null)
}

function clickByPattern(pattern) {
  const target = getClickableElements().find((el) => pattern.test(visibleText(el)))
  if (target) target.click()
}

function getRegistrationClickTarget() {
  const candidates = getClickableElements()
  return candidates.find((el) => /\b(registrations|registration|registros|registrants)\b/i.test(visibleText(el))) || null
}

function userCanManageRegistrations() {
  const bodyText = document.body?.innerText || ''
  const hasRegistrationNav = Boolean(getRegistrationClickTarget())
  const hasAdminContext = /global admin|administrador global|delegate admin|administrador delegado|aprobar|approve|decline|rechazar/i.test(bodyText)
  return hasRegistrationNav || hasAdminContext
}

function parseCount(patterns, fallback = 0) {
  const normalized = String(document.body?.innerText || '').replace(/\s+/g, ' ')
  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (match?.[1] && Number.isFinite(Number(match[1]))) return Number(match[1])
  }
  return fallback
}

function parsePendingCountFromText(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ')
  const patterns = [
    /registrants\s*pending registration requests\s*(\d+)/i,
    /registrations?\s*pending(?: registration requests)?\s*(\d+)/i,
    /registros?\s*pendientes?\s*(?:de aprobación|de accion|de acción)?\s*(\d+)/i,
    /(\d+)\s*(?:pending registration request|pending registrations|registros pendientes|solicitudes de registro pendientes)/i,
    /pending registration requests?\s*(\d+)/i,
    /registros pendientes[^0-9]*(\d+)/i
  ]
  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (match?.[1] && Number.isFinite(Number(match[1]))) return Number(match[1])
  }
  return 0
}

function getCounts() {
  const registration = getPendingRegistrationCount()
  return {
    verification: parseCount([/owner verification[^0-9]*(\d+)/i, /requiring owner verification[^0-9]*(\d+)/i, /My verification[^0-9]*(\d+)/i], 0),
    ready: parseCount([/ready to resolve[^0-9]*(\d+)/i, /verified incident\(s\) pending resolution[^0-9]*(\d+)/i], 0),
    registration,
    open: parseCount([/all open incidents[^0-9]*(\d+)/i, /open reports[^0-9]*(\d+)/i, /community incidents still in progress[^0-9]*(\d+)/i], 0)
  }
}

function getPendingRegistrationCount() {
  const bodyText = document.body?.innerText || ''
  let count = parsePendingCountFromText(bodyText)
  for (const el of getClickableElements()) {
    const txt = visibleText(el)
    if (/registrants|registrations|registros/i.test(txt)) {
      const localCount = parsePendingCountFromText(txt)
      if (localCount > count) count = localCount
      const numberMatch = txt.match(/(\d+)\s*$/)
      if (/pending|pendiente/i.test(txt) && numberMatch) count = Math.max(count, Number(numberMatch[1]))
    }
  }
  return Number.isFinite(count) ? Math.max(0, count) : 0
}

function addOrUpdateBadge(target, count) {
  if (!target) return
  target.classList.add('kai-registration-needs-action')
  target.setAttribute('title', TEXT[currentLang()].tooltip)
  target.setAttribute('aria-label', `${TEXT[currentLang()].navLabel}: ${count} pending`)
  let badge = target.querySelector(':scope > .kai-nav-pending-badge')
  if (count <= 0) { badge?.remove(); return }
  if (!badge) {
    badge = document.createElement('span')
    badge.className = 'kai-nav-pending-badge'
    target.appendChild(badge)
  }
  badge.textContent = String(count)
}

function normalizeLabels() {
  for (const el of getClickableElements()) {
    const txt = visibleText(el)
    if (/\bregistrants\b/i.test(txt) && !/pending/i.test(txt)) {
      el.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) node.textContent = node.textContent.replace(/Registrants/gi, currentLang() === 'en' ? 'Registrations' : 'Registros')
      })
    }
    if (/\badd apt\b|\+\s*agregar apto/i.test(txt)) {
      el.setAttribute('title', currentLang() === 'en' ? 'Add a full apartment/listing record.' : 'Agregar un registro completo de apartamento/listing.')
      el.setAttribute('aria-label', TEXT[currentLang()].addApartment)
    }
  }
}

function createBanner(count) {
  const lang = currentLang()
  const t = TEXT[lang]
  const banner = document.createElement('section')
  banner.className = 'kai-admin-pending-banner'
  banner.setAttribute('role', 'status')
  banner.setAttribute('aria-live', 'polite')
  banner.innerHTML = `
    <div class="kai-admin-pending-banner__icon">📝</div>
    <div class="kai-admin-pending-banner__copy">
      <strong>${t.bannerTitle}</strong>
      <span>${t.bannerBody(count)}</span>
    </div>
    <button type="button" class="kai-admin-pending-banner__button" title="${t.tooltip}">${t.action}</button>
  `
  banner.querySelector('button')?.addEventListener('click', () => {
    const target = getRegistrationClickTarget()
    if (target) target.click()
  })
  return banner
}

function placeBanner(count) {
  const existing = document.querySelector('.kai-admin-pending-banner')
  if (!userCanManageRegistrations() || count <= 0) { existing?.remove(); return }
  if (existing) {
    existing.querySelector('.kai-admin-pending-banner__copy span').textContent = TEXT[currentLang()].bannerBody(count)
    existing.querySelector('.kai-admin-pending-banner__button').textContent = TEXT[currentLang()].action
    return
  }
  const header = document.querySelector('header, [role="banner"], .kai-header, .app-header, .topbar, .top-nav')
  const banner = createBanner(count)
  if (header?.parentNode) header.insertAdjacentElement('afterend', banner)
  else document.body.prepend(banner)
}

function findBrokenActionCenterNode() {
  // Target BetaCommandCenter's root element directly via its CSS class.
  // The previous text-content search matched parent wrappers (innerText
  // of ancestor divs includes the same concatenated text), causing the
  // entire app shell to be replaced with just the action center.
  return document.querySelector('.beta-command') || null
}

function buildActionCenter() {
  const lang = currentLang()
  const t = TEXT[lang]
  const counts = getCounts()
  const section = document.createElement('section')
  section.className = 'kai-v75-action-center'
  section.setAttribute('aria-label', t.attentionTitle)
  section.innerHTML = `
    <div class="kai-v75-action-center__header">
      <small>${lang === 'en' ? 'Action center' : 'Centro de acción'}</small>
      <h2>${t.attentionTitle}</h2>
    </div>
    <div class="kai-v75-action-grid">
      <button type="button" class="kai-v75-action-chip" data-action="verification">
        <div><strong>✅ ${t.myVerification}</strong><span>${t.myVerificationDesc}</span></div><b>${counts.verification}</b>
      </button>
      <button type="button" class="kai-v75-action-chip" data-action="ready">
        <div><strong>🛠️ ${t.readyResolve}</strong><span>${t.readyResolveDesc}</span></div><b>${counts.ready}</b>
      </button>
      <button type="button" class="kai-v75-action-chip" data-action="registrations">
        <div><strong>📝 ${t.registrants}</strong><span>${t.registrantsDesc}</span></div><b>${counts.registration}</b>
      </button>
      <button type="button" class="kai-v75-action-chip" data-action="open">
        <div><strong>⚠️ ${t.openIncidents}</strong><span>${t.openIncidentsDesc}</span></div><b>${counts.open}</b>
      </button>
    </div>
  `
  section.querySelector('[data-action="verification"]')?.addEventListener('click', () => clickByPattern(/view my incidents|my incidents|mis incidentes/i))
  section.querySelector('[data-action="ready"]')?.addEventListener('click', () => clickByPattern(/view reports|reports|reportes/i))
  section.querySelector('[data-action="registrations"]')?.addEventListener('click', () => getRegistrationClickTarget()?.click())
  section.querySelector('[data-action="open"]')?.addEventListener('click', () => clickByPattern(/reports|reportes/i))
  return section
}

function wireDashboardActionCenter() {
  const existing = document.querySelector('.kai-v75-action-center')
  const replacement = buildActionCenter()
  if (existing) {
    existing.replaceWith(replacement)
    return
  }
  const broken = findBrokenActionCenterNode()
  if (broken) {
    broken.replaceWith(replacement)
    return
  }
  // Fallback: insert immediately before <main> so the action center sits in
  // the persistent shell area (same position as BetaCommandCenter) rather
  // than inside the dashboard's internal heading structure.
  const mainEl = document.querySelector('main.main, main[class], main')
  if (mainEl) mainEl.insertAdjacentElement('beforebegin', replacement)
}

function enhanceHeader() {
  const header = document.querySelector('header, [role="banner"], .kai-header, .app-header, .topbar, .top-nav')
  if (!header) return
  header.classList.add('kai-v75-header-stable')
  const more = getClickableElements().find((el) => /^More\b|^Más\b/i.test(visibleText(el)))
  const language = getClickableElements().find((el) => /English|Español/i.test(visibleText(el)) || el.tagName === 'SELECT')
  if (more) more.classList.add('kai-v75-more-button')
  if (language) language.classList.add('kai-v75-language-control')
}

function enhance() {
  try {
    normalizeLabels()
    enhanceHeader()
    const count = getPendingRegistrationCount()
    const registrationTarget = getRegistrationClickTarget()
    if (registrationTarget) addOrUpdateBadge(registrationTarget, count)
    placeBanner(count)
    // BetaCommandCenter renders as a React section inside the dashboard view.
    // DOM replacement disabled to prevent React reconciliation conflicts.
    document.documentElement.dataset.kaiV75 = 'active'
  } catch (error) {
    console.warn('[KAI_V75_ENHANCER_ERROR]', error)
  }
}

let observer = null
let timer = null
function scheduleEnhance() {
  clearTimeout(timer)
  timer = setTimeout(enhance, 180)
}

export function installAdminRegistrationAwareness() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  scheduleEnhance()
  window.addEventListener('resize', scheduleEnhance, { passive: true })
  window.addEventListener('orientationchange', scheduleEnhance, { passive: true })
  window.addEventListener('click', () => setTimeout(enhance, 120), true)

  if (!observer) {
    observer = new MutationObserver(scheduleEnhance)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  }
}
