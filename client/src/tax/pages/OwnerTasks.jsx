import { useEffect, useMemo, useRef, useState } from 'react';
import { pickI18n, useT } from '../i18n';
import { useEmployeeAuth } from '../auth/EmployeeAuthProvider';
import { taxApi } from '../api';
import EmployeeShell from '../components/EmployeeShell';
import { displayPersonName } from '../lib/personName';

// Owner / staff task tracker. Replaces the spreadsheet workflow:
// columns from the source CSV map onto this UI as
//   Task           → title
//   Customer Name  → customer picker (optional — practice-wide tasks
//                                       leave it blank)
//   Status         → status_key chip (owner-editable list)
//   Owner          → assigned_employee_id (staff picker)
//   Priority       → priority chip
//   Due date       → due_date input
//   Notes          → notes textarea

const PRIORITY_OPTIONS = ['urgent', 'high', 'normal', 'low'];
const PRIORITY_COLOR = {
  urgent: { bg: '#fee2e2', fg: '#991b1b' },
  high:   { bg: '#fef3c7', fg: '#92400e' },
  normal: { bg: '#e0e7ff', fg: '#3730a3' },
  low:    { bg: '#f3f4f6', fg: '#6b7280' },
};

export default function OwnerTasks() {
  const { locale, t } = useT();
  const { fbUser, employee, community } = useEmployeeAuth();
  const auth = { uid: fbUser?.uid, email: fbUser?.email, communitySlug: community?.id };
  const isAdmin = employee?.role === 'admin';

  const [statuses, setStatuses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [tasks, setTasks] = useState(null);
  const [err, setErr] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const [filters, setFilters] = useState({
    status: '', priority: '', assignedTo: '', productId: '', due: '',
    q: '',
  });

  const load = () => {
    if (!fbUser || !community) return;
    taxApi.adminListTasks(auth, { communitySlug: community.id, ...filters })
      .then(d => setTasks(d.tasks || []))
      .catch(e => setErr(e?.message || t('error.loadFailed')));
  };

  // Reference data (statuses / employees / customers / products) is loaded
  // once per community — the picker dropdowns + filter chips depend on it.
  useEffect(() => {
    if (!fbUser || !community) return;
    Promise.all([
      taxApi.adminListTaskStatuses(auth, community.id).catch(() => ({ statuses: [] })),
      taxApi.adminListEmployees(auth, community.id).catch(() => ({ employees: [] })),
      taxApi.adminListCustomers(auth, community.id).catch(() => ({ customers: [] })),
      taxApi.adminListProducts(auth, community.id).catch(() => ({ products: [] })),
    ]).then(([s, e, c, p]) => {
      setStatuses(s.statuses || []);
      setEmployees((e.employees || []).filter(em => em.status !== 'archived'));
      setCustomers(c.customers || []);
      setProducts(p.products || []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbUser, community]);

  // Refetch tasks whenever filters change. Debounce the search box so
  // typing doesn't refetch on every keystroke.
  const searchTimer = useRef(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(load, 200);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fbUser, community, filters]);

  const employeeById = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);
  const customerById = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
  const productById  = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

  const onClearFilters = () => setFilters({ status: '', priority: '', assignedTo: '', productId: '', due: '', q: '' });
  const filtersActive = Object.values(filters).some(v => v);

  if (err) return <EmployeeShell community={community} active="tasks">
    <div className="tax-msg tax-msg--error">{err}</div>
  </EmployeeShell>;

  return (
    <EmployeeShell community={community} active="tasks">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0 }}>{t('owner.tasks.title')}</h2>
          <p className="tax-section__lede" style={{ margin: '4px 0 0' }}>
            {t('owner.tasks.subtitle')}
          </p>
        </div>
        <button type="button" className="tax-btn tax-btn--primary"
                onClick={() => setShowAdd(true)}>
          + {t('owner.tasks.add')}
        </button>
      </div>

      {showAdd && (
        <AddTaskModal
          auth={auth} community={community}
          statuses={statuses} employees={employees} customers={customers} products={products}
          defaultAssignee={employee?.id || ''} locale={locale} t={t}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); load(); }}
        />
      )}

      <FilterBar
        filters={filters} setFilters={setFilters}
        statuses={statuses} employees={employees} products={products}
        onClear={onClearFilters} active={filtersActive}
        locale={locale} t={t}
      />

      {tasks === null ? <p>{t('loading')}</p>
        : tasks.length === 0
          ? <p style={{ color: 'var(--tax-muted)' }}>
              {filtersActive ? t('owner.tasks.noMatch') : t('owner.tasks.empty')}
            </p>
          : <div style={{ display: 'grid', gap: 8 }}>
              {tasks.map(task => (
                <TaskRow key={task.id} task={task} auth={auth}
                         statuses={statuses} employees={employees}
                         customerById={customerById} employeeById={employeeById}
                         productById={productById} isAdmin={isAdmin}
                         onChange={load} locale={locale} t={t} />
              ))}
            </div>
      }
    </EmployeeShell>
  );
}

