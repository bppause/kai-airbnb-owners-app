// Shared app state — Context + provider + hook.
//
// The whole tree below <AppStateProvider> can read state with `useApp()`.
// In stage F5 the provider wraps App.jsx's main return but no consumer
// reads from it yet; App.jsx still uses its local closures. Future stages
// (F6+) extract individual views into `client/src/modules/...` and
// `client/src/platform/...` — those extracted views consume Context via
// useApp() instead of receiving everything as props.
//
// Implementation notes:
//   - The Context value is whatever the App component computes and passes
//     in. There is no schema enforced here — App.jsx is the single source
//     of truth for what state exists.
//   - useApp() throws if used outside the provider. That gives a fast,
//     readable error instead of silently failing with `undefined.foo`.
//   - When Context starts to feel "fat" (lots of unrelated state in one
//     bag, or every view re-rendering on every tick), split this into
//     scoped contexts (auth/data/ui). Don't optimize early.
//
// See docs/platform/PLATFORM_ARCHITECTURE.md §11 frontend stage F5.

import React, { createContext, useContext } from "react";

const AppStateContext = createContext(null);

export const AppStateProvider = ({ value, children }) => (
  <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
);

export const useApp = () => {
  const ctx = useContext(AppStateContext);
  if (ctx === null) {
    throw new Error("useApp() must be called inside <AppStateProvider>");
  }
  return ctx;
};
