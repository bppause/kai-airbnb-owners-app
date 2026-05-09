# UAT Script — KAI Community Incident Management Portal

> Version: May 2026  
> Environment: staging / production  
> Tester: _____________________________ Date: _______________

---

## Before You Start

### Pre-UAT checklist

- [ ] Run `supabase/cleanup_uat.sql` in Supabase SQL Editor (clears incidents, listings, notifications, audit logs — keeps user accounts and config)
- [ ] Or run `supabase/cleanup_uat_full.sql` for a complete clean slate (removes all user accounts too)
- [ ] Confirm `GLOBAL_ADMIN_EMAILS` env var is set and the global admin account can sign in
- [ ] Confirm SLA hours is set to a testable value in Admin → SLA (e.g. 1 hour for testing, restore to 24h after)
- [ ] Have at least two Google accounts ready: one for admin, one for a standard owner

### Marking results

- ✅ Pass — behavior matches expected exactly
- ❌ Fail — behavior does not match; note what happened
- ⚠️ Partial — mostly correct but with a minor deviation; note it
- ➖ Skipped — not applicable to this environment/role

---

## Test Personas

| Persona | Role | Notes |
|---|---|---|
| **Global Admin** | `global_admin` | Email in `GLOBAL_ADMIN_EMAILS` env var |
| **Delegate Admin** | `delegate_admin` | Promoted via Admin panel; has `canResolveIncidents` |
| **Community Admin** | `community_admin` | Assigned per community; `canApproveRegistrations + canResolveIncidents` |
| **Standard Owner** | `user` | Registered and approved; owns at least one listing |
| **New User** | (pending) | Google sign-in but not yet approved |

---

## Section 1 — Login & Registration

---

**TC-01 — New user first sign-in creates a pending registration**
- **Role:** New User (not previously registered)
- **Precondition:** User has a Google account not yet in the system
- **Steps:**
  1. Open the app
  2. Click "Sign in with Google" and complete Google auth
- **Expected:** User lands on a waiting/pending screen. No nav items are accessible. A pending registration entry appears in Admin → Registrations for the global admin.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-02 — Admin approves registration; user gains access**
- **Role:** Global Admin or Delegate Admin (canApproveRegistrations)
- **Precondition:** TC-01 complete; pending registration exists
- **Steps:**
  1. Sign in as Global Admin
  2. Go to Registrations (📝 nav item)
  3. Find the pending registration
  4. Click Approve
- **Expected:** Registration moves out of the pending list. The new user (if still signed in) gains access to My Units and Incidents. An approval email is sent to the user.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-03 — Admin declines registration**
- **Role:** Global Admin or Delegate Admin (canApproveRegistrations)
- **Precondition:** A second pending registration exists
- **Steps:**
  1. In Registrations, find a pending entry
  2. Click Decline and enter a reason
- **Expected:** Registration is declined. A decline email with the reason is sent to the user. The user remains in a blocked state if they try to sign in.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-04 — Approved owner lands on My Units after sign-in**
- **Role:** Standard Owner (approved)
- **Precondition:** User is approved, has no listings yet
- **Steps:**
  1. Sign in as the approved owner
- **Expected:** Lands on My Units (🔑). Nav shows at minimum: My Units, Incidents, Alerts. No Admin or Analytics in nav.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-05 — Language switch persists across sessions**
- **Role:** Any signed-in user
- **Steps:**
  1. Switch language to EN (or ES) using the language toggle
  2. Refresh the page
- **Expected:** Language preference is retained after reload.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

## Section 2 — My Units (Owner Listings)

---

**TC-06 — Owner registers their first listing**
- **Role:** Standard Owner (approved, 0 listings)
- **Steps:**
  1. Go to My Units
  2. Click "+ Add" or follow the Step 1 prompt
  3. Fill in apartment number (3 digits), rooms, guest capacity
  4. Optionally fill operator name, email, WhatsApp
  5. Click Submit
