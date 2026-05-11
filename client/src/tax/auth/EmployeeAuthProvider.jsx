// Employee auth context (Phase 3).
//
// Parallel to the customer-side AuthProvider but operates against
// /employee/auth/link + /employee/me. Same Firebase project — the route
// you visit determines which provider mounts (/portal/* mounts the
// customer provider; /employee/* mounts this one).
//
// Impersonation: when sessionStorage holds an active impersonation state
// targeting an employee, we skip Firebase entirely and fetch /employee/me
// using the impersonation token.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onTaxAuthChanged, signOutTax, firebaseReady } from './firebase';
import { taxApi, getImpersonation, clearImpersonation } from '../api';

const EmpAuthCtx = createContext({
  fbUser: null, employee: null, community: null,
  status: 'loading', error: '',
  impersonation: null,
  signOut: () => {},
  refreshMe: () => {},
  exitImpersonation: () => {},
});

export function TaxEmployeeAuthProvider({ communitySlug, children }) {
  const [fbUser, setFbUser] = useState(null);
  const [me, setMe] = useState(null);
  const [status, setStatus] = useState(firebaseReady ? 'loading' : 'error');
  const [error, setError] = useState(firebaseReady ? '' : 'Firebase is not configured.');
  const [impersonation, setImpersonationState] = useState(() => {
    const imp = getImpersonation();
    return imp && imp.targetType === 'employee' ? imp : null;
  });

  useEffect(() => {
    if (!firebaseReady || impersonation) return;
    const unsub = onTaxAuthChanged((user) => {
      setFbUser(user);
      if (!user) { setMe(null); setStatus('unauthenticated'); setError(''); }
    });
    return () => { try { unsub(); } catch (_e) {} };
  }, [impersonation]);

  useEffect(() => {
    if (impersonation) return;
    if (!fbUser) return;
    let cancelled = false;
    setStatus('linking'); setError('');
    (async () => {
      try {
        await taxApi.employeeAuthLink({ uid: fbUser.uid, email: fbUser.email, communitySlug });
        const data = await taxApi.getEmployeeMe({ uid: fbUser.uid, email: fbUser.email, communitySlug });
        if (cancelled) return;
        setMe(data); setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setMe(null);
        setStatus('error');
        setError(err?.message || 'Could not link your staff account.');
      }
    })();
    return () => { cancelled = true; };
  }, [fbUser, communitySlug, impersonation]);

  useEffect(() => {
    if (!impersonation) return;
    let cancelled = false;
    setStatus('linking'); setError('');
    (async () => {
      try {
        const data = await taxApi.getEmployeeMe({ uid: '', email: '', communitySlug: impersonation.communitySlug });
        if (cancelled) return;
        setMe(data); setStatus('ready');
      } catch (err) {
        if (cancelled) return;
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
      try { const data = await taxApi.getEmployeeMe({ communitySlug: impersonation.communitySlug }); setMe(data); }
      catch (_e) {}
      return;
    }
    if (!fbUser) return;
    try {
      const data = await taxApi.getEmployeeMe({ uid: fbUser.uid, email: fbUser.email, communitySlug });
      setMe(data);
    } catch (_e) {}
  }, [fbUser, communitySlug, impersonation]);

  const signOut = useCallback(async () => {
    if (impersonation) {
      clearImpersonation();
      setImpersonationState(null);
      window.location.href = `/tax/${impersonation.communitySlug}/employee`;
      return;
    }
    try { await signOutTax(); } catch (_e) {}
    setFbUser(null); setMe(null); setStatus('unauthenticated');
  }, [impersonation]);

  const exitImpersonation = useCallback(async () => {
    if (!impersonation) return;
    const { token, communitySlug: cs, realAdminEmail, realAdminUid } = impersonation;
    try {
      await taxApi.adminEndImpersonation(
        { uid: realAdminUid, email: realAdminEmail, adminEmail: realAdminEmail, communitySlug: cs },
        token,
      );
    } catch (_e) {}
    clearImpersonation();
    setImpersonationState(null);
    // Stay on /employee — page reload picks up the real Firebase admin session.
    window.location.href = `/tax/${cs}/employee`;
  }, [impersonation]);

  const value = {
    fbUser,
    employee: me?.employee || null,
    community: me?.community || null,
    assignments: me?.assignments || [],
    impersonation,
    status, error,
    signOut, refreshMe, exitImpersonation,
  };
  return <EmpAuthCtx.Provider value={value}>{children}</EmpAuthCtx.Provider>;
}

export function useEmployeeAuth() { return useContext(EmpAuthCtx); }
