import { useEffect, useMemo, useRef, useState } from 'react';
import { FixedSizeList } from 'react-window';
import { pickI18n, useT } from '../i18n';
import { useEmployeeAuth } from '../auth/EmployeeAuthProvider';
import { taxApi } from '../api';
import EmployeeShell from '../components/EmployeeShell';
import { displayPersonName } from '../lib/personName';
import { urgencyOf, effectiveUrgency, colorOf, priorityColorOf, resolveThresholds, URGENCY_LABEL_KEY } from '../lib/taskUrgency';

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
  const [editingTask, setEditingTask] = useState(null);
  const [relationshipTypes, setRelationshipTypes] = useState([]);

  // Multi-value filters live as arrays of IDs; serialized to
  // comma-separated strings at the API boundary so the server can
  // accept either form. Priority + due stay scalar — small fixed
  // pickers.
  const [filters, setFilters] = useState({
    status: [], priority: '', assignedTo: [], productId: [], customerId: [], due: '',
    q: '',
  });
  // Phase 4n.45: view mode (list/calendar/kanban), group-by, and the
  // My-tasks toggle. View + group-by persist per browser via
  // localStorage so the operator's preference sticks across sessions.
  const [view, setView] = useState(() => {
    try { return localStorage.getItem('tax.tasks.view') || 'list'; }
    catch { return 'list'; }
  });
  useEffect(() => {
    try { localStorage.setItem('tax.tasks.view', view); } catch { /* ignore */ }
  }, [view]);
  const [groupBy, setGroupBy] = useState(() => {
    try { return localStorage.getItem('tax.tasks.groupBy') || 'none'; }
    catch { return 'none'; }
  });
  useEffect(() => {
    try { localStorage.setItem('tax.tasks.groupBy', groupBy); } catch { /* ignore */ }
  }, [groupBy]);
  // Sort key persisted per browser so the operator's order sticks.
  // Server interprets the key — see /admin/tasks.
  const [sortKey, setSortKey] = useState(() => {
    try { return localStorage.getItem('tax.tasks.sort') || 'dueAsc'; }
    catch { return 'dueAsc'; }
  });
  useEffect(() => {
    try { localStorage.setItem('tax.tasks.sort', sortKey); } catch { /* ignore */ }
  }, [sortKey]);
  const [mine, setMine] = useState(false);

  const load = () => {
    if (!fbUser || !community) return;
    // Flatten array filters to comma-separated strings for the API.
    // Empty arrays drop out so the server doesn't see "?status=".
    const flat = (v) => Array.isArray(v) ? v.join(',') : v;
    const merged = {
      communitySlug: community.id,
      status: flat(filters.status),
      priority: filters.priority,
      assignedTo: flat(filters.assignedTo),
      productId: flat(filters.productId),
      customerId: flat(filters.customerId),
      due: filters.due,
      q: filters.q,
      sort: sortKey,
    };
    // Mine-toggle overrides the assignedTo filter for the duration
    // of the toggle. Turning Mine off keeps whatever the picker
    // had selected before.
    if (mine && employee?.id) merged.assignedTo = employee.id;
    taxApi.adminListTasks(auth, merged)
      .then(d => {
        const rows = d.tasks || [];
        // Priority is a text column server-side so the rank ordering
        // (urgent > high > normal > low) is applied here. Other sort
        // keys are already handled by the SQL ORDER BY.
        if (sortKey === 'priority') {
          const rank = { urgent: 0, high: 1, normal: 2, low: 3 };
          rows.sort((a, b) => {
            const ar = rank[a.priority] ?? 99;
            const br = rank[b.priority] ?? 99;
            if (ar !== br) return ar - br;
            const ad = a.due_date || '9999-12-31';
            const bd = b.due_date || '9999-12-31';
            return ad.localeCompare(bd);
          });
        }
        setTasks(rows);
      })
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
      // Admin-only — non-admins can't quick-create a customer, so the
      // listing endpoint (which is admin-gated) is skipped for them.
      isAdmin
        ? taxApi.adminListRelationshipTypes(auth, { communitySlug: community.id }).catch(() => ({ types: [] }))
        : Promise.resolve({ types: [] }),
    ]).then(([s, e, c, p, rt]) => {
      setStatuses(s.statuses || []);
      setEmployees((e.employees || []).filter(em => em.status !== 'archived'));
      setCustomers(c.customers || []);
      setProducts(p.products || []);
      setRelationshipTypes((rt.types || []).filter(r => r.active !== false));
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
  }, [fbUser, community, filters, mine, employee?.id, sortKey]);

  const employeeById = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);
  const customerById = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
  const productById  = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

  const onClearFilters = () => setFilters({ status: [], priority: '', assignedTo: [], productId: [], customerId: [], due: '', q: '' });
  const filtersActive = Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : !!v);

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
        <TaskFormModal
          mode="create"
          auth={auth} community={community} isAdmin={isAdmin}
          statuses={statuses} employees={employees} customers={customers}
          products={products} relationshipTypes={relationshipTypes}
          defaultAssignee={employee?.id || ''} locale={locale} t={t}
          onCustomersChanged={(c) => setCustomers(prev => [c, ...prev])}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}

      {editingTask && (
        <TaskFormModal
          mode="edit" task={editingTask}
          auth={auth} community={community} isAdmin={isAdmin}
          statuses={statuses} employees={employees} customers={customers}
          products={products} relationshipTypes={relationshipTypes}
          defaultAssignee={employee?.id || ''} locale={locale} t={t}
          onCustomersChanged={(c) => setCustomers(prev => [c, ...prev])}
          onClose={() => setEditingTask(null)}
          onSaved={() => { setEditingTask(null); load(); }}
        />
      )}

      <TaskToolbar
        mine={mine} setMine={setMine}
        filters={filters} setFilters={setFilters}
        view={view} setView={setView}
        groupBy={groupBy} setGroupBy={setGroupBy}
        sortKey={sortKey} setSortKey={setSortKey}
        t={t}
      />

      <FilterBar
        filters={filters} setFilters={setFilters}
        statuses={statuses} employees={employees} products={products}
        customers={customers}
        onClear={onClearFilters} active={filtersActive}
        locale={locale} t={t}
      />

      {tasks === null ? <p>{t('loading')}</p>
        : tasks.length === 0
          ? <p style={{ color: 'var(--tax-muted)' }}>
              {filtersActive ? t('owner.tasks.noMatch') : t('owner.tasks.empty')}
            </p>
          : view === 'calendar' ? (
              <TasksCalendar tasks={tasks} community={community} statuses={statuses}
                             onEdit={setEditingTask} locale={locale} t={t} />
            )
          : view === 'kanban' ? (
              <TasksKanban tasks={tasks} statuses={statuses} community={community}
                           auth={auth} onChange={load}
                           onEdit={setEditingTask} locale={locale} t={t} />
            )
          : (
            <TasksGroupedList tasks={tasks} groupBy={groupBy} community={community}
                              statuses={statuses} employees={employees}
                              customerById={customerById} employeeById={employeeById}
                              productById={productById} isAdmin={isAdmin}
                              auth={auth} onEdit={setEditingTask} onChange={load}
                              locale={locale} t={t} />
          )
      }
    </EmployeeShell>
  );
}