- **Expected:** Listing appears in My Units. The unit badge shows the apartment number. If operator email is missing but name is set, an orange warning appears at the top of My Units.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-07 — Owner edits listing to add operator email**
- **Role:** Standard Owner
- **Precondition:** Listing exists with operator name but no email (orange warning visible)
- **Steps:**
  1. Click Edit on the listing
  2. Add a valid email in the Operator Email field
  3. Save
- **Expected:** Orange warning disappears. Operator will now receive incident notifications.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-08 — Unit card shows open incident count**
- **Role:** Standard Owner
- **Precondition:** At least one open incident exists for the owner's unit
- **Steps:**
  1. Go to My Units
  2. Observe the unit card
- **Expected:** Unit card shows a count or indicator of open incidents. Clicking it navigates to the incident or incidents view filtered to that unit.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-09 — Unit detail popup shows owner and operator contact**
- **Role:** Any signed-in user
- **Steps:**
  1. In any view that shows the apartment number plate (dark badge), click it
- **Expected:** A popup appears showing: owner name, email (mailto link), WhatsApp (opens WhatsApp), operator name + contact (if set). Co-owners shown if any.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-10 — Owner cannot delete a listing with open incidents**
- **Role:** Standard Owner
- **Precondition:** Listing has at least one open incident
- **Steps:**
  1. Go to My Units
  2. Click Delete (or Edit → Delete) on a listing that has open incidents
- **Expected:** Delete is blocked with an error message. Listing remains.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

## Section 3 — Reporting an Incident

---

**TC-11 — Owner reports incident for their own unit**
- **Role:** Standard Owner (approved, has listing)
- **Steps:**
  1. Go to My Units or Incidents
  2. Click "Report Incident" (or the report button on the unit card)
  3. Select incident type and category
  4. Fill in description
  5. The apartment is pre-selected (or select it from the dropdown)
  6. Optionally fill in guest name, city, country
  7. Optionally fill in immediate action taken
  8. Submit
- **Expected:** Incident is created with status Open. It appears in Incidents under the Unit tab. Owner, operator (if email set), and global admin receive an email notification.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-12 — Any user reports a community/general incident**
- **Role:** Standard Owner or Admin
- **Steps:**
  1. Go to Incidents → Community tab (or click "Community" in nav)
  2. Click "Report Incident"
  3. Fill in type, category, description (no unit required)
  4. Submit
- **Expected:** General incident appears in the Community tab. Notifications sent to community admins and global admin.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-13 — Required fields prevent empty submission**
- **Role:** Any user
- **Steps:**
  1. Open the report incident form
  2. Click Submit without filling required fields
- **Expected:** Validation errors appear on required fields. Form is not submitted.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

## Section 4 — Incident Workflow: Owner Steps

---

**TC-14 — Owner sees Step 1 verify button on their open incident**
- **Role:** Standard Owner
- **Precondition:** An open incident exists for this owner's unit
- **Steps:**
  1. Go to My Units or Incidents
  2. Find the open incident
- **Expected:** A "① Verify" / "① Verificar" button is visible. The incident shows status "Open — awaiting owner verification."
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-15 — Owner completes Step 1 (immediate action)**
- **Role:** Standard Owner
- **Precondition:** TC-14 complete
- **Steps:**
  1. Click "① Verify"
  2. Describe the immediate action taken (e.g. "Called the guest, contacted the operator")
  3. Submit
- **Expected:** Step 1 is marked complete. The SLA clock starts. Owner, operator, and admin receive an email. The incident card updates to show Step 2 is now available.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-16 — Owner completes Step 2 (resolution)**
- **Role:** Standard Owner
- **Precondition:** TC-15 complete; Step 1 is done
- **Steps:**
  1. Find the same incident
  2. Click "② Add Resolution" / "② Agregar respuesta"
  3. Describe how the situation was resolved
  4. Submit
- **Expected:** Step 2 is recorded. The incident is now ready for admin to close. Owner, operator, and admin receive an email. The "Resolve" button becomes available to admins.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-17 — Owner cannot see the Resolve/Close button**
- **Role:** Standard Owner
- **Precondition:** Incident is at Step 2 complete
- **Steps:**
  1. Owner views the incident
