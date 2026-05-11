import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { useEmployeeAuth } from '../auth/EmployeeAuthProvider';
import { taxApi } from '../api';

// Inbox-only setup banner. Auto-hides when all required steps are done
// or when the owner clicks Dismiss (per-community localStorage flag, so
// dismissing in one community doesn't hide it in another). Admin-only.
const DISMISS_KEY = (slug) => `tax_setup_dismissed_${slug}`;

export default function SetupBanner() {
  const { t } = useT();
  const { fbUser, employee, community } = useEmployeeAuth();
  const [data, setData] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!fbUser || !community || employee?.role !== 'admin') return;
    try { setDismissed(localStorage.getItem(DISMISS_KEY(community.id)) === '1'); }
    catch (_e) { /* localStorage may be unavailable */ }
    taxApi.adminGetSetupStatus(
      { uid: fbUser.uid, email: fbUser.email, communitySlug: community.id },
      community.id,
    ).then(d => setData(d)).catch(() => {});
  }, [fbUser, community, employee]);

  if (employee?.role !== 'admin' || !data) return null;
  if (dismissed) return null;

  const steps = data.steps || [];
  const totalDone = steps.filter(s => s.done).length;
  const requiredDone = steps.filter(s => !s.optional).every(s => s.done);
  if (requiredDone) return null;

  const onDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY(community.id), '1'); } catch (_e) {}
    setDismissed(true);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      background: 'color-mix(in srgb, var(--tax-brand-primary) 8%, #fff)',
      border: '1px solid color-mix(in srgb, var(--tax-brand-primary) 30%, #fff)',
      padding: '12px 16px', borderRadius: 10, marginBottom: 16, flexWrap: 'wrap',
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, color: 'var(--tax-brand-primary)' }}>
          {t('owner.setup.bannerTitle')}
        </div>
        <div style={{ fontSize: 13, color: 'var(--tax-text)', marginTop: 2 }}>
          {t('owner.setup.bannerProgress', { done: totalDone, total: steps.length })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <a href={`/tax/${community.id}/employee/setup`}
           className="tax-btn tax-btn--sm"
           style={{ background: 'var(--tax-brand-primary)', color: '#fff' }}>
          {t('owner.setup.bannerOpen')}
        </a>
        <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm" onClick={onDismiss}
                style={{ color: 'var(--tax-muted)' }}>
          {t('owner.setup.bannerDismiss')}
        </button>
      </div>
    </div>
  );
}
