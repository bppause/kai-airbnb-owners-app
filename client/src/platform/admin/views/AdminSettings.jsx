// AdminSettings — the big enchilada. Single ~1,900-line view that
// renders the entire /admin tab: SLA + escalation, mission sections,
// branding, email sender + notification config, role/permission
// matrices (standard menu, delegate defaults, community admin
// defaults, per-user roles), nav config, UI labels, tooltips, email
// templates, audit log, and the multi-community management panel
// (with per-community config overrides, members, mission, tooltips,
// templates).
//
// Lifted byte-identical from App.jsx in stage F34. Pulls lang via
// useApp(); config, user, listings, contactProps, onSave, showToast,
// adminInfo stay per-instance.
//
// Permission constants (DEFAULT_*, MENU_LABELS, PERMISSION_LABELS,
// COMMUNITY_ADMIN_PERMISSION_LABELS) moved alongside this in stage F34
// to core/permissions.js so App.jsx can keep using them in role
// resolution while AdminSettings reads them for the editors.
//
// Future split: each AdminSection block could be hoisted to its own
// sub-component once the shared state surface is mapped — but the
// state graph is dense (~80 useState hooks all mutually referenced)
// so for now the single-file lift is the pragmatic choice.
//
// See docs/PLATFORM_ARCHITECTURE.md §11 frontend stage F34.

import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../../../core/app-state";
import { api } from "../../../core/api";
import { APP_I18N, appText, localizedTooltips, DEFAULT_TOOLTIPS } from "../../../core/i18n/app-text";
import { lt, ui } from "../../../core/i18n";
import { parseMissionSections, normalizeMissionSections, MISSION_EN_DEFAULTS } from "../../../core/i18n/mission";
import { parseJsonObject } from "../../../core/utils";
import { Empty } from "../../../core/ui/EmptyState";
import { copyText, lookupContact } from "../../../core/contacts";
import {
  DEFAULT_STANDARD_MENU_PERMISSIONS,
  DEFAULT_DELEGATE_PERMISSIONS,
  DEFAULT_COMMUNITY_ADMIN_PERMISSIONS,
  COMMUNITY_ADMIN_PERMISSION_LABELS,
  PERMISSION_LABELS,
  MENU_LABELS,
} from "../../../core/permissions";
import AdminSection from "../components/AdminSection";
import NavConfigEditor from "../components/NavConfigEditor";
import CommunityCrudModal from "../components/CommunityCrudModal";
import AuditLogViewer from "../../audit/views/AuditLogViewer";

