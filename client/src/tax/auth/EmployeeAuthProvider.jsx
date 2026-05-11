// Employee auth context (Phase 3).
//
// Parallel to the customer-side AuthProvider but operates against
// /employee/auth/link + /employee/me. Same Firebase project — the route
// you visit determines which provider mounts (/portal/* mounts the
// customer provider; /employee/* mounts this one).

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onTaxAuthChanged, signOutTax, firebaseReady } from './firebase';
import { taxApi } from '../api';

const EmpAuthCtx = createContext({
  fbUser: null, employee: null, community: null,
  status: 'loading', error: '',
  signOut: () => {},
  refreshMe: () => {},
});

export function TaxEmployeeAuthProvider({ communitySlug, children }) {
  const [fbUser, setFbUser] = useState(null);
  const [me, setMe] = useState(null); // { employee, community }
  const [status, setStatus] = useState(firebaseReady ? 'loading' : 'error');
  const [error, setError] = useState(firebaseReady ? '' : 'Firebase is not configured.');

  useEffect(() => {
    if (!firebaseReady) return;
    const unsub = onTaxAuthChanged((user) => {
      setFbUser(user);
      if (!user) { setMe(null); setStatus('unauthenticated'); setError(''); }
    });
    return () => { try { unsub(); } catch (_e) {} };
  }, []);

  useEffect(() => {
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
  }, [fbUser, communitySlug]);

  const refreshMe = useCallback(async () => {
    if (!fbUser) return;
    try {
      const data = await taxApi.getEmployeeMe({ uid: fbUser.uid, email: fbUser.email, communitySlug });
      setMe(data);
    } catch (_e) {}
  }, [fbUser, communitySlug]);

  const signOut = useCallback(async () => {
    try { await signOutTax(); } catch (_e) {}
    setFbUser(null); setMe(null); setStatus('unauthenticated');
  }, []);

  const value = {
    fbUser,
    employee: me?.employee || null,
    community: me?.community || null,
    // Phase 3b: list of customer assignments for staff (empty array for
    // admin role — admins see all customers and don't carry an explicit list).
    assignments: me?.assignments || [],
    status, error,
    signOut, refreshMe,
  };
  return <EmpAuthCtx.Provider value={value}>{children}</EmpAuthCtx.Provider>;
}

export function useEmployeeAuth() { return useContext(EmpAuthCtx); }
