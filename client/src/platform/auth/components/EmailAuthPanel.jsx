// EmailAuthPanel — email/password sign-in, registration, and password reset.
//
// Sits below the Google button on AuthGate. On successful sign-in or
// registration, Firebase's onAuthStateChanged (wired in App.jsx) picks up the
// new user. For password registrations we trigger a verification email; the
// App.jsx auth handler refuses to provision /api/admin/me until
// firebaseUser.emailVerified is true, so unverified accounts can't reach the
// rest of the app.

import React, { useState } from "react";
import {
  registerWithEmail,
  signInWithEmail,
  requestPasswordReset,
} from "../../../core/auth";

const COPY = {
  es: {
    tabSignIn: "Iniciar sesión",
    tabRegister: "Crear cuenta",
    tabForgot: "Recuperar",
    or: "o con email y contraseña",
    name: "Nombre",
    email: "Email",
    password: "Contraseña",
    passwordConfirm: "Confirmar contraseña",
    submitSignIn: "Ingresar",
    submitRegister: "Crear cuenta",
    submitForgot: "Enviar enlace",
    forgotLink: "¿Olvidaste tu contraseña?",
    haveAccount: "¿Ya tienes cuenta? Inicia sesión",
    noAccount: "¿No tienes cuenta? Regístrate",
    backToSignIn: "← Volver a iniciar sesión",
    verifySent: "Te enviamos un email para verificar tu cuenta. Revisa tu bandeja antes de iniciar sesión.",
    resetSent: "Si existe una cuenta con ese email, te enviamos un enlace para restablecer la contraseña.",
    mismatch: "Las contraseñas no coinciden.",
    weak: "La contraseña debe tener al menos 8 caracteres.",
    invalidEmail: "Email no válido.",
    inUse: "Ese email ya está registrado.",
    notFound: "No encontramos una cuenta con ese email.",
    badCreds: "Email o contraseña incorrectos.",
    needsVerify: "Tu email aún no está verificado. Revisa tu bandeja.",
    tooMany: "Demasiados intentos. Inténtalo más tarde.",
    generic: "Algo salió mal. Inténtalo de nuevo.",
  },
  en: {
    tabSignIn: "Sign in",
    tabRegister: "Create account",
    tabForgot: "Reset",
    or: "or with email and password",
    name: "Name",
    email: "Email",
    password: "Password",
    passwordConfirm: "Confirm password",
    submitSignIn: "Sign in",
    submitRegister: "Create account",
    submitForgot: "Send reset link",
    forgotLink: "Forgot your password?",
    haveAccount: "Already have an account? Sign in",
    noAccount: "No account? Register",
    backToSignIn: "← Back to sign in",
    verifySent: "We sent you a verification email. Check your inbox before signing in.",
    resetSent: "If an account exists for that email, we sent a reset link.",
    mismatch: "Passwords do not match.",
    weak: "Password must be at least 8 characters.",
    invalidEmail: "Invalid email.",
    inUse: "That email is already registered.",
    notFound: "No account found for that email.",
    badCreds: "Incorrect email or password.",
    needsVerify: "Your email is not verified yet. Check your inbox.",
    tooMany: "Too many attempts. Try again later.",
    generic: "Something went wrong. Try again.",
  },
};

function mapFirebaseError(code, c) {
  switch (code) {
    case "auth/email-already-in-use": return c.inUse;
    case "auth/invalid-email":        return c.invalidEmail;
    case "auth/weak-password":        return c.weak;
    case "auth/user-not-found":       return c.notFound;
    case "auth/wrong-password":
    case "auth/invalid-credential":   return c.badCreds;
    case "auth/too-many-requests":    return c.tooMany;
    default:                          return c.generic;
  }
}

const ROW = { display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 };
const LABEL = { fontSize: ".72rem", fontWeight: 600, color: "rgba(47,79,58,.7)" };
const INPUT = {
  padding: "9px 11px",
  borderRadius: 8,
  border: "1.5px solid rgba(47,79,58,.25)",
  fontSize: ".9rem",
  background: "rgba(255,255,255,.92)",
  color: "#1a3c2a",
  boxSizing: "border-box",
};

