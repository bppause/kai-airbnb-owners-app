# client/src/platform/

Platform-level views — the shell of the app, not tied to any single feature
module. Mirrors the server-side `server/platform/` pattern.

Status: **placeholder.** Views move here from App.jsx in later stages.

## Planned layout

```
platform/
  landing/             # community switcher + module tile picker
  profile/             # user profile + preferences
  global-admin/        # AdminPanel views (config, users, delegates, …)
  units/views/         # MyListings + ListingForm (units are platform-level)
  registrations/views/ # RegistrationGate + Approvals
  notifications/views/ # NotificationsList
  communities/views/   # community admin views
  analytics/views/
```
