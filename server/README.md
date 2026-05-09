# server/

Modular structure for the platform backend, replacing the monolithic
`/server.js` at the repo root. See `docs/platform/PLATFORM_ARCHITECTURE.md` for the
contract.

Status: **mid-migration.** The legacy `server.js` is still authoritative;
this directory is being populated stage by stage. Do not import from
`/server.js` once a piece has moved here.

## Layout

```
server/
  index.js              # (future) bootstrap + module registry
  core/                 # supabase client, auth, email send, audit helpers, logger
  platform/             # platform-level concerns (cross-module)
    app-config/
    audit/
    communities/
    email/
    notifications/
    registrations/
    units/              # currently named "listings" in the DB
    users/
  modules/              # one folder per module
    incidents/
  templates/            # transitional: email template defaults aggregated here
                        # during migration. Long-term, defaults live inside
                        # the module that owns them.
```

## Migration order

1. ✅ Architecture doc + scaffold + extract email-template defaults
2. ⏳ Incidents module: routes, service, permissions
3. ⏳ Platform extractions: units rename, registrations, notifications, audit, users, config, communities, email
4. ⏳ Old-path + permission-key aliases
5. ⏳ New `server/index.js` replaces top of `server.js`