- **Expected:** No "Resolve" or "Close" button is visible. The owner can only see status and their own steps.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-18 — SLA badge shows on incident pending owner action**
- **Role:** Standard Owner or Admin
- **Precondition:** Step 1 is complete; some time has elapsed
- **Steps:**
  1. View the incident
- **Expected:** An SLA indicator shows how long since Step 1 was completed, and when the deadline is. Color changes from green → amber → red as the deadline approaches.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

## Section 5 — Incident Workflow: Admin Close

---

**TC-19 — Admin cannot resolve before Step 2 is complete**
- **Role:** Global Admin or Delegate Admin (canResolveIncidents)
- **Precondition:** Incident is at Step 1 done, Step 2 not yet done
- **Steps:**
  1. Find the incident in Incidents view
- **Expected:** Resolve button is either absent or disabled. The incident shows it is waiting for the owner's Step 2 response.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-20 — Admin resolves incident after Step 2 complete**
- **Role:** Global Admin or Delegate Admin (canResolveIncidents)
- **Precondition:** TC-16 complete; Step 2 is done
- **Steps:**
  1. Find the incident
  2. Click "Resolve" / "Resolver"
  3. Add final admin comments
  4. Confirm
- **Expected:** Incident status changes to Closed. It moves out of the open count. Owner, operator, reporter, and admin all receive a "resolved" email with the full incident summary.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-21 — Resolved incident appears in history, not open count**
- **Role:** Any user
- **Precondition:** TC-20 complete
- **Steps:**
  1. Go to My Units — note the unit's open count
  2. Go to Incidents — check the open count badge
- **Expected:** The resolved incident is no longer counted as open. It is visible in the incident history/list with a "Closed" status.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-22 — Admin assigns a general incident to a unit**
- **Role:** Global Admin or Delegate Admin (canUpdateGlobalIncidents)
- **Precondition:** A community/general incident exists
- **Steps:**
  1. Go to Incidents → Community tab
  2. Find the general incident
  3. Click Assign (if available)
  4. Select a unit
- **Expected:** Incident is linked to the selected unit. The unit owner is notified.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

## Section 6 — SLA & Email Notifications

---

**TC-23 — SLA reminder email fires when owner has not verified**
- **Role:** Admin (to observe); Standard Owner (to receive)
- **Precondition:** An open incident exists with Step 1 not completed. SLA hours set to a small value (e.g. 1h) in Admin → SLA for testing. Enough time has elapsed.
- **Steps:**
  1. Wait for SLA period to elapse (or advance time in test environment)
  2. Check the owner's email inbox
- **Expected:** Owner receives an SLA reminder email referencing the incident. Operator and admin are CC'd per the escalation config.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-24 — Notification bell shows unread count**
- **Role:** Standard Owner
- **Precondition:** An event (incident created, verified, or resolved) has generated a notification for this user
- **Steps:**
  1. Sign in as the owner
  2. Look at the bell icon in the top nav
- **Expected:** Bell shows a badge with the unread count. Clicking it opens the Alerts view.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-25 — Alerts view shows all notifications, filterable**
- **Role:** Any signed-in user
- **Steps:**
  1. Go to Alerts (🔔)
  2. Filter by type and read/unread
- **Expected:** All past notifications for this user are listed. Filter narrows the list correctly. Marking as read clears the badge count.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

## Section 7 — Inventory View (Admin)

---

**TC-26 — Admin sees all listings grouped by floor**
- **Role:** Global Admin or Delegate Admin (canUpdateGlobalListings)
- **Steps:**
  1. Go to Inventory (🏠)
- **Expected:** All listings across all owners are visible, grouped by floor/tower. Each listing shows unit number, owner name, operator (if set), open incident count.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-27 — Admin can edit any listing**
- **Role:** Global Admin or Delegate Admin (canUpdateGlobalListings)
- **Precondition:** At least one listing exists that the admin does not own
- **Steps:**
  1. In Inventory, click Edit on a listing owned by another user
  2. Update the operator email
  3. Save
