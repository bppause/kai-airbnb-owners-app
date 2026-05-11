import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { useEmployeeAuth } from '../auth/EmployeeAuthProvider';
import { taxApi } from '../api';
import EmployeeShell from '../components/EmployeeShell';

// Owner-side view of a single employee. Profile is read-only (the employee
// edits their own profile via /employee/profile); the action surface here is
// the customer-assignment manager.
export default function OwnerStaffDetail({ employeeId }) {
  const { t } = useT();
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
      <h2 style={{ marginTop: 8, marginBottom: 4 }}>
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
      </p>

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

function AssignmentManager({ assignments, customers, empId, auth, onChange, t }) {
  const [picking, setPicking] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const assignedIds = new Set((assignments || []).map(a => a.customer_id));
  const available = (customers || []).filter(c => !assignedIds.has(c.id));

  const onAssign = async () => {
    if (!customerId) return;
    setBusy(true); setErr('');
    try {
      await taxApi.adminAddEmployeeAssignment(auth, empId, { customerId, isPrimary });
      setCustomerId(''); setIsPrimary(false); setPicking(false);
      onChange();
    } catch (e) { setErr(e?.message || ''); }
    finally { setBusy(false); }
  };
  const onUnassign = async (a) => {
    if (!window.confirm(t('owner.staffDetail.confirmUnassign', { name: a.customer?.name || a.customer?.email || '' }))) return;
    try {
      await taxApi.adminRemoveEmployeeAssignment(auth, empId, a.customer_id);
      onChange();
    } catch (e) { setErr(e?.message || ''); }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        {available.length > 0 && (
          <button type="button" className="tax-btn tax-btn--primary tax-btn--sm"
                  onClick={() => setPicking(p => !p)}>
            {picking ? t('owner.staffDetail.cancelAssign') : t('owner.staffDetail.assignBtn')}
          </button>
        )}
      </div>

      {picking && (
        <div className="tax-contact-item" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={customerId} onChange={e => setCustomerId(e.target.value)}
                    style={{ padding: '8px 10px', border: '1px solid var(--tax-border)',
                             borderRadius: 8, minWidth: 280 }}>
              <option value="">{t('owner.staffDetail.chooseCustomer')}</option>
              {available.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.email} ({c.email})</option>
              ))}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
              <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} />
              {t('owner.staffDetail.markPrimary')}
            </label>
            <button type="button" className="tax-btn tax-btn--primary tax-btn--sm"
                    onClick={onAssign} disabled={!customerId || busy}>
              {busy ? t('lead.submitting') : t('owner.staffDetail.confirmAssign')}
            </button>
          </div>
        </div>
      )}
      {err && <div className="tax-msg tax-msg--error">{err}</div>}

      {assignments === null ? <p>{t('loading')}</p>
        : assignments.length === 0
          ? <p style={{ color: 'var(--tax-muted)' }}>{t('employee.profile.assignments.empty')}</p>
          : <div style={{ display: 'grid', gap: 8 }}>
              {assignments.map(a => (
                <div key={a.id} className="tax-contact-item"
                     style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>
                      {a.customer?.name || a.customer?.email}
                      {a.is_primary && (
                        <span style={{
                          marginLeft: 8, padding: '1px 8px', borderRadius: 999,
                          background: 'var(--tax-brand-primary)', color: '#fff',
                          fontSize: 11, fontWeight: 700,
                        }}>{t('employee.profile.assignments.primary')}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--tax-muted)', marginTop: 2 }}>
                      {a.customer?.email}
                    </div>
                  </div>
                  <button type="button" className="tax-btn tax-btn--ghost tax-btn--sm"
                          onClick={() => onUnassign(a)}
                          style={{ color: 'var(--tax-error)', borderColor: 'var(--tax-error)' }}>
                    {t('owner.staffDetail.unassign')}
                  </button>
                </div>
              ))}
            </div>}
    </>
  );
}
