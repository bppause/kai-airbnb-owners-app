import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { useTaxAuth } from '../auth/AuthProvider';
import { taxApi } from '../api';
import PortalShell from '../components/PortalShell';

// Portal messaging: thread list, thread detail with chronological messages,
// and an inline "start a new conversation" form. The threadId prop is set
// by TaxApp routing for /portal/messages/:threadId; absent → list mode.
export default function PortalMessages({ threadId }) {
  if (threadId === 'new') return <NewThread />;
  if (threadId) return <ThreadView id={threadId} />;
  return <ThreadList />;
}

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

// ── List view ─────────────────────────────────────────────────────────────
function ThreadList() {
  const { t } = useT();
  const { fbUser, community } = useTaxAuth();
  const auth = { uid: fbUser?.uid, email: fbUser?.email, communitySlug: community?.id };

  const [threads, setThreads] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!fbUser || !community) return;
    taxApi.getThreads(auth)
      .then(d => setThreads(d.threads || []))
      .catch(e => setErr(e?.message || t('error.loadFailed')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbUser, community]);

  const portalBase = community ? `/tax/${community.id}/portal/messages` : '#';

  return (
    <PortalShell community={community} active="messages">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>{t('portal.messages.title')}</h2>
        <a href={`${portalBase}/new`} className="tax-btn tax-btn--primary tax-btn--sm">
          {t('portal.messages.newBtn')}
        </a>
      </div>
      <p className="tax-section__lede">{t('portal.messages.subtitle')}</p>

      {err && <div className="tax-msg tax-msg--error">{err}</div>}

      {threads === null ? <p>{t('loading')}</p>
        : threads.length === 0
          ? <div className="tax-contact-item">
              <p style={{ margin: 0, color: 'var(--tax-muted)' }}>{t('portal.messages.empty')}</p>
              <a href={`${portalBase}/new`} className="tax-btn tax-btn--primary"
                 style={{ marginTop: 12 }}>{t('portal.messages.newBtn')}</a>
            </div>
          : <div style={{ display: 'grid', gap: 8 }}>
              {threads.map(thr => (
                <a key={thr.id} href={`${portalBase}/${encodeURIComponent(thr.id)}`}
                   className="tax-contact-item"
                   style={{
                     textDecoration: 'none', color: 'inherit',
                     borderLeft: thr.customer_unread ? '3px solid var(--tax-brand-secondary)' : '3px solid transparent',
                   }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: thr.customer_unread ? 700 : 600,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {thr.subject || t('portal.messages.untitled')}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--tax-muted)', marginTop: 4,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {thr.last_message_by_role === 'practice'
                          ? <strong style={{ color: 'var(--tax-text)' }}>{t('portal.messages.fromPractice')}</strong>
                          : <span>{t('portal.messages.fromYou')}</span>}
                        {' — '}{thr.last_message_preview || ''}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, fontSize: 12, color: 'var(--tax-muted)' }}>
                      {relTime(thr.last_message_at || thr.created_at)}
                    </div>
                  </div>
                </a>
              ))}
            </div>
      }
    </PortalShell>
  );
}

// ── New-thread form ───────────────────────────────────────────────────────
function NewThread() {
  const { t } = useT();
  const { fbUser, community } = useTaxAuth();
  const auth = { uid: fbUser?.uid, email: fbUser?.email, communitySlug: community?.id };
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const portalBase = community ? `/tax/${community.id}/portal/messages` : '#';

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!body.trim()) { setErr(t('portal.messages.errBody')); return; }
    setBusy(true); setErr('');
    try {
      const r = await taxApi.createThread(auth, { subject: subject.trim(), body: body.trim() });
      window.location.href = `${portalBase}/${encodeURIComponent(r.threadId)}`;
    } catch (e) {
      setErr(e?.message || t('respond.error.generic'));
      setBusy(false);
    }
  };

  return (
    <PortalShell community={community} active="messages">
      <a href={portalBase} style={{ fontSize: 14, color: 'var(--tax-muted)' }}>
        ← {t('portal.messages.backToList')}
      </a>
      <h2 style={{ marginTop: 8 }}>{t('portal.messages.newTitle')}</h2>
      <p className="tax-section__lede">{t('portal.messages.newSubtitle')}</p>

      <form className="tax-form" onSubmit={onSubmit} noValidate>
        <div>
          <label htmlFor="m-subject">{t('portal.messages.fieldSubject')}</label>
          <input id="m-subject" type="text" value={subject}
                 onChange={e => setSubject(e.target.value)}
                 placeholder={t('portal.messages.subjectPlaceholder')} maxLength={240} />
        </div>
        <div>
          <label htmlFor="m-body">{t('portal.messages.fieldBody')}</label>
          <textarea id="m-body" rows={6} value={body}
                    onChange={e => setBody(e.target.value)} required maxLength={4000}
                    placeholder={t('portal.messages.bodyPlaceholder')} />
        </div>
        {err && <div className="tax-msg tax-msg--error">{err}</div>}
        <button type="submit" className="tax-btn tax-btn--primary" disabled={busy}>
          {busy ? t('lead.submitting') : t('portal.messages.sendBtn')}
        </button>
      </form>
    </PortalShell>
  );
}

