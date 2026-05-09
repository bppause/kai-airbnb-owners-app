# client/src/core/

Cross-cutting frontend infrastructure used by every module: i18n loader,
API client, auth, layout shell, utilities. Mirrors the server-side
`server/core/` pattern.

Status: **mid-extraction.** App.jsx still owns most of the UI; pieces move
here stage by stage. See `docs/platform/PLATFORM_ARCHITECTURE.md` §11.

## Layout

```
core/
  i18n/                # locale JSONs + loader (Stage F1)
    es-CO.json
    en.json
    index.js
  utils.js             # pure helpers (Stage F2)
  api.js               # fetch wrapper (Stage F3)
  auth.js              # Firebase + role/permission resolver (Stage F4)
  app-state/           # React Context (Stage F5)
  layout/              # AppHeader and shell components
```
