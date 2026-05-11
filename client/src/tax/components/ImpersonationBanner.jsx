import { useT } from '../i18n';

// Sticky red banner shown above the shell when impersonation is active.
// Caller passes the impersonation state + exit callback; this component is
// kept presentational so both portal and employee shells can render it
// with their respective contexts without duplicating logic.
export default function ImpersonationBanner({ impersonation, onExit }) {
  const { t } = useT();
  if (!impersonation) return null;

  const targetLabel = impersonation.targetName || impersonation.targetEmail || '—';
  const targetType = impersonation.targetType;
  const expiresAt = impersonation.expiresAt
    ? new Date(impersonation.expiresAt)
    : null;
  const minsLeft = expiresAt
    ? Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 60000))
    : null;

  return (
    <div role="banner" style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: '#b91c1c', color: '#fff',
      padding: '10px 16px',
      borderBottom: '2px solid #7f1d1d',
      display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between',
      fontSize: 14, fontWeight: 500,
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: 4,
          background: 'rgba(255,255,255,.18)', fontSize: 11, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '.6px',
        }}>{t('impersonation.badge')}</span>
        <span>
          {targetType === 'customer'
            ? t('impersonation.viewingCustomer', { name: targetLabel })
            : t('impersonation.viewingEmployee', { name: targetLabel })}
        </span>
        {impersonation.realAdminEmail && (
          <span style={{ opacity: 0.85, fontSize: 12 }}>
            ({t('impersonation.realAdmin')}: {impersonation.realAdminEmail})
          </span>
        )}
        {minsLeft !== null && (
          <span style={{ opacity: 0.85, fontSize: 12 }}>
            {t('impersonation.expiresIn', { mins: minsLeft })}
          </span>
        )}
      </div>
      <button type="button" onClick={onExit} style={{
        background: '#fff', color: '#b91c1c',
        border: 0, padding: '6px 14px', borderRadius: 6,
        fontWeight: 700, fontSize: 13, cursor: 'pointer',
      }}>{t('impersonation.exit')}</button>
    </div>
  );
}
