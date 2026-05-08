# client/src/modules/incidents/

Frontend module for community/property incident management. Mirrors the
server-side `server/modules/incidents/` structure.

Status: **scaffolded; views move here from App.jsx stage by stage.**

## Layout

```
incidents/
  index.js             # module manifest (slug, navItems, routes, permissions)
  views/               # IncidentList, IncidentDetail, IncidentForm, IncidentDashboardSummary
  components/          # incident-specific components (modals, badges, …)
  i18n/                # locale JSONs for incident strings (Stage F5)
    templates.json     # bilingual incident templates (Stage F1)
    es-CO.json         # (future) per-module Spanish strings
    en.json            # (future) per-module English strings
  permissions.js       # mirrors server/modules/incidents/permissions.js
```