export default function AdminSettings({ config={}, user, listings=[], contactProps={}, onSave, showToast=()=>{}, adminInfo={} }) {
  const { lang } = useApp();
  const isEn = lang === 'en';
  const tips = localizedTooltips(config || {}, lang);
  const [slaHours,setSlaHours]=useState(config?.sla_hours || '24');
  const [escalationCcEmails,setEscalationCcEmails]=useState(config?.escalation_cc_emails || '');
  const [analyticsEnabled,setAnalyticsEnabled]=useState(String(config?.analytics_enabled || 'false') === 'true');
  const [users,setUsers]=useState([]);
  const [usersLoading,setUsersLoading]=useState(false);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersCommunityFilter, setUsersCommunityFilter] = useState('');
  const [usersCommunityAdminEditing, setUsersCommunityAdminEditing] = useState({});
  const [standardMenuPermissions,setStandardMenuPermissions]=useState(()=>({ ...DEFAULT_STANDARD_MENU_PERMISSIONS }));
  const [defaultDelegatePermissions,setDefaultDelegatePermissions]=useState(()=>({ ...DEFAULT_DELEGATE_PERMISSIONS }));
  const [defaultCommunityAdminPermissions,setDefaultCommunityAdminPermissions]=useState(()=>({ ...DEFAULT_COMMUNITY_ADMIN_PERMISSIONS }));
  const [mission,setMission]=useState(() => parseMissionSections(config || {}));
  const [missionEn,setMissionEn]=useState(()=>{ try{ const v=JSON.parse(config?.mission_sections_en||'{}'); return {...MISSION_EN_DEFAULTS,...(v&&typeof v==='object'?v:{})}; }catch{ return {...MISSION_EN_DEFAULTS}; }});
  const [missionLang,setMissionLang]=useState('es');
  const [tooltipsEs,setTooltipsEs]=useState(() => ({...Object.fromEntries(Object.entries(DEFAULT_TOOLTIPS).map(([k,v])=>[k,v.es])), ...parseJsonObject(config?.tooltips_es,{})}));
  const [tooltipsEn,setTooltipsEn]=useState(() => ({...Object.fromEntries(Object.entries(DEFAULT_TOOLTIPS).map(([k,v])=>[k,v.en])), ...parseJsonObject(config?.tooltips_en,{})}));
  const [uiLabelsEs,setUiLabelsEs]=useState(()=>parseJsonObject(config?.ui_labels_es,{}));
  const [uiLabelsEn,setUiLabelsEn]=useState(()=>parseJsonObject(config?.ui_labels_en,{}));
  const [uiLabelSearch,setUiLabelSearch]=useState('');
  const [uiLabelLang,setUiLabelLang]=useState('es');
  const [uiLabelOpenGroups,setUiLabelOpenGroups]=useState({});
  const toggleUlaGroup = (id) => setUiLabelOpenGroups(s=>({...s,[id]:!s[id]}));
  const [templates,setTemplates]=useState({});
  const [templateVars,setTemplateVars]=useState({});
  const [selectedTemplate,setSelectedTemplate]=useState('incident_new');
  const [templateLang,setTemplateLang]=useState('es-CO');
  const [templateCommunityId,setTemplateCommunityId]=useState('__global__');
  const [tplLoading,setTplLoading]=useState(false);
  const [emailNotifConfig,setEmailNotifConfig]=useState({});
  const [emailNotifLoading,setEmailNotifLoading]=useState(false);
  const [emailNotifSaving,setEmailNotifSaving]=useState(false);
  const [adminErrors,setAdminErrors]=useState([]);
  const [lastUiError,setLastUiError]=useState('');
  const [brandingNameEs,setBrandingNameEs]=useState(config?.complex_name_es||'Propietarios Airbnb KAI');
  const [brandingNameEn,setBrandingNameEn]=useState(config?.complex_name_en||'KAI Airbnb Owners');
  const [brandingLocation,setBrandingLocation]=useState(config?.complex_location||'Serena del Mar · Cartagena 🇨🇴');
  const [brandingLogo,setBrandingLogo]=useState(config?.complex_logo||'');
  const [brandingLogoMode,setBrandingLogoMode]=useState('url');
  const [brandingBg,setBrandingBg]=useState(config?.complex_bg??'/morros-kai-bg.jpg');
  const [brandingBgMode,setBrandingBgMode]=useState('url');
  const [emailFromName,setEmailFromName]=useState(config?.email_from_name||'Propietarios Airbnb KAI');
  const [emailFromAddress,setEmailFromAddress]=useState(config?.email_from_address||'');
  const [emailFromNameEn,setEmailFromNameEn]=useState(config?.email_from_name_en||'KAI Airbnb Owners');
  const [emailFromAddressEn,setEmailFromAddressEn]=useState(config?.email_from_address_en||'');
  // Master switches — emergency kill-switches that halt email/audit subsystems
  // platform-wide. Server-side gates live in core/email.js + core/audit.js.
  const [emailKillSwitch,setEmailKillSwitch]=useState(String(config?.email_kill_switch||'false')==='true');
  const [auditKillSwitch,setAuditKillSwitch]=useState(String(config?.audit_kill_switch||'false')==='true');
  // Per-event-type audit toggles. The JSON in app_config has the form
  // { "incident.create": false, ... } where missing keys default to enabled.
  // We hydrate state with that exact shape; the save function sends the same
  // object back. The list of keys to render in the UI grid comes from the
  // server (adminInfo.auditEventTypes — built from KNOWN_AUDIT_EVENT_TYPES).
  const [auditEventToggles,setAuditEventToggles]=useState(()=>parseJsonObject(config?.audit_event_toggles, {}));
  // Phase 4 — community management state
  const [communityFeatureEnabled, setCommunityFeatureEnabled] = useState(String(config?.community_feature_enabled ?? 'true') !== 'false');
  const [defaultCommunityId, setDefaultCommunityId] = useState(config?.default_community_id || 'kai');
  const [communities, setCommunities] = useState([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(false);
  const [communityModal, setCommunityModal] = useState(null); // null | {mode:'create'|'edit', data:{}}
  const [communityMembersOpen, setCommunityMembersOpen] = useState({});
  const [communityMembers, setCommunityMembers] = useState({});
  const [communityMembersLoading, setCommunityMembersLoading] = useState({});
  const [commMemberSearch, setCommMemberSearch] = useState({});
  const [commMemberOpen, setCommMemberOpen] = useState({});
  const [memberPermsEditing, setMemberPermsEditing] = useState({});  // {cid_uid: permissions obj}
  const [communityConfigData, setCommunityConfigData] = useState({}); // {cid: {globalValues, communityOverrides, overridesEnabled}}
  const [communityConfigLoading, setCommunityConfigLoading] = useState({});
  const [communityConfigOpen, setCommunityConfigOpen] = useState({});
  const [communityConfigDraft, setCommunityConfigDraft] = useState({}); // {cid: {key: value}}
  const [communityOverridesEnabled, setCommunityOverridesEnabled] = useState({}); // {cid: bool}
  const [communityConfigTab, setCommunityConfigTab] = useState({}); // {cid: tabId}
  const [commMissionLang, setCommMissionLang] = useState('es');
  // Community list filter + pagination
  const [commSearchDraft, setCommSearchDraft] = useState('');
  const [commFilter, setCommFilter] = useState({ q:'', city:'', state:'', country:'', active:'' });
  const [commPage, setCommPage] = useState(1);
  const [commTotal, setCommTotal] = useState(0);
  const [commFilterOptions, setCommFilterOptions] = useState({ cities:[], states:[], countries:[] });
  const [communityTplOpen, setCommunityTplOpen] = useState({});
  const [communityTplData, setCommunityTplData] = useState({});
  const [communityTplLoading, setCommunityTplLoading] = useState({});
  const [communityTplLang, setCommunityTplLang] = useState({});
  const [communityTplSelected, setCommunityTplSelected] = useState({});
  const [communityRoutingOpen, setCommunityRoutingOpen] = useState({});
  const [communityRoutingData, setCommunityRoutingData] = useState({});
  const [communityRoutingLoading, setCommunityRoutingLoading] = useState({});
  const [communityRoutingDraft, setCommunityRoutingDraft] = useState({});
  const [adminTab, setAdminTab] = useState(() => adminInfo.isGlobalAdmin ? 'platform' : 'community');
  const [activeCommId, setActiveCommId] = useState(() => {
    if (!adminInfo.isGlobalAdmin && (adminInfo.communityAdminOf||[]).length)
      return adminInfo.communityAdminOf[0].communityId;
    return '';
  });
  const ADMIN_SEC_DEFAULT = {communities:false,branding:false,masterSwitches:false,emailSender:false,roles:true,sla:false,mission:false,menu:false,delegate:false,communityAdminPerms:false,users:true,tooltips:false,uiLabels:false,email:false,emailNotif:false,auditLog:false,commMembers:false,commMission:false,commLabels:false,commTooltips:false,commTpl:false};
  const [openSections,setOpenSections] = useState(()=>{
    try{ const s=JSON.parse(localStorage.getItem('kai_admin_open')||'null'); return s&&typeof s==='object'?{...ADMIN_SEC_DEFAULT,...s}:ADMIN_SEC_DEFAULT; }catch{ return ADMIN_SEC_DEFAULT; }
  });
  const toggleSection = id => setOpenSections(s=>{ const n={...s,[id]:!s[id]}; try{localStorage.setItem('kai_admin_open',JSON.stringify(n))}catch{} return n; });
  const expandAll  = ()=>{ const n=Object.fromEntries(Object.keys(ADMIN_SEC_DEFAULT).map(k=>[k,true]));  setOpenSections(n); try{localStorage.setItem('kai_admin_open',JSON.stringify(n))}catch{}};
  const collapseAll= ()=>{ const n=Object.fromEntries(Object.keys(ADMIN_SEC_DEFAULT).map(k=>[k,false])); setOpenSections(n); try{localStorage.setItem('kai_admin_open',JSON.stringify(n))}catch{}};
  const trace = (...args) => console.log('[KAI_ADMIN]', ...args);
  const captureAdminError = (scope, err) => {
    const msg = err?.message || String(err || 'Unknown error');
    const detail = { scope, message:msg, status:err?.status, url:err?.url, details:err?.details, ts:new Date().toISOString() };
    console.error('[KAI_ADMIN_ERROR]', detail, err);
    setAdminErrors(prev => [detail, ...prev].slice(0,8));
    try { localStorage.setItem('kai_last_admin_error', JSON.stringify(detail, null, 2)); } catch(e) {}
  };
  useEffect(()=>{
    trace('mount/update config', { user:user?.email, lang, config });
    setMission(parseMissionSections(config || {}));
    try{ const v=JSON.parse(config?.mission_sections_en||'{}'); setMissionEn({...MISSION_EN_DEFAULTS,...(v&&typeof v==='object'?v:{})}); }catch{ setMissionEn({...MISSION_EN_DEFAULTS}); }
    setSlaHours(config?.sla_hours || '24');
    setEscalationCcEmails(config?.escalation_cc_emails || '');
    setAnalyticsEnabled(String(config?.analytics_enabled || 'false') === 'true');
    setTooltipsEs({...Object.fromEntries(Object.entries(DEFAULT_TOOLTIPS).map(([k,v])=>[k,v.es])), ...parseJsonObject(config?.tooltips_es,{})});
    setTooltipsEn({...Object.fromEntries(Object.entries(DEFAULT_TOOLTIPS).map(([k,v])=>[k,v.en])), ...parseJsonObject(config?.tooltips_en,{})});
    setUiLabelsEs(parseJsonObject(config?.ui_labels_es,{}));
    setUiLabelsEn(parseJsonObject(config?.ui_labels_en,{}));
    setCommunityFeatureEnabled(String(config?.community_feature_enabled ?? 'true') !== 'false');
    setDefaultCommunityId(config?.default_community_id || 'kai');
    setEmailKillSwitch(String(config?.email_kill_switch || 'false') === 'true');
    setAuditKillSwitch(String(config?.audit_kill_switch || 'false') === 'true');
    setAuditEventToggles(parseJsonObject(config?.audit_event_toggles, {}));
    try { setLastUiError(localStorage.getItem('kai_last_ui_error') || localStorage.getItem('kai_last_admin_error') || ''); } catch(e) {}
  }, [config?.mission_sections_es, config?.mission_sections_en, config?.sla_hours, config?.escalation_cc_emails, config?.analytics_enabled, config?.community_feature_enabled, config?.default_community_id, config?.email_kill_switch, config?.audit_kill_switch, config?.audit_event_toggles, lang, user?.email]);
  const templateEntries = Object.entries((templates && typeof templates==='object') ? templates : {}).filter(([k,v])=>k && v && typeof v==='object');
  const selectedKey = (templates && templates[selectedTemplate]) ? selectedTemplate : (templateEntries[0]?.[0] || '');
  const selected = selectedKey ? (templates[selectedKey] || {}) : {};
  const selectedVars = (templateVars && typeof templateVars==='object' && Array.isArray(templateVars[selectedKey])) ? templateVars[selectedKey] : [];
  const loadTemplates = useCallback(()=>{
    if (!user?.uid) return;
    setTplLoading(true);
    setAdminErrors([]);
    const url = '/api/admin/email-templates?uid=' + encodeURIComponent(user.uid) + '&email=' + encodeURIComponent(user.email || '') + '&language=' + encodeURIComponent(templateLang) + '&communityId=' + encodeURIComponent(templateCommunityId||'__global__');
    trace('loading templates', url);
    api.get(url).then(r => {
      const incoming = (r?.templates && typeof r.templates === 'object') ? r.templates : {};
      setTemplates(incoming);
      setTemplateVars((r?.variables && typeof r.variables === 'object') ? r.variables : {});
      const keys = Object.keys(incoming);
      if (!incoming[selectedTemplate] && keys.length) setSelectedTemplate(keys[0]);
      trace('templates loaded', keys);
    }).catch(e => { captureAdminError('email-templates', e); showToast(lt(lang,'Error cargando plantillas de email') + ': ' + (e.message || ''), true); }).finally(()=>setTplLoading(false));
  }, [user?.uid, user?.email, selectedTemplate, lang, templateLang, templateCommunityId]);
  useEffect(()=>{ loadTemplates(); }, [loadTemplates]);
  const loadEmailNotifConfig = useCallback(()=>{
    if(!user?.uid) return;
    setEmailNotifLoading(true);
    api.get('/api/admin/email-notification-config?uid='+encodeURIComponent(user.uid)+'&email='+encodeURIComponent(user.email||''))
      .then(r=>{ if(r?.config && typeof r.config==='object') setEmailNotifConfig(r.config); })
      .catch(e=>captureAdminError('email-notif-config',e))
      .finally(()=>setEmailNotifLoading(false));
  },[user?.uid,user?.email]);
  useEffect(()=>{ loadEmailNotifConfig(); },[loadEmailNotifConfig]);
  const saveEmailNotifConfig = async () => {
    setEmailNotifSaving(true);
    try {
      const r = await api.put('/api/admin/email-notification-config',{ actorUid:user.uid, actorEmail:user.email, config:emailNotifConfig });
      if(r?.config) setEmailNotifConfig(r.config);
      showToast('✅ '+lt(lang,'Configuración de notificaciones guardada'));
    } catch(e) { captureAdminError('save-email-notif-config',e); showToast(lt(lang,'Error guardando')+': '+(e.message||''),true); }
    finally { setEmailNotifSaving(false); }
  };
  const loadUsers = useCallback(()=>{
    if(!user?.uid) return;
    setUsersLoading(true);
    const url = '/api/admin/users?uid=' + encodeURIComponent(user.uid) + '&email=' + encodeURIComponent(user.email || '');
    trace('loading users', url);
    api.get(url).then(r=>{
      const rows = Array.isArray(r?.users) ? r.users : [];
      setUsers(rows);
      if (r?.standardMenuPermissions) setStandardMenuPermissions({ ...DEFAULT_STANDARD_MENU_PERMISSIONS, ...r.standardMenuPermissions });
      if (r?.defaultDelegatePermissions) setDefaultDelegatePermissions({ ...DEFAULT_DELEGATE_PERMISSIONS, ...r.defaultDelegatePermissions });
      if (r?.defaultCommunityAdminPermissions) setDefaultCommunityAdminPermissions({ ...DEFAULT_COMMUNITY_ADMIN_PERMISSIONS, ...r.defaultCommunityAdminPermissions });
      trace('users loaded', rows.length);
    }).catch(e=>{ captureAdminError('admin-users', e); showToast(lt(lang,'Error cargando usuarios') + ': ' + (e.message||''), true); }).finally(()=>setUsersLoading(false));
  }, [user?.uid, user?.email, lang]);
  useEffect(()=>{ loadUsers(); }, [loadUsers]);
  const updateUserRole = async (u, role) => {
    try {
      await api.post('/api/admin/delegate', { actorUid:user.uid, actorEmail:user.email, uid:u.uid, email:u.email, name:u.name, role, permissions: u.permissions || DEFAULT_DELEGATE_PERMISSIONS });
      showToast(role === 'delegate_admin' ? '✅ Usuario delegado para aprobar registros' : role === 'global_admin' ? '✅ Usuario promovido a administrador global' : '✅ Delegación removida');
      loadUsers();
    } catch(e) { captureAdminError('update-user-role', e); showToast(lt(lang,'Error actualizando delegado') + ': ' + (e.message||''), true); }
  };
  const toggleUserCommunityAdmin = async (u, cid, makeAdmin) => {
    try {
      if (makeAdmin) {
        await api.post(`/api/communities/${cid}/members/${u.uid}/promote`, { actorUid:user.uid, actorEmail:user.email, userEmail:u.email });
      } else {
        await api.del(`/api/communities/${cid}/members/${u.uid}/promote`, { actorUid:user.uid, actorEmail:user.email });
      }
      showToast(makeAdmin ? (isEn?'✅ Community admin added':'✅ Admin de comunidad asignado') : (isEn?'✅ Community admin removed':'✅ Admin de comunidad removido'));
      loadUsers();
    } catch(e) { showToast((e.message||String(e)), true); }
  };
  const updateTpl = (field, value) => { if(!selectedKey) return; setTemplates(t => ({...(t||{}), [selectedKey]: {...((t||{})[selectedKey]||{}), [field]:value}})); };
  const saveTemplates = async () => {
    try {
      const r = await api.put('/api/admin/email-templates', { actorUid:user.uid, actorEmail:user.email, templates, language:templateLang, communityId:templateCommunityId||'__global__' });
      setTemplates((r && r.templates) || templates);
      showToast('✅ ' + lt(lang,'Plantillas guardadas.'));
    } catch(e) { captureAdminError('save-templates', e); showToast(lt(lang,'Error al guardar plantillas') + ': ' + (e.message || ''), true); }
  };
  const setMissionField = (field, value) => setMission(m => ({...(m||{}), [field]:value}));
  const setMissionCard = (idx, field, value) => setMission(m => ({...(m||{}), cards:((m||{}).cards||[]).map((c,i)=>i===idx?{...c,[field]:value}:c)}));
  const setMissionRule = (group, idx, value) => setMission(m => ({...(m||{}), [group]:((m||{})[group]||[]).map((r,i)=>i===idx?value:r)}));
  const addRule = (group) => setMission(m => ({...(m||{}), [group]:[...(((m||{})[group])||[]), '']}));
  const removeRule = (group, idx) => setMission(m => ({...(m||{}), [group]:(((m||{})[group])||[]).filter((_,i)=>i!==idx)}));
  const setMissionEnField = (field, value) => setMissionEn(m => ({...(m||{}), [field]:value}));
  const setMissionEnCard = (idx, field, value) => setMissionEn(m => ({...(m||{}), cards:((m||{}).cards||[]).map((c,i)=>i===idx?{...c,[field]:value}:c)}));
  const setMissionEnRule = (group, idx, value) => setMissionEn(m => ({...(m||{}), [group]:((m||{})[group]||[]).map((r,i)=>i===idx?value:r)}));
  const addEnRule = (group) => setMissionEn(m => ({...(m||{}), [group]:[...(((m||{})[group])||[]), '']}));
  const removeEnRule = (group, idx) => setMissionEn(m => ({...(m||{}), [group]:(((m||{})[group])||[]).filter((_,i)=>i!==idx)}));
  const saveConfig = () => onSave({slaHours, escalationCcEmails, analyticsEnabled, missionSectionsEs:mission, missionSectionsEn:missionEn, defaultDelegatePermissions, tooltipsEs, tooltipsEn});
  const saveTooltips = () => onSave({ tooltipsEs, tooltipsEn });
  const saveUiLabels = () => onSave({ uiLabelsEs, uiLabelsEn });
  const saveCommunitySection = async (cid, keys) => {
    try {
      const draft = communityConfigDraft[cid] || {};
      const overrides = {};
      keys.forEach(k => { if (k in draft) overrides[k] = draft[k]; });
      await api.put(`/api/communities/${cid}/config`, { actorUid:user.uid, actorEmail:user.email, overrides });
      showToast(isEn?'✅ Community settings saved':'✅ Configuración de comunidad guardada');
      loadCommunityConfig(cid);
    } catch(e) { showToast((e.message||String(e)), true); }
  };
  const saveBranding = () => onSave({ complexNameEs:brandingNameEs, complexNameEn:brandingNameEn, complexLocation:brandingLocation, complexLogo:brandingLogo, complexBg:brandingBg });
  const saveEmailSender = () => { if (!emailFromAddress.trim() || !emailFromAddressEn.trim()) { showToast(isEn?'Both email addresses are required':'Ambos emails son requeridos', true); return; } onSave({ emailFromName, emailFromAddress, emailFromNameEn, emailFromAddressEn }); };
  // Master switches save — values stored as strings in app_config so the
  // server can read them with String(cfg.x||'false')==='true' without JSON.parse.
  const saveMasterSwitches = () => onSave({
    emailKillSwitch:String(emailKillSwitch),
    auditKillSwitch:String(auditKillSwitch),
    auditEventToggles, // posted as a plain object; server JSON.stringifies
  });
  // Helper for the per-event grid: setting `enabled=true` means "remove the
  // override" (back to the implicit-enabled default), keeping the JSON small.
  const setAuditEventEnabled = (eventKey, enabled) => setAuditEventToggles(prev => {
    const next = { ...prev };
    if (enabled) delete next[eventKey];
    else next[eventKey] = false;
    return next;
  });
  const toggleMenuPermission = (key) => setStandardMenuPermissions(p => ({ ...p, [key]: key === 'dashboard' ? true : !p[key] }));
  const toggleDefaultDelegatePermission = (key) => setDefaultDelegatePermissions(p => ({ ...p, [key]: !p[key] }));
  const toggleDefaultCommunityAdminPermission = (key) => setDefaultCommunityAdminPermissions(p => ({ ...p, [key]: !p[key] }));
  const saveStandardMenuPermissions = async () => {
    try { await api.put('/api/admin/config', { actorUid:user.uid, actorEmail:user.email, standardMenuPermissions }); showToast('✅ ' + lt(lang,'Permisos guardados')); }
    catch(e) { showToast((e.message || String(e)), true); }
  };
  const setUserPermission = (idx, key, val) => setUsers(prev => prev.map((u,i)=> i===idx ? ({...u, permissions:{...(u.permissions||{}), [key]:val}}) : u));
  const saveDefaultDelegatePermissions = async () => {
    try { await api.put('/api/admin/config', { actorUid:user.uid, actorEmail:user.email, defaultDelegatePermissions }); showToast('✅ ' + lt(lang,'Permisos predeterminados guardados')); }
    catch(e) { showToast((e.message || String(e)), true); }
  };
  const saveDefaultCommunityAdminPermissions = async () => {
    try { await api.put('/api/admin/config', { actorUid:user.uid, actorEmail:user.email, communityAdminDefaultPermissions: defaultCommunityAdminPermissions }); showToast('✅ ' + (isEn?'Community admin defaults saved':'Permisos predeterminados de admin de comunidad guardados')); }
    catch(e) { showToast((e.message || String(e)), true); }
  };
  const saveUserPermissions = async (u) => {
    const permsToSave = u.role === 'delegate_admin' ? defaultDelegatePermissions : (u.permissions || DEFAULT_DELEGATE_PERMISSIONS);
    try { await api.post('/api/admin/delegate', { actorUid:user.uid, actorEmail:user.email, uid:u.uid, email:u.email, name:u.name, role:u.role || 'user', permissions:permsToSave }); showToast('✅ ' + lt(lang,'Permisos guardados')); await loadUsers(); }
    catch(e) { showToast((e.message || String(e)), true); }
  };
  const clearSavedErrors = () => { try { localStorage.removeItem('kai_last_ui_error'); localStorage.removeItem('kai_last_admin_error'); } catch(e) {} setLastUiError(''); setAdminErrors([]); };

  // ── Community CRUD ────────────────────────────────────────────────────────
  const loadCommunities = useCallback(() => {
    if (!user?.uid) return;
    setCommunitiesLoading(true);
    const params = new URLSearchParams({ uid:user.uid, email:user.email||'', ...commFilter, page:commPage, limit:20 });
    api.get('/api/admin/communities?' + params.toString())
      .then(r => {
        const list = Array.isArray(r?.communities) ? r.communities : [];
        setCommunities(list);
        setCommTotal(r?.total ?? list.length);
        setCommunityConfigData(prev => {
          const next = { ...prev };
          list.forEach(c => {
            if (!next[c.id]) next[c.id] = { overridesEnabled: !!c.overridesEnabled };
            else if (next[c.id].overridesEnabled === undefined) next[c.id] = { ...next[c.id], overridesEnabled: !!c.overridesEnabled };
          });
          return next;
        });
        setCommunityOverridesEnabled(prev => {
          const next = { ...prev };
          list.forEach(c => { if (next[c.id] === undefined) next[c.id] = !!c.overridesEnabled; });
          return next;
        });
      })
      .catch(e => captureAdminError('communities', e))
      .finally(() => setCommunitiesLoading(false));
  }, [user?.uid, user?.email, commFilter, commPage]);

  const loadCommFilterOptions = useCallback(() => {
    if (!user?.uid) return;
    const qs = '?uid=' + encodeURIComponent(user.uid) + '&email=' + encodeURIComponent(user.email||'');
    api.get('/api/admin/communities/filter-options' + qs)
      .then(r => setCommFilterOptions(r || { cities:[], states:[], countries:[] }))
      .catch(() => {});
  }, [user?.uid, user?.email]);

  // Debounce search input → commFilter.q
  useEffect(() => {
    const t = setTimeout(() => { setCommFilter(p => ({...p, q:commSearchDraft})); setCommPage(1); }, 400);
    return () => clearTimeout(t);
  }, [commSearchDraft]);

  useEffect(() => { if (openSections.communities) { loadCommunities(); loadCommFilterOptions(); } }, [openSections.communities, loadCommunities, loadCommFilterOptions]);

  const loadCommunityMembers = async (cid) => {
    setCommunityMembersLoading(p => ({...p,[cid]:true}));
    try {
      const r = await api.get(`/api/communities/${cid}/members?uid=${encodeURIComponent(user.uid)}&email=${encodeURIComponent(user.email||'')}`);
      setCommunityMembers(p => ({...p,[cid]: Array.isArray(r?.members)?r.members:[]}));
    } catch(e) { captureAdminError('community-members', e); }
    finally { setCommunityMembersLoading(p => ({...p,[cid]:false})); }
  };

  const toggleCommunityMembers = (cid) => {
    const opening = !communityMembersOpen[cid];
    setCommunityMembersOpen(p => ({...p,[cid]:opening}));
    if (opening && !communityMembers[cid]) loadCommunityMembers(cid);
  };

  const loadCommunityConfig = async (cid) => {
    setCommunityConfigLoading(p => ({...p,[cid]:true}));
    try {
      const r = await api.get(`/api/communities/${cid}/config?uid=${encodeURIComponent(user.uid)}&email=${encodeURIComponent(user.email||'')}`);
      setCommunityConfigData(p => ({...p,[cid]:r}));
      setCommunityOverridesEnabled(p => ({...p,[cid]:r.overridesEnabled}));
      setCommunityConfigDraft(p => ({...p,[cid]:{...(r.communityOverrides||{})}}));
    } catch(e) { captureAdminError('load-community-config', e); }
    finally { setCommunityConfigLoading(p => ({...p,[cid]:false})); }
  };

  const saveCommunityConfig = async (cid) => {
    try {
      await api.put(`/api/communities/${cid}/config`, { actorUid:user.uid, actorEmail:user.email, overrides: communityConfigDraft[cid]||{} });
      showToast(isEn?'✅ Community settings saved':'✅ Configuración de comunidad guardada');
      loadCommunityConfig(cid);
    } catch(e) { captureAdminError('save-community-config', e); showToast(e.message||String(e), true); }
  };

  const toggleCommunityOverrides = async (cid, enabled) => {
    try {
      await api.put(`/api/communities/${cid}/config/overrides-enabled`, { actorUid:user.uid, actorEmail:user.email, enabled });
      showToast(isEn ? (enabled?'✅ Community overrides enabled':'✅ Community overrides disabled') : (enabled?'✅ Overrides habilitados':'✅ Overrides deshabilitados'));
      setCommunityOverridesEnabled(p => ({...p,[cid]:enabled}));
      loadCommunityConfig(cid);
    } catch(e) { captureAdminError('toggle-community-overrides', e); showToast(e.message||String(e), true); }
  };

  const loadCommunityTemplates = async (cid, lang) => {
    const l = lang || communityTplLang[cid] || 'es-CO';
    setCommunityTplLoading(p => ({...p,[cid]:true}));
    try {
      const r = await api.get(`/api/admin/email-templates?uid=${encodeURIComponent(user.uid)}&email=${encodeURIComponent(user.email||'')}&language=${encodeURIComponent(l)}&communityId=${encodeURIComponent(cid)}`);
      setCommunityTplData(p => ({...p,[cid]:r}));
      const keys = Object.keys(r?.templates||{});
      if (!communityTplSelected[cid] && keys.length) setCommunityTplSelected(p => ({...p,[cid]:keys[0]}));
    } catch(e) { captureAdminError('load-community-templates', e); showToast((e.message||String(e)), true); }
    finally { setCommunityTplLoading(p => ({...p,[cid]:false})); }
  };

  const saveCommunityTemplates = async (cid) => {
    const tplD = communityTplData[cid];
    if (!tplD?.templates) return;
    try {
      const r = await api.put('/api/admin/email-templates', { actorUid:user.uid, actorEmail:user.email, templates:tplD.templates, language:communityTplLang[cid]||'es-CO', communityId:cid });
      setCommunityTplData(p => ({...p,[cid]:{...(p[cid]||{}), templates:r.templates||tplD.templates}}));
      showToast(isEn?'✅ Community templates saved':'✅ Plantillas de comunidad guardadas');
    } catch(e) { captureAdminError('save-community-templates', e); showToast((e.message||String(e)), true); }
  };

  const loadCommunityRouting = async (cid) => {
    setCommunityRoutingLoading(p => ({...p,[cid]:true}));
    try {
      const r = await api.get(`/api/communities/${cid}/email-routing?uid=${encodeURIComponent(user.uid)}&email=${encodeURIComponent(user.email||'')}`);
      setCommunityRoutingData(p => ({...p,[cid]:r}));
      const draft = {};
      (r.eventKeys||[]).forEach(k => { draft[k] = { cc: ((r.communityRouting||{})[k]?.cc||[]).join(', ') }; });
      setCommunityRoutingDraft(p => ({...p,[cid]:draft}));
    } catch(e) { captureAdminError('load-community-routing', e); showToast((e.message||String(e)), true); }
    finally { setCommunityRoutingLoading(p => ({...p,[cid]:false})); }
  };

  const saveCommunityRouting = async (cid) => {
    const draft = communityRoutingDraft[cid] || {};
    const routing = {};
    Object.entries(draft).forEach(([k, v]) => { if (v?.cc?.trim()) routing[k] = { cc: v.cc.split(',').map(e=>e.trim()).filter(Boolean) }; });
    try {
      const r = await api.put(`/api/communities/${cid}/email-routing`, { actorUid:user.uid, actorEmail:user.email, routing });
      setCommunityRoutingData(p => ({...p,[cid]:{...(p[cid]||{}), communityRouting:r.communityRouting||{}}}));
      showToast(isEn?'✅ Email routing saved':'✅ Enrutamiento de email guardado');
    } catch(e) { captureAdminError('save-community-routing', e); showToast((e.message||String(e)), true); }
  };

  const saveCommunity = async (f) => {
    const isEdit = f.id && communities.some(c => c.id === f.id);
    try {
      if (isEdit) {
        await api.put(`/api/communities/${f.id}`, { actorUid:user.uid, actorEmail:user.email, name:f.name, nameEn:f.nameEn, tower:f.tower, city:f.city, state:f.state, country:f.country, logoUrl:f.logoUrl, backgroundUrl:f.backgroundUrl, description:f.description, descriptionEn:f.descriptionEn, isActive:f.isActive });
        showToast(isEn ? '✅ Community updated' : '✅ Comunidad actualizada');
      } else {
        await api.post('/api/communities', { actorUid:user.uid, actorEmail:user.email, id:f.id, name:f.name, nameEn:f.nameEn, tower:f.tower, city:f.city, state:f.state, country:f.country, logoUrl:f.logoUrl, backgroundUrl:f.backgroundUrl, description:f.description, descriptionEn:f.descriptionEn });
        showToast(isEn ? '✅ Community created' : '✅ Comunidad creada');
      }
      setCommunityModal(null);
      loadCommunities();
    } catch(e) { captureAdminError('save-community', e); showToast((e.message||String(e)), true); throw e; }
  };

  const deleteCommunity = async (cid) => {
    if (!window.confirm(isEn ? `Delete community "${cid}"? This cannot be undone.` : `¿Eliminar la comunidad "${cid}"? No se puede deshacer.`)) return;
    try {
      await api.del(`/api/communities/${cid}`, { actorUid:user.uid, actorEmail:user.email });
      showToast(isEn ? '✅ Community deleted' : '✅ Comunidad eliminada');
      loadCommunities();
    } catch(e) { captureAdminError('delete-community', e); showToast((e.message||String(e)), true); }
  };

  const promoteCommunityAdmin = async (cid, m) => {
    try {
      await api.post(`/api/communities/${cid}/members/${m.userUid}/promote`, { actorUid:user.uid, actorEmail:user.email, userEmail:m.userEmail });
      showToast(isEn?'✅ Promoted to community admin':'✅ Promovido a admin de comunidad');
      loadCommunityMembers(cid);
    } catch(e) { captureAdminError('promote-admin', e); showToast((e.message||String(e)), true); }
  };

  const demoteCommunityAdmin = async (cid, m) => {
    try {
      await api.del(`/api/communities/${cid}/members/${m.userUid}/promote`, { actorUid:user.uid, actorEmail:user.email });
      showToast(isEn?'✅ Admin role removed':'✅ Rol de admin removido');
      loadCommunityMembers(cid);
    } catch(e) { captureAdminError('demote-admin', e); showToast((e.message||String(e)), true); }
  };

  const updateMemberPerms = async (cid, uid, perms) => {
    try {
      await api.patch(`/api/communities/${cid}/members/${uid}/permissions`, { actorUid:user.uid, actorEmail:user.email, permissions:perms });
      showToast(isEn?'✅ Permissions saved':'✅ Permisos guardados');
      setMemberPermsEditing(p => { const n={...p}; delete n[`${cid}_${uid}`]; return n; });
      loadCommunityMembers(cid);
    } catch(e) { captureAdminError('update-member-perms', e); showToast((e.message||String(e)), true); }
  };

  return <div className="fade">
  <div className="ph" style={{flexWrap:'wrap',gap:12,alignItems:'flex-start'}}>
    <div><h1 className="ptitle">⚙️ {lt(lang,'Configuración global')}</h1><p className="psub">{lt(lang,'Solo administradores globales · SLA, copias, misión y plantillas de email')}</p></div>
    <div style={{display:'flex',gap:8,flexShrink:0,alignItems:'center'}}>
      <button className="btn-ghost" style={{minHeight:36,padding:'6px 12px',fontSize:'.8rem'}} onClick={expandAll}>{lang==='en'?'▼ Expand all':'▼ Expandir todo'}</button>
      <button className="btn-ghost" style={{minHeight:36,padding:'6px 12px',fontSize:'.8rem'}} onClick={collapseAll}>{lang==='en'?'▲ Collapse all':'▲ Colapsar todo'}</button>
    </div>
  </div>

  {(adminErrors.length > 0 || lastUiError) && <div className="card" style={{marginBottom:18,borderLeft:'4px solid #d4634a'}}><div className="card-title">🧪 {lt(lang,'Diagnóstico')}</div><p className="psub">{lt(lang,'Ver consola del navegador para más detalles.')}</p>{adminErrors.map((e,i)=><pre key={i} className="codebox" style={{whiteSpace:'pre-wrap',marginTop:8}}>{JSON.stringify(e,null,2)}</pre>)}{lastUiError&&<><div className="section-label" style={{marginTop:12}}>{lt(lang,'Último error de interfaz')}</div><pre className="codebox" style={{whiteSpace:'pre-wrap'}}>{lastUiError}</pre></>}<button className="btn-ghost" onClick={clearSavedErrors}>{lt(lang,'Limpiar error guardado')}</button></div>}

  {/* ── Admin Tab Bar ─────────────────────────────────────────────────── */}
  {adminInfo.isGlobalAdmin && (
    <div style={{display:'flex',gap:0,marginBottom:20,borderBottom:'2px solid #e8f4f8'}}>
      {[
        {id:'platform', icon:'🌐', label: isEn?'Platform Settings':'Configuración de plataforma'},
        {id:'community',icon:'🏢', label: isEn?'Community Settings':'Configuración de comunidad'},
      ].map(t=>(
        <button key={t.id} onClick={()=>{setAdminTab(t.id); if(t.id==='community'&&!communities.length)loadCommunities();}}
          style={{padding:'10px 20px',fontSize:'.85rem',fontWeight:adminTab===t.id?700:500,background:'none',border:'none',
            borderBottom:adminTab===t.id?'2px solid #2F4F3A':'2px solid transparent',
            color:adminTab===t.id?'#2F4F3A':'#6b9ba8',cursor:'pointer',marginBottom:'-2px',transition:'color .15s'}}>
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  )}

  {/* ── Community Tab ─────────────────────────────────────────────────── */}
  {(adminTab==='community' || !adminInfo.isGlobalAdmin) && (() => {
    const commOptions = adminInfo.isGlobalAdmin
      ? communities
      : (adminInfo.communityAdminOf||[]).map(ca=>({id:ca.communityId, name:ca.communityName, name_en:ca.communityNameEn}));
    const commData = activeCommId ? communityConfigData[activeCommId] : null;
    const commDraft = activeCommId ? (communityConfigDraft[activeCommId]||{}) : {};
    const commLoading = activeCommId ? communityConfigLoading[activeCommId] : false;
    const commOverridesOn = !!communityOverridesEnabled[activeCommId];
    const activeCaMembership = adminInfo.isGlobalAdmin ? null : (adminInfo.communityAdminOf||[]).find(ca=>ca.communityId===activeCommId);
    const caPerms = activeCaMembership?.permissions || {};
    const canEditMissionContent = adminInfo.isGlobalAdmin || (commOverridesOn && !!(caPerms.canEditMission ?? true));
    const canEditLabelsContent = adminInfo.isGlobalAdmin || (commOverridesOn && !!(caPerms.canEditUiLabels ?? true));
    const canEditTooltipsContent = adminInfo.isGlobalAdmin || (commOverridesOn && !!(caPerms.canEditTooltips ?? true));

    const getCommVal = (key) => {
      if (!commData) return '';
      return commDraft[key] ?? commData.communityOverrides?.[key] ?? commData.globalValues?.[key] ?? '';
    };
    const setCommVal = (key, val) => {
      if (!activeCommId) return;
      setCommunityConfigDraft(p=>({...p,[activeCommId]:{...(p[activeCommId]||{}),[key]:val}}));
    };
    const hasOverride = (key) => activeCommId && commData && (key in (commData.communityOverrides||{}) || key in commDraft);

    const getCommJsonObj = (jsonKey) => {
      if (!commData) return {};
      const str = commDraft[jsonKey] ?? commData.communityOverrides?.[jsonKey] ?? '';
      try { return JSON.parse(str||'{}'); } catch { return {}; }
    };
    const setCommJsonKey = (jsonKey, subkey, val) => {
      const current = getCommJsonObj(jsonKey);
      const updated = {...current, [subkey]: val};
      if (!val) delete updated[subkey];
      setCommunityConfigDraft(p=>({...p,[activeCommId]:{...(p[activeCommId]||{}),[jsonKey]:JSON.stringify(updated)}}));
    };

    return (
      <div>
        {/* ── Community picker ── */}
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20,padding:'12px 16px',background:'#f0f8fb',borderRadius:10,flexWrap:'wrap'}}>
          <span style={{fontSize:'.82rem',fontWeight:700,color:'#17313a',flexShrink:0}}>
            🏢 {isEn?'Editing community:':'Editando comunidad:'}
          </span>
          {adminInfo.isGlobalAdmin ? (
            <select value={activeCommId}
              onChange={e=>{const cid=e.target.value; setActiveCommId(cid); if(cid&&!communityConfigData[cid])loadCommunityConfig(cid);}}
              style={{padding:'6px 10px',borderRadius:6,border:'1px solid #cce7ee',fontSize:'.82rem',flex:'1 1 200px',maxWidth:320}}>
              <option value="">{isEn?'— Select a community —':'— Selecciona una comunidad —'}</option>
              {commOptions.map(c=><option key={c.id} value={c.id}>{isEn?(c.name_en||c.name):c.name}</option>)}
            </select>
          ) : (
            commOptions.length === 1
              ? <strong style={{fontSize:'.9rem',color:'#17313a'}}>{isEn?(commOptions[0].name_en||commOptions[0].name):commOptions[0].name}</strong>
              : <select value={activeCommId} onChange={e=>{ const cid=e.target.value; setActiveCommId(cid); if(cid&&!communityConfigData[cid])loadCommunityConfig(cid);}}
                  style={{padding:'6px 10px',borderRadius:6,border:'1px solid #cce7ee',fontSize:'.82rem',flex:'1 1 200px',maxWidth:320}}>
                  {commOptions.map(c=><option key={c.id} value={c.id}>{isEn?(c.name_en||c.name):c.name}</option>)}
                </select>
          )}
          {activeCommId && <span style={{fontSize:'.7rem',color:'#8a9fa5',fontStyle:'italic'}}>
            {isEn?'Changes override global defaults for this community only.':'Los cambios sobreescriben los valores globales solo para esta comunidad.'}
          </span>}
        </div>

        {!adminInfo.isGlobalAdmin && (
          <div style={{marginBottom:16,padding:'10px 14px',background:'#f0f8fb',borderRadius:10,fontSize:'.78rem',color:'#2a5a6a',border:'1px solid #cce7ee'}}>
            <div style={{fontWeight:700,marginBottom:4}}>ℹ️ {isEn?'About community settings':'Acerca de la configuración de comunidad'}</div>
            <ul style={{margin:0,paddingLeft:18,lineHeight:1.7}}>
              <li>{isEn?'When community overrides are enabled, members of this community see community-specific mission, labels, and tooltips instead of platform defaults.':'Cuando los overrides de comunidad están habilitados, los miembros de esta comunidad ven la misión, etiquetas y tooltips específicos de la comunidad en lugar de los valores globales.'}</li>
              <li>{isEn?'When disabled, all content falls back to the platform-wide global settings.':'Cuando están deshabilitados, todo el contenido usa la configuración global de la plataforma.'}</li>
              <li>{isEn?'Your permissions determine which sections you can edit.':'Tus permisos determinan qué secciones puedes editar.'}</li>
            </ul>
          </div>
        )}

        {!activeCommId && (
          <div style={{textAlign:'center',padding:'40px 20px',color:'#8a9fa5',fontSize:'.9rem'}}>
            {isEn?'Select a community above to edit its settings.':'Selecciona una comunidad arriba para editar su configuración.'}
          </div>
        )}

        {activeCommId && commLoading && (
          <div style={{textAlign:'center',padding:'20px',color:'#6b9ba8'}}><span className="spinner-sm"/> {isEn?'Loading…':'Cargando…'}</div>
        )}

        {activeCommId && !commLoading && (
          <div>
            {activeCommId && !commLoading && commData && (
              <div style={{marginBottom:16,padding:'10px 14px',borderRadius:8,background:commOverridesOn?'#e8f5ec':'#fff8e1',border:'1px solid',borderColor:commOverridesOn?'#b2dfdb':'#ffe082',fontSize:'.78rem',color:commOverridesOn?'#2F4F3A':'#7a5a00',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                <span style={{flex:1}}>
                  {commOverridesOn
                    ? (isEn?'✅ Community overrides are active — content below is applied to this community.':'✅ Los overrides de comunidad están activos — el contenido aquí aplica a esta comunidad.')
                    : (isEn?'🔒 Community overrides are disabled — all sections are read-only. A global admin must enable overrides from Platform → Communities.':'🔒 Los overrides de comunidad están deshabilitados — todas las secciones son solo lectura. Un admin global debe habilitar los overrides desde Plataforma → Comunidades.')}
                </span>
              </div>
            )}
            {/* ── Mission ── */}
            <AdminSection title={`🌊 ${lt(lang,'Misión y reglas de participación')}`} subtitle={isEn?'Override the community mission shown on the Mission page (Spanish and English).':'Sobreescribe la misión de comunidad mostrada en la página de Misión (español e inglés).'} action={!commOverridesOn?null:<button className="btn-p" style={{minHeight:36,padding:'6px 14px'}} onClick={()=>saveCommunitySection(activeCommId,['mission_sections_es','mission_sections_en'])} disabled={!canEditMissionContent}>💾 {isEn?'Save':'Guardar'}</button>} open={openSections.commMission} onToggle={()=>toggleSection('commMission')}>
              {!canEditMissionContent && <div style={{marginBottom:12,padding:'8px 12px',background:'#fff3e0',borderRadius:8,fontSize:'.78rem',color:'#7a5a00',border:'1px solid #f5c97a'}}>{isEn?(!commOverridesOn?'Content editing is not enabled for this community. Contact your global admin to enable it.':'You do not have permission to edit the mission for this community.'):(!commOverridesOn?'La edición de contenido no está habilitada para esta comunidad. Contacta al administrador global para habilitarla.':'No tienes permiso para editar la misión de esta comunidad.')}</div>}
              {(()=>{
                const getCommMission = () => {
                  const str = commDraft['mission_sections_es'] ?? commData?.communityOverrides?.['mission_sections_es'] ?? '';
                  try { return normalizeMissionSections(JSON.parse(str || '{}')); } catch { return normalizeMissionSections({}); }
                };
                const setCommMissionField = (field, val) => {
                  const m = getCommMission();
                  setCommVal('mission_sections_es', JSON.stringify({...m, [field]: val}));
                };
                const setCommMissionCard = (idx, field, val) => {
                  const m = getCommMission();
                  const cards = m.cards.map((c,i) => i===idx ? {...c, [field]:val} : c);
                  setCommVal('mission_sections_es', JSON.stringify({...m, cards}));
                };
                const setCommMissionRule = (group, idx, val) => {
                  const m = getCommMission();
                  setCommVal('mission_sections_es', JSON.stringify({...m, [group]: m[group].map((r,i) => i===idx ? val : r)}));
                };
                const addCommMissionRule = (group) => {
                  const m = getCommMission();
                  setCommVal('mission_sections_es', JSON.stringify({...m, [group]: [...m[group], '']}));
                };
                const removeCommMissionRule = (group, idx) => {
                  const m = getCommMission();
                  setCommVal('mission_sections_es', JSON.stringify({...m, [group]: m[group].filter((_,i) => i !== idx)}));
                };
                const getCommMissionEn = () => {
                  const str = commDraft['mission_sections_en'] ?? commData?.communityOverrides?.['mission_sections_en'] ?? '';
                  try { const v = JSON.parse(str || '{}'); return {...MISSION_EN_DEFAULTS,...(v&&typeof v==='object'?v:{})}; } catch { return {...MISSION_EN_DEFAULTS}; }
                };
                const setCommMissionEnField = (field, val) => {
                  const m = getCommMissionEn();
                  setCommVal('mission_sections_en', JSON.stringify({...m, [field]: val}));
                };
                const setCommMissionEnCard = (idx, field, val) => {
                  const m = getCommMissionEn();
                  const cards = m.cards.map((c,i) => i===idx ? {...c, [field]:val} : c);
                  setCommVal('mission_sections_en', JSON.stringify({...m, cards}));
                };
                const setCommMissionEnRule = (group, idx, val) => {
                  const m = getCommMissionEn();
                  setCommVal('mission_sections_en', JSON.stringify({...m, [group]: m[group].map((r,i) => i===idx ? val : r)}));
                };
                const addCommMissionEnRule = (group) => {
                  const m = getCommMissionEn();
                  setCommVal('mission_sections_en', JSON.stringify({...m, [group]: [...m[group], '']}));
                };
                const removeCommMissionEnRule = (group, idx) => {
                  const m = getCommMissionEn();
                  setCommVal('mission_sections_en', JSON.stringify({...m, [group]: m[group].filter((_,i) => i !== idx)}));
                };
                const cm = getCommMission();
                const cme = getCommMissionEn();
                return (
                  <div style={!commOverridesOn?{pointerEvents:'none',opacity:0.5,userSelect:'none'}:{}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,flexWrap:'wrap'}}>
                      <div style={{flex:1,padding:'6px 12px',background:'#f0f8fb',borderRadius:8,fontSize:'.76rem',color:'#2a5a6a',border:'1px solid #cce7ee'}}>
                        🌐 = {isEn?'using global value':'usando valor global'} &nbsp;·&nbsp; 🏷️ = {isEn?'community override':'override de comunidad'}
                      </div>
                      <div style={{display:'flex',gap:6}}>
                        <button className={`fchip${commMissionLang==='es'?' fchip-on':''}`} onClick={()=>setCommMissionLang('es')}>🇨🇴 Español</button>
                        <button className={`fchip${commMissionLang==='en'?' fchip-on':''}`} onClick={()=>setCommMissionLang('en')}>🇺🇸 English</button>
                      </div>
                    </div>
                    {commMissionLang==='es' && <>
                    <div className="fg2">
                      {[
                        {field:'title',label:isEn?'Title':'Título',rows:2},
                        {field:'subtitle',label:isEn?'Subtitle':'Subtítulo',rows:2},
                        {field:'heading',label:isEn?'Heading':'Encabezado',rows:2},
                        {field:'body',label:isEn?'Body':'Cuerpo',rows:3},
                      ].map(({field,label,rows})=>(
                        <div key={field} className="fg full">
                          <label style={{display:'flex',alignItems:'center',gap:6}}>
                            {label}
                            {hasOverride('mission_sections_es')
                              ? <span style={{fontSize:'.65rem',background:'#d9b45a22',color:'#7a5a00',padding:'1px 6px',borderRadius:4,fontWeight:600}}>🏷️ {isEn?'community override':'override comunidad'}</span>
                              : <span style={{fontSize:'.65rem',background:'#e8f5ec',color:'#2F4F3A',padding:'1px 6px',borderRadius:4}}>🌐 {isEn?'using global':'usando global'}</span>}
                          </label>
                          <textarea className="admin-textarea" rows={rows} value={cm[field]||''}
                            onChange={e=>setCommMissionField(field,e.target.value)}
                            style={{width:'100%',boxSizing:'border-box'}}/>
                        </div>
                      ))}
                    </div>
                    <div className="card-title" style={{margin:'16px 0 10px'}}>{isEn?'Purpose cards':'Tarjetas de propósito'}</div>
                    {(cm.cards||[]).map((card,i)=>(
                      <div className="fg2" key={i} style={{borderTop:'1px solid rgba(90,105,80,.12)',paddingTop:12,marginTop:8}}>
                        <div className="fg"><label>{isEn?'Icon':'Icono'}</label><input value={card?.icon||''} onChange={e=>setCommMissionCard(i,'icon',e.target.value)}/></div>
                        <div className="fg"><label>{isEn?'Card title':'Título tarjeta'} {i+1}</label><textarea className="admin-textarea" rows={2} value={card?.title||''} onChange={e=>setCommMissionCard(i,'title',e.target.value)}/></div>
                        <div className="fg full"><label>{isEn?'Card text':'Texto tarjeta'} {i+1}</label><textarea rows={2} value={card?.text||''} onChange={e=>setCommMissionCard(i,'text',e.target.value)}/></div>
                      </div>
                    ))}
                    <div className="two-col" style={{marginTop:16}}>
                      <div>
                        <div className="fg"><label>{isEn?'Participation title':'Título reglas de participación'}</label><textarea className="admin-textarea" rows={2} value={cm.participationTitle||''} onChange={e=>setCommMissionField('participationTitle',e.target.value)}/></div>
                        {(cm.participationRules||[]).map((r,i)=>(
                          <div className="fg" key={i}><label>{isEn?'Rule':'Regla'} {i+1}</label>
                            <div style={{display:'flex',gap:8}}><textarea className="admin-textarea flex-grow" rows={2} value={r||''} onChange={e=>setCommMissionRule('participationRules',i,e.target.value)}/><button className="btn-ghost" onClick={()=>removeCommMissionRule('participationRules',i)}>🗑️</button></div>
                          </div>
                        ))}
                        <button className="btn-ghost" onClick={()=>addCommMissionRule('participationRules')}>+ {isEn?'Add rule':'Agregar regla'}</button>
                      </div>
                      <div>
                        <div className="fg"><label>{isEn?'Access title':'Título acceso y responsabilidad'}</label><textarea className="admin-textarea" rows={2} value={cm.accessTitle||''} onChange={e=>setCommMissionField('accessTitle',e.target.value)}/></div>
                        {(cm.accessRules||[]).map((r,i)=>(
                          <div className="fg" key={i}><label>{isEn?'Rule':'Regla'} {i+1}</label>
                            <div style={{display:'flex',gap:8}}><textarea className="admin-textarea flex-grow" rows={2} value={r||''} onChange={e=>setCommMissionRule('accessRules',i,e.target.value)}/><button className="btn-ghost" onClick={()=>removeCommMissionRule('accessRules',i)}>🗑️</button></div>
                          </div>
                        ))}
                        <button className="btn-ghost" onClick={()=>addCommMissionRule('accessRules')}>+ {isEn?'Add rule':'Agregar regla'}</button>
                      </div>
                    </div>
                    </>}
                    {commMissionLang==='en' && <>
                      <div style={{marginBottom:8,fontSize:'.73rem',color:'#6b9ba8'}}>
                        {hasOverride('mission_sections_en')
                          ? <span style={{background:'#d9b45a22',color:'#7a5a00',padding:'2px 8px',borderRadius:4,fontWeight:600}}>🏷️ {isEn?'community override active':'override de comunidad activo'}</span>
                          : <span style={{background:'#e8f5ec',color:'#2F4F3A',padding:'2px 8px',borderRadius:4}}>🌐 {isEn?'using global values':'usando valores globales'}</span>}
                      </div>
                      <div className="fg2">
                        <div className="fg full"><label>Title (EN)</label><textarea className="admin-textarea" rows={2} value={cme.title||''} onChange={e=>setCommMissionEnField('title',e.target.value)}/></div>
                        <div className="fg full"><label>Subtitle (EN)</label><textarea className="admin-textarea" rows={2} value={cme.subtitle||''} onChange={e=>setCommMissionEnField('subtitle',e.target.value)}/></div>
                        <div className="fg"><label>Section label (EN)</label><input value={cme.sectionLabel||''} onChange={e=>setCommMissionEnField('sectionLabel',e.target.value)}/></div>
                        <div className="fg full"><label>Main heading (EN)</label><textarea className="admin-textarea" rows={2} value={cme.heading||''} onChange={e=>setCommMissionEnField('heading',e.target.value)}/></div>
                        <div className="fg full"><label>Main body (EN)</label><textarea rows={3} value={cme.body||''} onChange={e=>setCommMissionEnField('body',e.target.value)}/></div>
                      </div>
                      <div className="card-title" style={{margin:'16px 0 10px'}}>Purpose cards (EN)</div>
                      {(cme.cards||[]).map((c,i)=>(
                        <div className="fg2" key={i} style={{borderTop:'1px solid rgba(90,105,80,.12)',paddingTop:12,marginTop:8}}>
                          <div className="fg"><label>Icon</label><input value={c?.icon||''} onChange={e=>setCommMissionEnCard(i,'icon',e.target.value)}/></div>
                          <div className="fg"><label>Card title {i+1}</label><textarea className="admin-textarea" rows={2} value={c?.title||''} onChange={e=>setCommMissionEnCard(i,'title',e.target.value)}/></div>
                          <div className="fg full"><label>Card text {i+1}</label><textarea rows={2} value={c?.text||''} onChange={e=>setCommMissionEnCard(i,'text',e.target.value)}/></div>
                        </div>
                      ))}
                      <div className="two-col" style={{marginTop:16}}>
                        <div>
                          <div className="fg"><label>Participation title (EN)</label><textarea className="admin-textarea" rows={2} value={cme.participationTitle||''} onChange={e=>setCommMissionEnField('participationTitle',e.target.value)}/></div>
                          {(cme.participationRules||[]).map((r,i)=>(
                            <div className="fg" key={i}><label>Rule {i+1}</label>
                              <div style={{display:'flex',gap:8}}><textarea className="admin-textarea flex-grow" rows={2} value={r||''} onChange={e=>setCommMissionEnRule('participationRules',i,e.target.value)}/><button className="btn-ghost" onClick={()=>removeCommMissionEnRule('participationRules',i)}>🗑️</button></div>
                            </div>
                          ))}
                          <button className="btn-ghost" onClick={()=>addCommMissionEnRule('participationRules')}>+ Add rule</button>
                        </div>
                        <div>
                          <div className="fg"><label>Access title (EN)</label><textarea className="admin-textarea" rows={2} value={cme.accessTitle||''} onChange={e=>setCommMissionEnField('accessTitle',e.target.value)}/></div>
                          {(cme.accessRules||[]).map((r,i)=>(
                            <div className="fg" key={i}><label>Rule {i+1}</label>
                              <div style={{display:'flex',gap:8}}><textarea className="admin-textarea flex-grow" rows={2} value={r||''} onChange={e=>setCommMissionEnRule('accessRules',i,e.target.value)}/><button className="btn-ghost" onClick={()=>removeCommMissionEnRule('accessRules',i)}>🗑️</button></div>
                            </div>
                          ))}
                          <button className="btn-ghost" onClick={()=>addCommMissionEnRule('accessRules')}>+ Add rule</button>
                        </div>
                      </div>
                    </>}
                  </div>
                );
              })()}
            </AdminSection>

            {/* ── UI Labels ── */}
            <AdminSection title={`🏷️ ${isEn?'UI Labels':'Etiquetas de interfaz'}`} subtitle={isEn?'Override any app text label for this community.':'Sobreescribe cualquier etiqueta de texto de la app para esta comunidad.'} action={!commOverridesOn?null:<button className="btn-ghost" onClick={()=>saveCommunitySection(activeCommId,['ui_labels_es','ui_labels_en'])} disabled={!commData||!canEditLabelsContent}>💾 {isEn?'Save labels':'Guardar etiquetas'}</button>} open={openSections.commLabels} onToggle={()=>toggleSection('commLabels')}>
              {!canEditLabelsContent && <div style={{marginBottom:12,padding:'8px 12px',background:'#fff3e0',borderRadius:8,fontSize:'.78rem',color:'#7a5a00',border:'1px solid #f5c97a'}}>{isEn?(!commOverridesOn?'Content editing is not enabled for this community. Contact your global admin to enable it.':'You do not have permission to edit UI labels for this community.'):(!commOverridesOn?'La edición de contenido no está habilitada para esta comunidad. Contacta al administrador global para habilitarla.':'No tienes permiso para editar etiquetas UI de esta comunidad.')}</div>}
              {(()=>{
                const lang2 = uiLabelLang;
                const jsonKey = lang2==='en' ? 'ui_labels_en' : 'ui_labels_es';
                const commLabels2 = getCommJsonObj(jsonKey);
                const getDefVal2 = (key) => APP_I18N[key]?.[lang2==='en'?'en':'es'] || APP_I18N[key]?.es || '';
                const labelGroups2 = [
                  { id:'nav',    icon:'🧭', label:isEn?'Navigation & menu':'Navegación y menú',          prefixes:['nav.'] },
                  { id:'dash',   icon:'📊', label:isEn?'Dashboard':'Dashboard',                           prefixes:['dashboard.','actions.','smart.'] },
                  { id:'inc',    icon:'⚠️', label:isEn?'Incidents & Reports':'Incidentes y Reportes',     prefixes:['reports.','workflow.','incidents.'] },
                  { id:'form',   icon:'📝', label:isEn?'Forms & Validation':'Formularios y validación',   prefixes:['form.','validation.','modal.'] },
                  { id:'my',     icon:'🔑', label:isEn?'My Units':'Mis Unidades',                         prefixes:['my.'] },
                  { id:'listing',icon:'🏠', label:isEn?'Inventory':'Inventario',                          prefixes:['listings.'] },
                  { id:'notif',  icon:'🔔', label:isEn?'Notifications & Alerts':'Notificaciones y Alertas', prefixes:['notifications.'] },
                  { id:'roles',  icon:'👥', label:isEn?'Roles & Permissions':'Roles y permisos',          prefixes:['roles.'] },
                  { id:'common', icon:'🔤', label:isEn?'Common & Other':'Común y otros',                  prefixes:['common.','tooltips.',null] },
                ];
                const CommunityLabelRow = ({rkey, shortKey, defVal}) => {
                  const custom = commLabels2[rkey];
                  const isChanged = custom !== undefined;
                  return (
                    <div className={`ula-row${isChanged?' ula-row-changed':''}`}>
                      <div className="ula-row-key">
                        <code className="ula-key" title={rkey}>{shortKey}</code>
                        {isChanged&&<span className="ula-changed-dot">●</span>}
                      </div>
                      <div className="ula-row-content">
                        <div className="ula-default">{defVal||<span style={{color:'#aaa',fontStyle:'italic'}}>{isEn?'(empty)':'(vacío)'}</span>}</div>
                        <div className="ula-input-wrap">
                          <input className="ula-input" value={isChanged?custom:defVal}
                            onChange={e=>setCommJsonKey(jsonKey,rkey,e.target.value)}
                            onFocus={e=>{if(!isChanged){setCommJsonKey(jsonKey,rkey,defVal);setTimeout(()=>e.target.select(),0);}}}
                            placeholder={defVal}/>
                          {isChanged&&<button type="button" className="ula-reset" title={isEn?'Reset to global':'Resetear a global'} onClick={()=>setCommJsonKey(jsonKey,rkey,'')}>↩</button>}
                        </div>
                      </div>
                    </div>
                  );
                };
                const q2 = uiLabelSearch.trim().toLowerCase();
                const allKeys2 = Object.keys(APP_I18N).sort();
                const filteredKeys2 = q2
                  ? allKeys2.filter(k=>{
                      const dEn=String(APP_I18N[k]?.en||'').toLowerCase();
                      const dEs=String(APP_I18N[k]?.es||'').toLowerCase();
                      const cust=String(commLabels2[k]||'').toLowerCase();
                      return k.toLowerCase().includes(q2)||dEn.includes(q2)||dEs.includes(q2)||cust.includes(q2);
                    })
                  : allKeys2;
                const totalModified2 = Object.keys(commLabels2).length;
                return (
                  <div className="ula-wrap" style={!commOverridesOn?{pointerEvents:'none',opacity:0.5,userSelect:'none'}:{}}>
                    <div className="ula-toolbar">
                      <div className="ula-lang-toggle">
                        <button className={`fchip${lang2==='es'?' fchip-on':''}`} onClick={()=>setUiLabelLang('es')}>🇨🇴 Español</button>
                        <button className={`fchip${lang2==='en'?' fchip-on':''}`} onClick={()=>setUiLabelLang('en')}>🇺🇸 English</button>
                      </div>
                      <div style={{position:'relative',flex:1,maxWidth:340}}>
                        <input className="search" style={{paddingRight:32}} placeholder={isEn?'Search all labels…':'Buscar en todas las etiquetas…'} value={uiLabelSearch} onChange={e=>setUiLabelSearch(e.target.value)}/>
                        {uiLabelSearch&&<button className="inc-search-clear" onClick={()=>setUiLabelSearch('')}>✕</button>}
                      </div>
                      <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
                        {totalModified2>0&&<span className="ula-modified-badge">{totalModified2} {isEn?'overridden':'con override'}</span>}
                        {!q2&&<button type="button" className="bsm" style={{fontSize:'.72rem'}}
                          onClick={()=>setUiLabelOpenGroups(s=>{const allOpen=labelGroups2.every(g=>s[g.id]);return Object.fromEntries(labelGroups2.map(g=>[g.id,!allOpen]));})}>
                          {labelGroups2.every(g=>uiLabelOpenGroups[g.id])?(isEn?'Collapse all':'Colapsar todo'):(isEn?'Expand all':'Expandir todo')}
                        </button>}
                      </div>
                    </div>
                    {q2 ? (
                      <div className="ula-group ula-group-open">
                        <div className="ula-group-hdr ula-group-hdr-plain">
                          🔍 {filteredKeys2.length} {isEn?`result${filteredKeys2.length!==1?'s':''}`:`resultado${filteredKeys2.length!==1?'s':''}`}
                        </div>
                        <div className="ula-rows">
                          {filteredKeys2.map(key=>{
                            const defVal=getDefVal2(key);
                            return <CommunityLabelRow key={key} rkey={key} shortKey={key} defVal={defVal}/>;
                          })}
                        </div>
                      </div>
                    ) : (
                      labelGroups2.map(g=>{
                        const gKeys = g.prefixes.includes(null)
                          ? filteredKeys2.filter(k=>!labelGroups2.slice(0,-1).some(lg=>lg.prefixes.filter(Boolean).some(p=>k.startsWith(p))))
                          : filteredKeys2.filter(k=>g.prefixes.some(p=>k.startsWith(p)));
                        if(!gKeys.length) return null;
                        const isOpen = !!uiLabelOpenGroups[g.id];
                        const groupModified = gKeys.filter(k=>commLabels2[k]!==undefined).length;
                        return (
                          <div key={g.id} className={`ula-group${isOpen?' ula-group-open':''}`}>
                            <button type="button" className="ula-group-toggle" onClick={()=>toggleUlaGroup(g.id)}>
                              <span className="ula-group-icon">{g.icon}</span>
                              <span className="ula-group-label">{g.label}</span>
                              <span className="ula-group-count">{gKeys.length} {isEn?'labels':'etiquetas'}</span>
                              {groupModified>0&&<span className="ula-modified-badge" style={{fontSize:'.65rem',padding:'1px 7px'}}>{groupModified} {isEn?'edited':'editadas'}</span>}
                              <span className={`ula-group-chev${isOpen?' ula-group-chev-open':''}`}>›</span>
                            </button>
                            {isOpen&&(
                              <div className="ula-rows">
                                {gKeys.map(key=>{
                                  const shortKey = g.prefixes.filter(Boolean).reduce((s,p)=>s.startsWith(p)?s.slice(p.length):s, key);
                                  const defVal=getDefVal2(key);
                                  return <CommunityLabelRow key={key} rkey={key} shortKey={shortKey} defVal={defVal}/>;
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                    <div className="mact" style={{marginTop:16}}>
                      <button className="btn-ghost" onClick={()=>setCommunityConfigDraft(p=>({...p,[activeCommId]:{...(p[activeCommId]||{}),[jsonKey]:'{}'}}))}>↩ {isEn?'Clear all overrides':'Limpiar todos los overrides'}</button>
                      <button className="btn-p" onClick={()=>saveCommunitySection(activeCommId,['ui_labels_es','ui_labels_en'])}>💾 {isEn?'Save community labels':'Guardar etiquetas de comunidad'}</button>
                    </div>
                  </div>
                );
              })()}
            </AdminSection>

            {/* ── Tooltips ── */}
            <AdminSection title={`💡 ${isEn?'Tooltips / Instructions':'Tooltips / Instrucciones'}`} subtitle={isEn?'Override field help text and tooltips for this community.':'Sobreescribe el texto de ayuda de campos y tooltips para esta comunidad.'} action={!commOverridesOn?null:<button className="btn-ghost" onClick={()=>saveCommunitySection(activeCommId,['tooltips_es','tooltips_en'])} disabled={!commData||!canEditTooltipsContent}>💾 {isEn?'Save tooltips':'Guardar tooltips'}</button>} open={openSections.commTooltips} onToggle={()=>toggleSection('commTooltips')}>
              {!canEditTooltipsContent && <div style={{marginBottom:12,padding:'8px 12px',background:'#fff3e0',borderRadius:8,fontSize:'.78rem',color:'#7a5a00',border:'1px solid #f5c97a'}}>{isEn?(!commOverridesOn?'Content editing is not enabled for this community. Contact your global admin to enable it.':'You do not have permission to edit tooltips for this community.'):(!commOverridesOn?'La edición de contenido no está habilitada para esta comunidad. Contacta al administrador global para habilitarla.':'No tienes permiso para editar tooltips de esta comunidad.')}</div>}
              {(()=>{
                const TOOLTIP_KEYS = ['reportIncident','addListing','aptNumber','listingEmail','ownerWhatsapp','operator','operatorEmail','operatorWhatsapp','incidentApartment','incidentType','incidentCategory','incidentDescription','verifyIncident','resolveIncident'];
                const KEY_LABELS_COMM = {reportIncident:{es:'Botón "Reportar incidente"',en:'"Report Incident" button'},addListing:{es:'Botón "Registrar unidad"',en:'"Add Listing" button'},aptNumber:{es:'Campo número de apartamento',en:'Apartment number field'},listingEmail:{es:'Campo email del listing',en:'Listing email field'},ownerWhatsapp:{es:'Campo WhatsApp propietario',en:'Owner WhatsApp field'},operator:{es:'Campo operador',en:'Operator field'},operatorEmail:{es:'Campo email del operador',en:'Operator email field'},operatorWhatsapp:{es:'Campo WhatsApp operador',en:'Operator WhatsApp field'},incidentApartment:{es:'Campo apartamento (incidente)',en:'Apartment field (incident)'},incidentType:{es:'Campo tipo de incidente',en:'Incident type field'},incidentCategory:{es:'Campo categoría de incidente',en:'Incident category field'},incidentDescription:{es:'Campo descripción del incidente',en:'Incident description field'},verifyIncident:{es:'Botón "Verificar incidente"',en:'"Verify Incident" button'},resolveIncident:{es:'Botón "Resolver incidente"',en:'"Resolve Incident" button'}};
                const commTipsEs = getCommJsonObj('tooltips_es');
                const commTipsEn = getCommJsonObj('tooltips_en');
                return (
                  <div className="table-wrap" style={!commOverridesOn?{pointerEvents:'none',opacity:0.5,userSelect:'none'}:{}}>
                    <table className="admin-table">
                      <thead><tr><th>{isEn?'Field':'Campo'}</th><th>{isEn?'Spanish (ES)':'Español (ES)'} <span style={{fontSize:'.65rem',color:'#d9b45a'}}>community</span></th><th>English (EN) <span style={{fontSize:'.65rem',color:'#d9b45a'}}>community</span></th></tr></thead>
                      <tbody>
                        {TOOLTIP_KEYS.map(k=>(
                          <tr key={k}>
                            <td><div style={{fontWeight:600,fontSize:'.78rem',color:'#2a5a6a',marginBottom:2}}>{KEY_LABELS_COMM[k]?.[isEn?'en':'es']||k}</div><code style={{fontSize:'.72rem',color:'#888'}}>{k}</code></td>
                            <td style={{position:'relative'}}>
                              {commTipsEs[k]!==undefined&&<span style={{position:'absolute',top:4,right:4,fontSize:'.6rem',background:'#d9b45a22',color:'#7a5a00',padding:'1px 5px',borderRadius:3}}>override</span>}
                              <textarea className="admin-tooltip-textarea" rows={3} value={commTipsEs[k]??tooltipsEs[k]??''} placeholder={tooltipsEs[k]||''} onChange={e=>setCommJsonKey('tooltips_es',k,e.target.value)}/>
                            </td>
                            <td style={{position:'relative'}}>
                              {commTipsEn[k]!==undefined&&<span style={{position:'absolute',top:4,right:4,fontSize:'.6rem',background:'#d9b45a22',color:'#7a5a00',padding:'1px 5px',borderRadius:3}}>override</span>}
                              <textarea className="admin-tooltip-textarea" rows={3} value={commTipsEn[k]??tooltipsEn[k]??''} placeholder={tooltipsEn[k]||''} onChange={e=>setCommJsonKey('tooltips_en',k,e.target.value)}/>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </AdminSection>

            {/* ── Email Templates (community) ── */}
            <AdminSection title={`📨 ${isEn?'Email Templates':'Plantillas de email'}`} subtitle={isEn?'Override email notification templates for this community.':'Sobreescribe las plantillas de email para esta comunidad.'} action={!commOverridesOn?<span style={{fontSize:'.72rem',color:'#7a5a00'}}>🔒 {isEn?'Read-only':'Solo lectura'}</span>:null} open={openSections.commTpl} onToggle={()=>{ toggleSection('commTpl'); if(!communityTplData[activeCommId])loadCommunityTemplates(activeCommId); }}>
              {(()=>{
                const tplD = communityTplData[activeCommId];
                const tplLang = communityTplLang[activeCommId] || 'es-CO';
                const selKey = communityTplSelected[activeCommId] || '';
                const tpl = tplD?.templates?.[selKey];
                if (!tplD && communityTplLoading[activeCommId]) return <div style={{color:'#6b9ba8',fontSize:'.82rem'}}><span className="spinner-sm"/> {isEn?'Loading…':'Cargando…'}</div>;
                if (!tplD) return <div style={{padding:'12px 0'}}><button className="btn-ghost" onClick={()=>loadCommunityTemplates(activeCommId)}>{isEn?'Load templates':'Cargar plantillas'}</button></div>;
                return (
                  <div style={!commOverridesOn?{pointerEvents:'none',opacity:0.5,userSelect:'none'}:{}}>
                    <div style={{display:'flex',gap:8,marginBottom:8,flexWrap:'wrap',alignItems:'center'}}>
                      <select value={tplLang} onChange={e=>{setCommunityTplLang(p=>({...p,[activeCommId]:e.target.value}));loadCommunityTemplates(activeCommId,e.target.value);}} style={{padding:'3px 8px',borderRadius:6,border:'1px solid #cce7ee',fontSize:'.78rem'}}>
                        <option value="es-CO">Español</option>
                        <option value="en">English</option>
                      </select>
                      <select value={selKey} onChange={e=>setCommunityTplSelected(p=>({...p,[activeCommId]:e.target.value}))} style={{padding:'3px 8px',borderRadius:6,border:'1px solid #cce7ee',fontSize:'.78rem',flex:1,minWidth:120}}>
                        {Object.entries(tplD?.templates||{}).map(([k,v])=><option key={k} value={k}>{v?.label||k}</option>)}
                      </select>
                      <button className="btn-ghost" style={{fontSize:'.72rem',padding:'3px 10px'}} onClick={()=>loadCommunityTemplates(activeCommId,tplLang)}>↻ {isEn?'Refresh':'Actualizar'}</button>
                    </div>
                    {tpl && (
                      <div>
                        <div style={{fontSize:'.72rem',fontWeight:700,color:'#2F4F3A',marginBottom:4}}>{isEn?'Subject:':'Asunto:'}</div>
                        <input value={tpl.subject||''} onChange={e=>setCommunityTplData(p=>({...p,[activeCommId]:{...(p[activeCommId]||{}),templates:{...(p[activeCommId]?.templates||{}),[selKey]:{...(p[activeCommId]?.templates?.[selKey]||{}),subject:e.target.value}}}}))} style={{width:'100%',fontSize:'.78rem',padding:'4px 8px',borderRadius:6,border:'1px solid #cce7ee',boxSizing:'border-box',marginBottom:6}}/>
                        <div style={{fontSize:'.72rem',fontWeight:700,color:'#2F4F3A',marginBottom:4}}>HTML:</div>
                        <textarea value={tpl.html||''} onChange={e=>setCommunityTplData(p=>({...p,[activeCommId]:{...(p[activeCommId]||{}),templates:{...(p[activeCommId]?.templates||{}),[selKey]:{...(p[activeCommId]?.templates?.[selKey]||{}),html:e.target.value}}}}))} rows={5} style={{width:'100%',fontSize:'.72rem',fontFamily:'monospace',padding:'4px 8px',borderRadius:6,border:'1px solid #cce7ee',resize:'vertical',boxSizing:'border-box',marginBottom:4}}/>
                      </div>
                    )}
                    <div style={{display:'flex',gap:8,marginTop:6}}>
                      <button className="btn-p" style={{fontSize:'.78rem',padding:'4px 12px'}} onClick={()=>saveCommunityTemplates(activeCommId)}>💾 {isEn?'Save templates':'Guardar plantillas'}</button>
                    </div>
                  </div>
                );
              })()}
            </AdminSection>

          </div>
        )}
      </div>
    );
  })()}

  {adminInfo.isGlobalAdmin && adminTab === 'platform' && <>
  {/* ── Communities ────────────────────────────────────────────────────── */}
  <AdminSection
    title={`🌐 ${isEn?'Communities':'Comunidades'}`}
    subtitle={isEn?'Create and manage multi-tenant communities. Approved registered owners are automatically members. Promote any member to Community Admin here.':'Crea y administra comunidades multi-tenant. Los propietarios con registro aprobado son miembros automáticamente. Promueve a cualquier miembro a Admin de comunidad aquí.'}
    action={<button className="btn-p" style={{minHeight:36,padding:'6px 14px'}} onClick={()=>setCommunityModal({mode:'create',data:{}})}>{isEn?'＋ New community':'＋ Nueva comunidad'}</button>}
    open={openSections.communities} onToggle={()=>toggleSection('communities')}>
    {/* Community feature flag settings */}
    <div className="card" style={{marginBottom:16,padding:'12px 16px',background:'#f5fbfd',border:'1px solid #cce7ee'}}>
      <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <label style={{display:'flex',alignItems:'center',gap:10,fontSize:'.88rem',fontWeight:600,color:'#17313a',cursor:'pointer',userSelect:'none'}}>
          <button
            role="switch" aria-checked={communityFeatureEnabled}
            onClick={async()=>{
              const next=!communityFeatureEnabled;
              setCommunityFeatureEnabled(next);
              try{
                await api.put('/api/admin/config',{actorUid:user.uid,actorEmail:user.email,communityFeatureEnabled:next,defaultCommunityId});
                showToast('✅ '+(isEn?'Community settings saved':'Configuración de comunidad guardada'));
              }catch(e){setCommunityFeatureEnabled(!next);showToast((e.message||String(e)),true);}
            }}
            style={{position:'relative',display:'inline-flex',width:38,height:22,borderRadius:22,background:communityFeatureEnabled?'#0b7f4f':'#cdd8db',border:'none',cursor:'pointer',padding:0,flexShrink:0,transition:'background .2s'}}>
            <span style={{position:'absolute',top:3,left:communityFeatureEnabled?18:3,width:16,height:16,borderRadius:'50%',background:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,.25)',transition:'left .2s',pointerEvents:'none'}}/>
          </button>
          {isEn?'Community picker enabled':'Selector de comunidad habilitado'}
        </label>
        {!communityFeatureEnabled && (
          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:'.85rem',color:'#17313a'}}>
            <span style={{fontWeight:600}}>{isEn?'Default community:':'Comunidad predeterminada:'}</span>
            <select value={defaultCommunityId} onChange={e=>setDefaultCommunityId(e.target.value)} style={{padding:'4px 8px',borderRadius:6,border:'1.5px solid rgba(47,79,58,.25)',fontSize:'.85rem',background:'#fff',color:'#17313a'}}>
              {communities.map(c=><option key={c.id} value={c.id}>{isEn?(c.name_en||c.name):c.name}</option>)}
              {!communities.some(c=>c.id===defaultCommunityId)&&<option value={defaultCommunityId}>{defaultCommunityId}</option>}
            </select>
          </label>
        )}
      </div>
    </div>
    {/* ── Filter bar ── */}
    <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12,alignItems:'center'}}>
      <input
        value={commSearchDraft}
        onChange={e=>setCommSearchDraft(e.target.value)}
        placeholder={isEn?'Search name or ID…':'Buscar nombre o ID…'}
        style={{flex:'1 1 160px',minWidth:120,padding:'6px 10px',borderRadius:8,border:'1px solid rgba(47,79,58,.22)',fontSize:'.82rem',background:'#fff'}}
      />
      {commFilterOptions.cities.length > 0 && (
        <select value={commFilter.city} onChange={e=>{setCommFilter(p=>({...p,city:e.target.value}));setCommPage(1);}} style={{padding:'6px 8px',borderRadius:8,border:'1px solid rgba(47,79,58,.22)',fontSize:'.82rem',background:'#fff',color:'#17313a'}}>
          <option value="">{isEn?'All cities':'Todas las ciudades'}</option>
          {commFilterOptions.cities.map(v=><option key={v} value={v}>{v}</option>)}
        </select>
      )}
      {commFilterOptions.states.length > 0 && (
        <select value={commFilter.state} onChange={e=>{setCommFilter(p=>({...p,state:e.target.value}));setCommPage(1);}} style={{padding:'6px 8px',borderRadius:8,border:'1px solid rgba(47,79,58,.22)',fontSize:'.82rem',background:'#fff',color:'#17313a'}}>
          <option value="">{isEn?'All states':'Todos los depto.'}</option>
          {commFilterOptions.states.map(v=><option key={v} value={v}>{v}</option>)}
        </select>
      )}
      {commFilterOptions.countries.length > 0 && (
        <select value={commFilter.country} onChange={e=>{setCommFilter(p=>({...p,country:e.target.value}));setCommPage(1);}} style={{padding:'6px 8px',borderRadius:8,border:'1px solid rgba(47,79,58,.22)',fontSize:'.82rem',background:'#fff',color:'#17313a'}}>
          <option value="">{isEn?'All countries':'Todos los países'}</option>
          {commFilterOptions.countries.map(v=><option key={v} value={v}>{v}</option>)}
        </select>
      )}
      <select value={commFilter.active} onChange={e=>{setCommFilter(p=>({...p,active:e.target.value}));setCommPage(1);}} style={{padding:'6px 8px',borderRadius:8,border:'1px solid rgba(47,79,58,.22)',fontSize:'.82rem',background:'#fff',color:'#17313a'}}>
        <option value="">{isEn?'Active + Inactive':'Activas + Inactivas'}</option>
        <option value="true">{isEn?'Active only':'Solo activas'}</option>
        <option value="false">{isEn?'Inactive only':'Solo inactivas'}</option>
      </select>
      {(commSearchDraft||commFilter.city||commFilter.state||commFilter.country||commFilter.active) && (
        <button className="btn-ghost" style={{fontSize:'.78rem',padding:'5px 10px'}} onClick={()=>{setCommSearchDraft('');setCommFilter({q:'',city:'',state:'',country:'',active:''});setCommPage(1);}}>✕ {isEn?'Clear':'Limpiar'}</button>
      )}
      <span style={{fontSize:'.75rem',color:'#8a9fa5',marginLeft:'auto'}}>{commTotal} {isEn?'communities':'comunidades'}</span>
    </div>
    {communitiesLoading && <div style={{padding:'20px 0',textAlign:'center'}}><span className="spinner-sm"/> {isEn?'Loading...':'Cargando...'}</div>}
    {!communitiesLoading && communities.length === 0 && (
      <div style={{padding:'16px 0',color:'#6b9ba8',textAlign:'center',fontSize:'.9rem'}}>
        {commFilter.q||commFilter.city||commFilter.state||commFilter.country||commFilter.active
          ? (isEn?'No communities match your filters.':'Ninguna comunidad coincide con los filtros.')
          : (isEn?'No communities yet. Create the first one above.':'Sin comunidades todavía. Crea la primera arriba.')}
      </div>
    )}
    {!communitiesLoading && communities.map(c => (
      <div key={c.id} className="card" style={{marginBottom:12,padding:'12px 16px',border:'1px solid #cce7ee'}}>
        {/* Community header row */}
        <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          {c.logo_url && <img src={c.logo_url} alt="logo" style={{width:36,height:36,objectFit:'contain',borderRadius:6,background:'#f5fbfd',padding:2}}/>}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:'.95rem',color:'#17313a'}}>{c.name}{c.name_en&&c.name_en!==c.name&&<span style={{fontWeight:400,color:'#6b9ba8',marginLeft:8,fontSize:'.82rem'}}>{c.name_en}</span>}</div>
            <div style={{fontSize:'.77rem',color:'#8a9fa5',marginTop:2}}>
              <code style={{background:'#eef6f8',padding:'1px 5px',borderRadius:3,fontSize:'.75rem'}}>{c.id}</code>
              {c.tower&&<span style={{marginLeft:8}}>🏢 {c.tower}</span>}
              {c.city&&<span style={{marginLeft:8}}>📍 {c.city}{c.state?`, ${c.state}`:''}{c.country?`, ${c.country}`:''}</span>}
            </div>
          </div>
          <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
            <button className="btn-ghost" style={{fontSize:'.78rem',padding:'4px 10px'}} title={isEn?'Copy invite link':'Copiar enlace de invitación'} onClick={()=>{ const url=`${window.location.origin}/?community=${c.id}`; navigator.clipboard?.writeText(url).then(()=>showToast(isEn?`✅ Invite link copied:\n${url}`:`✅ Enlace copiado:\n${url}`)).catch(()=>showToast(url)); }}>🔗 {isEn?'Invite link':'Enlace invitación'}</button>
            <button className="btn-ghost" style={{fontSize:'.78rem',padding:'4px 10px'}} onClick={()=>setCommunityModal({mode:'edit',data:c})}>✏️ {isEn?'Edit':'Editar'}</button>
            <label style={{display:'flex',alignItems:'center',gap:6,userSelect:'none',fontSize:'.78rem',color:'#17313a',fontWeight:600}}>
              <span style={{color:c.is_active?'#0b7f4f':'#9aa5a8',minWidth:44}}>{c.is_active?(isEn?'Active':'Activa'):(isEn?'Inactive':'Inactiva')}</span>
              <button
                role="switch" aria-checked={!!c.is_active}
                title={c.is_active?(isEn?'Disable community':'Deshabilitar comunidad'):(isEn?'Enable community':'Habilitar comunidad')}
                onClick={()=>api.put(`/api/communities/${c.id}`,{actorUid:user.uid,actorEmail:user.email,isActive:!c.is_active}).then(()=>loadCommunities()).catch(e=>showToast(e.message,true))}
                style={{position:'relative',display:'inline-flex',width:38,height:22,borderRadius:22,background:c.is_active?'#0b7f4f':'#cdd8db',border:'none',cursor:'pointer',padding:0,flexShrink:0,transition:'background .2s'}}>
                <span style={{position:'absolute',top:3,left:c.is_active?18:3,width:16,height:16,borderRadius:'50%',background:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,.25)',transition:'left .2s',pointerEvents:'none'}}/>
              </button>
            </label>
            {c.id !== 'kai' && <button className="btn-ghost" style={{fontSize:'.78rem',padding:'4px 10px',color:'#c62828'}} onClick={()=>deleteCommunity(c.id)}>🗑️ {isEn?'Delete':'Eliminar'}</button>}
          </div>
        </div>
        {/* Config overrides toggle */}
        {(() => {
          const ovOn = !!communityConfigData[c.id]?.overridesEnabled;
          return (
            <div style={{marginTop:8,padding:'6px 12px',background:ovOn?'#e8f5ec':'#fff3e0',borderRadius:8,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',border:'1px solid',borderColor:ovOn?'#b2dfdb':'#f5c97a'}}>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',userSelect:'none'}}>
                <span style={{position:'relative',display:'inline-block',width:38,height:22,flexShrink:0}}>
                  <input type="checkbox" checked={ovOn} style={{opacity:0,width:0,height:0,position:'absolute'}}
                    onChange={e=>{ if(!communityConfigData[c.id]) loadCommunityConfig(c.id).then(()=>toggleCommunityOverrides(c.id,e.target.checked)); else toggleCommunityOverrides(c.id,e.target.checked); }}/>
                  <span style={{position:'absolute',inset:0,borderRadius:999,background:ovOn?'#0b7f4f':'#ccc',transition:'.2s'}}/>
                  <span style={{position:'absolute',top:3,left:ovOn?18:3,width:16,height:16,borderRadius:'50%',background:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,.25)',transition:'.2s'}}/>
                </span>
                <span style={{fontSize:'.75rem',fontWeight:600,color:ovOn?'#2F4F3A':'#7a5a00'}}>
                  {ovOn?(isEn?'Community overrides ON':'Overrides de comunidad ACTIVADOS'):(isEn?'Community overrides OFF':'Overrides de comunidad DESACTIVADOS')}
                </span>
              </label>
              <span style={{fontSize:'.72rem',color:ovOn?'#2F4F3A':'#7a5a00',marginLeft:'auto'}}>
                {ovOn?(isEn?'Mission, labels & tooltips use community values':'Misión, etiquetas y tooltips usan valores de comunidad'):(isEn?'All settings fall back to global defaults':'Todos los ajustes usan los valores globales')}
              </span>
              {!communityConfigData[c.id] && <button className="btn-ghost" style={{fontSize:'.72rem',padding:'2px 10px'}} onClick={()=>loadCommunityConfig(c.id)}>↻ {isEn?'Load status':'Cargar estado'}</button>}
            </div>
          );
        })()}
        {/* Members — expandable table with search */}
        <div style={{marginTop:8,borderTop:'1px solid #e8f4f8',paddingTop:8}}>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <button className="btn-ghost" style={{fontSize:'.75rem',padding:'3px 10px'}}
              onClick={()=>{
                setCommMemberOpen(p=>({...p,[c.id]:!p[c.id]}));
                if(!communityMembers[c.id])loadCommunityMembers(c.id);
              }}>
              👥 {communityMembers[c.id]?`${communityMembers[c.id].length} ${isEn?'members':'miembros'}`:(isEn?'Show members':'Ver miembros')} {commMemberOpen[c.id]?'▲':'▼'}
            </button>
            {communityMembers[c.id] && <span style={{fontSize:'.72rem',color:'#6b9ba8'}}>{communityMembers[c.id].filter(m=>m.isCommunityAdmin).length} {isEn?'admins':'admins'}</span>}
            {communityMembersLoading[c.id] && <span className="spinner-sm"/>}
          </div>
          {commMemberOpen[c.id] && (()=>{
            const mems = communityMembers[c.id] || [];
            const mLoading = communityMembersLoading[c.id];
            const mSearch = (commMemberSearch[c.id]||'').trim().toLowerCase();
            const filtered = mems.filter(m=>{
              if(!mSearch) return true;
              return (m.name||'').toLowerCase().includes(mSearch)
                || (m.userEmail||'').toLowerCase().includes(mSearch)
                || (m.whatsapp||'').toLowerCase().includes(mSearch)
                || (m.apts||[]).some(a=>(a||'').toLowerCase().includes(mSearch))
                || (m.isCommunityAdmin?'admin':'owner').includes(mSearch)
                || (m.platformRole||'').toLowerCase().includes(mSearch);
            });
            if(mLoading) return <div style={{color:'#6b9ba8',fontSize:'.82rem',padding:'8px 0'}}><span className="spinner-sm"/> {isEn?'Loading…':'Cargando…'}</div>;
            if(!mems.length) return <div style={{padding:'12px 0',color:'#8a9fa5',fontSize:'.85rem'}}>{isEn?'No members found.':'No se encontraron miembros.'} <button className="btn-ghost" style={{fontSize:'.75rem',padding:'3px 10px',marginLeft:8}} onClick={()=>loadCommunityMembers(c.id)}>↻ {isEn?'Reload':'Recargar'}</button></div>;
            return (
              <div style={{marginTop:8}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8,flexWrap:'wrap'}}>
                  <input className="search" placeholder={isEn?'Search by name, unit, email, WhatsApp…':'Buscar por nombre, unidad, email, WhatsApp…'}
                    value={commMemberSearch[c.id]||''}
                    onChange={e=>setCommMemberSearch(p=>({...p,[c.id]:e.target.value}))}
                    style={{flex:'1 1 240px',maxWidth:380}}/>
                  <span style={{fontSize:'.72rem',color:'#6b9ba8',flexShrink:0}}>{filtered.length}/{mems.length} {isEn?'members':'miembros'}</span>
                  <button className="btn-ghost" style={{fontSize:'.72rem',padding:'2px 8px'}} onClick={()=>loadCommunityMembers(c.id)}>↻</button>
                </div>
                <div style={{overflowX:'auto'}}>
                  <table className="admin-table" style={{width:'100%'}}>
                    <thead><tr>
                      <th>{isEn?'Name':'Nombre'}</th>
                      <th>{isEn?'Unit(s)':'Unidad(es)'}</th>
                      <th>Email</th>
                      <th>WhatsApp</th>
                      <th>{isEn?'Role(s)':'Rol(es)'}</th>
                      <th>{isEn?'Actions':'Acciones'}</th>
                    </tr></thead>
                    <tbody>
                      {filtered.map(m=>{
                        const mUid = m.userUid||m.uid||m.userEmail;
                        const mEmail = m.userEmail||'—';
                        const isGlobal = m.platformRole==='global_admin';
                        const isDelegate = m.platformRole==='delegate_admin';
                        const isCA = m.isCommunityAdmin;
                        return (
                          <tr key={mUid||mEmail}>
                            <td style={{fontWeight:700,color:'#17313a'}}>{m.name||'—'}</td>
                            <td style={{fontSize:'.82rem',color:'#2a5a6a'}}>{(m.apts||[]).length?(m.apts||[]).join(', '):'—'}</td>
                            <td style={{fontSize:'.78rem',color:'#17313a',wordBreak:'break-all'}}>{mEmail}</td>
                            <td style={{fontSize:'.78rem',color:'#17313a'}}>{m.whatsapp||'—'}</td>
                            <td>
                              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                                {isGlobal && <span style={{background:'#e8f0fe',color:'#3b5bdb',borderRadius:999,padding:'2px 8px',fontSize:'.72rem',fontWeight:700}}>🌐 Global</span>}
                                {isDelegate && <span style={{background:'#f3e8ff',color:'#7c3aed',borderRadius:999,padding:'2px 8px',fontSize:'.72rem',fontWeight:700}}>🛡️ Delegate</span>}
                                {isCA && <span style={{background:'#fef9c3',color:'#854d0e',borderRadius:999,padding:'2px 8px',fontSize:'.72rem',fontWeight:700}}>🏢 Admin</span>}
                                {!isGlobal && !isDelegate && !isCA && <span style={{background:'#f0f8fb',color:'#2a5a6a',borderRadius:999,padding:'2px 8px',fontSize:'.72rem'}}>🏠 {isEn?'Owner':'Propietario'}</span>}
                              </div>
                            </td>
                            <td>
                              {!isGlobal && mUid && (
                                isCA
                                  ? <button className="btn-ghost" style={{fontSize:'.72rem',padding:'3px 10px',color:'#9d1f16'}} onClick={async()=>{
                                      try{await api.del(`/api/communities/${c.id}/members/${encodeURIComponent(mUid)}/promote`,{actorUid:user.uid,actorEmail:user.email});showToast(isEn?'✅ Demoted to owner':'✅ Degradado a propietario');loadCommunityMembers(c.id);}catch(e){showToast(e.message||String(e),true);}
                                    }}>↓ {isEn?'Demote':'Degradar'}</button>
                                  : <button className="btn-ghost" style={{fontSize:'.72rem',padding:'3px 10px',color:'#2F4F3A'}} onClick={async()=>{
                                      try{await api.post(`/api/communities/${c.id}/members/${encodeURIComponent(mUid)}/promote`,{actorUid:user.uid,actorEmail:user.email});showToast(isEn?'✅ Promoted to community admin':'✅ Promovido a admin de comunidad');loadCommunityMembers(c.id);}catch(e){showToast(e.message||String(e),true);}
                                    }}>↑ {isEn?'Promote':'Promover'}</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
        {/* Community settings are edited inline in Mission / UI Labels / Tooltips sections above */}
        {false && <div style={{marginTop:8,borderTop:'1px solid #e8f4f8',paddingTop:8}}>
          <button type="button" className="btn-ghost" style={{fontSize:'.78rem',padding:'3px 10px'}}
            onClick={()=>{
              const opening = !communityConfigOpen[c.id];
              setCommunityConfigOpen(p=>({...p,[c.id]:opening}));
              if (opening && !communityConfigData[c.id]) loadCommunityConfig(c.id);
            }}>
            ⚙️ {isEn?'Community Settings':'Configuración de comunidad'} {communityConfigOpen[c.id]?'▲':'▼'}
          </button>
          {communityConfigOpen[c.id] && (
            <div style={{marginTop:10}}>
              {communityConfigLoading[c.id] && <div style={{color:'#6b9ba8',fontSize:'.82rem'}}><span className="spinner-sm"/> {isEn?'Loading...':'Cargando...'}</div>}
              {!communityConfigLoading[c.id] && communityConfigData[c.id] && (() => {
                const cfg = communityConfigData[c.id];
                const draft = communityConfigDraft[c.id] || {};
                const overridesOn = communityOverridesEnabled[c.id];
                const TABS = [
                  { id:'mission',  icon:'🌊', label: isEn?'Mission':'Misión',   keys:['mission_title_es','mission_body_es','mission_title_en','mission_body_en'] },
                  { id:'ui',       icon:'🏷️', label: isEn?'UI Labels':'Etiquetas', keys:['ui_labels_es','ui_labels_en'] },
                  { id:'tooltips', icon:'💡', label: isEn?'Tooltips':'Tooltips',  keys:['tooltips_es','tooltips_en'] },
                  { id:'other',    icon:'⚙️', label: isEn?'Other':'Otro',        keys:['escalation_cc_emails','community_admin_default_permissions'] },
                ];
                const KEY_LABELS = {
                  mission_title_es: isEn?'Mission title (ES)':'Título de misión (ES)',
                  mission_body_es:  isEn?'Mission body (ES)':'Cuerpo de misión (ES)',
                  mission_title_en: 'Mission title (EN)',
                  mission_body_en:  'Mission body (EN)',
                  ui_labels_es:     isEn?'UI labels (ES, JSON)':'Etiquetas de UI (ES, JSON)',
                  ui_labels_en:     'UI labels (EN, JSON)',
                  tooltips_es:      isEn?'Tooltips/instructions (ES, JSON)':'Tooltips/instrucciones (ES, JSON)',
                  tooltips_en:      'Tooltips/instructions (EN, JSON)',
                  escalation_cc_emails: isEn?'Escalation CC emails':'Emails de escalación CC',
                  community_admin_default_permissions: isEn?'Default admin permissions (JSON)':'Permisos default admin (JSON)',
                };
                const activeTab = communityConfigTab[c.id] || 'mission';
                const activetabKeys = TABS.find(t=>t.id===activeTab)?.keys || TABS[0].keys;
                return (
                  <div>
                    {/* Global admin: toggle override feature */}
                    {adminInfo.isGlobalAdmin && (
                      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,padding:'8px 10px',background:'#f0f8fb',borderRadius:8}}>
                        <label style={{display:'flex',alignItems:'center',gap:6,fontSize:'.82rem',fontWeight:700,color:'#17313a',cursor:'pointer'}}>
                          <input type="checkbox" checked={!!overridesOn} onChange={e=>toggleCommunityOverrides(c.id, e.target.checked)} style={{accentColor:'#0b7f4f',width:15,height:15}}/>
                          {isEn?'Allow community admin to override settings':'Permitir que admin comunidad sobreescriba configuración'}
                        </label>
                        <span style={{fontSize:'.72rem',color:'#6b9ba8'}}>{overridesOn?(isEn?'Overrides enabled':'Overrides habilitados'):(isEn?'Using global settings':'Usando config global')}</span>
                      </div>
                    )}
                    {/* Tab bar */}
                    <div style={{display:'flex',gap:4,marginBottom:12,borderBottom:'2px solid #e8f4f8',paddingBottom:0}}>
                      {TABS.map(t=>(
                        <button key={t.id} onClick={()=>setCommunityConfigTab(p=>({...p,[c.id]:t.id}))}
                          style={{padding:'5px 12px',fontSize:'.75rem',fontWeight:activeTab===t.id?700:500,background:'none',border:'none',borderBottom:activeTab===t.id?'2px solid #2F4F3A':'2px solid transparent',color:activeTab===t.id?'#2F4F3A':'#6b9ba8',cursor:'pointer',marginBottom:'-2px',borderRadius:'6px 6px 0 0',transition:'all .15s'}}>
                          {t.icon} {t.label}
                        </button>
                      ))}
                    </div>
                    {/* Tab content */}
                    {activetabKeys.map(key => {
                      const globalVal = cfg.globalValues?.[key] || '';
                      const overrideVal = draft[key] ?? cfg.communityOverrides?.[key] ?? globalVal;
                      const hasOverride = key in (cfg.communityOverrides||{}) || key in draft;
                      const isTextarea = key.includes('body') || key.includes('labels') || key.includes('tooltips') || key.includes('permissions');
                      return (
                        <div key={key} style={{marginBottom:12,paddingBottom:12,borderBottom:'1px solid #f0f8fb'}}>
                          <div style={{fontSize:'.75rem',fontWeight:700,color:'#2F4F3A',marginBottom:4,display:'flex',alignItems:'center',gap:6}}>
                            {KEY_LABELS[key]}
                            {hasOverride && <span style={{fontSize:'.65rem',background:'#d9b45a22',color:'#7a5a00',padding:'1px 6px',borderRadius:4,fontWeight:600}}>{isEn?'community override':'valor comunidad'}</span>}
                            {!hasOverride && <span style={{fontSize:'.65rem',background:'#e8f5ec',color:'#2F4F3A',padding:'1px 6px',borderRadius:4}}>🌐 {isEn?'using global':'usando global'}</span>}
                          </div>
                          {overridesOn && (isTextarea
                            ? <textarea value={overrideVal} rows={key.includes('body')?4:3}
                                onChange={e=>setCommunityConfigDraft(p=>({...p,[c.id]:{...(p[c.id]||{}),[key]:e.target.value}}))}
                                placeholder={globalVal||(isEn?'Override…':'Valor comunidad…')}
                                style={{width:'100%',fontSize:'.78rem',padding:'5px 8px',borderRadius:6,border:'1px solid #cce7ee',resize:'vertical',boxSizing:'border-box'}}/>
                            : <input value={overrideVal}
                                onChange={e=>setCommunityConfigDraft(p=>({...p,[c.id]:{...(p[c.id]||{}),[key]:e.target.value}}))}
                                placeholder={globalVal||(isEn?'Override…':'Valor comunidad…')}
                                style={{width:'100%',fontSize:'.78rem',padding:'5px 8px',borderRadius:6,border:'1px solid #cce7ee',boxSizing:'border-box'}}/>
                          )}
                          {!overridesOn && (
                            <div style={{fontSize:'.78rem',color:'#17313a',background:'#f8f8f6',padding:'5px 8px',borderRadius:6,border:'1px solid #eaecee'}}>
                              {globalVal||<em style={{color:'#8a9fa5'}}>{isEn?'(not set)':'(sin valor)'}</em>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {overridesOn && (
                      <div style={{display:'flex',gap:8,marginTop:8}}>
                        <button className="btn-p" style={{fontSize:'.78rem',padding:'5px 14px'}} onClick={()=>saveCommunityConfig(c.id)}>
                          💾 {isEn?'Save community settings':'Guardar configuración'}
                        </button>
                        <button className="btn-ghost" style={{fontSize:'.72rem',padding:'4px 10px'}} onClick={()=>loadCommunityConfig(c.id)}>
                          ↻ {isEn?'Refresh':'Actualizar'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>}
      </div>
    ))}
    {/* ── Pagination ── */}
    {commTotal > 20 && !communitiesLoading && (() => {
      const totalPages = Math.ceil(commTotal / 20);
      return (
        <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:12,marginTop:12,padding:'8px 0'}}>
          <button className="btn-ghost" style={{fontSize:'.78rem',padding:'4px 14px'}} disabled={commPage<=1} onClick={()=>setCommPage(p=>p-1)}>← {isEn?'Prev':'Anterior'}</button>
          <span style={{fontSize:'.78rem',color:'#6b9ba8'}}>{isEn?`Page ${commPage} of ${totalPages}`:`Página ${commPage} de ${totalPages}`}</span>
          <button className="btn-ghost" style={{fontSize:'.78rem',padding:'4px 14px'}} disabled={commPage>=totalPages} onClick={()=>setCommPage(p=>p+1)}>{isEn?'Next':'Siguiente'} →</button>
        </div>
      );
    })()}
    {communityModal && (
      <CommunityCrudModal
        mode={communityModal.mode}
        initial={communityModal.data||{}}
        onSave={saveCommunity}
        onClose={()=>setCommunityModal(null)}
      />
    )}
  </AdminSection>

  {/* ── Default / Fallback Branding ────────────────────────────── */}
  <AdminSection title={`🏢 ${isEn?'Default Branding (fallback)':'Identidad predeterminada (respaldo)'}`} subtitle={isEn?'Fallback logo, name, and location used when no community branding overrides it. For multi-community setups configure branding inside each community above.':'Logo, nombre y ubicación de respaldo usados cuando ninguna comunidad los sobreescribe. En setups multi-comunidad configura el branding dentro de cada comunidad arriba.'} action={<button className="btn-p" style={{minHeight:36,padding:'6px 14px'}} onClick={saveBranding}>💾 {isEn?'Save':'Guardar'}</button>} open={openSections.branding} onToggle={()=>toggleSection('branding')}>
    <div className="fg-row" style={{gap:12,flexWrap:'wrap',alignItems:'flex-start'}}>
      <div className="fg" style={{minWidth:180}}>
        <label>{isEn?'Name (Spanish)':'Nombre (Español)'}</label>
        <input value={brandingNameEs} onChange={e=>setBrandingNameEs(e.target.value)} className="input" placeholder="Propietarios Airbnb KAI"/>
      </div>
      <div className="fg" style={{minWidth:180}}>
        <label>{isEn?'Name (English)':'Nombre (Inglés)'}</label>
        <input value={brandingNameEn} onChange={e=>setBrandingNameEn(e.target.value)} className="input" placeholder="KAI Airbnb Owners"/>
      </div>
      <div className="fg" style={{flex:'1 1 100%'}}>
        <label>{isEn?'Location / Tagline':'Ubicación / Tagline'}</label>
        <input value={brandingLocation} onChange={e=>setBrandingLocation(e.target.value)} className="input" placeholder="Serena del Mar · Cartagena 🇨🇴"/>
      </div>
    </div>
    <div style={{marginTop:12}}>
      <div className="section-label" style={{marginBottom:6}}>{isEn?'Logo':'Logo'}</div>
      <div style={{display:'flex',gap:8,marginBottom:8}}>
        <button type="button" className={`chip ${brandingLogoMode==='url'?'chip-active':''}`} onClick={()=>setBrandingLogoMode('url')}>{isEn?'URL':'URL'}</button>
        <button type="button" className={`chip ${brandingLogoMode==='file'?'chip-active':''}`} onClick={()=>setBrandingLogoMode('file')}>{isEn?'Upload file':'Subir archivo'}</button>
      </div>
      {brandingLogoMode==='url' && <input value={brandingLogo} onChange={e=>setBrandingLogo(e.target.value)} className="input" placeholder="https://..." style={{marginBottom:8}}/>}
      {brandingLogoMode==='file' && <input type="file" accept="image/*" style={{marginBottom:8}} onChange={e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>{setBrandingLogo(ev.target?.result||'');};r.readAsDataURL(f);}}/>}
      {brandingLogo && <div style={{marginTop:8,padding:8,background:'#f6f6f4',borderRadius:8,display:'inline-block'}}><img src={brandingLogo} alt="logo preview" style={{maxHeight:64,maxWidth:220,objectFit:'contain'}}/></div>}
      {brandingLogo && <div style={{marginTop:6}}><button type="button" className="btn-ghost" style={{fontSize:'.75rem',padding:'3px 10px'}} onClick={()=>setBrandingLogo('')}>{isEn?'Remove logo':'Quitar logo'}</button></div>}
      {!brandingLogo && <div style={{marginTop:8,padding:8,background:'#f6f6f4',borderRadius:8,display:'inline-block'}}><img src="/morros-kai.png" alt="default logo" style={{maxHeight:64,maxWidth:220,objectFit:'contain'}}/><div style={{fontSize:'.7rem',color:'#888',marginTop:4}}>{isEn?'Default logo (morros-kai.png)':'Logo predeterminado (morros-kai.png)'}</div></div>}
    </div>
    <div style={{marginTop:16}}>
      <div className="section-label" style={{marginBottom:6}}>{isEn?'Background image (login & registration screens)':'Imagen de fondo (pantallas de login y registro)'}</div>
      <div style={{display:'flex',gap:8,marginBottom:8}}>
        <button type="button" className={`chip ${brandingBgMode==='url'?'chip-active':''}`} onClick={()=>setBrandingBgMode('url')}>URL</button>
        <button type="button" className={`chip ${brandingBgMode==='file'?'chip-active':''}`} onClick={()=>setBrandingBgMode('file')}>{isEn?'Upload file':'Subir archivo'}</button>
      </div>
      {brandingBgMode==='url' && <input value={brandingBg} onChange={e=>setBrandingBg(e.target.value)} className="input" placeholder="/morros-kai-bg.jpg or https://..." style={{marginBottom:8}}/>}
      {brandingBgMode==='file' && <input type="file" accept="image/*" style={{marginBottom:8}} onChange={e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>{setBrandingBg(ev.target?.result||'');};r.readAsDataURL(f);}}/>}
      {brandingBg && <div style={{marginTop:8,borderRadius:10,overflow:'hidden',display:'inline-block',position:'relative',maxWidth:320,boxShadow:'0 4px 14px rgba(0,0,0,.18)'}}>
        <img src={brandingBg} alt="bg preview" style={{width:320,height:160,objectFit:'cover',display:'block'}} onError={e=>{e.target.style.display='none';}} />
        <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,.35)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:'.72rem',letterSpacing:'.04em',opacity:.8,pointerEvents:'none'}}>PREVIEW</div>
      </div>}
      {brandingBg && <div style={{marginTop:6,display:'flex',gap:8}}>
        <button type="button" className="btn-ghost" style={{fontSize:'.75rem',padding:'3px 10px'}} onClick={()=>setBrandingBg('')}>{isEn?'Remove background':'Quitar fondo'}</button>
        <button type="button" className="btn-ghost" style={{fontSize:'.75rem',padding:'3px 10px'}} onClick={()=>setBrandingBg('/morros-kai-bg.jpg')}>{isEn?'Reset to default':'Restablecer por defecto'}</button>
      </div>}
      {!brandingBg && <div style={{marginTop:8,fontSize:'.78rem',color:'#888'}}>{isEn?'No background — solid color fallback.':'Sin fondo — se usa color sólido como alternativa.'}</div>}
    </div>
  </AdminSection>

  {/* ── Master switches — emergency kill-switches ───────────────── */}
  <AdminSection
    title={`🚦 ${isEn?'Master switches':'Interruptores maestros'}`}
    subtitle={isEn
      ? 'Emergency kill-switches that halt subsystems platform-wide. Use sparingly — toggling ON stops every community from sending email or writing audit log entries.'
      : 'Interruptores de emergencia que detienen subsistemas a nivel plataforma. Úsalos con cuidado — activarlos detiene los emails y la auditoría de TODAS las comunidades.'}
    action={<button className="btn-p" style={{minHeight:36,padding:'6px 14px'}} onClick={saveMasterSwitches}>💾 {isEn?'Save':'Guardar'}</button>}
    open={openSections.masterSwitches}
    onToggle={()=>toggleSection('masterSwitches')}>
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <label style={{display:'flex',alignItems:'flex-start',gap:10,padding:'12px 14px',background:emailKillSwitch?'#fff5f5':'#f8f9fa',border:`1.5px solid ${emailKillSwitch?'#e53935':'#e8eaed'}`,borderRadius:8,cursor:'pointer'}}>
        <input type="checkbox" checked={emailKillSwitch} onChange={e=>setEmailKillSwitch(e.target.checked)} style={{marginTop:3,width:18,height:18,flexShrink:0}}/>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:'.92rem',color:emailKillSwitch?'#c62828':'#17313a'}}>
            📧 {isEn?'Halt all outbound emails':'Detener todos los emails salientes'}
            {emailKillSwitch && <span style={{marginLeft:8,fontSize:'.7rem',background:'#c62828',color:'#fff',padding:'1px 8px',borderRadius:999}}>ON</span>}
          </div>
          <div style={{fontSize:'.78rem',color:'#496674',marginTop:4,lineHeight:1.45}}>
            {isEn
              ? 'When ON, sendTemplatedEmail() and sendSplitEmail() short-circuit and log every attempt as "skipped: Global email kill-switch is ON". No incident notifications, SLA reminders, or registration emails are sent.'
              : 'Cuando está activo, sendTemplatedEmail() y sendSplitEmail() se cortocircuitan y registran cada intento como "skipped: Global email kill-switch is ON". No se envían notificaciones de incidentes, recordatorios SLA, ni emails de registro.'}
          </div>
        </div>
      </label>
      <label style={{display:'flex',alignItems:'flex-start',gap:10,padding:'12px 14px',background:auditKillSwitch?'#fff5f5':'#f8f9fa',border:`1.5px solid ${auditKillSwitch?'#e53935':'#e8eaed'}`,borderRadius:8,cursor:'pointer'}}>
        <input type="checkbox" checked={auditKillSwitch} onChange={e=>setAuditKillSwitch(e.target.checked)} style={{marginTop:3,width:18,height:18,flexShrink:0}}/>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:'.92rem',color:auditKillSwitch?'#c62828':'#17313a'}}>
            🕵️ {isEn?'Halt all audit log writes':'Detener toda la escritura del log de auditoría'}
            {auditKillSwitch && <span style={{marginLeft:8,fontSize:'.7rem',background:'#c62828',color:'#fff',padding:'1px 8px',borderRadius:999}}>ON</span>}
          </div>
          <div style={{fontSize:'.78rem',color:'#496674',marginTop:4,lineHeight:1.45}}>
            {isEn
              ? 'When ON, auditLog() returns early without writing to audit_logs. Every action (incident state changes, role updates, config edits, listing CRUD, …) silently skips the audit trail. The legacy listing_audit_events table is unaffected.'
              : 'Cuando está activo, auditLog() retorna sin escribir en audit_logs. Cada acción (cambios de estado de incidentes, actualizaciones de roles, edición de configuración, CRUD de listings, …) salta el registro silenciosamente. La tabla legacy listing_audit_events no se ve afectada.'}
          </div>
        </div>
      </label>

      {/* Per-event-type audit toggles — grouped by entity for readability. */}
      {(() => {
        const types = adminInfo.auditEventTypes || [];
        if (!types.length) return null;
        const disabled = auditKillSwitch;
        // Group by entity prefix
        const groups = {};
        for (const t of types) {
          const [entity, action] = t.split('.');
          if (!groups[entity]) groups[entity] = [];
          groups[entity].push(action);
        }
        const disabledCount = Object.values(auditEventToggles).filter(v => v === false).length;
        return (
          <div style={{padding:'12px 14px',background:'#f8f9fa',border:'1px solid #e8eaed',borderRadius:8,opacity:disabled?0.5:1}}>
            <div style={{fontWeight:700,fontSize:'.88rem',color:'#17313a',marginBottom:4}}>
              🎚️ {isEn?'Per-event audit toggles':'Activación por tipo de evento'}
              {disabledCount > 0 && <span style={{marginLeft:8,fontSize:'.7rem',background:'#fff3cd',color:'#856404',border:'1px solid #ffe082',padding:'1px 8px',borderRadius:999}}>{disabledCount} {isEn?'disabled':'desactivado'+(disabledCount===1?'':'s')}</span>}
            </div>
            <div style={{fontSize:'.76rem',color:'#496674',marginBottom:10,lineHeight:1.45}}>
              {isEn
                ? 'Uncheck individual events to skip writing them to audit_logs. The global kill-switch above takes precedence: when it is ON these checkboxes have no effect.'
                : 'Desmarca eventos individuales para no escribirlos en audit_logs. El interruptor maestro arriba tiene prioridad: cuando está activo estas casillas no tienen efecto.'}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {Object.keys(groups).sort().map(entity => (
                <div key={entity}>
                  <div style={{fontSize:'.72rem',fontWeight:700,color:'#496674',marginBottom:4,textTransform:'uppercase',letterSpacing:'.04em'}}>{entity}</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                    {groups[entity].sort().map(action => {
                      const key = `${entity}.${action}`;
                      const enabled = auditEventToggles[key] !== false;
                      return (
                        <label key={key} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:999,background:enabled?'#fff':'#fff3cd',border:`1px solid ${enabled?'#cce7ee':'#ffe082'}`,fontSize:'.74rem',color:enabled?'#17313a':'#856404',cursor:disabled?'not-allowed':'pointer'}}>
                          <input type="checkbox" disabled={disabled} checked={enabled} onChange={e=>setAuditEventEnabled(key, e.target.checked)} style={{margin:0,cursor:disabled?'not-allowed':'pointer'}}/>
                          {action}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  </AdminSection>

  {/* ── Email Sender ────────────────────────────────────────────── */}
  <AdminSection title={`📤 ${isEn?'Email Sender':'Remitente de emails'}`} subtitle={isEn?'Display name and address used as the "From" field on all outgoing emails. The address must be verified in your Resend account.':'Nombre y dirección que aparecen como remitente en todos los emails. La dirección debe estar verificada en tu cuenta Resend.'} action={<button className="btn-p" style={{minHeight:36,padding:'6px 14px'}} onClick={saveEmailSender}>💾 {isEn?'Save':'Guardar'}</button>} open={openSections.emailSender} onToggle={()=>toggleSection('emailSender')}>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,flexWrap:'wrap'}} className="email-sender-grid">
      <div style={{padding:'12px 14px',background:'#f8f9fa',borderRadius:8,border:'1px solid #e8eaed'}}>
        <div className="section-label" style={{marginBottom:8}}>🇨🇴 {isEn?'Spanish recipients':'Destinatarios en Español'}</div>
        <div className="fg" style={{marginBottom:8}}>
          <label>{isEn?'Display name':'Nombre visible'}</label>
          <input value={emailFromName} onChange={e=>setEmailFromName(e.target.value)} className="input" placeholder="Propietarios Airbnb KAI"/>
        </div>
        <div className="fg">
          <label>{isEn?'From address':'Dirección de envío'}</label>
          <input value={emailFromAddress} onChange={e=>setEmailFromAddress(e.target.value)} className="input" type="email" placeholder="kai@yourdomain.com"/>
        </div>
        {emailFromAddress && <div style={{marginTop:6,fontSize:'.75rem',color:'#555'}}>→ <strong>{emailFromName ? `${emailFromName} <${emailFromAddress}>` : emailFromAddress}</strong></div>}
      </div>
      <div style={{padding:'12px 14px',background:'#f8f9fa',borderRadius:8,border:'1px solid #e8eaed'}}>
        <div className="section-label" style={{marginBottom:8}}>🇺🇸 {isEn?'English recipients':'Destinatarios en Inglés'}</div>
        <div className="fg" style={{marginBottom:8}}>
          <label>{isEn?'Display name':'Nombre visible'}</label>
          <input value={emailFromNameEn} onChange={e=>setEmailFromNameEn(e.target.value)} className="input" placeholder="KAI Airbnb Owners"/>
        </div>
        <div className="fg">
          <label>{isEn?'From address':'Dirección de envío'}</label>
          <input value={emailFromAddressEn} onChange={e=>setEmailFromAddressEn(e.target.value)} className="input" type="email" placeholder="kai@yourdomain.com"/>
        </div>
        {emailFromAddressEn && <div style={{marginTop:6,fontSize:'.75rem',color:'#555'}}>→ <strong>{emailFromNameEn ? `${emailFromNameEn} <${emailFromAddressEn}>` : emailFromAddressEn}</strong></div>}
      </div>
    </div>
    <div className="form-alert" style={{marginTop:10,fontSize:'.78rem'}}>
      {isEn
        ? '⚠️ Both addresses must be verified in Resend (Domains or single sender). Using an unverified address will cause delivery failures.'
        : '⚠️ Ambas direcciones deben estar verificadas en Resend (Dominios o sender individual). Usar una dirección no verificada causará fallos de entrega.'}
    </div>
  </AdminSection>

  <AdminSection
    title={lang==='en'?'👥 Role Reference — Capabilities by role':'👥 Referencia de roles — Capacidades por rol'}
    subtitle={lang==='en'?'All four roles in the platform. Community Admin is assigned per community; Delegate Admin and Global Admin are platform-wide.':'Los cuatro roles de la plataforma. Admin de comunidad se asigna por comunidad; Admin delegado y Admin global son de toda la plataforma.'}
    open={openSections.roles} onToggle={()=>toggleSection('roles')}>
    {(()=>{
      const isEn = lang==='en';
      const dp = defaultDelegatePermissions;
      const cap = (ok, label, note='') => (
        <div key={label} className="role-cap-row">
          <span className={`role-cap-icon ${ok?'rci-yes':'rci-no'}`}>{ok?'✓':'—'}</span>
          <span className="role-cap-label">{label}{note&&<span className="role-cap-note"> {note}</span>}</span>
        </div>
      );
      const conf = (on, label) => (
        <div key={label} className="role-cap-row">
          <span className={`role-cap-icon ${on?'rci-yes':'rci-conf'}`}>{on?'✓':'○'}</span>
          <span className="role-cap-label">{label}<span className="role-cap-note"> {isEn?'(configurable)':'(configurable)'}</span></span>
        </div>
      );
      const std = [
        cap(true,  isEn?'Dashboard, community & alerts':'Dashboard, comunidad y avisos'),
        cap(true,  isEn?'My units — add, edit, view':'Mis unidades — agregar, editar, ver'),
        cap(true,  isEn?'File incident reports':'Reportar incidentes'),
        cap(true,  isEn?'⚠️ Step 1: Verify incidents on own units':'⚠️ Paso 1: Verificar incidentes en mis unidades'),
        cap(true,  isEn?'📝 Step 2: Add resolution (unlocks admin close)':'📝 Paso 2: Agregar resolución (desbloquea cierre)'),
        cap(true,  isEn?'View all community incidents':'Ver todos los incidentes de la comunidad'),
        cap(true,  isEn?'Hover contact cards (email + WhatsApp)':'Tarjetas de contacto (email + WhatsApp)'),
        cap(standardMenuPermissions.analytics||false, isEn?'Analytics (admin-controlled)':'Analíticas (controlado por admin)'),
        cap(false, isEn?'Scope: own community, own units only':'Alcance: su comunidad, solo sus unidades'),
      ];
      const comm = [
        cap(true,  isEn?'All Standard Owner capabilities':'Todas las capacidades del propietario estándar'),
        conf(true, isEn?'Approve / decline registrations':'Aprobar / rechazar registros'),
        conf(true, isEn?'Close incidents in their community':'Cerrar incidentes en su comunidad'),
        conf(false, isEn?'Manage other owners\' listings':'Gestionar listings de otros propietarios'),
        cap(true,  isEn?'Receive community notification emails':'Recibir emails de notificación de la comunidad'),
        cap(false, isEn?'Full Admin panel':'Panel Admin completo'),
        cap(false, isEn?'Cross-community access':'Acceso a otras comunidades'),
        cap(false, isEn?'Manage roles or permissions':'Gestionar roles o permisos'),
        cap(true,  isEn?'Scope: assigned community/communities only':'Alcance: solo su(s) comunidad(es) asignada(s)'),
      ];
      const del = [
        cap(true,  isEn?'All Standard Owner capabilities':'Todas las capacidades del propietario estándar'),
        conf(dp.canApproveRegistrations, isEn?'Approve / decline registrations (all communities)':'Aprobar / rechazar registros (todas las comunidades)'),
        conf(dp.canResolveIncidents,     isEn?'Close incidents (all communities)':'Cerrar incidentes (todas las comunidades)'),
        conf(dp.canUpdateGlobalListings, isEn?'Edit any unit (all communities)':'Editar cualquier unidad (todas las comunidades)'),
        conf(dp.canDeleteGlobalListings, isEn?'Delete any unit (all communities)':'Eliminar cualquier unidad (todas las comunidades)'),
        conf(dp.canUpdateGlobalIncidents,isEn?'Edit any incident (all communities)':'Editar cualquier incidente (todas las comunidades)'),
        conf(dp.canDeleteGlobalIncidents,isEn?'Delete any incident (all communities)':'Eliminar cualquier incidente (todas las comunidades)'),
        cap(true,  isEn?'Analytics (always enabled)':'Analíticas (siempre activo)'),
        cap(true,  isEn?'Scope: platform-wide, all communities':'Alcance: toda la plataforma, todas las comunidades'),
      ];
      const glb = [
        cap(true, isEn?'All Delegate Admin capabilities':'Todas las capacidades del admin delegado'),
        cap(true, isEn?'Full Admin settings panel':'Panel de configuración admin completo'),
        cap(true, isEn?'Manage communities (create/edit/delete)':'Gestionar comunidades (crear/editar/eliminar)'),
        cap(true, isEn?'Promote community admins':'Promover admins de comunidad'),
        cap(true, isEn?'Manage user roles & permissions':'Gestionar roles y permisos de usuarios'),
        cap(true, isEn?'SLA hours + escalation email list':'Horas SLA + lista de emails de escalación'),
        cap(true, isEn?'Email templates + routing config':'Plantillas de email + configuración de envío'),
        cap(true, isEn?'Analytics — always on for global admin':'Analíticas — siempre activas para admin global'),
        cap(true, isEn?'Scope: platform-wide, no restrictions':'Alcance: toda la plataforma, sin restricciones'),
      ];
      const RoleCol = ({icon, title, color, rows, badge, scope}) => (
        <div className="role-ref-col" style={{borderTop:`3px solid ${color}`}}>
          <div className="role-ref-hdr">
            <span className="role-ref-icon">{icon}</span>
            <div><strong className="role-ref-title">{title}</strong>{badge&&<span className="role-ref-badge" style={{background:color+'22',color}}>{badge}</span>}</div>
          </div>
          {scope && <div style={{fontSize:'.7rem',color:'#6b9ba8',marginBottom:6,paddingBottom:6,borderBottom:'1px solid #f0f8fb',fontStyle:'italic'}}>{scope}</div>}
          <div className="role-ref-rows">{rows}</div>
        </div>
      );
      return (
        <div className="role-ref-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
          <RoleCol icon="🏠" title={isEn?'Standard Owner':'Propietario estándar'} color="#2a9aaa" rows={std} badge={isEn?'Default':'Por defecto'} scope={isEn?'One community · own units':'Una comunidad · propias unidades'}/>
          <RoleCol icon="🏢" title={isEn?'Community Admin':'Admin comunidad'} color="#5a9a6a" rows={comm} badge={isEn?'Per community':'Por comunidad'} scope={isEn?'Assigned communities only':'Solo comunidades asignadas'}/>
          <RoleCol icon="🛡️" title={isEn?'Delegate Admin':'Admin delegado'} color="#d9a030" rows={del} badge={isEn?'Configurable':'Configurable'} scope={isEn?'All communities':'Todas las comunidades'}/>
          <RoleCol icon="🌐" title={isEn?'Global Admin':'Admin global'} color="#0b7f4f" rows={glb} badge={isEn?'Full access':'Acceso total'} scope={isEn?'All communities · no limits':'Todas las comunidades · sin límites'}/>
        </div>
      );
    })()}
  </AdminSection>

  <AdminSection title={`⏱️ ${lt(lang,'SLA y escalaciones')}`} subtitle={lt(lang,'El recordatorio se repite cada ciclo hasta que el propietario verifique.')} action={<button className="btn-p" style={{minHeight:36,padding:'6px 14px'}} onClick={saveConfig}>💾 {isEn?'Save':'Guardar'}</button>} open={openSections.sla} onToggle={()=>toggleSection('sla')}>
    <div className="fg2"><div className="fg"><label>⏱️ {lt(lang,'SLA en horas')}</label><input type="number" min="1" value={slaHours} onChange={e=>setSlaHours(e.target.value)}/><span className="help-msg">{lt(lang,'Default: 24 horas.')}</span></div><div className="fg full"><label>✉️ {lt(lang,'Emails en copia para escalaciones')}</label><input value={escalationCcEmails} onChange={e=>setEscalationCcEmails(e.target.value)} placeholder="admin1@email.com, admin2@email.com"/><span className="help-msg">{lt(lang,'Se copian en cada recordatorio SLA, además del propietario y operador.')}</span></div><div className="fg full"><label>📈 {lt(lang,'Visibilidad de analíticas')}</label><select value={analyticsEnabled?"true":"false"} onChange={e=>setAnalyticsEnabled(e.target.value==="true")}><option value="false">{lt(lang,'Solo administrador global')}</option><option value="true">{lt(lang,'Todos los usuarios aprobados')}</option></select><span className="help-msg">{lt(lang,'El administrador global puede activar o desactivar las analíticas para toda la comunidad.')}</span></div></div>
  </AdminSection>

  <AdminSection title={`🌊 ${lt(lang,'Misión y reglas de participación')}`} subtitle={lt(lang,'Edita la misión en Español e Inglés de forma independiente.')} action={<button className="btn-p" style={{minHeight:36,padding:'6px 14px'}} onClick={saveConfig}>💾 {isEn?'Save':'Guardar'}</button>} open={openSections.mission} onToggle={()=>toggleSection('mission')}>
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,flexWrap:'wrap'}}>
      <div style={{display:'flex',gap:6}}>
        <button className={`fchip${missionLang==='es'?' fchip-on':''}`} onClick={()=>setMissionLang('es')}>🇨🇴 Español</button>
        <button className={`fchip${missionLang==='en'?' fchip-on':''}`} onClick={()=>setMissionLang('en')}>🇺🇸 English</button>
      </div>
    </div>
    {missionLang==='es' && <>
      <div className="fg2"><div className="fg full"><label>{lt(lang,'Título')}</label><textarea className="admin-textarea" rows={2} value={mission?.title||''} onChange={e=>setMissionField('title',e.target.value)}/></div><div className="fg full"><label>{lt(lang,'Subtítulo')}</label><textarea className="admin-textarea" rows={2} value={mission?.subtitle||''} onChange={e=>setMissionField('subtitle',e.target.value)}/></div><div className="fg"><label>{lt(lang,'Etiqueta de sección')}</label><input value={mission?.sectionLabel||''} onChange={e=>setMissionField('sectionLabel',e.target.value)}/></div><div className="fg full"><label>{lt(lang,'Encabezado principal')}</label><textarea className="admin-textarea" rows={2} value={mission?.heading||''} onChange={e=>setMissionField('heading',e.target.value)}/></div><div className="fg full"><label>{lt(lang,'Texto principal')}</label><textarea rows={3} value={mission?.body||''} onChange={e=>setMissionField('body',e.target.value)}/></div></div>
      <div className="card-title" style={{margin:'16px 0 10px'}}>{lt(lang,'Tarjetas de propósito')}</div>{((mission&&mission.cards)||[]).map((c,i)=><div className="fg2" key={i} style={{borderTop:'1px solid rgba(90,105,80,.12)',paddingTop:12,marginTop:8}}><div className="fg"><label>{lt(lang,'Icono')}</label><input value={c?.icon||''} onChange={e=>setMissionCard(i,'icon',e.target.value)}/></div><div className="fg"><label>{lt(lang,'Título tarjeta')} {i+1}</label><textarea className="admin-textarea" rows={2} value={c?.title||''} onChange={e=>setMissionCard(i,'title',e.target.value)}/></div><div className="fg full"><label>{lt(lang,'Texto tarjeta')} {i+1}</label><textarea rows={2} value={c?.text||''} onChange={e=>setMissionCard(i,'text',e.target.value)}/></div></div>)}
      <div className="two-col" style={{marginTop:16}}><div><div className="fg"><label>{lt(lang,'Título reglas de participación')}</label><textarea className="admin-textarea" rows={2} value={mission?.participationTitle||''} onChange={e=>setMissionField('participationTitle',e.target.value)}/></div>{((mission&&mission.participationRules)||[]).map((r,i)=><div className="fg" key={i}><label>{lt(lang,'Regla')} {i+1}</label><div style={{display:'flex',gap:8}}><textarea className="admin-textarea flex-grow" rows={2} value={r||''} onChange={e=>setMissionRule('participationRules',i,e.target.value)}/><button className="btn-ghost" onClick={()=>removeRule('participationRules',i)}>🗑️</button></div></div>)}<button className="btn-ghost" onClick={()=>addRule('participationRules')}>+ {lt(lang,'Agregar regla')}</button></div><div><div className="fg"><label>{lt(lang,'Título acceso y responsabilidad')}</label><textarea className="admin-textarea" rows={2} value={mission?.accessTitle||''} onChange={e=>setMissionField('accessTitle',e.target.value)}/></div>{((mission&&mission.accessRules)||[]).map((r,i)=><div className="fg" key={i}><label>{lt(lang,'Regla')} {i+1}</label><div style={{display:'flex',gap:8}}><textarea className="admin-textarea flex-grow" rows={2} value={r||''} onChange={e=>setMissionRule('accessRules',i,e.target.value)}/><button className="btn-ghost" onClick={()=>removeRule('accessRules',i)}>🗑️</button></div></div>)}<button className="btn-ghost" onClick={()=>addRule('accessRules')}>+ {lt(lang,'Agregar regla')}</button></div></div>
    </>}
    {missionLang==='en' && <>
      <div className="fg2"><div className="fg full"><label>Title (EN)</label><textarea className="admin-textarea" rows={2} value={missionEn?.title||''} onChange={e=>setMissionEnField('title',e.target.value)}/></div><div className="fg full"><label>Subtitle (EN)</label><textarea className="admin-textarea" rows={2} value={missionEn?.subtitle||''} onChange={e=>setMissionEnField('subtitle',e.target.value)}/></div><div className="fg"><label>Section label (EN)</label><input value={missionEn?.sectionLabel||''} onChange={e=>setMissionEnField('sectionLabel',e.target.value)}/></div><div className="fg full"><label>Main heading (EN)</label><textarea className="admin-textarea" rows={2} value={missionEn?.heading||''} onChange={e=>setMissionEnField('heading',e.target.value)}/></div><div className="fg full"><label>Main body (EN)</label><textarea rows={3} value={missionEn?.body||''} onChange={e=>setMissionEnField('body',e.target.value)}/></div></div>
      <div className="card-title" style={{margin:'16px 0 10px'}}>Purpose cards (EN)</div>{((missionEn&&missionEn.cards)||[]).map((c,i)=><div className="fg2" key={i} style={{borderTop:'1px solid rgba(90,105,80,.12)',paddingTop:12,marginTop:8}}><div className="fg"><label>Icon</label><input value={c?.icon||''} onChange={e=>setMissionEnCard(i,'icon',e.target.value)}/></div><div className="fg"><label>Card title {i+1}</label><textarea className="admin-textarea" rows={2} value={c?.title||''} onChange={e=>setMissionEnCard(i,'title',e.target.value)}/></div><div className="fg full"><label>Card text {i+1}</label><textarea rows={2} value={c?.text||''} onChange={e=>setMissionEnCard(i,'text',e.target.value)}/></div></div>)}
      <div className="two-col" style={{marginTop:16}}><div><div className="fg"><label>Participation title (EN)</label><textarea className="admin-textarea" rows={2} value={missionEn?.participationTitle||''} onChange={e=>setMissionEnField('participationTitle',e.target.value)}/></div>{((missionEn&&missionEn.participationRules)||[]).map((r,i)=><div className="fg" key={i}><label>Rule {i+1}</label><div style={{display:'flex',gap:8}}><textarea className="admin-textarea flex-grow" rows={2} value={r||''} onChange={e=>setMissionEnRule('participationRules',i,e.target.value)}/><button className="btn-ghost" onClick={()=>removeEnRule('participationRules',i)}>🗑️</button></div></div>)}<button className="btn-ghost" onClick={()=>addEnRule('participationRules')}>+ Add rule</button></div><div><div className="fg"><label>Access title (EN)</label><textarea className="admin-textarea" rows={2} value={missionEn?.accessTitle||''} onChange={e=>setMissionEnField('accessTitle',e.target.value)}/></div>{((missionEn&&missionEn.accessRules)||[]).map((r,i)=><div className="fg" key={i}><label>Rule {i+1}</label><div style={{display:'flex',gap:8}}><textarea className="admin-textarea flex-grow" rows={2} value={r||''} onChange={e=>setMissionEnRule('accessRules',i,e.target.value)}/><button className="btn-ghost" onClick={()=>removeEnRule('accessRules',i)}>🗑️</button></div></div>)}<button className="btn-ghost" onClick={()=>addEnRule('accessRules')}>+ Add rule</button></div></div>
    </>}
  </AdminSection>

  <AdminSection title={`🧭 ${lt(lang,'Permisos estándar de menú')}`} subtitle={lt(lang,'Activa o desactiva qué menús ven los usuarios estándar. Dashboard siempre queda disponible.')} action={<button className="btn-ghost" onClick={saveStandardMenuPermissions}>💾 {lt(lang,'Guardar permisos de menú')}</button>} open={openSections.menu} onToggle={()=>toggleSection('menu')}>
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{Object.keys(DEFAULT_STANDARD_MENU_PERMISSIONS).map(k=><label key={k} className="chip c-gray" style={{cursor:'pointer'}}><input type="checkbox" checked={!!standardMenuPermissions[k]} disabled={k==='dashboard'} onChange={()=>toggleMenuPermission(k)} style={{marginRight:6}}/>{MENU_LABELS[k]?.[lang==='en'?'en':'es']||k}</label>)}</div>
  </AdminSection>

  <AdminSection title={`🛡️ ${lt(lang,'Permisos predeterminados del delegado')}`} subtitle={`${lt(lang,'Define qué permisos recibe un administrador delegado nuevo por defecto.')} ${lt(lang,'Los permisos estándar siempre se heredan.')}`} action={<button className="btn-ghost" onClick={saveDefaultDelegatePermissions}>💾 {lt(lang,'Guardar permisos predeterminados')}</button>} open={openSections.delegate} onToggle={()=>toggleSection('delegate')}>
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{Object.keys(DEFAULT_DELEGATE_PERMISSIONS).map(k=><label key={k} className="chip c-gray" style={{cursor:'pointer'}}><input type="checkbox" checked={!!defaultDelegatePermissions[k]} onChange={()=>toggleDefaultDelegatePermission(k)} style={{marginRight:6}}/>{PERMISSION_LABELS[k]?.[lang==='en'?'en':'es']||k}</label>)}</div>
  </AdminSection>

  <AdminSection title={`🏢 ${isEn?'Community Admin Default Permissions':'Permisos predeterminados del admin de comunidad'}`} subtitle={isEn?'Define what permissions a new community admin receives by default when promoted. Includes content editing rights when overrides are enabled for that community.':'Define qué permisos recibe un nuevo admin de comunidad al ser promovido. Incluye derechos de edición de contenido cuando los overrides están habilitados para esa comunidad.'} action={<button className="btn-ghost" onClick={saveDefaultCommunityAdminPermissions}>💾 {isEn?'Save community admin defaults':'Guardar permisos predeterminados'}</button>} open={openSections.communityAdminPerms} onToggle={()=>toggleSection('communityAdminPerms')}>
    <div style={{marginBottom:10,padding:'8px 12px',background:'#f0f8fb',borderRadius:8,fontSize:'.78rem',color:'#2a5a6a'}}>
      {isEn?'Content editing permissions (mission, UI labels, tooltips) only take effect when "Config Overrides Enabled" is turned on for the community.':'Los permisos de edición de contenido (misión, etiquetas UI, tooltips) solo tienen efecto cuando "Config Overrides Enabled" está activado para la comunidad.'}
    </div>
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{Object.keys(DEFAULT_COMMUNITY_ADMIN_PERMISSIONS).map(k=><label key={k} className="chip c-gray" style={{cursor:'pointer'}}><input type="checkbox" checked={!!defaultCommunityAdminPermissions[k]} onChange={()=>toggleDefaultCommunityAdminPermission(k)} style={{marginRight:6}}/>{COMMUNITY_ADMIN_PERMISSION_LABELS[k]?.[isEn?'en':'es']||k}</label>)}</div>
  </AdminSection>

  <AdminSection title={`👥 ${isEn?'User roles & permissions':'Roles y permisos de usuarios'}`}
    subtitle={isEn?'Platform roles (Global Admin, Delegate Admin) apply across all communities. Community Admin roles are per-community and managed in the Communities panel below.':'Los roles de plataforma (Admin global, Admin delegado) aplican a todas las comunidades. El rol de Admin de comunidad es por comunidad y se gestiona en el panel de Comunidades.'}
    action={<button className="btn-ghost" onClick={loadUsers}>{usersLoading?lt(lang,'Cargando...'):lt(lang,'Actualizar')}</button>}
    open={openSections.users} onToggle={()=>toggleSection('users')}>
    {users.length===0?<Empty icon="👥" msg={lt(lang,'No hay usuarios aprobados todavía.')}/>:(
      <div>
        {/* Role scope legend */}
        <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:14,padding:'8px 12px',background:'#f0f8fb',borderRadius:8,fontSize:'.75rem',color:'#2a5a6a'}}>
          <span>🌐 <strong>{isEn?'Global Admin':'Admin global'}</strong> — {isEn?'all communities, set via GLOBAL_ADMIN_EMAILS env var':'todas las comunidades, configurado por variable de entorno'}</span>
          <span style={{color:'#ccc'}}>·</span>
          <span>🛡️ <strong>{isEn?'Delegate Admin':'Admin delegado'}</strong> — {isEn?'all communities, configurable permissions':'todas las comunidades, permisos configurables'}</span>
          <span style={{color:'#ccc'}}>·</span>
          <span>🏢 <strong>{isEn?'Community Admin':'Admin comunidad'}</strong> — {isEn?'per community, managed in Communities panel':'por comunidad, se gestiona en el panel de Comunidades'}</span>
          <span style={{color:'#ccc'}}>·</span>
          <span>🏠 <strong>{isEn?'Standard Owner':'Propietario'}</strong> — {isEn?'own units only':'solo sus unidades'}</span>
        </div>
        {/* Filter bar */}
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
          <input placeholder={isEn?'Search by name or email…':'Buscar por nombre o email…'} value={usersSearch} onChange={e=>setUsersSearch(e.target.value)}
            style={{flex:'1 1 200px',padding:'6px 10px',borderRadius:6,border:'1px solid #cce7ee',fontSize:'.82rem'}}/>
          <select value={usersCommunityFilter} onChange={e=>setUsersCommunityFilter(e.target.value)}
            style={{padding:'6px 8px',borderRadius:6,border:'1px solid #cce7ee',fontSize:'.82rem',flex:'0 1 200px'}}>
            <option value="">{isEn?'All communities':'Todas las comunidades'}</option>
            {communities.map(c=><option key={c.id} value={c.id}>{isEn?(c.name_en||c.name):c.name}</option>)}
          </select>
        </div>
        {(()=>{
          const filteredUsers = users.filter(u => {
            const q = usersSearch.trim().toLowerCase();
            if (q && ![(u.name||'').toLowerCase(),(u.email||'').toLowerCase()].some(v=>v.includes(q))) return false;
            if (usersCommunityFilter && !(u.communityIds||[]).includes(usersCommunityFilter) && !(u.communityMemberships||[]).some(m=>m.communityId===usersCommunityFilter)) return false;
            return true;
          });
          return (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {filteredUsers.map((u,idx)=>{
            const isGlb = u.role==='global_admin';
            const isDel = u.role==='delegate_admin';
            const platformBadge = isGlb
              ? { icon:'🌐', label:isEn?'Global Admin':'Admin global', color:'#0b7f4f', bg:'#e8f5ec' }
              : isDel
              ? { icon:'🛡️', label:isEn?'Delegate Admin':'Admin delegado', color:'#5a2d82', bg:'#f3eafd' }
              : { icon:'🏠', label:isEn?'Standard Owner':'Propietario', color:'#2a5a6a', bg:'#eef6f8' };
            return (
              <div key={u.uid||u.email} style={{border:'1px solid #e0eef2',borderRadius:12,padding:'12px 14px',background:'#fff'}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:12,flexWrap:'wrap'}}>
                  {/* Identity */}
                  <div style={{flex:'1 1 200px',minWidth:160}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:2}}>
                      <span style={{fontWeight:700,fontSize:'.85rem',color:'#17313a'}}>{u.name||u.email}</span>
                      <span style={{fontSize:'.68rem',fontWeight:700,padding:'1px 8px',borderRadius:999,background:platformBadge.bg,color:platformBadge.color,whiteSpace:'nowrap'}}>{platformBadge.icon} {platformBadge.label}</span>
                      {u.envGlobal && <span style={{fontSize:'.65rem',background:'#fff3cd',color:'#856404',padding:'1px 7px',borderRadius:999,border:'1px solid #ffc107'}} title="Set via GLOBAL_ADMIN_EMAILS environment variable">env</span>}
                    </div>
                    <div style={{fontSize:'.72rem',color:'#6b9ba8'}}>
                      <span className="copy-inline">{u.email}
                        <button type="button" onClick={()=>copyText(u.email,showToast,lang)}>📋</button>
                        <button type="button" onClick={()=>contactProps.onEmail({name:u.name,email:u.email,apartments:(lookupContact(contactProps.directory,{uid:u.uid,email:u.email,name:u.name}).apartments||[])})}>✉️</button>
                      </span>
                    </div>
                  </div>
                  {/* Platform role selector */}
                  <div style={{flex:'0 0 auto',minWidth:160}}>
                    <div style={{fontSize:'.7rem',fontWeight:700,color:'#496674',marginBottom:4,textTransform:'uppercase',letterSpacing:'.04em'}}>{isEn?'Platform role (all communities)':'Rol de plataforma (todas las comunidades)'}</div>
                    <select value={u.role||'user'} disabled={u.envGlobal}
                      onChange={e=>setUsers(prev=>prev.map((x,i)=>i===idx?{...x,role:e.target.value}:x))}
                      style={{fontSize:'.8rem',padding:'4px 8px',borderRadius:6,border:'1px solid #cce7ee',background:u.envGlobal?'#f8f8f6':'#fff',maxWidth:200}}>
                      <option value="user">{isEn?'Standard Owner':'Propietario estándar'}</option>
                      <option value="delegate_admin">{isEn?'Delegate Admin':'Admin delegado'}</option>
                      <option value="global_admin">{isEn?'Global Admin':'Admin global'}</option>
                    </select>
                    {u.envGlobal && <div style={{fontSize:'.68rem',color:'#856404',marginTop:2}}>GLOBAL_ADMIN_EMAILS</div>}
                    {!u.envGlobal && <button className="bsm bs-edit" style={{marginTop:6,fontSize:'.72rem',padding:'3px 10px'}} onClick={()=>saveUserPermissions(u)}>{isEn?'Save platform role':'Guardar rol'}</button>}
                  </div>
                  {/* Delegate permissions (only when delegate_admin) */}
                  {isDel && (
                    <div style={{flex:'1 1 180px'}}>
                      <div style={{fontSize:'.7rem',fontWeight:700,color:'#496674',marginBottom:4,textTransform:'uppercase',letterSpacing:'.04em'}}>{isEn?'Delegate permissions (platform-wide)':'Permisos delegado (toda la plataforma)'}</div>
                      <div style={{display:'flex',flexDirection:'column',gap:3}}>
                        {Object.keys(DEFAULT_DELEGATE_PERMISSIONS).map(k=>(
                          <span key={k} style={{display:'flex',alignItems:'center',gap:6,fontSize:'.75rem',color:defaultDelegatePermissions[k]?'#087346':'#aabcb8'}}>
                            {defaultDelegatePermissions[k]?'✅':'—'} {PERMISSION_LABELS[k]?.[isEn?'en':'es']||k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Community admin roles */}
                  <div style={{flex:'1 1 180px'}}>
                    <div style={{fontSize:'.7rem',fontWeight:700,color:'#496674',marginBottom:4,textTransform:'uppercase',letterSpacing:'.04em'}}>{isEn?'Community admin roles':'Roles de admin de comunidad'}</div>
                    {(u.communityIds||[]).length === 0
                      ? <div style={{fontSize:'.75rem',color:'#a0b8c0',fontStyle:'italic'}}>{isEn?'No communities with listings':'Sin comunidades con listings'}</div>
                      : <div style={{display:'flex',flexDirection:'column',gap:5}}>
                          {(u.communityIds||[]).map(cid => {
                            const comm = communities.find(c=>c.id===cid);
                            const membership = (u.communityMemberships||[]).find(m=>m.communityId===cid&&m.role==='community_admin');
                            const isCommAdmin = !!membership;
                            const canToggle = !isGlb && !isDel;
                            const commName = isEn ? (comm?.name_en||comm?.name||cid) : (comm?.name||cid);
                            const perms = membership?.permissions || {};
                            return (
                              <div key={cid}>
                                <label style={{display:'flex',alignItems:'center',gap:6,fontSize:'.78rem',cursor:canToggle?'pointer':'default',color:'#17313a'}}>
                                  <input type="checkbox" checked={isCommAdmin} disabled={!canToggle}
                                    onChange={e=>toggleUserCommunityAdmin(u, cid, e.target.checked)}
                                    style={{accentColor:'#2F4F3A',width:14,height:14}}/>
                                  <span style={{fontWeight:isCommAdmin?700:400}}>🏢 {commName}</span>
                                  {isCommAdmin && <span style={{fontSize:'.68rem',color:'#6b9ba8'}}>
                                    {[perms.canApproveRegistrations&&(isEn?'Approve':'Aprobar'),perms.canResolveIncidents&&(isEn?'Resolve':'Resolver'),perms.canManageListings&&(isEn?'Manage':'Gestionar')].filter(Boolean).join(' · ')||'—'}
                                  </span>}
                                </label>
                              </div>
                            );
                          })}
                          {isDel && <div style={{fontSize:'.68rem',color:'#8a9fa5',fontStyle:'italic'}}>{isEn?'Delegate admins have full access platform-wide':'Los admins delegados tienen acceso total en toda la plataforma'}</div>}
                        </div>
                    }
                  </div>
                </div>
              </div>
            );
          })}
        </div>
          );
        })()}
      </div>
    )}
  </AdminSection>

        {/* ── Navigation order & landing ── */}
        <AdminSection title={isEn?'🗺️ Navigation & Landing':'🗺️ Navegación y página de inicio'} subtitle={isEn?'Set the default landing page and primary nav items per role.':'Configura la página de inicio y los ítems de navegación por rol.'} open={openSections['navConfig']} onToggle={()=>toggleSection('navConfig')}>
          <NavConfigEditor config={config} onSave={cfg=>onSave({nav_config:JSON.stringify(cfg)})} showToast={showToast}/>
        </AdminSection>

        {/* ── UI Labels — organized by page/section with expand/collapse ── */}
  <AdminSection title={`🏷️ ${isEn?'UI Labels':'Etiquetas de la interfaz'}`} subtitle={isEn?'Customize any text in the app by page section. Changes apply to all users immediately after saving.':'Personaliza cualquier texto de la app por sección de página. Los cambios se aplican al guardar.'} action={<button className="btn-ghost" onClick={saveUiLabels}>💾 {isEn?'Save labels':'Guardar etiquetas'}</button>} open={openSections.uiLabels} onToggle={()=>toggleSection('uiLabels')}>
    {(()=>{
      const currentLabels = uiLabelLang==='en' ? uiLabelsEn : uiLabelsEs;
      const setLabel = (key, val) => {
        uiLabelLang==='en' ? setUiLabelsEn(p=>({...p,[key]:val})) : setUiLabelsEs(p=>({...p,[key]:val}));
      };
      const resetLabel = (key) => {
        uiLabelLang==='en' ? setUiLabelsEn(p=>{const n={...p};delete n[key];return n;}) : setUiLabelsEs(p=>{const n={...p};delete n[key];return n;});
      };
      const getDefVal = (key) => {
        return APP_I18N[key]?.[uiLabelLang==='en'?'en':'es'] || APP_I18N[key]?.es || '';
      };

      // Page/section oriented groups — ordered by how users encounter them
      const labelGroups = [
        { id:'nav',    icon:'🧭', label:isEn?'Navigation & menu':'Navegación y menú',          prefixes:['nav.'] },
        { id:'dash',   icon:'📊', label:isEn?'Dashboard':'Dashboard',                           prefixes:['dashboard.','actions.','smart.'] },
        { id:'inc',    icon:'⚠️', label:isEn?'Incidents & Reports':'Incidentes y Reportes',     prefixes:['reports.','workflow.','incidents.'] },
        { id:'form',   icon:'📝', label:isEn?'Forms & Validation':'Formularios y validación',   prefixes:['form.','validation.','modal.'] },
        { id:'my',     icon:'🔑', label:isEn?'My Units':'Mis Unidades',                         prefixes:['my.'] },
        { id:'listing',icon:'🏠', label:isEn?'Inventory':'Inventario',                          prefixes:['listings.'] },
        { id:'notif',  icon:'🔔', label:isEn?'Notifications & Alerts':'Notificaciones y Alertas', prefixes:['notifications.'] },
        { id:'roles',  icon:'👥', label:isEn?'Roles & Permissions':'Roles y permisos',          prefixes:['roles.'] },
        { id:'common', icon:'🔤', label:isEn?'Common & Other':'Común y otros',                  prefixes:['common.','tooltips.',null] },
      ];

      const q = uiLabelSearch.trim().toLowerCase();
      const allKeys = Object.keys(APP_I18N).sort();
      const filteredKeys = q
        ? allKeys.filter(k=>{
            const dEn=String(APP_I18N[k]?.en||'').toLowerCase();
            const dEs=String(APP_I18N[k]?.es||'').toLowerCase();
            const custom=String(currentLabels[k]||'').toLowerCase();
            return k.toLowerCase().includes(q)||dEn.includes(q)||dEs.includes(q)||custom.includes(q);
          })
        : allKeys;

      const totalModified = Object.keys(currentLabels).length;

      // Render a single label row
      const LabelRow = ({key:_,rkey,shortKey,defVal}) => {
        const custom = currentLabels[rkey];
        const isChanged = custom !== undefined;
        return (
          <div className={`ula-row${isChanged?' ula-row-changed':''}`}>
            <div className="ula-row-key">
              <code className="ula-key" title={rkey}>{shortKey}</code>
              {isChanged&&<span className="ula-changed-dot" title={isEn?'Customized':'Personalizado'}>●</span>}
            </div>
            <div className="ula-row-content">
              <div className="ula-default">{defVal||<span style={{color:'#aaa',fontStyle:'italic'}}>{isEn?'(empty)':'(vacío)'}</span>}</div>
              <div className="ula-input-wrap">
                <input className="ula-input" value={isChanged?custom:defVal} onChange={e=>setLabel(rkey,e.target.value)}
                  onFocus={e=>{if(!isChanged){setLabel(rkey,defVal);setTimeout(()=>e.target.select(),0);}}}
                  placeholder={defVal}/>
                {isChanged&&<button type="button" className="ula-reset" title={isEn?'Reset to default':'Restablecer'} onClick={()=>resetLabel(rkey)}>↩</button>}
              </div>
            </div>
          </div>
        );
      };

      return (
        <div className="ula-wrap">
          <>
          {/* Toolbar */}
          <div className="ula-toolbar">
            <div className="ula-lang-toggle">
              <button className={`fchip${uiLabelLang==='es'?' fchip-on':''}`} onClick={()=>setUiLabelLang('es')}>🇨🇴 Español</button>
              <button className={`fchip${uiLabelLang==='en'?' fchip-on':''}`} onClick={()=>setUiLabelLang('en')}>🇺🇸 English</button>
            </div>
            <div style={{position:'relative',flex:1,maxWidth:340}}>
              <input className="search" style={{paddingRight:32}} placeholder={isEn?'Search all labels…':'Buscar en todas las etiquetas…'} value={uiLabelSearch} onChange={e=>setUiLabelSearch(e.target.value)}/>
              {uiLabelSearch&&<button className="inc-search-clear" onClick={()=>setUiLabelSearch('')}>✕</button>}
            </div>
            <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
              {totalModified>0&&<span className="ula-modified-badge">{totalModified} {isEn?'overridden':'modificadas'}</span>}
              {!q&&<button type="button" className="bsm" style={{fontSize:'.72rem'}}
                onClick={()=>setUiLabelOpenGroups(s=>{const allOpen=labelGroups.every(g=>s[g.id]);return Object.fromEntries(labelGroups.map(g=>[g.id,!allOpen]));})}>
                {labelGroups.every(g=>uiLabelOpenGroups[g.id])?(isEn?'Collapse all':'Colapsar todo'):(isEn?'Expand all':'Expandir todo')}
              </button>}
            </div>
          </div>

          {/* Search results — flat list */}
          {q ? (
            <div className="ula-group ula-group-open">
              <div className="ula-group-hdr ula-group-hdr-plain">
                🔍 {filteredKeys.length} {isEn?`result${filteredKeys.length!==1?'s':''}`:`resultado${filteredKeys.length!==1?'s':''}`}
              </div>
              <div className="ula-rows">
                {filteredKeys.map(key=>{
                  const defVal=getDefVal(key);
                  return <LabelRow key={key} rkey={key} shortKey={key} defVal={defVal}/>;
                })}
              </div>
            </div>
          ) : (
            /* Grouped by page/section — each group has its own expand/collapse */
            labelGroups.map(g=>{
              const gKeys = g.prefixes.includes(null)
                ? filteredKeys.filter(k=>!labelGroups.slice(0,-1).some(lg=>lg.prefixes.filter(Boolean).some(p=>k.startsWith(p))))
                : filteredKeys.filter(k=>g.prefixes.some(p=>k.startsWith(p)));
              if(!gKeys.length) return null;
              const isOpen = !!uiLabelOpenGroups[g.id];
              const groupModified = gKeys.filter(k=>currentLabels[k]!==undefined).length;
              return (
                <div key={g.id} className={`ula-group${isOpen?' ula-group-open':''}`}>
                  <button type="button" className="ula-group-toggle" onClick={()=>toggleUlaGroup(g.id)}>
                    <span className="ula-group-icon">{g.icon}</span>
                    <span className="ula-group-label">{g.label}</span>
                    <span className="ula-group-count">{gKeys.length} {isEn?'labels':'etiquetas'}</span>
                    {groupModified>0&&<span className="ula-modified-badge" style={{fontSize:'.65rem',padding:'1px 7px'}}>{groupModified} {isEn?'edited':'editadas'}</span>}
                    <span className={`ula-group-chev${isOpen?' ula-group-chev-open':''}`}>›</span>
                  </button>
                  {isOpen&&(
                    <div className="ula-rows">
                      {gKeys.map(key=>{
                        const shortKey = g.prefixes.filter(Boolean).reduce((s,p)=>s.startsWith(p)?s.slice(p.length):s, key);
                        const defVal=getDefVal(key);
                        return <LabelRow key={key} rkey={key} shortKey={shortKey} defVal={defVal}/>;
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}

          <div className="mact" style={{marginTop:16}}>
            <button className="btn-ghost" onClick={()=>{if(uiLabelLang==='en')setUiLabelsEn({});else setUiLabelsEs({});}}>↩ {isEn?'Reset all to defaults':'Restablecer todo'}</button>
            <button className="btn-p" onClick={saveUiLabels}>💾 {isEn?'Save labels':'Guardar etiquetas'}</button>
          </div>
          </>
        </div>
      );
    })()}
  </AdminSection>

  <AdminSection title={`💡 ${appText(lang,'tooltips.adminTitle')}`} subtitle={appText(lang,'tooltips.adminSub')} action={<button className="btn-ghost" onClick={saveTooltips}>💾 {appText(lang,'tooltips.save')}</button>} open={openSections.tooltips} onToggle={()=>toggleSection('tooltips')}>
    {(()=>{
      const tipsIsEn = lang==='en';
      const TOOLTIP_GROUPS = [
        { id:'actions',  label: tipsIsEn?'⚡ Action Buttons':'⚡ Botones de acción',                    keys:['reportIncident','addListing'] },
        { id:'listing',  label: tipsIsEn?'🏠 Listing / Registration Fields':'🏠 Campos de listing / registro', keys:['aptNumber','listingEmail','ownerWhatsapp','operator','operatorEmail','operatorWhatsapp'] },
        { id:'incident', label: tipsIsEn?'⚠️ Incident Fields':'⚠️ Campos de incidente',               keys:['incidentApartment','incidentType','incidentCategory','incidentDescription','verifyIncident','resolveIncident'] },
      ];
      const KEY_LABELS = {
        reportIncident:      { es:'Botón "Reportar incidente"',        en:'"Report Incident" button' },
        addListing:          { es:'Botón "Registrar unidad"',           en:'"Add Listing" button' },
        aptNumber:           { es:'Campo número de apartamento',        en:'Apartment number field' },
        listingEmail:        { es:'Campo email del listing',            en:'Listing email field' },
        ownerWhatsapp:       { es:'Campo WhatsApp propietario',         en:'Owner WhatsApp field' },
        operator:            { es:'Campo operador',                     en:'Operator field' },
        operatorEmail:       { es:'Campo email del operador',           en:'Operator email field' },
        operatorWhatsapp:    { es:'Campo WhatsApp operador',            en:'Operator WhatsApp field' },
        incidentApartment:   { es:'Campo apartamento (incidente)',      en:'Apartment field (incident)' },
        incidentType:        { es:'Campo tipo de incidente',            en:'Incident type field' },
        incidentCategory:    { es:'Campo categoría de incidente',       en:'Incident category field' },
        incidentDescription: { es:'Campo descripción del incidente',    en:'Incident description field' },
        verifyIncident:      { es:'Botón "Verificar incidente"',        en:'"Verify Incident" button' },
        resolveIncident:     { es:'Botón "Resolver incidente"',         en:'"Resolve Incident" button' },
      };
      return (
        <div>
          <div className="table-wrap">
            <table className="admin-table">
              <thead><tr><th>{appText(lang,'tooltips.key')}</th><th style={{minWidth:180}}>{appText(lang,'tooltips.spanish')}</th><th style={{minWidth:180}}>{appText(lang,'tooltips.english')}</th></tr></thead>
              <tbody>
                {TOOLTIP_GROUPS.flatMap(group=>[
                  <tr key={`${group.id}-hdr`}><td colSpan={3} style={{background:'#e8f4f7',fontWeight:700,fontSize:'.8rem',padding:'8px 12px',color:'#1a4a5a',letterSpacing:'.02em',borderTop:'2px solid #c4dde6'}}>{group.label}</td></tr>,
                  ...group.keys.map(k=>(
                    <tr key={k}>
                      <td>
                        <div style={{fontWeight:600,fontSize:'.78rem',color:'#2a5a6a',marginBottom:2}}>{KEY_LABELS[k]?.[tipsIsEn?'en':'es']||k}</div>
                        <code style={{fontSize:'.72rem',color:'#888'}}>{k}</code>
                      </td>
                      <td>
                        <textarea className="admin-tooltip-textarea" rows={3} value={tooltipsEs[k]||''} onChange={e=>setTooltipsEs(v=>({...v,[k]:e.target.value}))}/>
                      </td>
                      <td>
                        <textarea className="admin-tooltip-textarea" rows={3} value={tooltipsEn[k]||''} onChange={e=>setTooltipsEn(v=>({...v,[k]:e.target.value}))}/>
                      </td>
                    </tr>
                  ))
                ])}
              </tbody>
            </table>
          </div>
        </div>
      );
    })()}
  </AdminSection>

  <AdminSection title={`📨 ${lt(lang,'Plantillas de emails')}`} subtitle={lt(lang,'Edita y guarda la versión en Español e Inglés por separado. El sistema envía según la preferencia del destinatario.')} action={tplLoading?<span className="sync-pill"><span className="spinner-sm"/> {lt(lang,'Cargando...')}</span>:null} open={openSections.email} onToggle={()=>{ toggleSection('email'); if (!openSections.email && !communities.length) loadCommunities(); }}>
    {templateEntries.length===0?<Empty icon="📨" msg={ui(lang,'templatesEmpty')}/>:<><div className="fg2"><div className="fg"><label>{lang==='en'?'Community':'Comunidad'}</label><select value={templateCommunityId} onChange={e=>setTemplateCommunityId(e.target.value)}><option value="__global__">🌐 {lang==='en'?'Global (all communities)':'Global (todas las comunidades)'}</option>{communities.map(c=><option key={c.id} value={c.id}>{lang==='en'?(c.name_en||c.name):c.name} ({c.id})</option>)}</select></div><div className="fg"><label>{lt(lang,'Idioma de plantilla')}</label><select value={templateLang} onChange={e=>setTemplateLang(e.target.value)}><option value="es-CO">{lt(lang,'Español')}</option><option value="en">{lt(lang,'Inglés')}</option></select></div><div className="fg"><label>{lt(lang,'Tipo de notificación')}</label><select value={selectedKey} onChange={e=>setSelectedTemplate(e.target.value)}>{templateEntries.map(([k,tpl])=><option key={k} value={k}>{tpl?.label||k}</option>)}</select></div><div className="fg full"><span className="help-msg">{lt(lang,'Variables disponibles')}: {selectedVars.map(v=>'{{'+v+'}}').join(', ')}</span></div><div className="fg full"><label>{lt(lang,'Asunto')}</label><input value={selected?.subject||''} onChange={e=>updateTpl('subject',e.target.value)}/></div><div className="fg full"><label>{lt(lang,'Texto plano')}</label><textarea rows={6} value={selected?.text||''} onChange={e=>updateTpl('text',e.target.value)}/></div><div className="fg full"><label>{lt(lang,'HTML del email')}</label><textarea rows={10} value={selected?.html||''} onChange={e=>updateTpl('html',e.target.value)}/><span className="help-msg">{lt(lang,'Conserva variables como href="{{incidentLink}}".')}</span></div></div><div className="mact"><button className="btn-p" onClick={saveTemplates}>💾 {lt(lang,'Guardar plantillas de email')}</button>{templateCommunityId!=='__global__'&&<span style={{fontSize:'.78rem',color:'#d9b45a',marginLeft:8}}>⚠️ {lang==='en'?`Editing community: ${templateCommunityId}`:`Editando comunidad: ${templateCommunityId}`}</span>}</div></>}
  </AdminSection>

  {/* ── Email notification routing ─────────────────────────────────────── */}
  {(()=>{
    const isEn = lang==='en';
    const tog = (key,field,val) => setEmailNotifConfig(c=>({...c,[key]:{...c[key],[field]:val}}));
    const GROUPS = [
      { id:'incident', label: isEn?'⚠️ Incidents':'⚠️ Incidentes', types:[
        { key:'incident_new',                label:isEn?'New incident filed':'Incidente nuevo reportado',               cols:['reporter','owner','operator','communityAdmin','delegateAdmin','globalAdmin'] },
        { key:'incident_sla',                label:isEn?'SLA escalation':'Escalación SLA',                             cols:['reporter','owner','operator','communityAdmin','delegateAdmin','globalAdmin'] },
        { key:'incident_sla_notification',   label:isEn?'SLA notification (initial)':'SLA — notificación inicial',     cols:['reporter','owner','operator','communityAdmin','delegateAdmin','globalAdmin'] },
        { key:'incident_sla_reminder',       label:isEn?'SLA reminder (cycle)':'SLA — recordatorio (ciclo)',           cols:['reporter','owner','operator','communityAdmin','delegateAdmin','globalAdmin'] },
        { key:'incident_verified',           label:isEn?'Step 1 verified by owner':'Paso 1 verificado por propietario', cols:['reporter','owner','operator','communityAdmin','delegateAdmin','globalAdmin'] },
        { key:'incident_resolution_added',   label:isEn?'Step 2 resolution added (ready to close)':'Paso 2 respuesta agregada (listo para cerrar)', cols:['reporter','owner','operator','communityAdmin','delegateAdmin','globalAdmin'] },
        { key:'incident_resolved',           label:isEn?'Incident closed':'Incidente cerrado',                         cols:['reporter','owner','operator','communityAdmin','delegateAdmin','globalAdmin'] },
      ]},
      { id:'registration', label: isEn?'📝 Registrations':'📝 Registros', types:[
        { key:'registration_submitted',    label:isEn?'Received (to registrant)':'Recibido (al registrante)',     cols:['owner'] },
        { key:'registration_approved',     label:isEn?'Approved (to registrant)':'Aprobado (al registrante)',     cols:['owner','communityAdmin','delegateAdmin','globalAdmin'] },
        { key:'registration_declined',     label:isEn?'Declined (to registrant)':'Rechazado (al registrante)',    cols:['owner','communityAdmin','delegateAdmin','globalAdmin'] },
        { key:'registration_reviewer',     label:isEn?'Pending — notify reviewers':'Pendiente — avisar revisores', cols:['owner','communityAdmin','delegateAdmin','globalAdmin'] },
      ]},
      { id:'listing', label: isEn?'🏠 Listings':'🏠 Listings', types:[
        { key:'listing_created',           label:isEn?'Listing created':'Listing creado',   cols:['owner','operator','communityAdmin','delegateAdmin','globalAdmin'] },
        { key:'listing_updated',           label:isEn?'Listing updated':'Listing actualizado', cols:['owner','operator','communityAdmin','delegateAdmin','globalAdmin'] },
        { key:'listing_deleted',           label:isEn?'Listing deleted':'Listing eliminado', cols:['owner','operator','communityAdmin','delegateAdmin','globalAdmin'] },
      ]},
    ];
    const COL_INFO = [
      { key:'reporter',      icon:'📋', label: isEn?'Reporter — individual person who filed this incident or request':'Reportador — persona específica que reportó el incidente', short: isEn?'Rep.':'Rep.', tag: isEn?'individual':'individual' },
      { key:'owner',         icon:'🏠', label: isEn?'Owner — individual listing owner / registrant':'Propietario — dueño específico del listing o registro', short: isEn?'Owner':'Prop.', tag: isEn?'individual':'individual' },
      { key:'operator',      icon:'🔧', label: isEn?'Operator — individual listing operator (if set)':'Operador — operador específico del listing (si está configurado)', short: isEn?'Oper.':'Oper.', tag: isEn?'individual':'individual' },
      { key:'communityAdmin',icon:'🏢', label: isEn?'Community Admins — admins of this community only (group)':'Admins de comunidad — admins de esta comunidad específica (grupo)', short: isEn?'Comm.':'Com.', tag: isEn?'group':'grupo' },
      { key:'delegateAdmin', icon:'👥', label: isEn?'Delegate Admins — all delegates with incident permission, platform-wide (group)':'Admins Delegados — todos los delegados con permiso de incidentes, en toda la plataforma (grupo)', short: isEn?'Deleg.':'Deleg.', tag: isEn?'group':'grupo' },
      { key:'globalAdmin',   icon:'🌐', label: isEn?'Global Admins — all configured global admins (group)':'Admins Globales — todos los admins globales configurados (grupo)', short: isEn?'Global':'Global', tag: isEn?'group':'grupo' },
    ];
    return (
      <AdminSection
        title={`📧 ${isEn?'Email Routing':'Enrutamiento de emails'}`}
        subtitle={isEn?'Enable or disable email types and choose who receives them. Individual recipients receive the email directly at their own address; group recipients are all members of that role.':'Activa o desactiva tipos de email y elige quiénes los reciben. Los destinatarios individuales reciben el email en su dirección propia; los grupos incluyen a todos los miembros de ese rol.'}
        action={<button className="bsm" onClick={saveEmailNotifConfig} disabled={emailNotifSaving} style={{whiteSpace:'nowrap'}}>{emailNotifSaving?(isEn?'Saving...':'Guardando...'):`💾 ${isEn?'Save':'Guardar'}`}</button>}
        open={openSections.emailNotif}
        onToggle={()=>toggleSection('emailNotif')}
      >
        {emailNotifLoading
          ? <div style={{padding:'12px 0',color:'#2a5a6a'}}><span className="spinner-sm"/> {lt(lang,'Cargando...')}</div>
          : <>
            {/* Legend */}
            <div className="enc-legend">
              {COL_INFO.map(c=>(
                <span key={c.key}>
                  <strong>{c.icon}</strong> {c.label}
                  {c.tag&&<span className={`enc-tag enc-tag-${c.tag}`}>{c.tag}</span>}
                </span>
              ))}
              <span style={{color:'#9aafb0'}}>— = {isEn?'not applicable for this email type':'no aplica para este tipo de email'}</span>
            </div>
            <div className="enc-table">
              {/* Column header */}
              <div className="enc-hdr">
                <div className="enc-col-type">{isEn?'Email type':'Tipo de email'}</div>
                <div className="enc-col-on">{isEn?'On':'Activo'}</div>
                {COL_INFO.map(c=>(
                  <div key={c.key} className="enc-col-r enc-col-r-hdr" title={c.label}>
                    <span>{c.icon}</span>
                    <span>{c.short}</span>
                    {c.tag&&<span className={`enc-tag enc-tag-${c.tag}`} style={{fontSize:'.5rem'}}>{c.tag}</span>}
                  </div>
                ))}
              </div>
              {GROUPS.map(g=>(
                <div key={g.id} className="enc-group">
                  <div className="enc-group-hdr">{g.label}</div>
                  {g.types.map(t=>{
                    const cfg = emailNotifConfig[t.key] || {};
                    const on = !!cfg.enabled;
                    return (
                      <div key={t.key} className={`enc-row${on?'':' enc-off'}`}>
                        <div className="enc-col-type">{t.label}</div>
                        <div className="enc-col-on">
                          <label className="enc-pill-toggle">
                            <input type="checkbox" checked={on} onChange={e=>tog(t.key,'enabled',e.target.checked)}/>
                            <span className={`enc-pill${on?' enc-pill-on':''}`}/>
                          </label>
                        </div>
                        {COL_INFO.map(c=>(
                          <div key={c.key} className="enc-col-r">
                            {t.cols.includes(c.key)
                              ? <label className={`enc-cb-wrap${!on?' enc-cb-dim':''}`} title={c.label}>
                                  <input type="checkbox" disabled={!on} checked={!!cfg[c.key]} onChange={e=>tog(t.key,c.key,e.target.checked)}/>
                                </label>
                              : <span className="enc-na">—</span>
                            }
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{marginTop:12,display:'flex',justifyContent:'flex-end'}}>
              <button className="btn-p" onClick={saveEmailNotifConfig} disabled={emailNotifSaving}>{emailNotifSaving?(isEn?'Saving...':'Guardando...'):`💾 ${isEn?'Save configuration':'Guardar configuración'}`}</button>
            </div>
          </>
        }
      </AdminSection>
    );
  })()}

  {/* ── Audit Log Viewer ───────────────────────────────────────────────── */}
  <AdminSection title={`🕵️ ${isEn?'Audit Log':'Log de auditoría'}`} subtitle={isEn?'Full activity history for listings, incidents, roles, and config changes.':'Historial completo de actividad: listings, incidentes, roles y configuración.'} open={openSections.auditLog} onToggle={()=>toggleSection('auditLog')}>
    <AuditLogViewer/>
  </AdminSection>
  </>}

</div>;
}