// ── Thread view ──────────────────────────────────────────────────────────
function ThreadView({ id }) {
  const { t } = useT();
  const { fbUser, customer, community } = useTaxAuth();
  const auth = { uid: fbUser?.uid, email: fbUser?.email, communitySlug: community?.id };

  const [state, setState] = useState({ kind: 'loading' });
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const endRef = useRef(null);

  const load = () => {
    taxApi.getThread(auth, id)
      .then(d => setState({ kind: 'ready', thread: d.thread, messages: d.messages || [] }))
      .catch(e => setState({ kind: e?.status === 404 ? 'not-found' : 'error', error: e?.message || '' }));
  };
  useEffect(() => {
    if (!fbUser || !community) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbUser, community, id]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [state]);

  const portalBase = community ? `/tax/${community.id}/portal/messages` : '#';

  if (state.kind === 'loading') return <PortalShell community={community} active="messages"><p>{t('loading')}</p></PortalShell>;
  if (state.kind === 'not-found') return <PortalShell community={community} active="messages"><div className="tax-msg tax-msg--error">{t('portal.messages.notFound')}</div></PortalShell>;
  if (state.kind === 'error') return <PortalShell community={community} active="messages"><div className="tax-msg tax-msg--error">{state.error || t('error.loadFailed')}</div></PortalShell>;

  const { thread, messages } = state;
  const onSendReply = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true); setErr('');
    try {
      await taxApi.postMessage(auth, id, { body: reply.trim() });
      setReply('');
      load();
    } catch (e) {
      setErr(e?.message || t('respond.error.generic'));
    } finally {
      setSending(false);
    }
  };

  return (
    <PortalShell community={community} active="messages">
      <a href={portalBase} style={{ fontSize: 14, color: 'var(--tax-muted)' }}>
        ← {t('portal.messages.backToList')}
      </a>
      <h2 style={{ marginTop: 8, marginBottom: 4 }}>{thread.subject || t('portal.messages.untitled')}</h2>
      <p style={{ color: 'var(--tax-muted)', marginTop: 0, fontSize: 13 }}>
        {t('portal.messages.opened')} {new Date(thread.created_at).toLocaleString()}
      </p>

      <div style={{ display: 'grid', gap: 12, margin: '24px 0' }}>
        {messages.map(m => {
          const mine = m.author_role === 'customer';
          const bgColor = mine ? 'color-mix(in srgb, var(--tax-brand-primary) 8%, #fff)' : '#f7f7f9';
          const align = mine ? 'flex-end' : 'flex-start';
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: align }}>
              <div style={{
                maxWidth: '80%',
                background: bgColor,
                borderRadius: 12, padding: '10px 14px',
                border: '1px solid var(--tax-border)',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tax-muted)', marginBottom: 4 }}>
                  {mine ? (customer?.name || t('portal.messages.you'))
                        : (community?.name || t('portal.messages.practice'))}
                  <span style={{ marginLeft: 8, fontWeight: 400 }}>{relTime(m.created_at)}</span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.55 }}>{m.body}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {thread.status === 'closed' ? (
        <div className="tax-msg" style={{ background: 'var(--tax-bg-alt)', color: 'var(--tax-muted)' }}>
          {t('portal.messages.closed')}
        </div>
      ) : (
        <form onSubmit={onSendReply} className="tax-form" style={{ marginTop: 16 }}>
          <div>
            <label htmlFor="m-reply">{t('portal.messages.fieldReply')}</label>
            <textarea id="m-reply" rows={4} value={reply}
                      onChange={e => setReply(e.target.value)}
                      placeholder={t('portal.messages.replyPlaceholder')} maxLength={4000} />
          </div>
          {err && <div className="tax-msg tax-msg--error">{err}</div>}
          <button type="submit" className="tax-btn tax-btn--primary" disabled={sending || !reply.trim()}>
            {sending ? t('lead.submitting') : t('portal.messages.sendBtn')}
          </button>
        </form>
      )}
    </PortalShell>
  );
}
