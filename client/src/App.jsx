// App.jsx — root component for the KAI Airbnb Owners App.
//
// After the F1-F35 refactor this file contains only:
//   - imports of all extracted views / components / core modules
//   - the global error logging handlers (window.error, unhandledrejection)
//   - the BUILD_TIME constant injected by Vite at build time
//   - <ErrorBoundary> — class wrapper used around the AdminSettings tab
//   - <App/> — default export with state, effects, role/permission
//     resolution, action handlers, and the view-dispatch JSX (wrapped
//     in <AppStateProvider> so extracted views read shared state via
//     useApp()).
//
// Every extracted file lives under client/src/{core,modules,platform}/
// and has its own per-file header explaining what was lifted and why.
// See docs/PLATFORM_ARCHITECTURE.md §11 for the full extraction history
// (frontend stages F1-F35).

import { Component, useCallback, useEffect, useRef, useState } from "react";

import { APP_VERSION } from "./version.js";

// ── Core (cross-cutting platform) ────────────────────────────────────────────
import { api, getCommunityId, setCommunityId } from "./core/api";
import { AppStateProvider } from "./core/app-state";
import {
  auth, fetchAdminContext, firebaseReady,
  onAuthChanged, provider, signInWithGoogle, signOutUser,
} from "./core/auth";
import { buildContactDirectory } from "./core/contacts";
import { getT } from "./core/i18n";
import { appText, aptDisplay, setCustomLabels } from "./core/i18n/app-text";
import {
  DEFAULT_DELEGATE_PERMISSIONS,
  DEFAULT_STANDARD_MENU_PERMISSIONS,
} from "./core/permissions";
import { CSS } from "./core/styles";

// ── Core UI primitives ───────────────────────────────────────────────────────
import CommunitySwitch from "./core/ui/CommunitySwitch";
import GoogleIcon from "./core/ui/GoogleIcon";
import LanguageSwitch from "./core/ui/LanguageSwitch";
import Overlay from "./core/ui/Overlay";

// ── Module: incidents ────────────────────────────────────────────────────────
import AddResolutionModal from "./modules/incidents/components/AddResolutionModal";
import AssignToUnitModal from "./modules/incidents/components/AssignToUnitModal";
import CloseGeneralModal from "./modules/incidents/components/CloseGeneralModal";
import IncidentModal from "./modules/incidents/components/IncidentModal";
import VerifyIncidentModal from "./modules/incidents/components/VerifyIncidentModal";
import IncidentsView from "./modules/incidents/views/IncidentsView";

// ── Module: notifications ────────────────────────────────────────────────────
import NotificationsView from "./modules/notifications/views/NotificationsView";

// ── Platform: admin ──────────────────────────────────────────────────────────
import AdminAccessHelp from "./platform/admin/views/AdminAccessHelp";
import AdminFallback from "./platform/admin/views/AdminFallback";
import AdminSettings from "./platform/admin/views/AdminSettings";

// ── Platform: analytics ──────────────────────────────────────────────────────
import AnalyticsDashboard from "./platform/analytics/views/AnalyticsDashboard";

// ── Platform: auth gates ─────────────────────────────────────────────────────
import AuthGate from "./platform/auth/views/AuthGate";
import CommunityMissionView from "./platform/auth/views/CommunityMissionView";
import RegistrationGate from "./platform/auth/views/RegistrationGate";

// ── Platform: dashboard ──────────────────────────────────────────────────────
import DashboardGreeting from "./platform/dashboard/components/DashboardGreeting";
import Dashboard from "./platform/dashboard/views/Dashboard";

// ── Platform: email ──────────────────────────────────────────────────────────
import SendUserEmailModal from "./platform/email/components/SendUserEmailModal";

// ── Platform: onboarding ─────────────────────────────────────────────────────
import HelpView from "./platform/onboarding/views/HelpView";
import UserTour from "./platform/onboarding/views/UserTour";

// ── Platform: registrations ──────────────────────────────────────────────────
import PendingApprovalsView from "./platform/registrations/views/PendingApprovalsView";

// ── Platform: units (listings) ───────────────────────────────────────────────
import ListingModal from "./platform/units/components/ListingModal";
import UnitDetailCard from "./platform/units/components/UnitDetailCard";
import UnitPlate from "./platform/units/components/UnitPlate";
import ListingsView from "./platform/units/views/ListingsView";
import MyListings from "./platform/units/views/MyListings";

// ── Platform: users ──────────────────────────────────────────────────────────
import ProfileView from "./platform/users/views/ProfileView";


// Global client logging: prevents silent blank screens and records the last runtime issue.
window.addEventListener("error", (event) => {
  const payload = { section:"window.error", message:event?.message || "Unknown error", stack:event?.error?.stack || "", ts:new Date().toISOString() };
  console.error("[KAI_WINDOW_ERROR]", payload);
  try { localStorage.setItem("kai_last_ui_error", JSON.stringify(payload, null, 2)); } catch(e) {}
  try { fetch("/api/client-log", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) }).catch(()=>{}); } catch(e) {}
});
window.addEventListener("unhandledrejection", (event) => {
  const reason = event?.reason || {};
  const payload = { section:"unhandledrejection", message:reason?.message || String(reason), stack:reason?.stack || "", ts:new Date().toISOString() };
  console.error("[KAI_UNHANDLED_REJECTION]", payload);
  try { localStorage.setItem("kai_last_ui_error", JSON.stringify(payload, null, 2)); } catch(e) {}
  try { fetch("/api/client-log", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) }).catch(()=>{}); } catch(e) {}
});

// Build timestamp injected by Vite at build time via vite.config.js define.__BUILD_TIME__
// Falls back gracefully if the constant isn't defined (e.g. older builds or test envs).
const BUILD_TIME = (() => {
  try {
    const iso = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';
    if (!iso) return '';
    const d = new Date(iso);
    // Format: "Jan 1, 2026 · 07:48 PM UTC"
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
    });
  } catch(e) { return ''; }
})();

