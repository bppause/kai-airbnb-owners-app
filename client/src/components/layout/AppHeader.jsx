import React from 'react'

const DEFAULT_NAV_ITEMS = [
  { key: 'dashboard', icon: '📊', label: { en: 'Dashboard', es: 'Dashboard' } },
  { key: 'apartments', icon: '🏠', label: { en: 'Apartments', es: 'Apartamentos' } },
  { key: 'reports', icon: '⚠️', label: { en: 'Reports', es: 'Reportes' } },
  { key: 'alerts', icon: '🔔', label: { en: 'Alerts', es: 'Alertas' } },
  { key: 'listings', icon: '🔑', label: { en: 'My listings', es: 'Mis propiedades' } },
  { key: 'registrations', icon: '📝', label: { en: 'Registrations', es: 'Registros' } }
]

function getLabel(item, language) {
  const lang = String(language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en'
  return item?.label?.[lang] || item?.label?.en || item?.key || ''
}

export default function AppHeader({
  language = 'en',
  activeKey = 'dashboard',
  navItems = DEFAULT_NAV_ITEMS,
  counts = {},
  user = null,
  syncLabel = '',
  onNavigate = () => {},
  onLanguageChange = () => {},
  onOpenMore = () => {}
}) {
  const lang = String(language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en'
  const primaryItems = navItems.slice(0, 5)
  const moreItems = navItems.slice(5)

  return (
    <header className="kai-v74-header" role="banner">
      <div className="kai-v74-brand" aria-label="KAI Airbnb Owners">
        <div className="kai-v74-brand__mark">K̃</div>
        <div className="kai-v74-brand__copy">
          <strong>KAI Airbnb Owners</strong>
          <span>Serena del Mar · Cartagena 🇨🇴 BETA</span>
        </div>
      </div>

      <nav className="kai-v74-nav" aria-label={lang === 'es' ? 'Navegación principal' : 'Primary navigation'}>
        {primaryItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`kai-v74-nav__item ${activeKey === item.key ? 'is-active' : ''}`}
            onClick={() => onNavigate(item.key)}
            data-tooltip={`${getLabel(item, language)}${counts[item.key] ? ` · ${counts[item.key]}` : ''}`}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span className="kai-v74-nav__label">{getLabel(item, language)}</span>
            {counts[item.key] > 0 && <span className="kai-v74-badge">{counts[item.key]}</span>}
          </button>
        ))}

        {moreItems.length > 0 && (
          <button type="button" className="kai-v74-nav__item kai-v74-nav__more" onClick={onOpenMore} data-tooltip={lang === 'es' ? 'Más opciones' : 'More options'}>
            <span>More</span>
            <span aria-hidden="true">▾</span>
          </button>
        )}
      </nav>

      <div className="kai-v74-header__tools">
        <select value={language} onChange={(e) => onLanguageChange(e.target.value)} aria-label={lang === 'es' ? 'Idioma' : 'Language'}>
          <option value="en">English 🇺🇸</option>
          <option value="es-CO">Español 🇨🇴</option>
        </select>
        {counts.alerts > 0 && <span className="kai-v74-alert-pill">🔔 {counts.alerts}</span>}
        {syncLabel && <span className="kai-v74-sync">● {syncLabel}</span>}
        {user && <span className="kai-v74-avatar" title={user.name || user.email}>{(user.name || user.email || 'U').slice(0, 1).toUpperCase()}</span>}
      </div>
    </header>
  )
}

export { DEFAULT_NAV_ITEMS }