- **Expected:** Change is saved. The listing reflects the updated info.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-28 — Floor filter links through to Incidents**
- **Role:** Admin
- **Steps:**
  1. In Inventory, click a floor label or the floor-level incident count
- **Expected:** Navigates to Incidents view filtered to that floor's units.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

## Section 8 — Dashboard & Analytics

---

**TC-29 — Dashboard shows correct pending action counts**
- **Role:** Global Admin or Standard Owner (action counts differ by role)
- **Steps:**
  1. Go to Dashboard (📊)
  2. Note the counts shown (pending owner verification, pending resolution, pending admin close)
- **Expected:** Counts match actual open incidents in each state. Clicking a count card navigates to the filtered incidents list.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-30 — Analytics shows SLA breach report**
- **Role:** Global Admin
- **Precondition:** At least one incident that has breached its SLA (Step 2 overdue)
- **Steps:**
  1. Go to Analytics (📈)
- **Expected:** SLA breach table lists incidents past their deadline. Columns show unit, days elapsed, SLA cycles. Exportable or scannable.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-31 — Analytics is not visible to standard owners**
- **Role:** Standard Owner
- **Steps:**
  1. Sign in as standard owner
  2. Check nav for Analytics
- **Expected:** Analytics is not visible in the nav (unless global admin has enabled it for all via Admin → Permissions).
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

## Section 9 — Admin Panel

---

**TC-32 — Admin updates SLA hours**
- **Role:** Global Admin
- **Steps:**
  1. Go to Admin (⚙️) → SLA & Escalations
  2. Change SLA hours (e.g. 24 → 48)
  3. Save
- **Expected:** Setting is saved. New incidents use the updated SLA window.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-33 — Admin adds a CC email for SLA escalations**
- **Role:** Global Admin
- **Steps:**
  1. Admin → SLA & Escalations
  2. Add an email address to the CC field
  3. Save
- **Expected:** The email is saved. This address will be CC'd on all future SLA reminder emails.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-34 — Admin edits an email template**
- **Role:** Global Admin
- **Steps:**
  1. Admin → Email Templates
  2. Select a template type (e.g. "Incident Created")
  3. Edit the subject or body (use `{{variable}}` placeholders correctly)
  4. Save
- **Expected:** Template is saved. The next event of that type uses the updated template.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-35 — Admin disables an email notification type**
- **Role:** Global Admin
- **Steps:**
  1. Admin → Email Routing
  2. Toggle off a notification type (e.g. "SLA reminder")
  3. Save
- **Expected:** That notification type is suppressed. No emails of that type are sent until re-enabled.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-36 — Admin grants delegate permissions to a user**
- **Role:** Global Admin
- **Precondition:** A standard owner exists (approved)
- **Steps:**
  1. Admin → Users / Permissions
  2. Find the standard owner
  3. Promote to Delegate Admin or grant specific permission (e.g. canResolveIncidents)
  4. Save
- **Expected:** The user's role/permissions update. They can now perform the granted action (e.g. see Resolve button on incidents). Changes take effect on next page load for that user.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-37 — Admin updates mission/about content**
- **Role:** Global Admin
- **Steps:**
  1. Admin → Mission / About
  2. Edit the mission title and body text (both ES and EN)
  3. Save
- **Expected:** Updated content appears in the Mission/About view for all users.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-38 — Admin controls which nav items standard users see**
- **Role:** Global Admin
- **Steps:**
  1. Admin → Permissions → Standard Menu
  2. Toggle off a menu item (e.g. Analytics, Dashboard)
  3. Save
  4. Sign in as a standard owner and check the nav
- **Expected:** The toggled-off item does not appear in the standard owner's nav.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

## Section 10 — Search & Filtering

---

**TC-39 — Incident search filters in real time**
- **Role:** Any user with access to Incidents
- **Precondition:** Multiple incidents exist
- **Steps:**
  1. Go to Incidents
  2. Type a unit number, owner name, or keyword in the search bar