function FilterBar({ filters, setFilters, statuses, employees, products, onClear, active, locale, t }) {
  const set = (k, v) => setFilters(prev => ({ ...prev, [k]: v }));
  return (
    <div style={{ display: 'grid', gap: 8, marginBottom: 16,
                  padding: 12, background: 'var(--tax-bg-alt)', borderRadius: 8 }}>
      <input type="search" value={filters.q}
             onChange={e => set('q', e.target.value)}
             placeholder={t('owner.tasks.searchPlaceholder')}
             style={{ padding: '8px 10px', border: '1px solid var(--tax-border)', borderRadius: 6 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        <select value={filters.status} onChange={e => set('status', e.target.value)}>
          <option value="">{t('owner.tasks.filter.allStatuses')}</option>
          {statuses.map(s => (
            <option key={s.id} value={s.key}>{pickI18n(s.label_i18n, locale).value || s.key}</option>
          ))}
        </select>
        <select value={filters.priority} onChange={e => set('priority', e.target.value)}>
          <option value="">{t('owner.tasks.filter.allPriorities')}</option>
          {PRIORITY_OPTIONS.map(p => (
            <option key={p} value={p}>{t(`owner.tasks.priority.${p}`)}</option>
          ))}
        </select>
        <select value={filters.assignedTo} onChange={e => set('assignedTo', e.target.value)}>
          <option value="">{t('owner.tasks.filter.anyOwner')}</option>
          {employees.map(em => (
            <option key={em.id} value={em.id}>{displayPersonName(em) || em.email}</option>
          ))}
        </select>
        <select value={filters.productId} onChange={e => set('productId', e.target.value)}>
          <option value="">{t('owner.tasks.filter.anyService')}</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{pickI18n(p.name_i18n, locale).value || p.slug}</option>
          ))}
        </select>
        <select value={filters.due} onChange={e => set('due', e.target.value)}>
          <option value="">{t('owner.tasks.filter.anyDue')}</option>
          <option value="overdue">{t('owner.tasks.filter.overdue')}</option>
          <option value="today">{t('owner.tasks.filter.today')}</option>
          <option value="week">{t('owner.tasks.filter.week')}</option>
        </select>
      </div>
      {active && (
        <button type="button" onClick={onClear}
                style={{ justifySelf: 'start', border: 0, background: 'transparent',
                         color: 'var(--tax-brand-primary)', cursor: 'pointer',
                         fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
          × {t('owner.tasks.filter.clear')}
        </button>
      )}
    </div>
  );
}

function TaskRow({ task, auth, statuses, employees, customerById, employeeById, productById, isAdmin, onChange, locale, t }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  const customer = task.customer || (task.customer_id ? customerById.get(task.customer_id) : null);
  const product  = task.product  || (task.product_id  ? productById.get(task.product_id)   : null);
  const assignee = task.assignee || (task.assigned_employee_id ? employeeById.get(task.assigned_employee_id) : null);
  const status   = statuses.find(s => s.key === task.status_key);
  const statusLabel = status ? (pickI18n(status.label_i18n, locale).value || status.key) : task.status_key;
  const statusBg = status?.color || '#9ca3af';
  const overdue = task.due_date && task.due_date < new Date().toISOString().slice(0, 10) && !task.completed_at;
  const prCol = PRIORITY_COLOR[task.priority] || PRIORITY_COLOR.normal;

  const update = async (patch) => {
    setBusy(true); setErr('');
    try { await taxApi.adminUpdateTask(auth, task.id, patch); onChange(); }
    catch (e) { setErr(e?.message || ''); }
    finally { setBusy(false); }
  };
  const onDelete = async () => {
    if (!window.confirm(t('owner.tasks.deleteConfirm'))) return;
    setBusy(true); setErr('');
    try { await taxApi.adminDeleteTask(auth, task.id); onChange(); }
    catch (e) { setErr(e?.message || ''); }
    finally { setBusy(false); }
  };

  return (
    <div className="tax-contact-item" style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600 }}>
            {task.title}
            {task.priority !== 'normal' && (
              <span style={{
                marginLeft: 8, padding: '1px 8px', borderRadius: 999,
                background: prCol.bg, color: prCol.fg,
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              }}>{t(`owner.tasks.priority.${task.priority}`)}</span>
            )}
          </div>
          <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 13, color: 'var(--tax-muted)' }}>
            {customer && (
              <span><strong>{t('owner.tasks.customer')}:</strong>{' '}
                <a href={`/tax/${task.community_id}/employee/customers/${encodeURIComponent(customer.id)}`}
                   style={{ color: 'var(--tax-brand-primary)' }}>
                  {displayPersonName(customer) || customer.email}
                </a>
              </span>
            )}
            {product && (
              <span><strong>{t('owner.tasks.service')}:</strong>{' '}
                {pickI18n(product.name_i18n, locale).value || product.slug}</span>
            )}
            {assignee && (
              <span><strong>{t('owner.tasks.owner')}:</strong>{' '}
                {displayPersonName(assignee) || assignee.email}</span>
            )}
            {task.due_date && (
              <span style={overdue ? { color: '#b91c1c', fontWeight: 600 } : undefined}>
                <strong>{t('owner.tasks.due')}:</strong> {task.due_date}
                {overdue && ` (${t('owner.tasks.overdue')})`}
              </span>
            )}
            <span style={{ color: 'var(--tax-muted)' }}>
              {t('owner.tasks.created')}: {task.created_at ? new Date(task.created_at).toLocaleDateString() : ''}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          <select value={task.status_key} onChange={e => update({ statusKey: e.target.value })}
                  disabled={busy}
                  style={{
                    padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    border: '1px solid var(--tax-border)',
                    background: `color-mix(in srgb, ${statusBg} 18%, #fff)`,
                  }}>
            {statuses.map(s => (
              <option key={s.id} value={s.key}>{pickI18n(s.label_i18n, locale).value || s.key}</option>
            ))}
          </select>
          {(isAdmin || task.assigned_employee_id === auth?.uid) && (
            <button type="button" onClick={onDelete} disabled={busy}
                    className="tax-btn tax-btn--ghost tax-btn--sm"
                    style={{ color: 'var(--tax-error)', borderColor: 'var(--tax-error)' }}>
              {t('owner.tasks.delete')}
            </button>
          )}
        </div>
      </div>

      {err && <div className="tax-msg tax-msg--error">{err}</div>}

      {task.notes && (
        <div>
          <button type="button" onClick={() => setShowNotes(s => !s)}
                  style={{ border: 0, background: 'transparent', cursor: 'pointer',
                           color: 'var(--tax-brand-primary)', fontSize: 12, fontWeight: 600 }}>
            {showNotes ? t('owner.tasks.hideNotes') : t('owner.tasks.showNotes')}
          </button>
          {showNotes && (
            <div style={{ marginTop: 6, padding: 10, background: 'var(--tax-bg-alt)',
                          borderRadius: 6, fontSize: 13, whiteSpace: 'pre-wrap' }}>
              {task.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddTaskModal({ auth, community, statuses, employees, customers, products, defaultAssignee, locale, t, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [productId, setProductId] = useState('');
  const [statusKey, setStatusKey] = useState(statuses[0]?.key || 'not_started');
  const [priority, setPriority] = useState('normal');
  const [assignedTo, setAssignedTo] = useState(defaultAssignee);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  // Load product-specific title suggestions whenever the service picker
  // changes. Falls back to the generic "Common" bucket when no service is
  // selected.
  useEffect(() => {
    const product = products.find(p => p.id === productId);
    taxApi.adminTaskSuggestions(auth, product?.slug || '')
      .then(d => setSuggestions(d.suggestions || []))
      .catch(() => setSuggestions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const onSave = async (e) => {
    e?.preventDefault?.();
    if (!title.trim()) { setErr(t('owner.tasks.errTitle')); return; }
    setBusy(true); setErr('');
    try {
      await taxApi.adminCreateTask(auth, {
        communitySlug: community.id,
        title: title.trim(),
        customerId: customerId || null,
        productId: productId || null,
        statusKey, priority,
        assignedEmployeeId: assignedTo || null,
        dueDate: dueDate || null,
        notes: notes.trim(),
      });
      onCreated();
    } catch (e) { setErr(e?.message || ''); }
    finally { setBusy(false); }
  };

  return (
    <div className="tax-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="tax-modal__panel" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <button type="button" className="tax-modal__close"
                onClick={onClose} aria-label={t('preview.close')}>×</button>
        <h3 className="tax-modal__title">{t('owner.tasks.add')}</h3>
        <form onSubmit={onSave} className="tax-form" style={{ boxShadow: 'none', padding: 0, border: 0 }}>
          <div>
            <label>{t('owner.tasks.field.title')}</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                   maxLength={300} list="task-suggestions" required autoFocus />
            <datalist id="task-suggestions">
              {suggestions.map((s, i) => (
                <option key={i} value={pickI18n(s, locale).value || s.en || s.es} />
              ))}
            </datalist>
          </div>

          <div className="tax-form__row2">
            <div>
              <label>{t('owner.tasks.field.service')}</label>
              <select value={productId} onChange={e => setProductId(e.target.value)}>
                <option value="">{t('owner.tasks.field.servicePractice')}</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{pickI18n(p.name_i18n, locale).value || p.slug}</option>
                ))}
              </select>
            </div>
            <div>
              <label>{t('owner.tasks.field.customer')}</label>
              <select value={customerId} onChange={e => setCustomerId(e.target.value)}>
                <option value="">{t('owner.tasks.field.customerNone')}</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{displayPersonName(c) || c.email}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="tax-form__row2">
            <div>
              <label>{t('owner.tasks.field.owner')}</label>
              <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                <option value="">{t('owner.tasks.field.ownerNone')}</option>
                {employees.map(em => (
                  <option key={em.id} value={em.id}>{displayPersonName(em) || em.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label>{t('owner.tasks.field.priority')}</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}>
                {PRIORITY_OPTIONS.map(p => (
                  <option key={p} value={p}>{t(`owner.tasks.priority.${p}`)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="tax-form__row2">
            <div>
              <label>{t('owner.tasks.field.status')}</label>
              <select value={statusKey} onChange={e => setStatusKey(e.target.value)}>
                {statuses.map(s => (
                  <option key={s.id} value={s.key}>{pickI18n(s.label_i18n, locale).value || s.key}</option>
                ))}
              </select>
            </div>
            <div>
              <label>{t('owner.tasks.field.due')}</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label>{t('owner.tasks.field.notes')}</label>
            <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} maxLength={4000} />
          </div>

          {err && <div className="tax-msg tax-msg--error">{err}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="tax-btn tax-btn--primary" disabled={busy}>
              {busy ? t('lead.submitting') : t('owner.tasks.create')}
            </button>
            <button type="button" className="tax-btn tax-btn--ghost"
                    onClick={onClose} style={{ color: 'var(--tax-text)' }}>
              {t('preview.close')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
