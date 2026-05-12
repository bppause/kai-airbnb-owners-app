import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { useEmployeeAuth } from '../auth/EmployeeAuthProvider';
import { taxApi, setImpersonation } from '../api';
import EmployeeShell from '../components/EmployeeShell';

// Phase 4n.17: humanize a last-sign-in timestamp. Mirrors the helper in
// OwnerCustomerDetail — kept inline rather than extracted because both
// pages are otherwise self-contained.
function formatLastSignIn(iso, locale, t) {
  if (!iso) return t('owner.lastSignIn.never');
  try {
    const formatted = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-ES',
      { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      .format(new Date(iso));
    return t('owner.lastSignIn.recent', { date: formatted });
  } catch (_e) {
    return t('owner.lastSignIn.recent', { date: iso });
  }
}

// Owner-side view of a single employee. Profile is read-only (the employee
// edits their own profile via /employee/profile); the action surface here is
// the customer-assignment manager.
export default function OwnerStaffDetail({ employeeId }) {
  const { t, locale } = useT();
  const { fbUser, employee: me, community } = useEmployeeAuth();
  const auth = { uid: fbUser?.uid, email: fbUser?.email, communitySlug: community?.id };

  const [employees, setEmployees] = useState(null);
  const [customers, setCustomers] = useState(null);
  const [assignments, setAssignments] = useState(null);
  const [err, setErr] = useState('');

  const loadEmployee = () => taxApi.adminListEmployees(auth, community.id)
    .then(d => setEmployees(d.employees || []))
    .catch(e => setErr(e?.message || t('error.loadFailed')));
  const loadCustomers = () => taxApi.adminListCustomers(auth, community.id)
    .then(d => setCustomers(d.customers || []))
    .catch(() => {});
  const loadAssignments = () => taxApi.adminListEmployeeAssignments(auth, employeeId)
    .then(d => setAssignments(d.assignments || []))
    .catch(() => {});

  useEffect(() => {
    if (!fbUser || !community) return;
    loadEmployee(); loadCustomers(); loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbUser, community, employeeId]);

  if (me && me.role !== 'admin') {
    return <EmployeeShell community={community}>
      <div className="tax-msg tax-msg--error">{t('owner.notAuthorized')}</div>
    </EmployeeShell>;
  }
  if (err) return <EmployeeShell community={community} active="staff"><div className="tax-msg tax-msg--error">{err}</div></EmployeeShell>;

  const emp = (employees || []).find(e => e.id === employeeId);
  if (employees === null) return <EmployeeShell community={community} active="staff"><p>{t('loading')}</p></EmployeeShell>;
  if (!emp) return <EmployeeShell community={community} active="staff"><div className="tax-msg tax-msg--error">{t('owner.staff.notFound')}</div></EmployeeShell>;

  const back = community ? `/tax/${community.id}/employee/staff` : '#';

  return (
    <EmployeeShell community={community} active="staff">
      <a href={back} style={{ fontSize: 14, color: 'var(--tax-muted)' }}>← {t('owner.staff.back')}</a>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginTop: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ margin: 0, marginBottom: 4 }}>
            {emp.name || emp.email}
            <span style={{
              marginLeft: 12, padding: '2px 10px', borderRadius: 999,
              background: emp.role === 'admin' ? 'var(--tax-brand-primary)' : 'var(--tax-bg-alt)',
              color: emp.role === 'admin' ? '#fff' : 'var(--tax-muted)',
              fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
              verticalAlign: 'middle',
            }}>{emp.role}</span>
          </h2>
          <p style={{ color: 'var(--tax-muted)', marginTop: 0, fontSize: 13 }}>
            {emp.email}
            {!emp.firebase_uid && <> • <em>{t('owner.staff.notSignedInHint')}</em></>}
            {' • '}{(emp.notification_channels || []).includes('email')
                    ? t('owner.staff.channelBoth') : t('owner.staff.channelPortal')}
            {' • '}{formatLastSignIn(emp.last_sign_in_at, locale, t)}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
          {/* No self-impersonation — admin viewing their own row shouldn't try. */}
          {emp.id !== me?.id && emp.firebase_uid && emp.status === 'active' && (
            <ImpersonateEmployeeButton employee={emp} auth={auth} community={community} t={t} />
          )}
          {emp.id !== me?.id && (
            <ArchiveEmployeeButton emp={emp} auth={auth} onChanged={loadEmployee} t={t} />
          )}
        </div>
      </div>

      {emp.status === 'archived' && (
        <div className="tax-msg" style={{
          background: 'color-mix(in srgb, #b91c1c 8%, #fff)',
          borderLeft: '3px solid #b91c1c', color: '#7f1d1d',
          padding: '10px 14px', marginTop: 12,
        }}>
          <strong>{t('owner.staffDetail.archivedBanner.title')}</strong>
          <div style={{ marginTop: 4, fontSize: 13 }}>
            {t('owner.staffDetail.archivedBanner.body')}
          </div>
        </div>
      )}

      <h3 style={{ marginTop: 32 }}>{t('owner.staffDetail.assignments')}</h3>
      {emp.role === 'admin' ? (
        <div className="tax-msg" style={{ background: 'color-mix(in srgb, var(--tax-brand-primary) 8%, #fff)',
                                          color: 'var(--tax-text)', borderLeft: '3px solid var(--tax-brand-primary)' }}>
          <strong>{t('employee.profile.assignments.adminBanner')}</strong>
          <div style={{ marginTop: 4, color: 'var(--tax-muted)', fontSize: 13 }}>
            {t('owner.staffDetail.adminHint')}
          </div>
        </div>
      ) : (
        <AssignmentManager
          assignments={assignments} customers={customers}
          empId={employeeId} auth={auth}
          onChange={loadAssignments} t={t} />
      )}
    </EmployeeShell>
  );
}

