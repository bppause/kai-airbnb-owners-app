import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { useEmployeeAuth } from '../auth/EmployeeAuthProvider';
import { taxApi } from '../api';
import EmployeeShell from '../components/EmployeeShell';

function relTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffMin < 60 * 24) return `${Math.round(diffMin / 60)}h`;
    return d.toLocaleDateString();
  } catch (_e) { return ''; }
}

export default function EmployeeInbox() {
  const { t } = useT();
  const { fbUser, community } = useEmployeeAuth();
  const auth = { uid: fbUser?.uid, email: fbUser?.email, communitySlug: community?.id };

  const [threads, setThreads] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!fbUser || !community) return;
    taxApi.getEmployeeThreads(auth)
      .then(d => setThreads(d.threads || []))
      .catch(e => setErr(e?.message || t('error.loadFailed')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbUser, community]);

  const base = community ? `/tax/${community.id}/employee` : '#';
  const shown = !threads ? null
    : (filter === 'unread' ? threads.filter(th => th.practice_unread) : threads);
  const unreadCount = (threads || []).filter(th => th.practice_unread).length;

  return (
    <EmployeeShell community={community} active="inbox">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>{t('employee.inbox.title')}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button"
                  className={`tax-btn tax-btn--sm ${filter === 'all' ? 'tax-btn--primary' : 'tax-btn--ghost'}`}
                  onClick={() => setFilter('all')}
                  style={filter !== 'all' ? { color: 'var(--tax-text)', borderColor: 'var(--tax-border)' } : undefined}>
            {t('employee.inbox.filterAll')}
          </button>
          <button type="button"
                  className={`tax-btn tax-btn--sm ${filter === 'unread' ? 'tax-btn--primary' : 'tax-btn--ghost'}`}
                  onClick={() => setFilter('unread')}
                  style={filter !== 'unread' ? { color: 'var(--tax-text)', borderColor: 'var(--tax-border)' } : undefined}>
            {t('employee.inbox.filterUnread', { count: unreadCount })}
          </button>
        </div>
      </div>
      <p className="tax-section__lede">{t('employee.inbox.subtitle')}</p>

      {err && <div className="tax-msg tax-msg--error">{err}</div>}

      {shown === null ? <p>{t('loading')}</p>
        : shown.length === 0
          ? <p style={{ color: 'var(--tax-muted)' }}>
              {filter === 'unread' ? t('employee.inbox.emptyUnread') : t('employee.inbox.empty')}
            </p>
          : <div style={{ display: 'grid', gap: 8 }}>
              {shown.map(th => (
                <a key={th.id} href={`${base}/threads/${encodeURIComponent(th.id)}`}
                   className="tax-contact-item"
                   style={{
                     textDecoration: 'none', color: 'inherit',
                     borderLeft: th.practice_unread ? '3px solid var(--tax-brand-secondary)' : '3px solid transparent',
                   }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                        <div style={{ fontWeight: th.practice_unread ? 700 : 600,
                                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {th.subject || t('employee.inbox.untitled')}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--tax-muted)', flexShrink: 0 }}>
                          {th.customer?.name || th.customer?.email || ''}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--tax-muted)', marginTop: 4,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {th.last_message_by_role === 'customer'
                          ? <strong style={{ color: 'var(--tax-text)' }}>{t('employee.inbox.fromCustomer')}</strong>
                          : <span>{t('employee.inbox.fromPractice')}</span>}
                        {' — '}{th.last_message_preview || ''}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, fontSize: 12, color: 'var(--tax-muted)' }}>
                      {relTime(th.last_message_at || th.created_at)}
                    </div>
                  </div>
                </a>
              ))}
            </div>
      }
    </EmployeeShell>
  );
}
