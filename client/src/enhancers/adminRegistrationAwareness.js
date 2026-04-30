// v72 Enterprise Architecture Enhancer
// Non-invasive DOM bridge used while the legacy App.jsx is gradually split into components.
// Purpose: make pending registrations obvious to users who can act on them and
// keep common labels/tooltips consistent across responsive layouts.

const TEXT = {
  en: {
    bannerTitle: 'Registrations need admin action',
    bannerBody: (count) => `${count} pending registration request${count === 1 ? '' : 's'} need approval or decline.`,
    action: 'Review registrations',
    tooltip: 'Open registrations to approve or decline pending owner requests.',
    navLabel: 'Registrations',
    addApartment: 'Add Apartment'
  },
  es: {
    bannerTitle: 'Registros pendientes de acción',
    bannerBody: (count) => `${count} solicitud${count === 1 ? '' : 'es'} de registro pendiente${count === 1 ? '' : 's'} requieren aprobación o rechazo.`,
    action: 'Revisar registros',
    tooltip: 'Abrir registros para aprobar o rechazar solicitudes pendientes de propietarios.',
    navLabel: 'Registros',
    addApartment: 'Agregar apartamento'
  }
}

function currentLang() {
  const htmlLang = document.documentElement.lang || ''
  const bodyText = document.body?.innerText || ''
  if (/English|My listings|Reports/i.test(bodyText) || htmlLang.toLowerCase().startsWith('en')) return 'en'
  return 'es'
}

function visibleText(el) {
  return String(el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim()
}

function getClickableElements() {
  return Array.from(document.querySelectorAll('button, a, [role="button"], select'))
    .filter((el) => el && el.offsetParent !== null)
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

function getPendingRegistrationCount() {
  const bodyText = document.body?.innerText || ''
  let count = parsePendingCountFromText(bodyText)

  // Prefer more local button/card labels when available.
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
  if (!target || count <= 0) return
  target.classList.add('kai-registration-needs-action')
  target.setAttribute('data-tooltip', TEXT[currentLang()].tooltip)
  target.setAttribute('aria-label', `${TEXT[currentLang()].navLabel}: ${count} pending`)

  let badge = target.querySelector(':scope > .kai-nav-pending-badge')
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
      el.setAttribute('data-tooltip', currentLang() === 'en' ? 'Add a full apartment/listing record.' : 'Agregar un registro completo de apartamento/listing.')
      el.setAttribute('aria-label', TEXT[currentLang()].addApartment)
    }
    if (/\bapt\b/i.test(txt) && /add|agregar|\+/i.test(txt)) {
      el.classList.add('kai-add-apartment-action')
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
    <button type="button" class="kai-admin-pending-banner__button" data-tooltip="${t.tooltip}">${t.action}</button>
  `
  banner.querySelector('button')?.addEventListener('click', () => {
    const target = getRegistrationClickTarget()
    if (target) target.click()
  })
  return banner
}

function placeBanner(count) {
  const existing = document.querySelector('.kai-admin-pending-banner')
  if (!userCanManageRegistrations() || count <= 0) {
    existing?.remove()
    return
  }
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

function enhance() {
  try {
    normalizeLabels()
    const count = getPendingRegistrationCount()
    const registrationTarget = getRegistrationClickTarget()
    if (registrationTarget) addOrUpdateBadge(registrationTarget, count)
    placeBanner(count)
    document.documentElement.dataset.kaiV72 = 'active'
  } catch (error) {
    console.warn('[KAI_V72_ENHANCER_ERROR]', error)
  }
}

let observer = null
let timer = null
function scheduleEnhance() {
  clearTimeout(timer)
  timer = setTimeout(enhance, 150)
}

export function installAdminRegistrationAwareness() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  scheduleEnhance()
  window.addEventListener('resize', scheduleEnhance, { passive: true })
  window.addEventListener('orientationchange', scheduleEnhance, { passive: true })
  window.addEventListener('click', () => setTimeout(enhance, 100), true)

  if (!observer) {
    observer = new MutationObserver(scheduleEnhance)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  }
}
