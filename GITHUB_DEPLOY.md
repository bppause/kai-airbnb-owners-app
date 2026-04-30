# Propietarios Airbnb KAI - GitHub Deploy Version

This folder is ready to push to GitHub and deploy from Render.

## Included production fixes

- Owner verification is required before an incident can be resolved.
- Owner verification requires guest first/last name, city, country, and owner comments.
- Incident resolution is separated from owner verification.
- Verified by owner uses ✅.
- Resolved by admin/delegate uses 🛠️.
- Global admins can resolve incidents.
- Delegate admins can resolve incidents by default.
- Delegate permissions default:
  - approve/deny registrations: true
  - resolve incidents with comments: true
  - update/delete any listing: false
  - update/delete any incident: false
- Environment variable `GLOBAL_ADMIN_EMAILS` users remain global admins.

## Push this version to GitHub

From this folder:

```bash
git init
git add .
git commit -m "v50 verification required before resolution"
git branch -M main
git remote add origin https://github.com/bppause/Airbnb-Properties-Issue-Management.git
git push -u origin main --force
```

If you do not want to force push, use a new branch:

```bash
git checkout -b v50-verification-resolution
git push -u origin v50-verification-resolution
```

Then in Render, set the branch to `v50-verification-resolution` or merge it into `main`.

## Render settings

Build command:

```bash
npm ci && npm run build
```

Start command:

```bash
npm start
```

Required environment variables:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PUBLIC_APP_URL=https://airbnb-property-issue-management.onrender.com
GLOBAL_ADMIN_EMAILS=email1@gmail.com,email2@gmail.com
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_key_here
EMAIL_FROM=Propietarios Airbnb KAI <onboarding@resend.dev>
```

## Supabase

Run:

```sql
supabase/schema.sql
```

before testing this version.
