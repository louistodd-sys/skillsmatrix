# Security checklist — Base44 entity rules & cross-tenant verification

**Status: ACTION REQUIRED.** These checks cannot be performed from the repository —
Base44 stores entity security rules in the platform dashboard, not in code. Until
each box below is ticked by testing against the live app, assume tenant isolation
and role enforcement are **not** proven.

Why this matters: this app's data plane is direct client entity calls
(`base44.entities.X.filter/create/update/delete`). The only thing standing between
one organisation's browser and another organisation's data is the per-entity
security rules configured in the Base44 dashboard. Base44 itself has had documented
platform-level authorization failures (Wiz, July 2025 — unauthenticated access to
private apps; Imperva, Aug 2025 — client-side-only premium enforcement), so platform
defaults must never be trusted blind.

## 1. Per-entity row security rules (Base44 dashboard → Data → each entity → Security)

For **every** entity below, the read AND write rule should scope rows to
`organisation_id == current user's organisation_id` (Base44's "user data" /
conditional rules), not "any authenticated user":

- Skills Matrix: `Organisation`, `Skill`, `SkillCategory`, `Team`, `TeamMember`,
  `TeamRequiredSkill`, `SkillAssessment`, `Invitation`, `Notification`,
  `AuditLogEntry`, `EvidenceFile`
- BRC: `BRCAudit`, `BRCCAPA`, `BRCCalibrationRecord`, `BRCClauseEvidenceLink`,
  `BRCClauseStatus`, `BRCComplaint`, `BRCDocument`, `BRCDocumentVersion`,
  `BRCGlassItem`, `BRCManagementReview`, `BRCNonConformance`,
  `BRCPestControlVisit`, `BRCSupplier`
- `BRCClause` is shared reference data: read may be open to authenticated users;
  **write must be service-role only**.

Additional field-level rules that matter even inside one tenant:

- [ ] `User.role` and `User.organisation_id` must NOT be writable by the user
      themselves (otherwise `auth.updateMe({role:'admin'})` is self-escalation —
      the onboarding flow no longer does this client-side, but the API surface
      must be closed too).
- [ ] `Organisation.subscription_tier`, `stripe_*`, `modules`,
      `brc_subscription_status` should be writable only via backend functions
      (service role), not by client updates from any admin browser.
- [ ] `AuditLogEntry` should deny client `update`/`delete` (append-only), else the
      log has no evidential value.
- [ ] `Notification`: reads scoped to `user_id == current user`, not just org.

## 2. Cross-tenant (IDOR) test — do this with two real accounts

1. Create two throwaway orgs: Org A (user A) and Org B (user B), each with a
   couple of skills/assessments.
2. Log in as user B, open devtools, and note Org A's IDs from user A's session
   (org id, a skill id, an assessment id).
3. As user B, from the browser console, run each of:
   - `base44.entities.SkillAssessment.filter({ organisation_id: '<ORG_A_ID>' })`
   - `base44.entities.SkillAssessment.list()` (no filter — should return only Org B rows)
   - `base44.entities.Skill.update('<ORG_A_SKILL_ID>', { name: 'pwned' })`
   - `base44.entities.Organisation.filter({ id: '<ORG_A_ID>' })`
4. Every call must return an empty result or a permission error. **Any Org A data
   coming back means tenant isolation is broken** — stop and fix the entity rules
   before anything else.
5. Repeat the same idea for one BRC entity (e.g. `BRCNonConformance`) and for
   `AuditLogEntry.update(...)` (append-only check).

## 3. Role-escalation test (single tenant)

As a `viewer` user in Org B, from the console:

- [ ] `base44.auth.updateMe({ role: 'admin' })` → must fail.
- [ ] `base44.entities.Organisation.update('<ORG_B_ID>', { modules: ['skills_matrix','brc_compliance'] })`
      → must fail (module entitlement is enforced by the `setModuleEnabled`
      function; direct writes must be closed).
- [ ] `base44.entities.Organisation.update('<ORG_B_ID>', { subscription_tier: 'scale' })` → must fail.

## 4. Scheduled function secret & automations

`checkTrialEnding`, `recomputeReadinessScore` and `sendExpiryReminders` require
either an authenticated caller or an `x-cron-secret` header matching the
`CRON_SECRET` environment variable:

- [ ] Set `CRON_SECRET` (a long random string) in the Base44 dashboard's function
      environment variables.
- [ ] Configure these scheduled automations, each sending the `x-cron-secret` header:
      - `sendExpiryReminders` with `{ "mode": "daily" }` — daily (e.g. 07:00) —
        expiry warnings and expired alerts
      - `sendExpiryReminders` with `{ "mode": "digest" }` — Mondays (e.g. 08:00) —
        the weekly expiry digest
      - `checkTrialEnding` — daily — trial-ending emails
      - `recomputeReadinessScore` (no body) — nightly — BRC readiness scores
      Until both are done, the functions simply refuse unauthenticated calls —
      they fail closed, so scheduled runs will 403 rather than leak. Admins can
      also trigger a reminder run manually from Settings → Notifications.

## 5. Known client-side-only gates (server work still pending — P1)

Route guards and the Settings admin check added in this pass are **UX guards**.
The following remain enforceable only by entity rules until the P1 write-path
work lands, so section 1 is what actually secures them:

- Tier limits (`checkTierLimit` is advisory; bulk import/templates now checked
  client-side but writes are still direct entity calls).
- BRC module gating for reads (all BRC data access is direct client entity calls;
  `requireBrcModule` exists but nothing routes through it).

Once verified, date and initial each section here so the next audit knows when
isolation was last proven.
