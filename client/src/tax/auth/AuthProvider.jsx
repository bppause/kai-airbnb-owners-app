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

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onTaxAuthChanged, signOutTax, firebaseReady } from './firebase';
import { taxApi } from '../api';

const AuthCtx = createContext({
  fbUser: null, customer: null, community: null, prefs: null,
  status: 'loading', error: '',
  signOut: () => {},
  refreshMe: () => {},
});

export function TaxAuthProvider({ communitySlug, children }) {
  const [fbUser, setFbUser] = useState(null);
  const [me, setMe] = useState(null);            // { customer, community, preferences }
  const [status, setStatus] = useState(firebaseReady ? 'loading' : 'error');
  const [error, setError] = useState(firebaseReady ? '' : 'Firebase is not configured.');

  // Subscribe to Firebase auth state.
  useEffect(() => {
    if (!firebaseReady) return;
    const unsub = onTaxAuthChanged((user) => {
      setFbUser(user);
      if (!user) { setMe(null); setStatus('unauthenticated'); setError(''); }
    });
    return () => { try { unsub(); } catch (_e) {} };
  }, []);

  // Link + fetch /me when fbUser appears.
  useEffect(() => {
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
  }, [fbUser, communitySlug]);

  const refreshMe = useCallback(async () => {
    if (!fbUser) return;
    try {
      const data = await taxApi.getMe({ uid: fbUser.uid, email: fbUser.email, communitySlug });
      setMe(data);
    } catch (_e) {}
  }, [fbUser, communitySlug]);

  const signOut = useCallback(async () => {
    try { await signOutTax(); } catch (_e) {}
    setFbUser(null); setMe(null); setStatus('unauthenticated');
  }, []);

  const value = {
    fbUser,
    customer: me?.customer || null,
    community: me?.community || null,
    prefs: me?.preferences || null,
    relationships: me?.relationships || [],
    status, error,
    signOut, refreshMe,
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useTaxAuth() { return useContext(AuthCtx); }
