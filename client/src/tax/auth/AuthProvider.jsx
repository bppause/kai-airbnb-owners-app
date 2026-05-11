// Tax portal auth context.
//
// Wraps Firebase auth state with the server-side tax_customers linkage.
// Provides: { fbUser, customer, community, prefs, status, error, signOut }.
//
// Lifecycle:
//   1. Firebase emits onAuthStateChanged → fbUser set
//   2. We POST /auth/link with { uid, email, communitySlug } to link the
//      Firebase UID to the existing tax_customers row (Phase 1.5 seeded it)
//   3. We GET /portal/me to fetch full customer + community + preferences
//   4. Children render based on status: 'unauthenticated' | 'linking' | 'ready' | 'error'
//
// Impersonation: when sessionStorage holds an active impersonation state
// targeting a customer, we skip Firebase entirely and fetch /portal/me
// using the impersonation token. The admin's actual Firebase session
// (running at /employee in their normal flow) is left untouched, so
// exiting impersonation just clears sessionStorage and bounces back.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onTaxAuthChanged, signOutTax, firebaseReady } from './firebase';
import { taxApi, getImpersonation, clearImpersonation } from '../api';

const AuthCtx = createContext({
  fbUser: null, customer: null, community: null, prefs: null,
  status: 'loading', error: '',
  impersonation: null,
  signOut: () => {},
  refreshMe: () => {},
  exitImpersonation: () => {},
});

export function TaxAuthProvider({ communitySlug, children }) {
  const [fbUser, setFbUser] = useState(null);
  const [me, setMe] = useState(null);
  const [status, setStatus] = useState(firebaseReady ? 'loading' : 'error');
  const [error, setError] = useState(firebaseReady ? '' : 'Firebase is not configured.');
  // Impersonation state lives in sessionStorage; we mirror it into React so
  // children get clean reactive access and the Exit button can update it.
  const [impersonation, setImpersonationState] = useState(() => {
    const imp = getImpersonation();
    return imp && imp.targetType === 'customer' ? imp : null;
  });

  // Subscribe to Firebase auth state — but skip when impersonating, so a
  // stale Firebase listener doesn't fight the impersonation identity.
  useEffect(() => {
    if (!firebaseReady || impersonation) return;
    const unsub = onTaxAuthChanged((user) => {
      setFbUser(user);
      if (!user) { setMe(null); setStatus('unauthenticated'); setError(''); }
    });
    return () => { try { unsub(); } catch (_e) {} };
  }, [impersonation]);

  // Normal Firebase-driven link + /me fetch.
  useEffect(() => {
    if (impersonation) return;          // impersonation path below handles it
    if (!fbUser) return;
    let cancelled = false;
    setStatus('linking'); setError('');
    (async () => {
      try {
        await taxApi.authLink({ uid: fbUser.uid, email: fbUser.email, communitySlug });
        const data = await taxApi.getMe({ uid: fbUser.uid, email: fbUser.email, communitySlug });
        if (cancelled) return;
        setMe(data); setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setMe(null);
        setStatus('error');
        setError(err?.message || 'Could not link your account.');
      }
    })();
    return () => { cancelled = true; };
  }, [fbUser, communitySlug, impersonation]);

  // Impersonation path: pull /portal/me directly. authHeaders() in api.js
  // detects the sessionStorage token and routes the request accordingly.
  useEffect(() => {
    if (!impersonation) return;
    let cancelled = false;
    setStatus('linking'); setError('');
    (async () => {
      try {
        // Pass empty auth; impersonation token takes over inside api.js.
        const data = await taxApi.getMe({ uid: '', email: '', communitySlug: impersonation.communitySlug });
        if (cancelled) return;
        setMe(data); setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        // Token likely expired/invalid → drop state so the gate kicks the
        // user back to the sign-in (or, more typically, the admin can exit
        // impersonation and refresh).
        clearImpersonation();
        setImpersonationState(null);
        setMe(null);
        setStatus('error');
        setError(err?.message || 'Impersonation session ended.');
      }
    })();
    return () => { cancelled = true; };
  }, [impersonation]);

  const refreshMe = useCallback(async () => {
    if (impersonation) {
      try { const data = await taxApi.getMe({ communitySlug: impersonation.communitySlug }); setMe(data); }
      catch (_e) {}
      return;
    }
    if (!fbUser) return;
    try {
      const data = await taxApi.getMe({ uid: fbUser.uid, email: fbUser.email, communitySlug });
      setMe(data);
    } catch (_e) {}
  }, [fbUser, communitySlug, impersonation]);

  const signOut = useCallback(async () => {
    if (impersonation) {
      // While impersonating, "sign out" means exit impersonation rather than
      // dropping the underlying admin's Firebase session.
      clearImpersonation();
      setImpersonationState(null);
      const back = `/tax/${impersonation.communitySlug}/employee`;
      window.location.href = back;
      return;
    }
    try { await signOutTax(); } catch (_e) {}
    setFbUser(null); setMe(null); setStatus('unauthenticated');
  }, [impersonation]);

  // Exit impersonation: tell the server to end the session, clear the
  // sessionStorage state, and bounce back to /employee where the admin's
  // real Firebase identity resumes.
  const exitImpersonation = useCallback(async () => {
    if (!impersonation) return;
    const { token, communitySlug: cs, realAdminEmail, realAdminUid } = impersonation;
    try {
      await taxApi.adminEndImpersonation(
        { uid: realAdminUid, email: realAdminEmail, adminEmail: realAdminEmail, communitySlug: cs },
        token,
      );
    } catch (_e) { /* best effort */ }
    clearImpersonation();
    setImpersonationState(null);
    window.location.href = `/tax/${cs}/employee`;
  }, [impersonation]);

  const value = {
    fbUser,
    customer: me?.customer || null,
    community: me?.community || null,
    prefs: me?.preferences || null,
    relationships: me?.relationships || [],
    impersonation,
    status, error,
    signOut, refreshMe, exitImpersonation,
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useTaxAuth() { return useContext(AuthCtx); }
