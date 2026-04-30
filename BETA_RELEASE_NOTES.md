# KAI Airbnb Owners — Beta v65

This beta consolidates the collaboration features into a cleaner production-ready baseline.

## Included
- Stable Firebase/Google login with safe loading and fallback states
- Role-aware navigation for owners, standard admins, delegated admins, and global admins
- Smart action center with pending counts for owner verification, ready-to-resolve incidents, registrations, and open incidents
- Interactive incident workflow: Open → Verified by owner → Resolved by Admin
- Responsive layout for desktop, tablet, and mobile screen space
- Global tooltip behavior using native title attributes and app hover styles
- Admin-focused visibility for registration requests requiring action
- Safer menu overlay priority so dropdowns are not hidden by content sections
- Existing backend API, Supabase schema, data models, and working features preserved

## Recommended beta test paths
1. Log in as owner and verify an open incident.
2. Log in as admin and resolve a verified incident.
3. Review pending registrations from the action center and Registrations page.
4. Test mobile viewport and desktop viewport.
5. Confirm `/api/health` is healthy after deploying to Render.

## Deploy notes
- Use the existing Render environment variables.
- Do not change the Supabase schema unless you intentionally want to reset or migrate data.
- If the UI shows a configuration message instead of login, verify Firebase variables in Render.