export default function EmailAuthPanel({ lang }) {
  const c = COPY[lang === "en" ? "en" : "es"];
  const [mode, setMode] = useState("signIn"); // 'signIn' | 'register' | 'forgot'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reset = () => { setError(""); setNotice(""); };
  const switchMode = (m) => { reset(); setPassword(""); setConfirm(""); setMode(m); };

  const onSubmit = async (e) => {
    e.preventDefault();
    reset();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) { setError(c.invalidEmail); return; }
    setBusy(true);
    try {
      if (mode === "register") {
        if (password.length < 8) { setError(c.weak); setBusy(false); return; }
        if (password !== confirm) { setError(c.mismatch); setBusy(false); return; }
        await registerWithEmail(trimmedEmail, password, displayName.trim() || trimmedEmail);
        setNotice(c.verifySent);
      } else if (mode === "forgot") {
        await requestPasswordReset(trimmedEmail);
        setNotice(c.resetSent);
      } else {
        await signInWithEmail(trimmedEmail, password);
        // onAuthChanged in App.jsx will take it from here; if the email isn't
        // verified, App.jsx surfaces a message and signs the user back out.
      }
    } catch (err) {
      setError(mapFirebaseError(err?.code, c));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px dashed rgba(47,79,58,.22)" }}>
      <div style={{ textAlign: "center", fontSize: ".72rem", color: "rgba(47,79,58,.6)", marginBottom: 10, letterSpacing: ".02em" }}>
        — {c.or} —
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 10, background: "rgba(47,79,58,.06)", padding: 3, borderRadius: 8 }}>
        {[
          { id: "signIn", label: c.tabSignIn },
          { id: "register", label: c.tabRegister },
          { id: "forgot", label: c.tabForgot },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => switchMode(t.id)}
            style={{
              flex: 1,
              padding: "6px 8px",
              borderRadius: 6,
              fontSize: ".78rem",
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              background: mode === t.id ? "#fff" : "transparent",
              color: mode === t.id ? "#1a3c2a" : "rgba(47,79,58,.6)",
              boxShadow: mode === t.id ? "0 1px 3px rgba(0,0,0,.08)" : "none",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit}>
        {mode === "register" && (
          <div style={ROW}>
            <label style={LABEL}>{c.name}</label>
            <input style={INPUT} type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" />
          </div>
        )}
        <div style={ROW}>
          <label style={LABEL}>{c.email}</label>
          <input style={INPUT} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
        {mode !== "forgot" && (
          <div style={ROW}>
            <label style={LABEL}>{c.password}</label>
            <input style={INPUT} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} required />
          </div>
        )}
        {mode === "register" && (
          <div style={ROW}>
            <label style={LABEL}>{c.passwordConfirm}</label>
            <input style={INPUT} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          </div>
        )}

        {error && (
          <div role="alert" style={{ marginTop: 6, padding: "7px 10px", borderRadius: 6, background: "rgba(200,40,40,.08)", color: "#a02020", fontSize: ".78rem", border: "1px solid rgba(200,40,40,.2)" }}>
            {error}
          </div>
        )}
        {notice && (
          <div style={{ marginTop: 6, padding: "7px 10px", borderRadius: 6, background: "rgba(11,127,79,.08)", color: "#0b5f3a", fontSize: ".78rem", border: "1px solid rgba(11,127,79,.22)" }}>
            {notice}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{
            width: "100%",
            marginTop: 10,
            padding: "10px 12px",
            borderRadius: 8,
            border: "none",
            background: busy ? "rgba(47,79,58,.4)" : "#2F4F3A",
            color: "#fff",
            fontWeight: 700,
            fontSize: ".88rem",
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "…" : mode === "register" ? c.submitRegister : mode === "forgot" ? c.submitForgot : c.submitSignIn}
        </button>
      </form>

      <div style={{ marginTop: 8, textAlign: "center", fontSize: ".76rem" }}>
        {mode === "signIn" && (
          <>
            <button type="button" onClick={() => switchMode("forgot")} style={linkBtn}>{c.forgotLink}</button>
            <span style={{ margin: "0 6px", color: "rgba(47,79,58,.3)" }}>·</span>
            <button type="button" onClick={() => switchMode("register")} style={linkBtn}>{c.noAccount}</button>
          </>
        )}
        {mode === "register" && (
          <button type="button" onClick={() => switchMode("signIn")} style={linkBtn}>{c.haveAccount}</button>
        )}
        {mode === "forgot" && (
          <button type="button" onClick={() => switchMode("signIn")} style={linkBtn}>{c.backToSignIn}</button>
        )}
      </div>
    </div>
  );
}

const linkBtn = {
  background: "none",
  border: "none",
  color: "#0b7f8c",
  fontWeight: 600,
  cursor: "pointer",
  padding: 0,
  fontSize: ".76rem",
  textDecoration: "underline",
};