function FilterBar({ filters, setFilters, statuses, employees, products, customers = [], onClear, active, locale, t }) {
  const set = (k, v) => setFilters(prev => ({ ...prev, [k]: v }));
  const toggle = (k, id) => setFilters(prev => {
    const cur = Array.isArray(prev[k]) ? prev[k] : [];
    return { ...prev, [k]: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] };
  });
  // Sort customers alphabetically by display name (company first when set)
  // so the picker scans like a directory.
  const customerOptions = [...customers].sort((a, b) => {
    const an = (a.business_name || displayPersonName(a) || a.email || '').toLowerCase();
    const bn = (b.business_name || displayPersonName(b) || b.email || '').toLowerCase();
    return an.localeCompare(bn);
  }).map(c => ({
    id: c.id,
    label: c.business_name || displayPersonName(c) || c.email,
    sub: c.business_name && (c.first_name || c.last_name)
      ? `${[c.first_name, c.last_name].filter(Boolean).join(' ').trim()}${c.email ? ' · ' + c.email : ''}`
      : (c.email || ''),
    haystack: `${c.business_name || ''} ${c.name || ''} ${c.first_name || ''} ${c.last_name || ''} ${c.email || ''} ${c.phone || ''}`.toLowerCase(),
  }));
  const statusOptions = statuses.map(s => ({
    id: s.key,
    label: pickI18n(s.label_i18n, locale).value || s.key,
  }));
  const ownerOptions = employees.map(em => ({
    id: em.id,
    label: displayPersonName(em) || em.email,
    sub: em.email || '',
  }));
  const productOptions = products.map(p => ({
    id: p.id,
    label: pickI18n(p.name_i18n, locale).value || p.slug,
  }));
  return (
    <div style={{ display: 'grid', gap: 8, marginBottom: 16,
                  padding: 12, background: 'var(--tax-bg-alt)', borderRadius: 8 }}>
      <input type="search" value={filters.q}
             onChange={e => set('q', e.target.value)}
             placeholder={t('owner.tasks.searchPlaceholder')}
             style={{ padding: '8px 10px', border: '1px solid var(--tax-border)', borderRadius: 6 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
        <MultiSelect
          label={t('owner.tasks.filter.allStatuses')}
          options={statusOptions}
          value={filters.status}
          onToggle={id => toggle('status', id)}
          onClear={() => set('status', [])}
          searchable={statusOptions.length > 8}
          searchPlaceholder={t('owner.tasks.filter.searchStatuses')}
          t={t}
        />
        <select value={filters.priority} onChange={e => set('priority', e.target.value)}>
          <option value="">{t('owner.tasks.filter.allPriorities')}</option>
          {PRIORITY_OPTIONS.map(p => (
            <option key={p} value={p}>{t(`owner.tasks.priority.${p}`)}</option>
          ))}
        </select>
        <MultiSelect
          label={t('owner.tasks.filter.anyOwner')}
          options={ownerOptions}
          value={filters.assignedTo}
          onToggle={id => toggle('assignedTo', id)}
          onClear={() => set('assignedTo', [])}
          searchable={ownerOptions.length > 8}
          searchPlaceholder={t('owner.tasks.filter.searchOwners')}
          t={t}
        />
        <MultiSelect
          label={t('owner.tasks.filter.anyService')}
          options={productOptions}
          value={filters.productId}
          onToggle={id => toggle('productId', id)}
          onClear={() => set('productId', [])}
          searchable={productOptions.length > 8}
          searchPlaceholder={t('owner.tasks.filter.searchServices')}
          t={t}
        />
        <MultiSelect
          label={t('owner.tasks.filter.anyCustomer')}
          options={customerOptions}
          value={filters.customerId}
          onToggle={id => toggle('customerId', id)}
          onClear={() => set('customerId', [])}
          searchable
          searchPlaceholder={t('owner.tasks.filter.searchCustomers')}
          t={t}
        />
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

// Compact multi-select that doubles as a type-ahead picker for long
// lists (customers, services). Closed: shows the placeholder label
// when empty, the only chosen label when one item is selected, or
// "N selected" otherwise. Open: a search input plus a checkbox list
// filtered as you type. Falls back to a no-search list when the
// option count is small enough to scan at a glance.
function MultiSelect({ label, options, value, onToggle, onClear, searchable, searchPlaceholder, t }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const selected = Array.isArray(value) ? value : [];
  const selectedSet = new Set(selected);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);
  useEffect(() => {
    if (open && searchable && inputRef.current) {
      inputRef.current.focus();
    }
    if (!open) setQuery('');
  }, [open, searchable]);

  const summary = (() => {
    if (selected.length === 0) return label;
    if (selected.length === 1) {
      const opt = options.find(o => o.id === selected[0]);
      return opt ? opt.label : `${selected.length} ${t('owner.tasks.filter.selected')}`;
    }
    return `${selected.length} ${t('owner.tasks.filter.selected')}`;
  })();

  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter(o => (o.haystack || o.label.toLowerCase()).includes(q))
    : options;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button type="button"
              onClick={() => setOpen(o => !o)}
              aria-haspopup="listbox"
              aria-expanded={open}
              style={{
                width: '100%', padding: '6px 28px 6px 10px',
                border: '1px solid var(--tax-border)', borderRadius: 6,
                background: '#fff', cursor: 'pointer', textAlign: 'left',
                fontSize: 13, color: 'var(--tax-text)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                position: 'relative', minHeight: 34,
              }}>
        {summary}
        {selected.length > 0 ? (
          <span onClick={(e) => { e.stopPropagation(); onClear(); }}
                role="button" aria-label={t('owner.tasks.filter.clearOne')}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--tax-muted)', fontSize: 16, cursor: 'pointer', lineHeight: 1,
                }}>×</span>
        ) : (
          <span aria-hidden="true" style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--tax-muted)', fontSize: 10, pointerEvents: 'none',
          }}>▼</span>
        )}
      </button>
      {open && (
        <div role="listbox"
             style={{
               position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0,
               minWidth: 240,
               maxHeight: 320, display: 'flex', flexDirection: 'column',
               background: '#fff', border: '1px solid var(--tax-border)',
               borderRadius: 6, boxShadow: '0 8px 16px rgba(0,0,0,.08)',
               zIndex: 50,
             }}>
          {searchable && (
            <div style={{ padding: 8, borderBottom: '1px solid var(--tax-border)' }}>
              <input ref={inputRef} type="search" value={query}
                     onChange={e => setQuery(e.target.value)}
                     placeholder={searchPlaceholder || t('owner.tasks.filter.searchPlaceholder')}
                     style={{
                       width: '100%', padding: '6px 8px',
                       border: '1px solid var(--tax-border)', borderRadius: 4,
                       fontSize: 13,
                     }} />
            </div>
          )}
          <MultiSelectOptionList
            filtered={filtered}
            selectedSet={selectedSet}
            onToggle={onToggle}
            t={t}
          />
          {selected.length > 0 && (
            <div style={{ padding: 6, borderTop: '1px solid var(--tax-border)',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--tax-muted)' }}>
                {selected.length} {t('owner.tasks.filter.selected')}
              </span>
              <button type="button" onClick={onClear}
                      style={{ border: 0, background: 'transparent',
                               color: 'var(--tax-brand-primary)', cursor: 'pointer',
                               fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                {t('owner.tasks.filter.clearOne')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Rows are uniform 44px regardless of whether they carry a sub-line
// — virtualized lists need a fixed row height. Below this count we
// just map normally; above it we hand off to react-window so even a
// 5,000-customer practice opens the picker without jank.
const MULTI_SELECT_VIRTUALIZE_THRESHOLD = 60;
const MULTI_SELECT_ROW_HEIGHT = 44;
const MULTI_SELECT_LIST_HEIGHT = 240;

function MultiSelectOptionList({ filtered, selectedSet, onToggle, t }) {
  if (filtered.length === 0) {
    return (
      <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--tax-muted)' }}>
        {t('owner.tasks.filter.noMatch')}
      </div>
    );
  }
  if (filtered.length < MULTI_SELECT_VIRTUALIZE_THRESHOLD) {
    return (
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {filtered.map(o => (
          <MultiSelectRow key={o.id} option={o}
                          checked={selectedSet.has(o.id)} onToggle={onToggle} />
        ))}
      </div>
    );
  }
  // react-window passes `style` (absolute positioning) and `index`
  // — pull the option out of itemData so the row component stays
  // identical to the non-virtual branch.
  const itemData = { filtered, selectedSet, onToggle };
  return (
    <div style={{ flex: 1 }}>
      <FixedSizeList
        height={Math.min(MULTI_SELECT_LIST_HEIGHT, filtered.length * MULTI_SELECT_ROW_HEIGHT)}
        itemCount={filtered.length}
        itemSize={MULTI_SELECT_ROW_HEIGHT}
        itemData={itemData}
        width="100%"
        overscanCount={6}
      >
        {VirtualizedRow}
      </FixedSizeList>
    </div>
  );
}

function VirtualizedRow({ index, style, data }) {
  const o = data.filtered[index];
  return (
    <div style={style}>
      <MultiSelectRow option={o}
                      checked={data.selectedSet.has(o.id)}
                      onToggle={data.onToggle} />
    </div>
  );
}

function MultiSelectRow({ option: o, checked, onToggle }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '8px 12px', cursor: 'pointer', height: MULTI_SELECT_ROW_HEIGHT,
      boxSizing: 'border-box',
      background: checked ? 'color-mix(in srgb, var(--tax-brand-primary) 8%, #fff)' : '#fff',
      borderBottom: '1px solid color-mix(in srgb, var(--tax-border) 60%, transparent)',
    }}>
      <input type="checkbox" checked={checked}
             onChange={() => onToggle(o.id)}
             style={{ marginTop: 2 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, color: 'var(--tax-text)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {o.label}
        </div>
        {o.sub && (
          <div style={{ fontSize: 11, color: 'var(--tax-muted)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {o.sub}
          </div>
        )}
      </div>
    </label>
  );
}

function TaskRow({ task, auth, community, statuses, employees, customerById, employeeById, productById, isAdmin, onEdit, onChange, locale, t }) {
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
  // Phase 4n.47: due-date color treatment shared with Calendar +
  // Kanban. Completed tasks always render neutral — there's no
  // "urgency" once the work is done.
  const thresholds = resolveThresholds(community);
  const urgency = effectiveUrgency(task, thresholds);
  const due = colorOf(urgency, community);
  const prCol = priorityColorOf(task.priority, community);

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
                  {customer.business_name || displayPersonName(customer) || customer.email}
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
              <span>
                <strong>{t('owner.tasks.due')}:</strong>{' '}
                {urgency === 'later' ? (
                  <span style={{ color: 'var(--tax-muted)' }}>{task.due_date}</span>
                ) : (
                  <span style={{
                    padding: '1px 8px', borderRadius: 999,
                    background: due.bg, color: due.fg,
                    fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap',
                  }}>
                    {task.due_date}
                    {urgency === 'overdue' && ` · ${t('owner.tasks.urgency.overdue')}`}
                  </span>
                )}
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
          <button type="button" onClick={onEdit} disabled={busy}
                  className="tax-btn tax-btn--ghost tax-btn--sm"
                  style={{ color: 'var(--tax-brand-primary)', borderColor: 'var(--tax-brand-primary)' }}>
            {t('owner.tasks.edit')}
          </button>
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

// Unified create + edit modal. Customer picker is a typeahead with an
// inline "+ New customer" affordance; picking a customer auto-fills the
// service from the customer's first active relationship (best-effort —
// stays blank if no workflow rule chains to a product).
function TaskFormModal({
  mode, task, auth, community, isAdmin,
  statuses, employees, customers, products, relationshipTypes,
  defaultAssignee, locale, t,
  onCustomersChanged, onClose, onSaved,
}) {
  const isEdit = mode === 'edit';
  const [title, setTitle] = useState(isEdit ? (task.title || '') : '');
  const [customerId, setCustomerId] = useState(isEdit ? (task.customer_id || '') : '');
  const [productId, setProductId] = useState(isEdit ? (task.product_id || '') : '');
  const [productAutoFilledFor, setProductAutoFilledFor] = useState('');
  const [statusKey, setStatusKey] = useState(
    isEdit ? task.status_key : (statuses[0]?.key || 'not_started')
  );
  const [priority, setPriority] = useState(isEdit ? task.priority : 'normal');
  const [assignedTo, setAssignedTo] = useState(
    isEdit ? (task.assigned_employee_id || '') : defaultAssignee
  );
  const [dueDate, setDueDate] = useState(isEdit ? (task.due_date || '') : '');
  const [notes, setNotes] = useState(isEdit ? (task.notes || '') : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showInlineCreate, setShowInlineCreate] = useState(false);
  const [defaultProductHint, setDefaultProductHint] = useState(null);

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

  // When the customer changes, fetch their default product and pre-fill —
  // but only if the user hasn't manually overridden it. We track which
  // customer the auto-fill came from so a later edit to the same customer
  // doesn't stomp a manual choice.
  useEffect(() => {
    if (!customerId) { setDefaultProductHint(null); return; }
    if (productAutoFilledFor === customerId) return;
    taxApi.adminCustomerDefaultProduct(auth, customerId)
      .then(d => {
        setDefaultProductHint(d?.productId ? d : null);
        // Only auto-fill if the field is currently empty. Avoid clobbering
        // the existing selection on an edit-mode open.
        if (d?.productId && !productId) {
          setProductId(d.productId);
          setProductAutoFilledFor(customerId);
        }
      })
      .catch(() => setDefaultProductHint(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const onSave = async (e) => {
    e?.preventDefault?.();
    if (!title.trim()) { setErr(t('owner.tasks.errTitle')); return; }
    setBusy(true); setErr('');
    try {
      const payload = {
        title: title.trim(),
        customerId: customerId || null,
        productId: productId || null,
        statusKey, priority,
        assignedEmployeeId: assignedTo || null,
        dueDate: dueDate || null,
        notes: notes.trim(),
      };
      if (isEdit) {
        await taxApi.adminUpdateTask(auth, task.id, payload);
      } else {
        await taxApi.adminCreateTask(auth, { communitySlug: community.id, ...payload });
      }
      onSaved();
    } catch (e) { setErr(e?.message || ''); }
    finally { setBusy(false); }
  };

  return (
    <div className="tax-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="tax-modal__panel" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <button type="button" className="tax-modal__close"
                onClick={onClose} aria-label={t('preview.close')}>×</button>
        <h3 className="tax-modal__title">
          {isEdit ? t('owner.tasks.editTitle') : t('owner.tasks.add')}
        </h3>
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

          <div>
            <label>{t('owner.tasks.field.customer')}</label>
            <CustomerCombobox
              customers={customers} value={customerId} onChange={setCustomerId}
              isAdmin={isAdmin} onAddNew={() => setShowInlineCreate(true)}
              locale={locale} t={t}
            />
            {defaultProductHint?.relationshipName_i18n && productId === defaultProductHint.productId && (
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--tax-muted)' }}>
                {t('owner.tasks.field.serviceAutoFilled', {
                  relationship: pickI18n(defaultProductHint.relationshipName_i18n, locale).value || ''
                })}
              </p>
            )}
          </div>

          <div className="tax-form__row2">
            <div>
              <label>{t('owner.tasks.field.service')}</label>
              <select value={productId} onChange={e => {
                setProductId(e.target.value);
                setProductAutoFilledFor(customerId);  // mark as user-edited
              }}>
                <option value="">{t('owner.tasks.field.servicePractice')}</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{pickI18n(p.name_i18n, locale).value || p.slug}</option>
                ))}
              </select>
            </div>
            <div>
              <label>{t('owner.tasks.field.owner')}</label>
              <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                <option value="">{t('owner.tasks.field.ownerNone')}</option>
                {employees.map(em => (
                  <option key={em.id} value={em.id}>{displayPersonName(em) || em.email}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="tax-form__row2">
            <div>
              <label>{t('owner.tasks.field.priority')}</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}>
                {PRIORITY_OPTIONS.map(p => (
                  <option key={p} value={p}>{t(`owner.tasks.priority.${p}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label>{t('owner.tasks.field.status')}</label>
              <select value={statusKey} onChange={e => setStatusKey(e.target.value)}>
                {statuses.map(s => (
                  <option key={s.id} value={s.key}>{pickI18n(s.label_i18n, locale).value || s.key}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label>{t('owner.tasks.field.due')}</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>

          <div>
            <label>{t('owner.tasks.field.notes')}</label>
            <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} maxLength={4000} />
          </div>

          {err && <div className="tax-msg tax-msg--error">{err}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="tax-btn tax-btn--primary" disabled={busy}>
              {busy ? t('lead.submitting')
                    : (isEdit ? t('owner.tasks.save') : t('owner.tasks.create'))}
            </button>
            <button type="button" className="tax-btn tax-btn--ghost"
                    onClick={onClose} style={{ color: 'var(--tax-text)' }}>
              {t('preview.close')}
            </button>
          </div>
        </form>
      </div>

      {showInlineCreate && (
        <InlineCustomerCreateModal
          auth={auth} community={community}
          relationshipTypes={relationshipTypes}
          locale={locale} t={t}
          onClose={() => setShowInlineCreate(false)}
          onCreated={(c) => {
            setShowInlineCreate(false);
            onCustomersChanged?.(c);
            setCustomerId(c.id);
          }}
        />
      )}
    </div>
  );
}

// Searchable customer combobox. Renders an input + dropdown; matches
// against name, email, phone. When non-admin or no match, only existing
// customers can be selected. Admins also see a "+ New customer" entry
// at the bottom that opens an inline-create modal.
function CustomerCombobox({ customers, value, onChange, isAdmin, onAddNew, locale, t }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  const selected = customers.find(c => c.id === value) || null;
  const display = selected ? (displayPersonName(selected) || selected.email) : '';

  // Re-seed the visible input when the parent changes value (e.g. inline-
  // create just picked a new customer).
  useEffect(() => { if (!open) setQuery(''); }, [value, open]);

  const filtered = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers.slice(0, 20);
    return customers.filter(c => {
      const hay = `${c.business_name || ''} ${c.name || ''} ${c.first_name || ''} ${c.last_name || ''} ${c.email || ''} ${c.phone || ''}`.toLowerCase();
      return hay.includes(q);
    }).slice(0, 30);
  })();

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef} type="text"
        value={open ? query : display}
        onFocus={() => setOpen(true)}
        onChange={e => { setOpen(true); setQuery(e.target.value); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={t('owner.tasks.field.customerSearch')}
        autoComplete="off"
      />
      {value && !open && (
        <button type="button"
                onClick={() => { onChange(''); setQuery(''); inputRef.current?.focus(); }}
                aria-label={t('owner.tasks.field.customerClear')}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  border: 0, background: 'transparent', cursor: 'pointer',
                  fontSize: 18, color: 'var(--tax-muted)', lineHeight: 1,
                }}>×</button>
      )}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0,
          maxHeight: 280, overflowY: 'auto',
          background: '#fff', border: '1px solid var(--tax-border)',
          borderRadius: 6, boxShadow: '0 8px 16px rgba(0,0,0,.08)',
          zIndex: 50,
        }}>
          <button type="button" onMouseDown={e => { e.preventDefault(); onChange(''); setOpen(false); }}
                  style={comboItemStyle(value === '')}>
            <span style={{ color: 'var(--tax-muted)' }}>
              {t('owner.tasks.field.customerNone')}
            </span>
          </button>
          {filtered.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--tax-muted)' }}>
              {t('owner.tasks.field.customerNoMatch')}
            </div>
          )}
          {filtered.map(c => {
            const name = displayPersonName(c) || c.email;
            // When the customer is a business, surface the contact
            // person on the second line so the picker still shows
            // both names — useful for "Acme LLC (John Smith)".
            const contact = c.business_name
              ? [c.first_name, c.last_name].filter(Boolean).join(' ').trim()
              : '';
            return (
              <button key={c.id} type="button"
                      onMouseDown={e => { e.preventDefault(); onChange(c.id); setOpen(false); }}
                      style={comboItemStyle(value === c.id)}>
                <div style={{ fontWeight: 500 }}>{name}</div>
                <div style={{ fontSize: 11, color: 'var(--tax-muted)' }}>
                  {contact ? `${contact} · ` : ''}{c.email}{c.phone ? ` · ${c.phone}` : ''}
                </div>
              </button>
            );
          })}
          {isAdmin && (
            <button type="button" onMouseDown={e => { e.preventDefault(); onAddNew(); setOpen(false); }}
                    style={{
                      ...comboItemStyle(false),
                      borderTop: '1px solid var(--tax-border)',
                      color: 'var(--tax-brand-primary)', fontWeight: 600,
                    }}>
              + {t('owner.tasks.field.customerCreate')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function comboItemStyle(active) {
  return {
    display: 'block', width: '100%', textAlign: 'left',
    padding: '8px 12px', border: 0, cursor: 'pointer',
    background: active ? 'color-mix(in srgb, var(--tax-brand-primary) 10%, #fff)' : 'transparent',
    fontSize: 13,
  };
}

// Lightweight inline customer-create. Asks for the minimum the welcome-
// email path needs (email, name) plus the first relationship type so the
// "default service" lookup has something to chain on after creation.
function InlineCustomerCreateModal({ auth, community, relationshipTypes, locale, t, onClose, onCreated }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [relTypeId, setRelTypeId] = useState('');
  const [sendWelcome, setSendWelcome] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onSubmit = async (e) => {
    e?.preventDefault?.();
    if (!email.trim() || !firstName.trim()) {
      setErr(t('owner.tasks.customerCreateErr')); return;
    }
    setBusy(true); setErr('');
    try {
      const resp = await taxApi.adminCreateCustomer(auth, {
        communitySlug: community.id,
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        businessName: businessName.trim(),
        phone: phone.trim(),
        locale,
        relationshipTypeIds: relTypeId ? [relTypeId] : [],
        sendWelcomeEmail: sendWelcome,
      });
      const relRows = relTypeId ? [{
        relationship_type_id: relTypeId, active: true,
        type: relationshipTypes.find(r => r.id === relTypeId) || null,
      }] : [];
      onCreated({
        id: resp.id, email: email.trim(),
        first_name: firstName.trim(), last_name: lastName.trim(),
        business_name: businessName.trim(),
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        phone: phone.trim(), locale, status: 'active',
        relationships: relRows,
      });
    } catch (e) { setErr(e?.message || ''); }
    finally { setBusy(false); }
  };

  return (
    <div className="tax-modal" role="dialog" aria-modal="true"
         onClick={onClose}
         style={{ zIndex: 60 }}>
      <div className="tax-modal__panel" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <button type="button" className="tax-modal__close"
                onClick={onClose} aria-label={t('preview.close')}>×</button>
        <h3 className="tax-modal__title">{t('owner.tasks.field.customerCreate')}</h3>
        <form onSubmit={onSubmit} className="tax-form" style={{ boxShadow: 'none', padding: 0, border: 0 }}>
          <div>
            <label>{t('owner.tasks.field.businessName')}</label>
            <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)}
                   maxLength={200}
                   placeholder={t('owner.tasks.field.businessNamePlaceholder')} />
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--tax-muted)' }}>
              {t('owner.tasks.field.businessNameHint')}
            </p>
          </div>
          <div className="tax-form__row2">
            <div>
              <label>{t('owner.tasks.field.firstName')}</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                     maxLength={200} required autoFocus />
            </div>
            <div>
              <label>{t('owner.tasks.field.lastName')}</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} maxLength={200} />
            </div>
          </div>
          <div className="tax-form__row2">
            <div>
              <label>{t('owner.tasks.field.emailLabel')}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                     maxLength={200} required />
            </div>
            <div>
              <label>{t('owner.tasks.field.phoneLabel')}</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} maxLength={50} />
            </div>
          </div>
          {relationshipTypes.length > 0 && (
            <div>
              <label>{t('owner.tasks.field.relationship')}</label>
              <select value={relTypeId} onChange={e => setRelTypeId(e.target.value)}>
                <option value="">{t('owner.tasks.field.relationshipNone')}</option>
                {relationshipTypes.map(rt => (
                  <option key={rt.id} value={rt.id}>{pickI18n(rt.name_i18n, locale).value || rt.slug}</option>
                ))}
              </select>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--tax-muted)' }}>
                {t('owner.tasks.field.relationshipHint')}
              </p>
            </div>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={sendWelcome} onChange={e => setSendWelcome(e.target.checked)} />
            {t('owner.tasks.field.sendWelcome')}
          </label>

          {err && <div className="tax-msg tax-msg--error">{err}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="tax-btn tax-btn--primary" disabled={busy}>
              {busy ? t('lead.submitting') : t('owner.tasks.customerCreateBtn')}
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

// ─── Toolbar: My-tasks toggle + due chips + view-mode + group-by ─────────
function TaskToolbar({ mine, setMine, filters, setFilters, view, setView, groupBy, setGroupBy, sortKey, setSortKey, t }) {
  const DUE_CHIPS = [
    { key: '',         label: t('owner.tasks.chip.all') },
    { key: 'overdue',  label: t('owner.tasks.chip.overdue') },
    { key: 'today',    label: t('owner.tasks.chip.today') },
    { key: 'week',     label: t('owner.tasks.chip.week7') },
    { key: 'month',    label: t('owner.tasks.chip.month30') },
    { key: 'month60',  label: t('owner.tasks.chip.month60') },
    { key: 'month90',  label: t('owner.tasks.chip.month90') },
  ];
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
      padding: 10, marginBottom: 10, background: 'var(--tax-bg-alt)', borderRadius: 8,
    }}>
      <Pill active={mine} onClick={() => setMine(m => !m)}>
        👤 {t('owner.tasks.chip.mine')}
      </Pill>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {DUE_CHIPS.map(c => (
          <Pill key={c.key || 'all'} active={filters.due === c.key}
                onClick={() => setFilters(prev => ({ ...prev, due: c.key }))}>
            {c.label}
          </Pill>
        ))}
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
        {view === 'list' && (
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
            <span style={{ color: 'var(--tax-muted)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700 }}>
              {t('owner.tasks.groupBy.label')}
            </span>
            <select value={groupBy} onChange={e => setGroupBy(e.target.value)}
                    style={{ padding: '4px 6px', border: '1px solid var(--tax-border)', borderRadius: 6, fontSize: 12 }}>
              <option value="none">{t('owner.tasks.groupBy.none')}</option>
              <option value="employee">{t('owner.tasks.groupBy.employee')}</option>
              <option value="service">{t('owner.tasks.groupBy.service')}</option>
              <option value="customer">{t('owner.tasks.groupBy.customer')}</option>
              <option value="dueBucket">{t('owner.tasks.groupBy.dueBucket')}</option>
            </select>
          </label>
        )}
        {view === 'list' && (
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
            <span style={{ color: 'var(--tax-muted)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700 }}>
              {t('owner.tasks.sort.label')}
            </span>
            <select value={sortKey} onChange={e => setSortKey(e.target.value)}
                    style={{ padding: '4px 6px', border: '1px solid var(--tax-border)', borderRadius: 6, fontSize: 12 }}>
              <option value="dueAsc">{t('owner.tasks.sort.dueAsc')}</option>
              <option value="dueDesc">{t('owner.tasks.sort.dueDesc')}</option>
              <option value="priority">{t('owner.tasks.sort.priority')}</option>
              <option value="createdDesc">{t('owner.tasks.sort.createdDesc')}</option>
              <option value="createdAsc">{t('owner.tasks.sort.createdAsc')}</option>
            </select>
          </label>
        )}
        <div role="tablist" style={{
          display: 'inline-flex', border: '1px solid var(--tax-border)', borderRadius: 6, overflow: 'hidden',
        }}>
          {['list', 'calendar', 'kanban'].map(v => (
            <button key={v} type="button" onClick={() => setView(v)}
                    style={{
                      padding: '6px 10px', border: 0, cursor: 'pointer',
                      background: view === v
                        ? 'color-mix(in srgb, var(--tax-brand-primary) 12%, #fff)'
                        : '#fff',
                      color: view === v ? 'var(--tax-brand-primary)' : 'var(--tax-text)',
                      fontWeight: view === v ? 700 : 500, fontSize: 12,
                    }}>
              {t(`owner.tasks.view.${v}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
function Pill({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
            style={{
              padding: '4px 12px', borderRadius: 999,
              border: '1px solid',
              borderColor: active
                ? 'color-mix(in srgb, var(--tax-brand-primary) 35%, #fff)'
                : 'var(--tax-border)',
              background: active
                ? 'color-mix(in srgb, var(--tax-brand-primary) 12%, #fff)'
                : '#fff',
              color: active ? 'var(--tax-brand-primary)' : 'var(--tax-text)',
              fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer',
            }}>
      {children}
    </button>
  );
}

// ─── Due-pill shared across views ────────────────────────────────────────
function DuePill({ dueDate, thresholds, t }) {
  if (!dueDate) return null;
  const u = urgencyOf(dueDate, thresholds);
  const c = colorOf(u);
  return (
    <span style={{
      padding: '1px 8px', borderRadius: 999,
      background: c.bg, color: c.fg,
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {dueDate}
    </span>
  );
}

// ─── Grouped list view ───────────────────────────────────────────────────
function TasksGroupedList({ tasks, groupBy, community, statuses, employees,
                            customerById, employeeById, productById, isAdmin,
                            auth, onEdit, onChange, locale, t }) {
  if (groupBy === 'none') {
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        {tasks.map(task => (
          <TaskRow key={task.id} task={task} auth={auth} community={community}
                   statuses={statuses} employees={employees}
                   customerById={customerById} employeeById={employeeById}
                   productById={productById} isAdmin={isAdmin}
                   onEdit={() => onEdit(task)}
                   onChange={onChange} locale={locale} t={t} />
        ))}
      </div>
    );
  }

  const thresholds = resolveThresholds(community);
  const today = new Date().toISOString().slice(0, 10);
  const groups = new Map();
  const keyFor = (task) => {
    if (groupBy === 'employee') {
      const e = task.assignee || (task.assigned_employee_id ? employeeById.get(task.assigned_employee_id) : null);
      return [e?.id || '__unassigned__', e ? (displayPersonName(e) || e.email) : t('owner.tasks.groupBy.unassigned')];
    }
    if (groupBy === 'service') {
      const p = task.product || (task.product_id ? productById.get(task.product_id) : null);
      return [p?.id || '__none__', p ? (pickI18n(p.name_i18n, locale).value || p.slug) : t('owner.tasks.groupBy.noService')];
    }
    if (groupBy === 'customer') {
      const c = task.customer || (task.customer_id ? customerById.get(task.customer_id) : null);
      return [c?.id || '__none__', c ? (c.business_name || displayPersonName(c) || c.email) : t('owner.tasks.groupBy.practiceWide')];
    }
    if (groupBy === 'dueBucket') {
      const u = effectiveUrgency(task, thresholds, today);
      return [u, t(URGENCY_LABEL_KEY[u])];
    }
    return ['__none__', ''];
  };
  for (const task of tasks) {
    const [key, label] = keyFor(task);
    const slot = groups.get(key) || { label, items: [] };
    slot.items.push(task);
    groups.set(key, slot);
  }

  // Stable ordering — overdue first for dueBucket, alpha for the rest.
  const order = groupBy === 'dueBucket'
    ? ['overdue', 'urgent', 'soon', 'upcoming', 'later']
    : Array.from(groups.keys()).sort((a, b) => {
        if (a === '__unassigned__' || a === '__none__') return 1;
        if (b === '__unassigned__' || b === '__none__') return -1;
        return groups.get(a).label.localeCompare(groups.get(b).label);
      });

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {order.filter(k => groups.has(k)).map(k => {
        const g = groups.get(k);
        return (
          <section key={k}>
            <h3 style={{
              margin: '0 0 8px', fontSize: 13, color: 'var(--tax-muted)',
              textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700,
            }}>
              {g.label} <span style={{ marginLeft: 4, fontWeight: 500 }}>· {g.items.length}</span>
            </h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {g.items.map(task => (
                <TaskRow key={task.id} task={task} auth={auth} community={community}
                         statuses={statuses} employees={employees}
                         customerById={customerById} employeeById={employeeById}
                         productById={productById} isAdmin={isAdmin}
                         onEdit={() => onEdit(task)}
                         onChange={onChange} locale={locale} t={t} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ─── Calendar view ───────────────────────────────────────────────────────
// ─── Hover card shared by Calendar pips and Kanban cards ────────────────
// Wraps a trigger element with a hover-revealed popover that shows the
// fields not visible on the small surface — customer/company, service,
// priority chip, due date, owner, status. ~150ms enter delay so quick
// mouse-drifts across a packed calendar don't flash tooltips. The
// popover sets `pointer-events: none` so it never blocks the
// underlying click/drag handler on the trigger.
function TaskHover({ task, statuses, community, locale, t, children, side = 'below' }) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);
  const show = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), 150);
  };
  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setOpen(false);
  };
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const customer = task.customer;
  const product  = task.product;
  const assignee = task.assignee;
  const status   = (statuses || []).find(s => s.key === task.status_key);
  const thresholds = resolveThresholds(community);
  const urgency = effectiveUrgency(task, thresholds);
  const dueCol  = colorOf(urgency, community);
  const prCol   = priorityColorOf(task.priority, community);

  const posStyle = side === 'right'
    ? { top: 0, left: 'calc(100% + 6px)' }
    : { top: 'calc(100% + 6px)', left: 0 };

  return (
    <span style={{ position: 'relative', display: 'block' }}
          onMouseEnter={show} onMouseLeave={hide}
          onFocus={show} onBlur={hide}>
      {children}
      {open && (
        <div role="tooltip"
             style={{
               position: 'absolute', ...posStyle,
               minWidth: 240, maxWidth: 320, zIndex: 60,
               background: '#fff', border: '1px solid var(--tax-border)',
               borderRadius: 8, boxShadow: '0 12px 24px rgba(0,0,0,.12)',
               padding: '10px 12px', textAlign: 'left',
               pointerEvents: 'none',
             }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, whiteSpace: 'normal', color: 'var(--tax-text)' }}>
            {task.title}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr',
                        columnGap: 8, rowGap: 4, fontSize: 12, color: 'var(--tax-text)' }}>
            <span style={{ color: 'var(--tax-muted)' }}>{t('owner.tasks.customer')}</span>
            <span>{customer
              ? (customer.business_name || displayPersonName(customer) || customer.email)
              : t('owner.tasks.calendar.practiceWide')}</span>
            {product && (
              <>
                <span style={{ color: 'var(--tax-muted)' }}>{t('owner.tasks.service')}</span>
                <span>{pickI18n(product.name_i18n, locale).value || product.slug}</span>
              </>
            )}
            <span style={{ color: 'var(--tax-muted)' }}>{t('owner.tasks.field.priority')}</span>
            <span>
              <span style={{
                display: 'inline-block', padding: '1px 8px', borderRadius: 999,
                background: prCol.bg, color: prCol.fg,
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              }}>{t(`owner.tasks.priority.${task.priority || 'normal'}`)}</span>
            </span>
            {task.due_date && (
              <>
                <span style={{ color: 'var(--tax-muted)' }}>{t('owner.tasks.field.due')}</span>
                <span>
                  <span style={{
                    display: 'inline-block', padding: '1px 8px', borderRadius: 4,
                    background: dueCol.bg, color: dueCol.fg,
                    fontSize: 11, fontWeight: 600,
                  }}>{task.due_date}</span>
                </span>
              </>
            )}
            <span style={{ color: 'var(--tax-muted)' }}>{t('owner.tasks.field.owner')}</span>
            <span>{assignee
              ? (displayPersonName(assignee) || assignee.email)
              : t('owner.tasks.field.ownerNone')}</span>
            {status && (
              <>
                <span style={{ color: 'var(--tax-muted)' }}>{t('owner.tasks.field.status')}</span>
                <span>{pickI18n(status.label_i18n, locale).value || status.key}</span>
              </>
            )}
          </div>
        </div>
      )}
    </span>
  );
}

function TasksCalendar({ tasks, community, statuses, onEdit, locale, t }) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => ({
    year: today.getUTCFullYear(), month: today.getUTCMonth(),
  }));
  const [drawerDate, setDrawerDate] = useState(null);
  const thresholds = resolveThresholds(community);
  const todayIso = new Date().toISOString().slice(0, 10);

  // Bucket tasks by ISO date.
  const byDate = new Map();
  for (const t1 of tasks) {
    if (!t1.due_date) continue;
    const arr = byDate.get(t1.due_date) || [];
    arr.push(t1);
    byDate.set(t1.due_date, arr);
  }

  // Month grid — pad start with prev month so first cell is a Sunday.
  const first = new Date(Date.UTC(cursor.year, cursor.month, 1));
  const dow = first.getUTCDay(); // 0 = Sun
  const start = new Date(first);
  start.setUTCDate(1 - dow);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    cells.push(d);
  }
  const monthName = first.toLocaleDateString(locale === 'es' ? 'es' : 'en', { month: 'long', year: 'numeric' });

  const drawerTasks = drawerDate ? (byDate.get(drawerDate) || []) : [];

  const prev = () => setCursor(c => {
    const m = c.month - 1;
    return m < 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: m };
  });
  const next = () => setCursor(c => {
    const m = c.month + 1;
    return m > 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: m };
  });
  const goToday = () => setCursor({ year: today.getUTCFullYear(), month: today.getUTCMonth() });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <button type="button" onClick={prev} className="tax-btn tax-btn--ghost tax-btn--sm">◀</button>
        <button type="button" onClick={goToday} className="tax-btn tax-btn--ghost tax-btn--sm">
          {t('owner.tasks.calendar.today')}
        </button>
        <button type="button" onClick={next} className="tax-btn tax-btn--ghost tax-btn--sm">▶</button>
        <strong style={{ fontSize: 15, marginLeft: 8 }}>{monthName}</strong>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
        gap: 1, background: 'var(--tax-border)',
        border: '1px solid var(--tax-border)', borderRadius: 8, overflow: 'hidden',
      }}>
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} style={{
            padding: '6px 8px', fontSize: 11, fontWeight: 700, color: 'var(--tax-muted)',
            textTransform: 'uppercase', background: 'var(--tax-bg-alt)',
          }}>{d}</div>
        ))}
        {cells.map(d => {
          const iso = d.toISOString().slice(0, 10);
          const isThisMonth = d.getUTCMonth() === cursor.month;
          const isToday = iso === todayIso;
          const cellTasks = byDate.get(iso) || [];
          return (
            <button key={iso} type="button"
                    onClick={() => setDrawerDate(iso)}
                    style={{
                      minHeight: 96, padding: 6,
                      textAlign: 'left', border: 0, cursor: 'pointer',
                      background: isToday
                        ? 'color-mix(in srgb, var(--tax-brand-primary) 8%, #fff)'
                        : '#fff',
                      opacity: isThisMonth ? 1 : 0.45,
                      display: 'flex', flexDirection: 'column', gap: 3,
                    }}>
              <span style={{
                fontSize: 12, fontWeight: isToday ? 700 : 500,
                color: isToday ? 'var(--tax-brand-primary)' : 'var(--tax-text)',
              }}>{d.getUTCDate()}</span>
              {cellTasks.slice(0, 4).map(tt => {
                const c = colorOf(effectiveUrgency(tt, thresholds, todayIso), community);
                return (
                  <TaskHover key={tt.id} task={tt} statuses={statuses}
                             community={community} locale={locale} t={t}>
                    <span style={{
                      display: 'block',
                      fontSize: 10, padding: '1px 4px', borderRadius: 4,
                      background: c.bg, color: c.fg,
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                    }}>{tt.title}</span>
                  </TaskHover>
                );
              })}
              {cellTasks.length > 4 && (
                <span style={{ fontSize: 10, color: 'var(--tax-muted)' }}>
                  + {cellTasks.length - 4}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {drawerDate && (
        <div className="tax-modal" role="dialog" aria-modal="true" onClick={() => setDrawerDate(null)}>
          <div className="tax-modal__panel" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <button type="button" className="tax-modal__close"
                    onClick={() => setDrawerDate(null)} aria-label={t('preview.close')}>×</button>
            <h3 className="tax-modal__title">
              {t('owner.tasks.calendar.dayTasks', { date: drawerDate })}
            </h3>
            {drawerTasks.length === 0 ? (
              <p style={{ color: 'var(--tax-muted)' }}>{t('owner.tasks.calendar.dayEmpty')}</p>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {drawerTasks.map(tt => (
                  <button key={tt.id} type="button"
                          onClick={() => { onEdit(tt); setDrawerDate(null); }}
                          style={{
                            display: 'block', textAlign: 'left', cursor: 'pointer',
                            padding: '8px 10px', border: '1px solid var(--tax-border)', borderRadius: 6,
                            background: '#fff',
                          }}>
                    <div style={{ fontWeight: 600 }}>{tt.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--tax-muted)' }}>
                      {tt.customer
                        ? (tt.customer.business_name || displayPersonName(tt.customer) || tt.customer.email)
                        : t('owner.tasks.calendar.practiceWide')}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Kanban view (status columns + native drag-and-drop) ─────────────────
function TasksKanban({ tasks, statuses, community, auth, onChange, onEdit, locale, t }) {
  const thresholds = resolveThresholds(community);
  const todayIso = new Date().toISOString().slice(0, 10);
  const cols = statuses.length
    ? statuses.slice().sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    : [{ id: 'fallback', key: 'not_started', label_i18n: { en: 'Not started', es: 'Sin iniciar' } }];
  const tasksByStatus = new Map();
  for (const tt of tasks) {
    const arr = tasksByStatus.get(tt.status_key) || [];
    arr.push(tt);
    tasksByStatus.set(tt.status_key, arr);
  }

  const onDrop = async (e, targetKey) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    const task = tasks.find(tt => tt.id === id);
    if (!task || task.status_key === targetKey) return;
    try {
      await taxApi.adminUpdateTask(auth, id, { statusKey: targetKey });
      onChange();
    } catch (_e) { /* swallow */ }
  };

  return (
    <div style={{
      display: 'grid', gap: 12,
      gridTemplateColumns: `repeat(${cols.length}, minmax(220px, 1fr))`,
      overflowX: 'auto',
    }}>
      {cols.map(col => {
        const items = tasksByStatus.get(col.key) || [];
        return (
          <div key={col.id || col.key}
               onDragOver={e => e.preventDefault()}
               onDrop={e => onDrop(e, col.key)}
               style={{
                 background: 'var(--tax-bg-alt)', borderRadius: 8,
                 padding: 8, minHeight: 200,
                 // Phase 4n.47: each column carries the status's
                 // owner-configured color along its top, so the
                 // Kanban inherits the same color language the chip
                 // uses in the List view.
                 borderTop: `3px solid ${col.color || '#9ca3af'}`,
               }}>
            <div style={{
              padding: '4px 6px 8px', fontSize: 12, fontWeight: 700,
              color: 'var(--tax-muted)', textTransform: 'uppercase', letterSpacing: '.04em',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 10, height: 10, borderRadius: 999,
                  background: col.color || '#9ca3af',
                }} />
                {pickI18n(col.label_i18n, locale).value || col.key}
              </span>
              <span style={{ fontWeight: 500 }}>· {items.length}</span>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {items.map(tt => {
                const c = colorOf(effectiveUrgency(tt, thresholds, todayIso), community);
                const custName = tt.customer
                  ? (tt.customer.business_name || displayPersonName(tt.customer) || tt.customer.email)
                  : '';
                return (
                  <TaskHover key={tt.id} task={tt} statuses={statuses}
                             community={community} locale={locale} t={t}>
                    <button type="button"
                            draggable
                            onDragStart={e => e.dataTransfer.setData('text/plain', tt.id)}
                            onClick={() => onEdit(tt)}
                            style={{
                              display: 'block', width: '100%', textAlign: 'left', cursor: 'grab',
                              padding: '8px 10px',
                              background: '#fff',
                              borderRadius: 6, border: '1px solid var(--tax-border)',
                              borderLeft: `4px solid ${c.bar}`,
                            }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{tt.title}</div>
                      {custName && (
                        <div style={{ fontSize: 11, color: 'var(--tax-muted)', marginTop: 2 }}>
                          {custName}
                        </div>
                      )}
                      {tt.due_date && (
                        <div style={{ marginTop: 4 }}>
                          <DuePill dueDate={tt.due_date} thresholds={thresholds} t={t} />
                        </div>
                      )}
                    </button>
                  </TaskHover>
                );
              })}
              {items.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--tax-muted)', textAlign: 'center', padding: 12 }}>
                  {t('owner.tasks.kanban.empty')}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
