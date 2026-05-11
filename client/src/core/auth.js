// Firebase auth + role/permission resolution.
//
// Owns:
//   - Firebase app/auth/provider initialization (driven by VITE_FIREBASE_*
//     env vars set at Vite build time)
//   - Google sign-in / sign-out convenience wrappers
//   - The auth state listener helper (onAuthChanged)
//   - fetchAdminContext: GET /api/admin/me which returns role, config,
//     permissions, communities, etc. — the "who am I?" call the SPA makes
//     immediately after Firebase resolves the user.
//
// Lifted byte-identical from App.jsx in stage F4. The Firebase init block
// (FIREBASE_CONFIG, firebaseApp, auth, provider, the try/catch) was at the
// top of App.jsx; it now lives here. App.jsx no longer imports from
// firebase/app or firebase/auth directly — everything goes through
// core/auth.
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F4.

import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { api } from "./api";

const FIREBASE_CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseReady = Object.values(FIREBASE_CONFIG).every(Boolean);

let _firebaseApp = null;
let _auth = null;
let _provider = null;
try {
  if (firebaseReady) {
    _firebaseApp = initializeApp(FIREBASE_CONFIG);
    _auth = getAuth(_firebaseApp);
    _provider = new GoogleAuthProvider();
    // Always show Google account chooser so users can switch accounts on shared devices.
    _provider.setCustomParameters({ prompt: "select_account" });
  } else {
    console.warn('[KAI_FIREBASE_CONFIG_MISSING]', Object.keys(FIREBASE_CONFIG).filter(k => !FIREBASE_CONFIG[k]));
  }
} catch (e) {
  console.error('[KAI_FIREBASE_INIT_ERROR]', e);
}

export const auth = _auth;
export const provider = _provider;

// Convenience wrappers — App.jsx calls these instead of importing from
// firebase/auth directly. Each throws if Firebase isn't configured; callers
// should gate with `firebaseReady` first (matches prior App.jsx behavior).
export const signInWithGoogle = () => signInWithPopup(_auth, _provider);
export const signOutUser = () => signOut(_auth);
export const onAuthChanged = (cb) => onAuthStateChanged(_auth, cb);

// Email/password helpers — companion to Google sign-in. Password accounts
// must verify their email before the SPA provisions them via /api/admin/me;
// the caller in App.jsx checks `firebaseUser.emailVerified`.
export const registerWithEmail = async (email, password, displayName) => {
  const cred = await createUserWithEmailAndPassword(_auth, email, password);
  if (displayName && cred.user) {
    try { await updateProfile(cred.user, { displayName }); } catch (e) { /* non-fatal */ }
  }
  try { await sendEmailVerification(cred.user); } catch (e) { /* non-fatal */ }
  return cred;
};
export const signInWithEmail = (email, password) => signInWithEmailAndPassword(_auth, email, password);
export const resendVerificationEmail = () => {
  if (!_auth?.currentUser) throw new Error("not signed in");
  return sendEmailVerification(_auth.currentUser);
};
export const requestPasswordReset = (email) => sendPasswordResetEmail(_auth, email);

// Resolve role / config / permissions / communities for a Firebase user.
// Mirrors the previous App.jsx call sites (which built the URL by hand).
export const fetchAdminContext = ({ uid='', email='', name='', lang='' } = {}) => {
  const q = new URLSearchParams({
    uid: String(uid || ''),
    email: String(email || ''),
    name: String(name || ''),
    lang: String(lang || ''),
  });
  return api.get('/api/admin/me?' + q.toString());
};