// Phase 4n.19: unified assignment roster. One list of every customer in
// the community with an "Assigned" checkbox per row + a "Lead" toggle when
// assigned. Owner toggles multiple, sees the running count of pending
// changes, and saves all in one click. Search filters the list so the
// long customer rosters stay manageable.
function AssignmentManager({ assignments, customers, empId, auth, onChange, t }) {
  // Initial state derived from the server-side assignment list. We keep
  // these in refs-of-truth (initialAssigned / initialPrimary) so the diff
  // for Save is straightforward and a stale render doesn't cause spurious
  // POST/DELETEs.
  const initialAssigned = new Set((assignments || []).map(a => a.customer_id));
  const initialPrimary = new Map((assignments || []).map(a => [a.customer_id, !!a.is_primary]));

  const [assignedSet, setAssignedSet] = useState(() => new Set(initialAssigned));
  const [primaryMap, setPrimaryMap] = useState(() => new Map(initialPrimary));
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Re-sync when the server-side assignments change (after a save).
  useEffect(() => {
    setAssignedSet(new Set((assignments || []).map(a => a.customer_id)));
    setPrimaryMap(new Map((assignments || []).map(a => [a.customer_id, !!a.is_primary])));
  }, [assignments]);

  // Compute pending diffs once per render.
  const toAdd = [];
  const toRemove = [];
  const toUpdatePrimary = [];
  for (const c of customers || []) {
    const wasAssigned = initialAssigned.has(c.id);
    const isAssigned  = assignedSet.has(c.id);
    if (!wasAssigned && isAssigned) toAdd.push({ id: c.id, isPrimary: !!primaryMap.get(c.id) });
    else if (wasAssigned && !isAssigned) toRemove.push(c.id);
    else if (wasAssigned && isAssigned) {
      const wasPrimary = !!initialPrimary.get(c.id);
      const isPrimary  = !!primaryMap.get(c.id);
      if (wasPrimary !== isPrimary) toUpdatePrimary.push({ id: c.id, isPrimary });
    }
  }
  const pendingCount = toAdd.length + toRemove.length + toUpdatePrimary.length;

  const onToggle = (cid) => {
    setAssignedSet(prev => {
      const next = new Set(prev);
      if (next.has(cid)) {
        next.delete(cid);
        // Lead flag is meaningless on an unassigned customer; clear it.
        setPrimaryMap(m => { const mm = new Map(m); mm.delete(cid); return mm; });
      } else {
        next.add(cid);
      }
      return next;
    });
  };
  const onPrimary = (cid, value) => {
    setPrimaryMap(prev => { const mm = new Map(prev); mm.set(cid, !!value); return mm; });
  };

  const onSave = async () => {
    if (!pendingCount) return;
    setBusy(true); setErr('');
    try {
      await Promise.all([
        ...toAdd.map(a => taxApi.adminAddEmployeeAssignment(auth, empId, {
          customerId: a.id, isPrimary: a.isPrimary,
        })),
        // The POST endpoint upserts on (employee_id, customer_id) so it
        // doubles as the "change is_primary" path.
        ...toUpdatePrimary.map(a => taxApi.adminAddEmployeeAssignment(auth, empId, {
          customerId: a.id, isPrimary: a.isPrimary,
        })),
        ...toRemove.map(cid => taxApi.adminRemoveEmployeeAssignment(auth, empId, cid)),
      ]);
      onChange();
    } catch (e) { setErr(e?.message || ''); }
    finally { setBusy(false); }
  };

  const onResetDraft = () => {
    setAssignedSet(new Set(initialAssigned));
    setPrimaryMap(new Map(initialPrimary));
  };

  const q = query.trim().toLowerCase();
  const filtered = (customers || []).filter(c => {
    if (!q) return true;
    return (c.name || '').toLowerCase().includes(q)
        || (c.email || '').toLowerCase().includes(q);
  });
  // Sort: assigned-first, then alphabetical. Owner can scan the assigned
  // block at the top and add new ones below.
  filtered.sort((a, b) => {
    const aA = assignedSet.has(a.id) ? 0 : 1;
    const bA = assignedSet.has(b.id) ? 0 : 1;
    if (aA !== bA) return aA - bA;
    return (a.name || a.email || '').localeCompare(b.name || b.email || '');
  });

  return (
    <>
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        marginBottom: 10, flexWrap: 'wrap',
      }}>
        <input type="search" value={query} onChange={e => setQuery(e.target.value)}
               placeholder={t('owner.staffDetail.searchPlaceholder')}
               style={{ flex: 1, minWidth: 240, padding: '8px 10px',
                        border: '1px solid var(--tax-border)', borderRadius: 8 }} />
        <span style={{ fontSize: 13, color: 'var(--tax-muted)' }}>
          {t('owner.staffDetail.assignedCount', {
            assigned: assignedSet.size,
            total: (customers || []).length,
          })}
        </span>
      </div>

      {err && <div className="tax-msg tax-msg--error" style={{ marginBottom: 8 }}>{err}</div>}

      {(!customers || customers.length === 0) ? (
        <p style={{ color: 'var(--tax-muted)' }}>{t('owner.staffDetail.noCustomers')}</p>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {filtered.map(c => {
            const isAssigned = assignedSet.has(c.id);
            const wasAssigned = initialAssigned.has(c.id);
            const wasPrimary  = !!initialPrimary.get(c.id);
            const isPrimary   = !!primaryMap.get(c.id);
            const changed = (isAssigned !== wasAssigned)
                         || (isAssigned && wasAssigned && (isPrimary !== wasPrimary));
            return (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--tax-border)',
                background: changed ? 'color-mix(in srgb, var(--tax-brand-primary) 6%, #fff)' : '#fff',
              }}>
                <input type="checkbox" checked={isAssigned} onChange={() => onToggle(c.id)} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{c.name || c.email}</div>
                  <div style={{ fontSize: 12, color: 'var(--tax-muted)' }}>{c.email}</div>
                </div>
                {wasAssigned && (
                  <span style={{
                    padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                    background: 'var(--tax-bg-alt)', color: 'var(--tax-muted)',
                  }}>{t('owner.staffDetail.alreadyAssigned')}</span>
                )}
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 13, opacity: isAssigned ? 1 : 0.4,
                }}>
                  <input type="checkbox" checked={isPrimary} disabled={!isAssigned}
                         onChange={e => onPrimary(c.id, e.target.checked)} />
                  {t('owner.staffDetail.markPrimary')}
                </label>
              </div>
            );
          })}
        </div>
      )}

      <div style={{
        position: 'sticky', bottom: 0,
        marginTop: 16, padding: '10px 12px',
        background: 'rgba(255,255,255,.96)', borderRadius: 10,
        border: '1px solid var(--tax-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 13, color: 'var(--tax-muted)' }}>
          {pendingCount === 0
            ? t('owner.staffDetail.noPendingChanges')
            : t('owner.staffDetail.pendingChanges', {
                count: pendingCount,
                adds: toAdd.length,
                removes: toRemove.length,
                primaries: toUpdatePrimary.length,
              })}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {pendingCount > 0 && (
            <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                    onClick={onResetDraft} disabled={busy}>
              {t('owner.staffDetail.discardChanges')}
            </button>
          )}
          <button type="button" className="tax-btn tax-btn--primary tax-btn--sm"
                  onClick={onSave} disabled={!pendingCount || busy}>
            {busy ? t('lead.submitting') : t('owner.staffDetail.saveAssignments')}
          </button>
        </div>
      </div>
    </>
  );
}

