# platform/

Cross-module / tenant-level concerns. Anything that more than one module
needs lives here, not inside any single module.

| Folder | Owns |
| --- | --- |
| `users/` | `app_users` table, profile, language preference |
| `communities/` | `communities`, `community_memberships`, `community_config` |
| `units/` | apartments / rooms / villas (currently the `listings` table — rename pending) |
| `registrations/` | community-membership applications |
| `notifications/` | cross-module notification fan-out |
| `audit/` | `audit_logs` (with module column) |
| `app-config/` | platform-wide runtime settings |
| `email/` | email send + delivery logging |

See `docs/platform/PLATFORM_ARCHITECTURE.md` §4 for the platform-vs-module-entity rule.
