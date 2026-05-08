# incidents module

Community / property incident management. The first and currently only live
module.

Owns:
- `incidents` table
- `/api/m/incidents/*` routes (currently aliased from `/api/incidents/*`)
- Incident-related email templates (`incidents.new`, `incidents.verified`, …)
- Incident SLA / escalation logic
- Permissions: `incidents:resolve`, `incidents:update`, `incidents:delete`, …

References platform entities (units, users, communities, notifications) but
does not reach into other modules' tables.

Status: **extraction in progress.** Routes still live in `/server.js` and
will move here in the next stage.

## Future structure

```
modules/incidents/
  index.js                 # module manifest
  routes.js                # express router → /api/m/incidents/*
  service.js               # SLA, escalation, status transitions
  email-templates.js       # default templates (es-CO + en) for incident.* keys
  permissions.js           # capability list this module declares
  audit-entities.js        # entity names for audit_logs
```