// "Impersonate" button for a staff row. Behaves like the customer version
// but routes to /employee — the EmployeeAuthProvider detects the
// impersonation state and swaps identity to the target.
function ImpersonateEmployeeButton({ employee: emp, auth, community, t }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onClick = async () => {
    if (!window.confirm(t('impersonation.confirm.employee', { name: emp.name || emp.email }))) return;
    setBusy(true); setErr('');
    try {
      const r = await taxApi.adminStartImpersonation(auth, {
        communitySlug: community.id,
        targetType: 'employee',
        targetId: emp.id,
      });
      setImpersonation({
        token: r.token,
        targetType: 'employee',
        targetId: emp.id,
        targetEmail: emp.email,
        targetName: emp.name || emp.email,
        communitySlug: community.id,
        realAdminEmail: auth.adminEmail || auth.email,
        realAdminUid: auth.uid,
        expiresAt: r.expiresAt,
      });
      window.location.href = `/tax/${community.id}/employee`;
    } catch (e) {
      setErr(e?.message || '');
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
              onClick={onClick} disabled={busy}
              style={{ color: '#b91c1c', borderColor: '#b91c1c', flexShrink: 0 }}>
        {busy ? t('impersonation.starting') : t('impersonation.viewAsEmployee')}
      </button>
      {err && <span style={{ color: 'var(--tax-error)', fontSize: 11 }}>{err}</span>}
    </div>
  );
}

// Phase 4n.16: archive (status='archived') an employee. Soft-delete to
// retain audit history + past assignments. When already archived, swaps
// to a "Restore" affordance.
function ArchiveEmployeeButton({ emp, auth, onChanged, t }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ kind: 'idle', text: '' });
  const isArchived = emp.status === 'archived';

  const onClick = async () => {
    if (!isArchived) {
      if (!window.confirm(t('owner.staffDetail.archive.confirm', { name: emp.name || emp.email }))) return;
    }
    setBusy(true); setMsg({ kind: 'idle', text: '' });
    try {
      await taxApi.adminSetEmployeeStatus(auth, emp.id, {
        status: isArchived ? 'active' : 'archived',
      });
      setMsg({ kind: 'success',
        text: isArchived ? t('owner.staffDetail.archive.restored') : t('owner.staffDetail.archive.done') });
      onChanged && onChanged();
    } catch (e) {
      setMsg({ kind: 'error', text: e?.message || t('respond.error.generic') });
    } finally {
      setBusy(false);
      setTimeout(() => setMsg({ kind: 'idle', text: '' }), 6000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
              onClick={onClick} disabled={busy}
              style={{ color: '#b91c1c', borderColor: '#b91c1c' }}>
        {busy
          ? t('lead.submitting')
          : (isArchived ? t('owner.staffDetail.archive.restoreBtn') : t('owner.staffDetail.archive.button'))}
      </button>
      {msg.text && (
        <span style={{
          fontSize: 11,
          color: msg.kind === 'success' ? 'var(--tax-success)' : 'var(--tax-error)',
        }}>{msg.text}</span>
      )}
    </div>
  );
}