class ErrorBoundary extends Component {
  constructor(props){ super(props); this.state={hasError:false, message:'', stack:'', componentStack:''}; }
  static getDerivedStateFromError(error){ return {hasError:true, message:error?.message || String(error), stack:error?.stack || ''}; }
  componentDidCatch(error, info){
    const payload = { section:this.props.section || 'unknown', message:error?.message || String(error), stack:error?.stack || '', componentStack:info?.componentStack || '', ts:new Date().toISOString() };
    console.error('[KAI_UI_ERROR]', payload);
    try { localStorage.setItem('kai_last_ui_error', JSON.stringify(payload, null, 2)); } catch(e) {}
    try { fetch('/api/client-log', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) }).catch(()=>{}); } catch(e) {}
    this.setState({componentStack:info?.componentStack || ''});
  }
  render(){
    if(this.state.hasError){
      if (typeof this.props.fallback === 'function') return this.props.fallback({ message:this.state.message, stack:this.state.stack, componentStack:this.state.componentStack });
      return this.props.fallback || <div className="card"><h2 className="ptitle">No se pudo cargar esta sección</h2><p className="psub">Error: {this.state.message}</p><pre className="codebox">{this.state.stack}</pre></div>;
    }
    return this.props.children;
  }
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [user,      setUser]      = useState(null);
  const [lang, setLangState] = useState(() => { let v = localStorage.getItem("kai_lang"); if (!v) { const bl = (navigator.language || navigator.userLanguage || 'es-CO').toLowerCase(); v = bl.startsWith('en') ? 'en' : 'es-CO'; localStorage.setItem("kai_lang", v); } document.documentElement.lang = v.startsWith('en') ? 'en' : 'es'; return v; });
  const t = getT(lang);
  const setLang = (next) => { const v = next === "en" ? "en" : "es-CO"; setLangState(v); localStorage.setItem("kai_lang", v); document.documentElement.lang = v.startsWith('en') ? 'en' : 'es'; if (user?.uid) api.put("/api/users/preference", { uid:user.uid, email:user.email, name:user.name, language:v }).catch(()=>{}); };
  const [authLoading, setAuthLoading] = useState(true);
  const [listings,  setListings]  = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [registration, setRegistration] = useState(null);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [pendingRegistrations, setPendingRegistrations] = useState([]);
  const [activeRegistrations, setActiveRegistrations] = useState([]);
  const [adminInfo, setAdminInfo] = useState({role:'user', isGlobalAdmin:false, canManageRegistrations:false, config:{}});
  // Holds the community config selected on the login screen so logo/branding shows
  // immediately after login, before loadAll has fetched the full adminInfo.
  const [preLoginConfig, setPreLoginConfig] = useState(null);
  const complexNameEs = adminInfo.config?.complex_name_es || preLoginConfig?.name || 'Propietarios Airbnb KAI';
  const complexNameEn = adminInfo.config?.complex_name_en || preLoginConfig?.name_en || preLoginConfig?.name || 'KAI Airbnb Owners';
  const complexName = lang === 'en' ? complexNameEn : complexNameEs;
  const complexLocation = adminInfo.config?.complex_location || (preLoginConfig?.city ? [preLoginConfig.city, preLoginConfig.country].filter(Boolean).join(' · ') : '') || 'Serena del Mar · Cartagena 🇨🇴';
  const complexLogo = adminInfo.config?.complex_logo || preLoginConfig?.logo_url || '';
  const complexBg = adminInfo.config?.complex_bg ?? preLoginConfig?.background_url ?? '/morros-kai-bg.jpg';
  const complexTower = adminInfo.config?.community_tower || 'KAI';
  const [previewRole, setPreviewRole] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [showTour, setShowTour] = useState(false);
  const initialView = new URLSearchParams(window.location.search).get('view') || (() => { try { return localStorage.getItem('kai_last_view') || 'incidents'; } catch(e) { return 'incidents'; } })();
  const [view,      setView]      = useState(initialView);
  // Apply role-based landing once admin config has fully loaded from server.
  // Must wait for adminLoading===false — without this guard the effect fires on the
  // initial render (config:{}) before the real config arrives, sets the ref, and the
  // actual nav_config landing is never applied.  Default is 'incidents'.
  const _landingApplied = useRef(false);
  useEffect(() => {
    if (_landingApplied.current || !user || adminLoading) return;
    _landingApplied.current = true;
    if (new URLSearchParams(window.location.search).get('view')) return;
    try { if (localStorage.getItem('kai_last_view')) return; } catch(e) {}
    try {
      const navCfg = JSON.parse(adminInfo?.config?.nav_config || '{}');
      const roleKey = effectiveIsGlobalAdmin ? 'global' : effectiveRole === 'delegate_admin' ? 'delegate' : 'user';
      // Incidents is the primary workflow; 'my' (units) is secondary
      const landing = navCfg[roleKey]?.landing || 'incidents';
      setView(landing);
    } catch(e) { setView('incidents'); }
  }, [adminInfo, user, adminLoading]);
  const [loading,   setLoading]   = useState(true);
  const [syncing,   setSyncing]   = useState(false);
  const [lastSync,  setLastSync]  = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [toast,     setToast]     = useState(null);
  const [modal,            setModal]            = useState(null);
  const [unitDetailOverlay, setUnitDetailOverlay] = useState(null); // { listingId, defaultStep? }
  const [incidentDetailOverlay, setIncidentDetailOverlay] = useState(null); // { incidentId }
  const openIncidentDetail = (incidentId) => setIncidentDetailOverlay({ incidentId });

  // ── Email deep-link: ?incident=inc_xxx opens the incident popup after data loads ──
  const _deepLinkApplied = useRef(false);
  useEffect(() => {
    if (_deepLinkApplied.current || loading || !incidents.length) return;
    const params = new URLSearchParams(window.location.search);
    const incId = params.get('incident');
    if (incId && incidents.find(i => i.id === incId)) {
      _deepLinkApplied.current = true;
      setView('incidents');
      // Small delay so the view renders before the overlay mounts
      setTimeout(() => openIncidentDetail(incId), 120);
    }
  }, [loading, incidents]);
  // ── ?action=report deep-link: opens report modal after auth + data load ──
  const _reportLinkApplied = useRef(false);
  useEffect(() => {
    if (_reportLinkApplied.current || loading || !user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'report') {
      _reportLinkApplied.current = true;
      setView('incidents');
      setTimeout(() => setModal({type:'incident'}), 200);
    }
  }, [loading, user]);

  // ── ?community=COMMUNITY_ID invite deep-link: switches to community and opens registration ──
  const _communityInviteApplied = useRef(false);
  useEffect(() => {
    if (_communityInviteApplied.current || loading || !user) return;
    const inviteCid = new URLSearchParams(window.location.search).get('community');
    if (!inviteCid) return;
    _communityInviteApplied.current = true;
    setTimeout(() => setModal({type:'addListing'}), 250);
  }, [loading, user]);

  // ── Reputation & Goals state ──
  const [reputation, setReputation] = useState(null);
  const [reputationLoading, setReputationLoading] = useState(false);
  const [communityGoals, setCommunityGoals] = useState(null);
  const [communityGoalsLoading, setCommunityGoalsLoading] = useState(false);

  const loadReputation = async () => {
    if (!user?.uid || reputationLoading) return;
    setReputationLoading(true);
    try { setReputation(await api.get(`/api/users/reputation?uid=${encodeURIComponent(user.uid)}`)); }
    catch(e) { /* non-critical */ }
    finally { setReputationLoading(false); }
  };

  const loadCommunityGoals = async (cid) => {
    if (!cid || communityGoalsLoading) return;
    setCommunityGoalsLoading(true);
    try { setCommunityGoals(await api.get(`/api/communities/${cid}/goals?uid=${encodeURIComponent(user?.uid||'')}&email=${encodeURIComponent(user?.email||'')}`)); }
    catch(e) { /* non-critical */ }
    finally { setCommunityGoalsLoading(false); }
  };

  const [incidentQuickFilter, setIncidentQuickFilter] = useState(null);
  const [userProfile, setUserProfile] = useState({ whatsapp:'', country:'Colombia', notificationEmail:'' });
  // Listing floor collapse state — lives here so it persists across navigation
  const [listingFloorOpen, setListingFloorOpen] = useState({});
  const toggleListingFloor = (f) => setListingFloorOpen(s=>({...s,[f]:!s[f]}));
  const pollRef = useRef(null);

  const [loadError, setLoadError] = useState(false);
  const [loadErrorMsg, setLoadErrorMsg] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const isApproved = registration?.status === "approved";
  const analyticsEnabledForAll = String(adminInfo?.config?.analytics_enabled || "false") === "true";

  // ── ROLE PREVIEW (Global Admin only, view-only simulation, never writes to DB) ──
  const ROLE_PREVIEW_PERMS = {
    global_admin: { isGlobalAdmin:true, role:'global_admin', canManage:true, menu:{ dashboard:true, listings:true, incidents:true, notifications:true, about:true, my:true, analytics:true, approvals:true }, delegate:{ canApproveRegistrations:true, canResolveIncidents:true, canUpdateGlobalListings:true, canDeleteGlobalListings:true, canUpdateGlobalIncidents:true, canDeleteGlobalIncidents:true } },
    delegate_admin: { isGlobalAdmin:false, role:'delegate_admin', canManage:true, menu:{ ...DEFAULT_STANDARD_MENU_PERMISSIONS, approvals:true }, delegate:{ ...DEFAULT_DELEGATE_PERMISSIONS } },
    community_admin: { isGlobalAdmin:false, isCommunityAdmin:true, role:'user', canManage:true, menu:{ ...DEFAULT_STANDARD_MENU_PERMISSIONS, approvals:true }, delegate:{ ...DEFAULT_DELEGATE_PERMISSIONS } },
    standard_admin: { isGlobalAdmin:false, role:'standard_admin', canManage:false, menu:{ ...DEFAULT_STANDARD_MENU_PERMISSIONS }, delegate:{ ...DEFAULT_DELEGATE_PERMISSIONS, canApproveRegistrations:false, canResolveIncidents:true } },
    user: { isGlobalAdmin:false, role:'user', canManage:false, menu:{ ...DEFAULT_STANDARD_MENU_PERMISSIONS }, delegate:{ ...DEFAULT_DELEGATE_PERMISSIONS, canApproveRegistrations:false, canResolveIncidents:false } },
  };
  const PREVIEW_ROLE_LABELS = {
    en: { global_admin:'Global Admin', delegate_admin:'Delegate Admin', community_admin:'Community Admin', standard_admin:'Standard Admin', user:'Owner/User' },
    es: { global_admin:'Admin global', delegate_admin:'Admin delegado', community_admin:'Admin comunidad', standard_admin:'Admin estándar', user:'Propietario/Usuario' },
  };
  const previewPerms = previewRole ? ROLE_PREVIEW_PERMS[previewRole] : null;
  const effectiveIsGlobalAdmin = previewPerms ? previewPerms.isGlobalAdmin : adminInfo.isGlobalAdmin;
  const effectiveRole = previewPerms ? previewPerms.role : adminInfo.role;
  const effectiveCanManageRegistrations = previewPerms ? previewPerms.canManage : adminInfo.canManageRegistrations;
  const effectiveIsCommunityAdmin = previewPerms ? !!previewPerms.isCommunityAdmin : !!adminInfo.isCommunityAdmin;

  const loadAll = useCallback(async (isInit=false) => {
    if (!user?.uid || registration?.status !== "approved") { setLoading(false); return; }
    try {
      const [l, i, n, p, a] = await Promise.all([
        api.get('/api/listings'),
        api.get('/api/incidents'),
        api.get('/api/notifications?ownerUid=' + encodeURIComponent(user.uid)),
        adminInfo.canManageRegistrations ? api.get('/api/registrations/pending?reviewerUid=' + encodeURIComponent(user.uid) + '&reviewerEmail=' + encodeURIComponent(user.email || '')) : Promise.resolve([]),
        adminInfo.canManageRegistrations ? api.get('/api/registrations/active?reviewerUid=' + encodeURIComponent(user.uid) + '&reviewerEmail=' + encodeURIComponent(user.email || '')) : Promise.resolve([]),
      ]);
      setListings(Array.isArray(l) ? l : []);
      setIncidents(Array.isArray(i) ? i : []);
      setNotifications(Array.isArray(n) ? n : []);
      setPendingRegistrations(Array.isArray(p) ? p : []);
      setActiveRegistrations(Array.isArray(a) ? a : []);
      setLastSync(new Date());
      if (isInit) { setLoadError(false); setLoadErrorMsg(''); }
    } catch(e) {
      console.error('Load error', e);
      if (isInit) { setLoadError(true); setLoadErrorMsg(e.message || 'No se pudo conectar al servidor'); }
    }
  }, [user?.uid, user?.email, registration?.status, adminInfo.canManageRegistrations]);

  useEffect(() => {
    loadAll(true).finally(() => setLoading(false));
  }, [loadAll, retryCount]);

  // Poll every 20s for real-time updates
  useEffect(() => {
    if (!isApproved) return;
    pollRef.current = setInterval(loadAll, 20000);
    return () => clearInterval(pollRef.current);
  }, [loadAll, isApproved]);

  // Close header dropdowns (profile, more) on outside click or Escape
  useEffect(() => {
    if (!openDropdown) return;
    const onDown = (e) => {
      if (!e.target.closest('.profile-dd, .nav-dd')) setOpenDropdown(null);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpenDropdown(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [openDropdown]);

  // Reset to dashboard when preview role is activated so the simulated role's view is coherent
  useEffect(() => {
    if (previewRole) setView('dashboard');
  }, [previewRole]);

  const showToast = (msg, err=false) => { setToast({msg,err}); setTimeout(()=>setToast(null),3200); };

  // ── FIREBASE AUTH ──
  useEffect(() => {
    if (!firebaseReady || !auth) {
      setAuthLoading(false);
      setUser(null);
      setRegistration(null);
      setAdminLoading(false);
      setRegistrationLoading(false);
      return;
    }
    const unsub = onAuthChanged((firebaseUser) => {
      if (firebaseUser) {
        setAdminLoading(true);
        setRegistrationLoading(true);
        setUser({
          uid:    firebaseUser.uid,
          email:  firebaseUser.email,
          name:   firebaseUser.displayName || firebaseUser.email,
          avatar: (firebaseUser.displayName||"?")[0].toUpperCase(),
          photo:  firebaseUser.photoURL,
        });
      } else {
        setUser(null);
        setRegistration(null);
        setAdminInfo({role:'user', isGlobalAdmin:false, canManageRegistrations:false, config:{}});
        setAdminLoading(false);
        setRegistrationLoading(false);
        setListings([]); setIncidents([]); setNotifications([]); setPendingRegistrations([]); setActiveRegistrations([]);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setAdminInfo({role:'user', isGlobalAdmin:false, canManageRegistrations:false, config:{}});
      setAdminLoading(false);
      setRegistration(null);
      setRegistrationLoading(false);
      return;
    }
    setAdminLoading(true);
    setRegistrationLoading(true);
    fetchAdminContext({ uid: user.uid, email: user.email, name: user.name, lang })
      .then(adminResponse => {
        const info = adminResponse || {role:'user', isGlobalAdmin:false, canManageRegistrations:false, config:{}};
        setAdminInfo(info);
        if (info.config) setCustomLabels(info.config);
        // Confirm community from server before checking registration
        if (info.communityId) { setCommunityId(info.communityId); try { localStorage.setItem('kai_community', info.communityId); } catch(e) {} loadCommunityGoals(info.communityId); }
        if (info.languagePreference && info.languagePreference !== lang) {
          const pref = info.languagePreference === 'en' ? 'en' : 'es-CO';
          setLangState(pref);
          localStorage.setItem('kai_lang', pref);
        }
        // Chain registration check so it always uses the confirmed communityId
        return api.get('/api/registrations/status?uid=' + encodeURIComponent(user.uid));
      })
      .then(r => { if (r !== undefined) setRegistration(r || {status:'none'}); })
      .catch(e => {
        console.error('Login init error', e);
        setAdminInfo({role:'user', isGlobalAdmin:false, canManageRegistrations:false, config:{}});
        setRegistration({status:'error', error:e.message});
      })
      .finally(() => { setAdminLoading(false); setRegistrationLoading(false); });
  }, [user?.uid, user?.email, user?.name]);

  // Load owner profile (whatsapp + country)
  useEffect(() => {
    if (!user?.uid) { setUserProfile({ whatsapp:'', country:'Colombia', notificationEmail:'' }); return; }
    api.get('/api/users/profile?uid=' + encodeURIComponent(user.uid))
      .then(p => setUserProfile({ whatsapp:p.whatsapp||'', country:p.country||'Colombia', notificationEmail:p.notificationEmail||'' }))
      .catch(() => {});
  }, [user?.uid]);

  const saveProfile = async (profileData) => {
    setSyncing(true);
    try {
      const result = await api.put('/api/users/profile', { uid:user.uid, email:user.email, whatsapp:profileData.whatsapp, country:profileData.country||'Colombia', notificationEmail:profileData.notificationEmail||'' });
      setUserProfile({ whatsapp:result.whatsapp||'', country:result.country||'Colombia', notificationEmail:result.notificationEmail||'' });
      // Also update cached contact info in listings for the current user
      const effectiveEmail = result.notificationEmail || user.email;
      setListings(ls => ls.map(l => l.ownerUid===user.uid ? {...l, contact:result.whatsapp||'', email:effectiveEmail} : l));
      showToast(lang==='en' ? '✅ Profile updated' : '✅ Perfil actualizado');
    } catch(e) {
      showToast((lang==='en' ? 'Could not save: ' : 'No se pudo guardar: ') + (e.message || ''), true);
    } finally { setSyncing(false); }
  };

  const switchCommunity = async (newCommunityId) => {
    if (!newCommunityId || newCommunityId === adminInfo.communityId) return;
    setCommunityId(newCommunityId);
    try { localStorage.setItem('kai_community', newCommunityId); } catch(e) {}
    setAdminLoading(true);
    setRegistrationLoading(true);
    // Clear secondary data but keep listings/incidents visible until new data arrives
    // (avoids the "community is empty" flash while data is loading)
    setNotifications([]); setPendingRegistrations([]); setActiveRegistrations([]);
    try {
      const info = await fetchAdminContext({ uid: user.uid, email: user.email, name: user.name, lang });
      const adminData = info || {role:'user', isGlobalAdmin:false, canManageRegistrations:false, config:{}};
      setAdminInfo(adminData);
      if (adminData.config) setCustomLabels(adminData.config);
      const reg = await api.get('/api/registrations/status?uid=' + encodeURIComponent(user.uid));
      setRegistration(reg || {status:'none'});
      // Explicitly reload listings/incidents for the new community.
      // loadAll's useCallback only re-fires when canManageRegistrations changes,
      // which often doesn't change between communities, so we must call it directly.
      await loadAll(false);
    } catch(e) {
      showToast((lang === 'en' ? 'Could not switch community: ' : 'Error al cambiar comunidad: ') + (e.message || ''), true);
    } finally {
      setAdminLoading(false);
      setRegistrationLoading(false);
    }
  };

  const submitRegistration = async ({ listings: listingsToRegister, profile = {} }) => {
    setSyncing(true);
    try {
      const r = await api.post('/api/registrations', { userUid:user.uid, userName:user.name, userEmail:user.email, listings:listingsToRegister, profileWhatsapp:profile.whatsapp||'', profileCountry:profile.country||'Colombia', language:lang });
      setRegistration(r);
      if (profile.whatsapp) setUserProfile({ whatsapp:profile.whatsapp, country:profile.country||'Colombia' });
      showToast('✅ Registro enviado. Pendiente de aprobación.');
    } catch(e) { showToast('Error al enviar registro: ' + (e.message || 'Revise los datos'), true); }
    finally { setSyncing(false); }
  };
  const reviewRegistrationAction = async (id, action) => {
    const reason = action === 'decline' ? prompt('Motivo del rechazo:') : prompt('Nota opcional para aprobación:', 'Aprobado');
    if (action === 'decline' && !reason) { showToast('Debe ingresar un motivo para rechazar.', true); return; }
    setSyncing(true);
    try {
      await api.post('/api/registrations/' + id + '/' + (action === 'approve' ? 'approve' : 'decline'), { reviewerUid:user.uid, reviewerEmail:user.email, reviewerName:user.name, reason:reason || '' });
      setPendingRegistrations(p => p.filter(r => r.id !== id));
      await loadAll(false);
      showToast(action === 'approve' ? '✅ Registro aprobado' : '🚫 Registro rechazado');
    } catch(e) { showToast('Error al revisar registro: ' + (e.message || 'Revise Render/Supabase'), true); }
    finally { setSyncing(false); }
  };

  const login = async () => {
    if (!firebaseReady || !auth || !provider) {
      showToast(lang === 'en' ? 'Google login is not configured. Check Firebase environment variables in Render.' : 'Google login no está configurado. Revise las variables de Firebase en Render.', true);
      return;
    }
    setAuthLoading(true);
    try {
      await signInWithGoogle();
      setLoginOpen(false);
    } catch(e) {
      setAuthLoading(false);
      if (e.code !== "auth/popup-closed-by-user") showToast("Error al iniciar sesión: " + e.message, true);
    }
  };
  const handleLoginCommunitySelect = (communityId, cfg) => {
    if (!communityId) return;
    setCommunityId(communityId);
    try { localStorage.setItem('kai_community', communityId); } catch(e) {}
    if (cfg) {
      setPreLoginConfig(cfg);
      setCustomLabels({
        complex_name_es: cfg.name, complex_name_en: cfg.name_en || cfg.name,
        complex_logo: cfg.logo_url, complex_bg: cfg.background_url,
        community_tower: cfg.tower,
      });
    }
  };
  useEffect(() => {
    if (user && view) { try { localStorage.setItem('kai_last_view', view); } catch(e) {} }
  }, [view, user]);

  const logout = async () => {
    if (auth) await signOutUser();
    try { localStorage.removeItem('kai_community'); localStorage.removeItem('kai_last_view'); } catch(e) {}
    setCommunityId('kai');
    showToast("Sesión cerrada");
  };

  const openCount    = incidents.filter(i=>i.status==="open").length;
  const myListings   = user ? listings.filter(l=>l.ownerUid===user.uid) : [];
  const contactDirectory = buildContactDirectory(listings);
  const contactProps = { directory:contactDirectory, showToast, lang, onEmail:(contact)=>setModal({type:'sendUserEmail', data:contact}) };
  const sendUserEmail = async ({ to, toName, subject, message }) => {
    setSyncing(true);
    try {
      await api.post('/api/contact/send-email', { actorUid:user.uid, actorEmail:user.email, actorName:user.name, to, toName, subject, message, language:lang });
      setModal(null);
      showToast(lang === 'en' ? '✅ Email sent' : '✅ Email enviado');
    } catch(e) { showToast((lang === 'en' ? 'Error sending email: ' : 'Error enviando email: ') + (e.message || ''), true); }
    finally { setSyncing(false); }
  };
  const unreadNotifications = notifications.filter(n=>!n.isRead).length;
  // Derived set used for action-needed banners; keep safe to avoid home-screen render crashes.
  const myListingIds = new Set((myListings || []).map(l => l.id));
  const menuPerms = previewPerms ? previewPerms.menu : { ...DEFAULT_STANDARD_MENU_PERMISSIONS, ...(adminInfo?.permissions?.menu || {}) };
  // Only delegate_admins and global_admins receive delegate permissions.
  // Standard users (role='user') always get canResolveIncidents:false and
  // canApproveRegistrations:false regardless of any DB-stored value.
  const delegatePerms = previewPerms
    ? previewPerms.delegate
    : effectiveRole === 'delegate_admin'
      ? { ...DEFAULT_DELEGATE_PERMISSIONS, ...(adminInfo?.permissions?.delegate || {}) }
      : { ...DEFAULT_DELEGATE_PERMISSIONS, canApproveRegistrations:false, canResolveIncidents:false };
  const canSeeMenu = (id) => effectiveIsGlobalAdmin || id === 'dashboard' || !!menuPerms[id];
  const needsOwnerVerification = incidents.filter(i => i.status === "open" && myListingIds.has(i.aptId));
  // Step 2 for owners: verified but owner hasn't added their resolution yet
  const needsOwnerResolution   = incidents.filter(i => i.status === "verified" && !String(i.ownerResolution||'').trim() && myListingIds.has(i.aptId));
  const canResolveIncidentsNow = Boolean(effectiveIsGlobalAdmin || (effectiveRole === 'delegate_admin' && delegatePerms.canResolveIncidents));
  // Verified incidents where owner resolution is still missing (owner must act before admin can close)
  const ownerResolutionPending = incidents.filter(i => i.status === "verified" && !String(i.ownerResolution||'').trim() && myListingIds.has(i.aptId));
  // Verified incidents where owner has provided resolution — truly ready for admin to close
  const needsAdminResolution = incidents.filter(i => i.status === "verified" && String(i.ownerResolution||'').trim() && canResolveIncidentsNow);
  const openSeriousIncidents = incidents.filter(i => i.status !== "resolved" && ["serious","watch","under_watch"].includes(String(i.category || "")));
  const smartAlerts = [
    needsOwnerVerification.length ? { id:"ownerVerification", priority:1, icon:"✅", tone:"owner", title:appText(lang,"smart.ownerTitle"), msg:appText(lang,"smart.ownerMsg",{count:needsOwnerVerification.length}), count:needsOwnerVerification.length, action:()=>{setIncidentQuickFilter("ownerVerification");setView("incidents");setOpenDropdown(null);} } : null,
    ownerResolutionPending.length ? { id:"ownerResolution", priority:2, icon:"📝", tone:"owner", title:appText(lang,"smart.ownerResolutionTitle"), msg:appText(lang,"smart.ownerResolutionMsg",{count:ownerResolutionPending.length}), count:ownerResolutionPending.length, action:()=>{setIncidentQuickFilter("needsResolution");setView("incidents");setOpenDropdown(null);} } : null,
    needsAdminResolution.length ? { id:"readyResolve", priority:3, icon:"🛠️", tone:"resolve", title:appText(lang,"smart.resolveTitle"), msg:appText(lang,"smart.resolveMsg",{count:needsAdminResolution.length}), count:needsAdminResolution.length, action:()=>{setIncidentQuickFilter("requiresResolution");setView("incidents");setOpenDropdown(null);} } : null,
    effectiveCanManageRegistrations && pendingRegistrations.length ? { id:"registrations", priority:4, icon:"📝", tone:"registration", title:appText(lang,"smart.registrationTitle"), msg:appText(lang,"smart.registrationMsg",{count:pendingRegistrations.length}), count:pendingRegistrations.length, action:()=>{setView("approvals");setOpenDropdown(null);} } : null,
    unreadNotifications ? { id:"unread", priority:5, icon:"🔔", tone:"notice", title:appText(lang,"smart.unreadTitle"), msg:appText(lang,"smart.unreadMsg",{count:unreadNotifications}), count:unreadNotifications, action:()=>{setView("notifications");setOpenDropdown(null);} } : null,
    openSeriousIncidents.length ? { id:"serious", priority:6, icon:"🚨", tone:"serious", title:appText(lang,"smart.seriousTitle"), msg:appText(lang,"smart.seriousMsg",{count:openSeriousIncidents.length}), count:openSeriousIncidents.length, action:()=>{setIncidentQuickFilter("seriousOpen");setView("incidents");setOpenDropdown(null);} } : null,
  ].filter(Boolean).sort((a,b)=>a.priority-b.priority);
  const smartAlertCount = smartAlerts.reduce((sum,a)=>sum + Number(a.count || 0), 0);
  // All available nav items for the current user/role
  const allNavItems = [
    canSeeMenu('my') && isApproved         ? { id:'my',        icon:'🔑', label:t.nav.my,        badge:myListings.length } : null,
    canSeeMenu('incidents')                 ? { id:'incidents',  icon:'⚠️', label:t.nav.incidents,  badge:openCount } : null,
    canSeeMenu('listings')                  ? { id:'listings',   icon:'🏠', label:t.nav.listings } : null,
    canSeeMenu('dashboard')                 ? { id:'dashboard',  icon:'📊', label:t.nav.dashboard } : null,
    effectiveCanManageRegistrations && isApproved ? { id:'approvals', icon:'📝', label:t.nav.approvals, badge:pendingRegistrations.length } : null,
    (effectiveIsGlobalAdmin || effectiveRole === 'delegate_admin' || effectiveIsCommunityAdmin) && isApproved    ? { id:'admin',      icon:'⚙️', label:t.nav.admin } : null,
    (effectiveIsGlobalAdmin || (analyticsEnabledForAll && canSeeMenu('analytics'))) && isApproved ? { id:'analytics', icon:'📈', label:t.nav.analytics } : null,
  ].filter(Boolean);

  // Role-based nav config (from app_config.nav_config JSON)
  const _roleNavKey = effectiveIsGlobalAdmin ? 'global' : effectiveRole==='delegate_admin' ? 'delegate' : 'user';
  const _navRoleCfg = (() => { try { return JSON.parse(adminInfo?.config?.nav_config||'{}')[_roleNavKey]||{}; } catch(e){return{};} })();
  const _configuredPrimary = _navRoleCfg.primary || ['incidents','my','listings','dashboard'];

  // Build NAV: primary items first (in config order), then remaining items
  const _navById = Object.fromEntries(allNavItems.map(n=>[n.id,n]));
  const NAV = [
    ..._configuredPrimary.filter(id=>_navById[id]).map(id=>_navById[id]),
    ...allNavItems.filter(n=>!_configuredPrimary.includes(n.id))
  ];
  const primaryNav = NAV.filter(n=>_configuredPrimary.includes(n.id));
  const moreNav    = NAV.filter(n=>!_configuredPrimary.includes(n.id));

  // ── CRUD ACTIONS ──
  const addListing = async (data) => {
    setSyncing(true);
    try {
      const newL = await api.post('/api/listings', { ...data, ownerUid: user.uid, owner: user.name, userEmail: user.email });
      // New units now go through the same approval flow as initial
      // registration — listing comes back as 'pending' and won't show in
      // My Units until an admin approves it.
      if (newL?.status === 'pending') {
        setModal(null);
        showToast(lang === 'en'
          ? "📋 Unit submitted — awaiting admin approval. You'll receive an email when it's reviewed."
          : "📋 Unidad enviada — pendiente de aprobación. Recibirás un email cuando sea revisada.");
      } else {
        setListings(l => [...l, newL]);
        setModal(null); showToast("✅ Apartamento registrado");
      }
    } catch(e) { console.error('Save listing error', e); showToast("Error al guardar: " + (e.message || 'Revise Supabase/Render'), true); } finally { setSyncing(false); }
  };

  const editListing = async (id, ownerUid, data) => {
    if (ownerUid !== user?.uid && !adminInfo.isGlobalAdmin) { showToast("Solo el propietario o administrador global puede editar", true); return; }
    setSyncing(true);
    try {
      const updated = await api.put(`/api/listings/${id}`, { ...data, ownerUid: user.uid, actorEmail: user.email });
      setListings(l => l.map(x => x.id === id ? updated : x));
      setModal(null); showToast("✅ Actualizado");
    } catch(e) { console.error('Update listing error', e); showToast("Error al actualizar: " + (e.message || 'Revise Supabase/Render'), true); } finally { setSyncing(false); }
  };

  const deleteListing = async (l) => {
    if (l.ownerUid !== user?.uid && !adminInfo.isGlobalAdmin) { showToast("Solo el propietario o administrador global puede eliminar", true); return; }
    setSyncing(true);
    try {
      await api.del(`/api/listings/${l.id}`, { ownerUid: user.uid, actorEmail: user.email });
      setListings(ls => ls.filter(x => x.id !== l.id));
      setIncidents(is => is.filter(x => x.aptId !== l.id));
      showToast("🗑️ Eliminado");
    } catch(e) { console.error('Delete error', e); showToast("Error al eliminar: " + (e.message || 'Revise Supabase/Render'), true); } finally { setSyncing(false); }
  };

  const addIncident = async (data) => {
    setSyncing(true);
    try {
      const apt = data.aptId ? listings.find(l => l.id === data.aptId) : null;
      const aptLabel = data.isGeneral ? '' : apt ? aptDisplay(apt.apt, lang) : '?';
      const newI = await api.post('/api/incidents', { ...data, reporterUid: user.uid, reporterName: user.name, aptLabel });
      setIncidents(i => [newI, ...i]);
      setModal(null);
      loadAll(false);
      showToast(data.isGeneral ? (lang==='en'?'📢 General report submitted':'📢 Reporte general registrado') : '⚠️ Reporte registrado');
    } catch(e) {
      console.error('Save incident error', e);
      let errMsg;
      if (e.status === 413)
        errMsg = lang==='en'
          ? '⚠️ Photos are too large to upload. Try attaching fewer photos or using images with lower resolution.'
          : '⚠️ Las fotos son demasiado grandes para enviar. Intenta con menos fotos o imágenes de menor resolución.';
      else
        errMsg = (lang==='en' ? 'Error saving report: ' : 'Error al reportar: ') + (e.message && !e.message.startsWith('<') ? e.message : 'Revise Supabase/Render');
      showToast(errMsg, true);
    } finally { setSyncing(false); }
  };

  const assignIncident = async (incidentId, aptId) => {
    setSyncing(true);
    try {
      const updated = await api.patch(`/api/incidents/${incidentId}/assign`, { actorUid:user.uid, actorEmail:user.email, aptId });
      setIncidents(i => i.map(x => x.id === incidentId ? updated : x));
      setModal(null); loadAll(false); showToast(lang==='en'?'🏠 Incident assigned to unit':'🏠 Incidente asignado a unidad');
    } catch(e) { showToast('Error: ' + (e.message||''), true); } finally { setSyncing(false); }
  };

  const closeGeneralIncident = async (incidentId, { action, resolution, resolutionComments='' }) => {
    setSyncing(true);
    try {
      const updated = await api.patch(`/api/incidents/${incidentId}/close-general`, { actorUid:user.uid, actorEmail:user.email, action, resolution, resolutionComments });
      setIncidents(i => i.map(x => x.id === incidentId ? updated : x));
      setModal(null); loadAll(false); showToast(lang==='en'?'✓ General incident closed':'✓ Incidente general cerrado');
    } catch(e) { showToast('Error: ' + (e.message||''), true); } finally { setSyncing(false); }
  };

  const resolveIncident = async (id) => {
    const comments = window.prompt(appText(lang, 'reports.resolvePrompt'), '');
    if (comments === null) return;
    if (!String(comments || '').trim()) { showToast(appText(lang, 'reports.resolveRequired'), true); return; }
    setSyncing(true);
    try {
      const updated = await api.patch(`/api/incidents/${id}/resolve`, { actorUid:user.uid, actorEmail:user.email, actorName:user.name, resolutionComments:comments });
      setIncidents(i => i.map(x => x.id === id ? (updated?.id ? updated : {...x, status:'resolved', resolutionComments:comments, resolvedAt:new Date().toISOString(), resolvedBy:user.email}) : x));
      showToast(lang === 'en' ? '🛠️ Resolved' : '🛠️ Resuelto');
    } catch(e) { console.error('Resolve incident error', e); showToast("Error: " + (e.message || 'Revise Supabase/Render'), true); } finally { setSyncing(false); }
  };

  const verifyIncident = async (id, payload) => {
    setSyncing(true);
    try {
      const updated = await api.patch(`/api/incidents/${id}/verify`, { ownerUid:user.uid, guests:payload.guests || [], ownerComments:payload.ownerComments || '', ownerResolution:payload.ownerResolution || '' });
      setIncidents(i => i.map(x => x.id === id ? updated : x));
      setModal(null); loadAll(false); showToast('✅ Incidente verificado');
    } catch(e) { showToast('Error al verificar: ' + (e.message || 'Revise datos'), true); }
    finally { setSyncing(false); }
  };

  const addResolution = async (id, resolutionText) => {
    setSyncing(true);
    try {
      const updated = await api.patch(`/api/incidents/${id}/add-resolution`, { ownerUid:user.uid, ownerResolution:resolutionText });
      setIncidents(i => i.map(x => x.id === id ? updated : x));
      setModal(null); loadAll(false); showToast(lang==='en' ? '📝 Resolution saved — admin notified' : '📝 Respuesta guardada — admin notificado');
    } catch(e) { showToast('Error: ' + (e.message || ''), true); }
    finally { setSyncing(false); }
  };

  const deleteIncident = async (id) => {
    setSyncing(true);
    try {
      await api.del(`/api/incidents/${id}`, { reporterUid: user.uid, actorEmail: user.email });
      setIncidents(i => i.filter(x => x.id !== id));
      showToast("🗑️ Eliminado");
    } catch(e) { console.error('Delete incident error', e); showToast("Error al eliminar: " + (e.message || 'Revise Supabase/Render'), true); } finally { setSyncing(false); }
  };

  const markNotificationRead = async (id) => {
    if (!user?.uid) return;
    try {
      const updated = await api.patch(`/api/notifications/${id}/read`, { ownerUid: user.uid });
      setNotifications(ns => ns.map(n => n.id === id ? updated : n));
    } catch(e) { console.error('Notification read error', e); showToast("Error al marcar aviso", true); }
  };

  const markAllNotificationsRead = async () => {
    if (!user?.uid) return;
    try {
      await api.patch('/api/notifications/read-all', { ownerUid: user.uid });
      setNotifications(ns => ns.map(n => ({ ...n, isRead: true })));
      showToast("🔔 Avisos marcados como leídos");
    } catch(e) { console.error('Notification read-all error', e); showToast("Error al marcar avisos", true); }
  };

  const saveAdminConfig = async (cfg) => {
    setSyncing(true);
    try {
      const r = await api.put('/api/admin/config', { actorUid:user.uid, actorEmail:user.email, ...cfg });
      const newConfig = r.config || {};
      setAdminInfo(a => ({...a, config: newConfig }));
      if (newConfig) setCustomLabels(newConfig);
      showToast('✅ Configuración guardada');
    } catch(e) { showToast('Error al guardar configuración: ' + (e.message || ''), true); }
    finally { setSyncing(false); }
  };

  const [updateAvailable, setUpdateAvailable] = useState(false);
  useEffect(() => {
    const clientBuild = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';
    if (!clientBuild) return;
    const check = () => api.get('/api/version').then(r => { if (r?.buildTime && r.buildTime !== clientBuild) setUpdateAvailable(true); }).catch(()=>{});
    check();
    const id = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (authLoading || (user && (adminLoading || registrationLoading)) || (isApproved && loading) || loadError) return (
    <div style={{fontFamily:"'DM Sans',sans-serif",minHeight:"100vh",background:"#07141e",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:24}}>
      <style>{CSS}</style>
      <div className="logo-mark" style={{width:64,height:64}}>
        <span className="logo-k" style={{fontSize:"1.6rem"}}>K</span>
        <span className="logo-wave" style={{fontSize:"0.8rem"}}>~</span>
      </div>
      <div style={{textAlign:"center",maxWidth:320}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:"1.4rem",color:"#dff0f5",marginBottom:8}}>{complexName}</div>
        {loading && !loadError && <>
          <div style={{fontSize:"0.82rem",color:"#2a6a7a",marginBottom:6}}>Conectando con el servidor...</div>
          <div style={{fontSize:"0.72rem",color:"#1a4a5a",marginBottom:20}}>(El servidor puede tardar ~30s en despertar)</div>
          <div className="spinner" style={{margin:"0 auto"}}/>
        </>}
        {loadError && <>
          <div style={{fontSize:"0.82rem",color:"#ff6b6b",marginBottom:8}}>⚠️ No se pudo conectar al servidor</div>
          <div style={{fontSize:"0.72rem",color:"#8fb6c4",marginBottom:8,wordBreak:"break-word"}}>{loadErrorMsg}</div>
          <div style={{fontSize:"0.72rem",color:"#3a5a6a",marginBottom:20}}>Verifica <code>/api/health</code>. Si dice missing env o table missing, revisa Render Environment y corre el schema de Supabase.</div>
          <button onClick={()=>{ setLoading(true); setLoadError(false); setLoadErrorMsg(''); setRetryCount(c=>c+1); }}
            style={{background:"#1a8fa0",color:"white",border:"none",padding:"10px 24px",borderRadius:10,fontSize:"0.85rem",cursor:"pointer"}}>
            🔄 Reintentar
          </button>
        </>}
      </div>
    </div>
  );

  // ─── Shared state exposed via Context (stage F5) ───────────────────────────
  // Built before the early gate returns below so AuthGate / RegistrationGate
  // (which call useApp() internally) can read lang from the Provider.
  const appState = {
    // Auth + user
    user, lang, t, authLoading,
    // Domain data
    listings, incidents, notifications, registration,
    pendingRegistrations, activeRegistrations,
    // Admin context
    adminInfo, effectiveRole, effectiveIsGlobalAdmin,
    // Loading / sync flags
    adminLoading, registrationLoading, loading, syncing, lastSync,
    // Reputation + community goals
    reputation, reputationLoading, communityGoals, communityGoalsLoading,
    // Profile
    userProfile,
    // Branding (derived)
    complexName, complexNameEs, complexNameEn, complexLocation,
    complexLogo, complexBg, complexTower,
    // Derived flags
    isApproved, analyticsEnabledForAll,
    // UI state
    view, modal, toast, openDropdown, showTour,
    unitDetailOverlay, incidentDetailOverlay,
    incidentQuickFilter, listingFloorOpen,
    preLoginConfig, previewRole,
    // Actions / setters
    setLang, setView, setModal, setToast, setOpenDropdown, setShowTour,
    setUnitDetailOverlay, setIncidentDetailOverlay,
    setIncidentQuickFilter, setListingFloorOpen,
    setUserProfile, setPreLoginConfig, setPreviewRole,
    setLoading, setSyncing, setLastSync,
    setRegistration, setRegistrationLoading,
    setListings, setIncidents, setNotifications,
    setPendingRegistrations, setActiveRegistrations,
    setAdminInfo, setAdminLoading,
    setUser, setAuthLoading, setLoginOpen,
    setReputation, setCommunityGoals,
    setLoadError, setLoadErrorMsg,
    // Composite actions
    login, logout,
    loadReputation, loadCommunityGoals,
    openIncidentDetail, toggleListingFloor,
  };

  if (!user) return <AppStateProvider value={appState}><AuthGate onLogin={login} setLang={setLang} complexLogo={complexLogo} complexNameEs={complexNameEs} complexNameEn={complexNameEn} complexLocation={complexLocation} complexBg={complexBg} onCommunitySelect={handleLoginCommunitySelect} /></AppStateProvider>;
  if (!isApproved) return <AppStateProvider value={appState}><RegistrationGate user={user} registration={registration} onSubmit={submitRegistration} onLogout={logout} syncing={syncing} toast={toast} setLang={setLang} complexLogo={complexLogo} complexName={complexName} complexLocation={complexLocation} complexBg={complexBg} /></AppStateProvider>;

  return (
    <AppStateProvider value={appState}>
    <div className="app-shell">
      <style>{CSS}</style>

      {updateAvailable && (
        <div className="update-banner" role="alert">
          <span>🔄 {lang==='en' ? 'A new version is available.' : 'Hay una nueva versión disponible.'}</span>
          <button className="update-banner-btn" onClick={() => window.location.reload()}>
            {lang==='en' ? 'Reload' : 'Actualizar'}
          </button>
        </div>
      )}

      <header className="hdr">
        <div className="hdr-inner">
          <div className="logo" onClick={()=>setView("dashboard")}>
            {complexLogo
              ? <img src={complexLogo} className="hdr-logo-img" alt={complexName} title={`${complexNameEn} v${APP_VERSION} · BETA${BUILD_TIME ? '\nBuilt ' + BUILD_TIME : ''}`}/>
              : <div className="logo-mark" title={`${complexNameEn} v${APP_VERSION} · BETA${BUILD_TIME ? '\nBuilt ' + BUILD_TIME : ''}`}><span className="logo-k">K</span><span className="logo-wave">~</span></div>}
            <div>
              <div className="logo-title">{complexName}</div>
              <div className="logo-sub">{complexLocation} <span className="beta-badge">BETA</span></div>
            </div>
          </div>

          <nav className="nav nav-compact">
            {primaryNav.map(n=>(
              <button key={n.id} className={`nb ${view===n.id?"nb-active":""}`} onClick={()=>{setView(n.id);setOpenDropdown(null);}}>
                {n.icon} {n.label}
                {n.badge>0 && <span className="nb-badge">{n.badge}</span>}
              </button>
            ))}
            <button className={`nb nav-help-btn ${view==='help'?'nb-active':''}`} onClick={()=>{setView('help');setOpenDropdown(null);}} title={t.nav.help} aria-label={t.nav.help}>❓</button>
            {/* Bell sits inside the nav so it stays adjacent to More ▾ */}
            <button className={`icon-btn nav-bell${view==="notifications"?" icon-active":""}`} onClick={()=>{setView('notifications');setOpenDropdown(null);}} title={appText(lang,"smart.title")} aria-label={`${appText(lang,"smart.title")}${smartAlertCount>0?` (${smartAlertCount})`:''}`}>🔔{smartAlertCount>0 && <span className="icon-badge">{smartAlertCount}</span>}</button>
            {(moreNav.length > 0 || adminInfo.isGlobalAdmin) && <div className="nav-dd" onClick={e=>e.stopPropagation()}>
              <button type="button" className={`nb ${moreNav.some(n=>n.id===view)||previewRole?"nb-active":""}`} onClick={() => setOpenDropdown(openDropdown === "more" ? null : "more")}>{lang === "en" ? "More ▾" : "Más ▾"}{previewRole && <span className="nb-preview-dot" aria-label="preview active">👁</span>}</button>
              <div className={`nav-dd-menu ${openDropdown === "more" ? "menu-open" : ""}`}>
                {moreNav.map(n=><button key={n.id} className={`dd-item ${view===n.id?"dd-active":""}`} onClick={()=>{setView(n.id);setOpenDropdown(null);}}>{n.icon} {n.label}{n.badge>0 && <span className="nb-badge">{n.badge}</span>}</button>)}
                {adminInfo.isGlobalAdmin && <>
                  {moreNav.length > 0 && <div className="dd-sep"/>}
                  <div className="dd-section-label">👁 {lang==='en'?'View as role':'Ver como rol'}</div>
                  {[
                    {value:'',               label:lang==='en'?'Global Admin':'Admin global'},
                    {value:'delegate_admin',  label:lang==='en'?'Delegate Admin':'Admin delegado'},
                    {value:'community_admin', label:lang==='en'?'Community Admin':'Admin comunidad'},
                    {value:'user',            label:lang==='en'?'Owner/User':'Propietario/Usuario'},
                  ].map(opt=>(
                    <button key={opt.value||'ga'} type="button"
                      className={`dd-item dd-radio ${(previewRole||'')=== opt.value?'dd-radio-on':''}`}
                      onClick={()=>{setPreviewRole(opt.value||null);setOpenDropdown(null);}}>
                      <span className="dd-radio-dot">{(previewRole||'')=== opt.value?'●':'○'}</span>
                      {opt.label}
                    </button>
                  ))}
                </>}
              </div>
            </div>}
          </nav>

          <div className="hdr-right">
            {user && (adminInfo.communities||[]).length > 1 && (
              <CommunitySwitch
                communities={adminInfo.communities}
                currentId={adminInfo.communityId || getCommunityId() || ''}
                onChange={switchCommunity}
                loading={adminLoading}
              />
            )}
            <LanguageSwitch lang={lang} setLang={setLang} />
            {user ? (
              <div className="profile-dd" onClick={e=>e.stopPropagation()}>
                <button type="button" className="profile-btn" title={user.email} onClick={() => setOpenDropdown(openDropdown === "profile" ? null : "profile")}>
                  {user.photo ? <img src={user.photo} className="uavatar-img" alt={user.avatar} referrerPolicy="no-referrer"/> : <div className="uavatar">{user.avatar}</div>}
                </button>
                <div className={`profile-menu ${openDropdown === "profile" ? "menu-open" : ""}`}>
                  <div className="profile-head">
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                    <small>{myListings.length ? `${myListings.length} ${lang === 'en' ? (myListings.length>1?'units':'unit') : ('unidad' + (myListings.length>1?'es':''))}` : (lang === "en" ? "Visitor" : "Visitante")}</small>
                    <span className={`profile-role-badge prb-${effectiveIsGlobalAdmin?'global':effectiveRole==='delegate_admin'?'delegate':effectiveIsCommunityAdmin?'community':'user'}`}>{effectiveIsGlobalAdmin?(lang==='en'?'🌐 Global Admin':'🌐 Admin global'):effectiveRole==='delegate_admin'?(lang==='en'?'🛡️ Delegate Admin':'🛡️ Admin delegado'):effectiveIsCommunityAdmin?(lang==='en'?'🏢 Community Admin':'🏢 Admin comunidad'):(lang==='en'?'🏠 Unit Owner':'🏠 Propietario')}</span>
                  </div>
                  <button className="dd-item" onClick={()=>{setView('profile');setOpenDropdown(null);}}>{lang === "en" ? "👤 My profile" : "👤 Mi perfil"}</button>
                  <button className="dd-item" onClick={()=>{setShowTour(true);setOpenDropdown(null);}}>🎯 {lang === "en" ? "Interactive tour" : "Tour interactivo"}</button>
                  <button className="dd-item" onClick={()=>{setView('my');setOpenDropdown(null);}}>🏠 {t.nav.my}</button>
                  <button className="dd-item" onClick={()=>{setView('about');setOpenDropdown(null);}}>🌊 {t.nav.about}</button>
                  {(effectiveIsGlobalAdmin || effectiveRole === 'delegate_admin' || effectiveIsCommunityAdmin) && <button className="dd-item" onClick={()=>{setView('admin');setOpenDropdown(null);}}>⚙️ {t.nav.admin}</button>}
                  {(effectiveIsGlobalAdmin || analyticsEnabledForAll) && <button className="dd-item" onClick={()=>{setView('analytics');setOpenDropdown(null);}}>📈 {t.nav.analytics}</button>}
                  {adminInfo.isGlobalAdmin && <div className="profile-view-as"><span>👁 {lang==='en'?'View as:':'Ver como:'}</span><select className="view-as-select" value={previewRole||''} onChange={e=>{setPreviewRole(e.target.value||null);setOpenDropdown(null);}}><option value="">{lang==='en'?'Global Admin':'Admin global'}</option><option value="delegate_admin">{lang==='en'?'Delegate Admin':'Admin delegado'}</option><option value="community_admin">{lang==='en'?'Community Admin':'Admin comunidad'}</option><option value="user">{lang==='en'?'Owner/User':'Propietario/Usuario'}</option></select></div>}
                  <button className="dd-item danger" onClick={()=>{setOpenDropdown(null);logout();}}>{lang === "en" ? "🚪 Log out" : "🚪 Cerrar sesión"}</button>
                  <div className="profile-version">{complexName} · v{APP_VERSION}</div>
                </div>
              </div>
            ) : (
              <button className="btn-google" onClick={login}><GoogleIcon/> {lang === "en" ? "Sign in with Google" : "Ingresar con Google"}</button>
            )}
          </div>
        </div>
        <div className="mob-nav">
          {NAV.map(n=>(
            <button key={n.id} className={`mbn ${view===n.id?"mbn-active":""}`} onClick={()=>{setView(n.id);setOpenDropdown(null);}}>
              <span>{n.icon}</span><span>{n.label}</span>
              {n.badge>0 && <span className="mbn-badge">{n.badge}</span>}
            </button>
          ))}
        </div>
      </header>
      {adminInfo.isGlobalAdmin && previewRole && (
        <div className="role-preview-banner" role="alert" aria-live="polite">
          <span>⚠️ {lang==='en' ? `Viewing as: ${PREVIEW_ROLE_LABELS.en[previewRole]} — This is a preview only` : `Vista previa como: ${PREVIEW_ROLE_LABELS.es[previewRole]} — Esto es solo una vista previa`}</span>
          <button type="button" onClick={()=>setPreviewRole(null)}>{lang==='en'?'Exit preview':'Salir de vista previa'}</button>
        </div>
      )}
      <main className="main">
        {view==="dashboard" && <Dashboard listings={listings} incidents={incidents} user={user} contactProps={contactProps} setView={setView} showBlacklist={false} onReport={()=>{ if(!user){login();return;} setModal({type:"incident"}); }} effectiveIsGlobalAdmin={effectiveIsGlobalAdmin} effectiveRole={effectiveRole} delegatePerms={delegatePerms} pendingOwner={needsOwnerVerification.length} pendingOwnerResolution={needsOwnerResolution.length} pendingResolve={needsAdminResolution.length} pendingRegistrations={effectiveCanManageRegistrations ? pendingRegistrations.length : 0} canResolve={canResolveIncidentsNow} canManageRegistrations={effectiveCanManageRegistrations} onOwnerClick={()=>{setIncidentQuickFilter('ownerVerification');setView('incidents');}} onResolveClick={()=>{setIncidentQuickFilter('requiresResolution');setView('incidents');}} onRegistrationsClick={()=>setView('approvals')} onAddResClick={()=>{setIncidentQuickFilter('needsResolution');setView('incidents');}} onIncidentDetail={openIncidentDetail} communityGoals={communityGoals} communityGoalsLoading={communityGoalsLoading} />}
        {view==="about" && <CommunityMissionView config={adminInfo.config} />}
        {view==="listings"  && <ListingsView listings={listings} incidents={incidents} user={user} contactProps={contactProps} isGlobalAdmin={effectiveIsGlobalAdmin} canEditGlobal={delegatePerms.canUpdateGlobalListings} canDeleteGlobal={delegatePerms.canDeleteGlobalListings} canResolveGlobal={canResolveIncidentsNow} floorOpenState={listingFloorOpen} onFloorToggle={toggleListingFloor} onAdd={()=>{ if(!user){login();return;} setModal({type:"addListing"}); }} onEdit={l=>setModal({type:"editListing",data:l})} onDelete={deleteListing} onReport={l=>{ if(!user){login();return;} setModal({type:"incident",data:{aptId:l.id}}); }} onVerify={inc=>setModal({type:"verifyIncident",data:inc})} onResolve={resolveIncident} onAddResolution={inc=>setModal({type:"addResolution",data:inc})} onFloorFilter={f=>{setIncidentQuickFilter({type:'floorFilter',aptIds:f.aptIds,status:f.status});setView('incidents');}} onAssign={inc=>setModal({type:'assignGeneral',data:inc})} onCloseGeneral={inc=>setModal({type:'closeGeneral',data:inc})} onIncidentDetail={openIncidentDetail} />}

        {(view==="incidents"||view==="general") && <IncidentsView key={view} defaultTab={view==='general'?'general':'unit'} incidents={incidents} listings={listings} quickFilter={incidentQuickFilter} onQuickFilterApplied={()=>setIncidentQuickFilter(null)} contactProps={contactProps} isGlobalAdmin={effectiveIsGlobalAdmin} canUpdateGlobal={delegatePerms.canUpdateGlobalIncidents} canDeleteGlobal={delegatePerms.canDeleteGlobalIncidents} canResolveGlobal={canResolveIncidentsNow} onAdd={()=>{ if(!user){login();return;} setModal({type:"incident"}); }} onResolve={resolveIncident} onDelete={deleteIncident} onVerify={inc=>setModal({type:"verifyIncident",data:inc})} onAddResolution={inc=>setModal({type:"addResolution",data:inc})} onUnitDetail={id=>setUnitDetailOverlay({listingId:id})} onIncidentDetail={openIncidentDetail} onAssign={inc=>setModal({type:'assignGeneral',data:inc})} onCloseGeneral={inc=>setModal({type:'closeGeneral',data:inc})} />}
        {view==="notifications" && user && <NotificationsView notifications={notifications} incidents={incidents} listings={listings} contactProps={contactProps} onRead={markNotificationRead} onReadAll={markAllNotificationsRead} smartAlerts={smartAlerts} onIncidentDetail={openIncidentDetail} />}
        {view==="approvals" && user && effectiveCanManageRegistrations && <PendingApprovalsView pending={pendingRegistrations} onApprove={id=>reviewRegistrationAction(id,'approve')} onDecline={id=>reviewRegistrationAction(id,'decline')} active={activeRegistrations} />}
        {view==="analytics" && user && (effectiveIsGlobalAdmin || analyticsEnabledForAll) && <AnalyticsDashboard user={user} contactProps={contactProps} showToast={showToast} isGlobalAdmin={effectiveIsGlobalAdmin} />}
        {view==="admin" && user && ((effectiveIsGlobalAdmin || effectiveRole === 'delegate_admin' || effectiveIsCommunityAdmin) ? <ErrorBoundary section="admin" fallback={(err)=><AdminFallback error={err}/>}><AdminSettings config={adminInfo.config || {}} user={user} listings={listings} contactProps={contactProps} onSave={saveAdminConfig} showToast={showToast} adminInfo={adminInfo} /></ErrorBoundary> : <AdminAccessHelp user={user} adminInfo={adminInfo} />)}
        {view==="my" && user && <><DashboardGreeting user={user} role={effectiveIsGlobalAdmin?'global':effectiveRole==='delegate_admin'?'delegate':'standard'} pendingOwner={needsOwnerVerification.length} pendingOwnerResolution={needsOwnerResolution.length} pendingResolve={needsAdminResolution.length} pendingRegistrations={effectiveCanManageRegistrations?pendingRegistrations.length:0} myOpenCount={needsOwnerVerification.length} onOwnerClick={()=>{setIncidentQuickFilter('ownerVerification');setView('incidents');}} onResolveClick={()=>{setIncidentQuickFilter('requiresResolution');setView('incidents');}} onRegistrationsClick={()=>setView('approvals')} setView={setView}/><MyListings listings={myListings} allListings={listings} incidents={incidents} user={user} contactProps={contactProps} isGlobalAdmin={effectiveIsGlobalAdmin} canResolveGlobal={canResolveIncidentsNow} onAdd={()=>setModal({type:"addListing"})} onEdit={l=>setModal({type:"editListing",data:l})} onDelete={deleteListing} onReport={l=>setModal({type:"incident",data:{aptId:l.id}})} onVerify={inc=>setModal({type:"verifyIncident",data:inc})} onResolve={resolveIncident} onAddResolution={inc=>setModal({type:"addResolution",data:inc})} onNavigateToIncidents={f=>{setIncidentQuickFilter({type:'floorFilter',aptIds:f.aptIds,status:f.status||'all'});setView('incidents');}} onIncidentDetail={openIncidentDetail} onAssign={inc=>setModal({type:'assignGeneral',data:inc})} onCloseGeneral={inc=>setModal({type:'closeGeneral',data:inc})} /></>}
        {view==="profile" && user && <ProfileView user={user} userProfile={userProfile} onSave={saveProfile} communities={adminInfo.communities||[]} currentCommunityId={adminInfo.communityId||getCommunityId()} onSwitchCommunity={switchCommunity} reputation={reputation} reputationLoading={reputationLoading} loadReputation={loadReputation} />}
        {view==="help" && <HelpView effectiveRole={effectiveRole} effectiveIsGlobalAdmin={effectiveIsGlobalAdmin} delegatePerms={delegatePerms} listings={listings} incidents={incidents} user={user} setView={setView} onReport={()=>{ if(!user){login();return;} setModal({type:'incident'}); }} onAddListing={()=>{ if(!user){login();return;} setModal({type:'addListing'}); }} setIncidentQuickFilter={setIncidentQuickFilter} openMore={()=>setOpenDropdown('more')} onStartTour={()=>setShowTour(true)} />}
      </main>
      {showTour && <UserTour onClose={()=>setShowTour(false)} onGo={v=>{setShowTour(false);setView(v);}} onReport={()=>{setShowTour(false);if(user)setModal({type:'incident'});else login();}} onAddListing={()=>{setShowTour(false);if(user)setModal({type:'addListing'});else login();}} />}

      {/* Mobile bottom navigation — sticky 4-tab bar for small screens */}
      {user && isApproved && (
        <nav className="mob-bottom-nav" aria-label={lang==='en'?'Main navigation':'Navegación principal'}>
          {[
            { id:'incidents',     icon:'⚠️', label:lang==='en'?'Incidents':'Incidentes',    badge: openCount },
            { id:'my',            icon:'🔑', label:lang==='en'?'My Units':'Mis Unidades',   badge: myListings.length>0&&(needsOwnerVerification.length+needsOwnerResolution.length)||0 },
            { id:'notifications', icon:'🔔', label:lang==='en'?'Alerts':'Alertas',          badge: unreadNotifications },
            { id:'my',            icon:'👤', label:lang==='en'?'Profile':'Perfil',           badge: 0, toProfile:true },
          ].map((n,i)=>(
            <button key={i} type="button"
              className={`mbn-bottom${view===(n.toProfile?'profile':n.id)?' mbn-bottom-active':''}`}
              onClick={()=>{setView(n.toProfile?'profile':n.id);setOpenDropdown(null);}}>
              <span className="mbn-bottom-icon">{n.icon}{n.badge>0&&<span className="mbn-bottom-badge">{n.badge}</span>}</span>
              <span className="mbn-bottom-lbl">{n.label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* Global unit detail overlay — triggered from any unit number click across the app */}
      {unitDetailOverlay && (() => {
        const udl = listings.find(x=>x.id===unitDetailOverlay.listingId);
        if (!udl) return null;
        return (
          <Overlay onClose={()=>setUnitDetailOverlay(null)} wide>
            <UnitDetailCard
              key={udl.id}
              l={udl}
              incidents={incidents}
              canEdit={user?.uid===udl.ownerUid||effectiveIsGlobalAdmin||delegatePerms.canUpdateGlobalListings}
              canDelete={user?.uid===udl.ownerUid||effectiveIsGlobalAdmin||delegatePerms.canDeleteGlobalListings}
              onEdit={()=>{setUnitDetailOverlay(null);setModal({type:'editListing',data:udl});}}
              onDelete={()=>{setUnitDetailOverlay(null);deleteListing(udl);}}
              onReport={()=>{setUnitDetailOverlay(null);if(!user){login();return;}setModal({type:'incident',data:{aptId:udl.id}});}}
              user={user}
              contactProps={contactProps}
              isGlobalAdmin={effectiveIsGlobalAdmin}
              canResolveGlobal={canResolveIncidentsNow}
              onVerify={inc=>setModal({type:'verifyIncident',data:inc})}
              onResolve={resolveIncident}
              onAddResolution={inc=>setModal({type:'addResolution',data:inc})}
              defaultStep={unitDetailOverlay.defaultStep||'info'}
            />
          </Overlay>
        );
      })()}
      {/* Global incident detail overlay — triggered from any incident summary click across the app */}
      {incidentDetailOverlay && (() => {
        const inc = incidents.find(i => i.id === incidentDetailOverlay.incidentId);
        const udl = inc ? listings.find(x => x.id === inc.aptId) : null;
        if (!udl || !inc) return null;
        return (
          <Overlay onClose={()=>setIncidentDetailOverlay(null)} wide>
            <UnitDetailCard
              key={`${udl.id}-${inc.id}`}
              l={udl}
              incidents={incidents}
              canEdit={user?.uid===udl.ownerUid||effectiveIsGlobalAdmin||delegatePerms.canUpdateGlobalListings}
              canDelete={user?.uid===udl.ownerUid||effectiveIsGlobalAdmin||delegatePerms.canDeleteGlobalListings}
              onEdit={()=>{setIncidentDetailOverlay(null);setModal({type:'editListing',data:udl});}}
              onDelete={()=>{setIncidentDetailOverlay(null);deleteListing(udl);}}
              onReport={()=>{setIncidentDetailOverlay(null);if(!user){login();return;}setModal({type:'incident',data:{aptId:udl.id}});}}
              user={user}
              contactProps={contactProps}
              isGlobalAdmin={effectiveIsGlobalAdmin}
              canResolveGlobal={canResolveIncidentsNow}
              onVerify={inc=>setModal({type:'verifyIncident',data:inc})}
              onResolve={resolveIncident}
              onAddResolution={inc=>setModal({type:'addResolution',data:inc})}
              defaultStep="incident"
              defaultIncidentId={inc.id}
            />
          </Overlay>
        );
      })()}
      {/* LoginModal removed — Google popup handles auth directly */}
      {modal?.type==="addListing" && <ListingModal title={appText(lang,"listings.add")} config={adminInfo.config} user={user} onSave={addListing} onClose={()=>setModal(null)} />}
      {modal?.type==="editListing" && <ListingModal title={appText(lang,"modal.listing.editTitle")} config={adminInfo.config} user={user} initial={modal.data} onSave={d=>editListing(modal.data.id, modal.data.ownerUid, d)} onClose={()=>setModal(null)} />}
      {modal?.type==="incident" && <IncidentModal config={adminInfo.config} listings={listings} user={user} presetApt={modal.data?.aptId} onSave={addIncident} onClose={()=>{setModal(null);loadAll(false);}} />}
      {modal?.type==="verifyIncident" && <VerifyIncidentModal config={adminInfo.config} incident={modal.data} onSave={payload=>verifyIncident(modal.data.id,payload)} onClose={()=>{setModal(null);loadAll(false);}} />}
      {modal?.type==="addResolution" && <AddResolutionModal incident={modal.data} onSave={text=>addResolution(modal.data.id,text)} onClose={()=>{setModal(null);loadAll(false);}} />}
      {modal?.type==="assignGeneral" && <AssignToUnitModal incident={modal.data} listings={listings} onSave={aptId=>assignIncident(modal.data.id,aptId)} onClose={()=>{setModal(null);loadAll(false);}} />}
      {modal?.type==="closeGeneral" && <CloseGeneralModal incident={modal.data} onSave={data=>closeGeneralIncident(modal.data.id,data)} onClose={()=>{setModal(null);loadAll(false);}} />}
      {modal?.type==="sendUserEmail" && <SendUserEmailModal contact={modal.data} fromUser={user} onSend={sendUserEmail} onClose={()=>setModal(null)} />}

      {syncing && <div className="sync-overlay"><div className="spinner-sm"/><span>{lang === "en" ? "Saving to server..." : "Guardando en servidor..."}</span></div>}
      {toast && <div className={`toast ${toast.err?"toast-err":""}`}>{toast.msg}</div>}
    </div>
    </AppStateProvider>
  );
}