- **Expected:** List filters in real time to matching incidents. Clearing the search shows all incidents again.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-40 — Quick filter: "Needs my verification"**
- **Role:** Standard Owner with open incidents
- **Steps:**
  1. Go to My Units or Dashboard
  2. Click the "Needs verification" action or count
- **Expected:** Incidents view opens pre-filtered to incidents awaiting this owner's Step 1 verification.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-41 — Quick filter: "Ready to resolve" (admin)**
- **Role:** Global Admin or Delegate Admin (canResolveIncidents)
- **Precondition:** At least one incident with Step 2 complete exists
- **Steps:**
  1. Go to Dashboard or the action center
  2. Click "Ready to resolve" count
- **Expected:** Incidents view opens pre-filtered to incidents where Step 2 is complete and admin close is pending.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

## Section 11 — Role Boundary Checks

---

**TC-42 — Standard owner cannot edit another owner's listing**
- **Role:** Standard Owner A
- **Precondition:** Owner B has a listing in the same community
- **Steps:**
  1. Sign in as Owner A
  2. Navigate to Inventory (if accessible) and find Owner B's listing
  3. Attempt to edit or delete it
- **Expected:** Edit/delete controls are not visible, or if attempted via the URL/API, a 403 error is returned.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-43 — Standard owner cannot close an incident**
- **Role:** Standard Owner
- **Precondition:** An incident exists at Step 2 complete (ready for admin close)
- **Steps:**
  1. Owner views the incident detail
- **Expected:** "Resolve" / "Close" button is not present for the standard owner.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-44 — Delegate admin without canResolveIncidents cannot close**
- **Role:** Delegate Admin (canResolveIncidents = false)
- **Precondition:** A delegate admin exists with canResolveIncidents toggled off in Admin → Permissions
- **Steps:**
  1. Sign in as that delegate admin
  2. View an incident at Step 2 complete
- **Expected:** No Resolve button. If attempted via API, 403 returned.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-45 — Unauthenticated user sees login screen only**
- **Role:** No user (signed out)
- **Steps:**
  1. Open the app without being signed in
  2. Try to navigate to /incidents or click any nav item
- **Expected:** Login/sign-in screen is shown. No incident data is visible without auth.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

## Section 12 — Mobile & Cross-browser

---

**TC-46 — Mobile bottom nav shows correct tabs**
- **Role:** Standard Owner
- **Device:** Mobile (screen ≤ 768px)
- **Steps:**
  1. Open the app on a mobile device or narrow browser window
- **Expected:** A fixed bottom navigation bar appears with: My Units, Incidents, Alerts, Profile. Top nav collapses. All core actions are reachable from the bottom bar.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

**TC-47 — Report incident form is usable on mobile**
- **Role:** Standard Owner (mobile)
- **Steps:**
  1. On mobile, tap the report incident button
  2. Complete and submit the form
- **Expected:** Form is readable and submittable without horizontal scrolling. Keyboard does not obstruct required fields.
- **Result:** ☐ Pass ☐ Fail ☐ Partial — Notes: _______________________

---

## Sign-off

| Section | Pass | Fail | Partial | Skipped |
|---|---|---|---|---|
| 1 — Login & Registration (TC-01–05) | | | | |
| 2 — My Units (TC-06–10) | | | | |
| 3 — Reporting (TC-11–13) | | | | |
| 4 — Owner Workflow (TC-14–18) | | | | |
| 5 — Admin Close (TC-19–22) | | | | |
| 6 — SLA & Notifications (TC-23–25) | | | | |
| 7 — Inventory (TC-26–28) | | | | |
| 8 — Dashboard & Analytics (TC-29–31) | | | | |
| 9 — Admin Panel (TC-32–38) | | | | |
| 10 — Search & Filtering (TC-39–41) | | | | |
| 11 — Role Boundaries (TC-42–45) | | | | |
| 12 — Mobile (TC-46–47) | | | | |

**Overall result:** ☐ Pass — ready for production  ☐ Fail — issues to resolve  ☐ Conditional — pass with noted exceptions

**Tester signature:** _____________________________ Date: _______________

**Issues logged:** _(link to issue tracker or list below)_
