// Firebase auth for the tax portal.
//
// Reuses the existing Firebase app instance if the Airbnb side already
// initialized it (path-based routing means only one of the two apps mounts
// per page, but both pull from the same VITE_FIREBASE_* env vars). When the
// tax module is eventually lifted into a standalone deploy, this same code
// keeps working — it just always hits the `else` branch.

import { getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';

const FIREBASE_CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseReady = Object.values(FIREBASE_CONFIG).every(Boolean);

let _app = null;
let _auth = null;
let _googleProvider = null;

try {
  if (firebaseReady) {
    _app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
    _auth = getAuth(_app);
    _googleProvider = new GoogleAuthProvider();
    _googleProvider.setCustomParameters({ prompt: 'select_account' });
  } else {
    console.warn('[TAX_FIREBASE_CONFIG_MISSING]',
      Object.keys(FIREBASE_CONFIG).filter(k => !FIREBASE_CONFIG[k]));
  }
} catch (e) {
  console.error('[TAX_FIREBASE_INIT_ERROR]', e);
}

export const taxAuth = _auth;

export const signInWithGoogle = () => signInWithPopup(_auth, _googleProvider);
export const signInWithEmail = (email, password) => signInWithEmailAndPassword(_auth, email, password);
export const createEmailAccount = (email, password) => createUserWithEmailAndPassword(_auth, email, password);
export const sendPasswordReset = (email) => sendPasswordResetEmail(_auth, email);
export const onTaxAuthChanged = (cb) => onAuthStateChanged(_auth, cb);
export const signOutTax = () => signOut(_auth);

// Maps Firebase error codes to bilingual, customer-friendly messages.
export function firebaseErrorMessage(err, lang = 'es') {
  const code = (err && err.code) || '';
  const map = {
    'auth/invalid-credential':       { es: 'Correo o contraseña incorrectos.', en: 'Invalid email or password.' },
    'auth/invalid-email':            { es: 'El correo no es válido.',            en: 'Email is not valid.' },
    'auth/user-not-found':           { es: 'No encontramos una cuenta con este correo.', en: 'No account found with that email.' },
    'auth/wrong-password':           { es: 'Contraseña incorrecta.',             en: 'Incorrect password.' },
    'auth/email-already-in-use':     { es: 'Ya existe una cuenta con este correo. Inicie sesión en su lugar.', en: 'An account with that email already exists. Please sign in instead.' },
    'auth/weak-password':            { es: 'La contraseña debe tener al menos 6 caracteres.', en: 'Password must be at least 6 characters.' },
    'auth/too-many-requests':        { es: 'Demasiados intentos. Espere unos minutos e inténtelo de nuevo.', en: 'Too many attempts. Please wait a few minutes and try again.' },
    'auth/popup-closed-by-user':     { es: 'La ventana de inicio de sesión se cerró antes de completar.', en: 'The sign-in window was closed before completing.' },
    'auth/network-request-failed':   { es: 'Error de red. Verifique su conexión.', en: 'Network error. Check your connection.' },
  };
  return (map[code] && map[code][lang]) || (lang === 'en'
    ? 'Sign-in failed. Please try again or contact your tax practice.'
    : 'No pudimos iniciar sesión. Inténtelo de nuevo o contacte a su contador.');
}
