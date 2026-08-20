# Competitor & Process Pain-Point Audit

**SkillsMatrix (Skills Matrix module + BRC Compliance module)**
**Date:** 19 August 2026
**Branch:** `claude/competitor-pain-points-t1tnvu`

---

## 1. Purpose & method

This audit answers one question: *what are the recurring, well-evidenced pain points in the products and processes this app competes with — and does this app avoid them?*

Research was run in four parallel streams:

1. **Skills matrix / competency management software** — review mining and practitioner-forum research across AG5, Skills Base, Kahuna, MuchSkills, Skills DB Pro, iMocha, TalentGuard, Cinode, Visual Workforce, CABEM, Cornerstone, SAP SuccessFactors, Workday Skills Cloud, 365Talents, and the Excel/spreadsheet incumbent; plus process-level pain in ISO 9001 / IATF / BRCGS-regulated environments.
2. **Food-safety QMS / BRCGS compliance software** — Safefood 360°, FoodDocs, SafetyChain, Ideagen Q-Pulse, Mango QHSE, Intelex, ETQ Reliance, MasterControl, Qualio, isoTracker, Effivity, SafetyCulture/iAuditor; plus IFSQN and Elsmar Cove forum threads, certification-body non-conformity datasets, and consultant content on BRCGS audit failure modes.
3. **Cross-cutting SME B2B SaaS pain points** — onboarding/import, notifications, permissions/multi-tenancy (including documented Base44 platform vulnerabilities), billing/tier gating, reporting/exports, trust/GDPR, and shop-floor/mobile use.
4. **Codebase audit** — a full feature-and-mechanics map of this repository (~215 files, 26 entities, 16 backend functions, 43 pages), verified against the pain-point catalogue with file-level evidence. Load-bearing claims (notification producer, tier enforcement, invitation loop, evidence wiring) were independently re-verified by hand.

**Evidence caveats.** Direct fetching of G2/Capterra/Reddit was proxy-blocked, so review evidence comes from search-indexed summaries and secondary "we read the reviews" analyses; URLs are listed in the appendix so claims can be spot-checked. Vendor blog claims about competitor pain are treated as encoding real buyer objections, not as fact. On the app side, anything enforced by Base44 platform configuration outside this repo (entity row-level security, scheduled automations) **cannot be verified here** and is flagged explicitly wherever it matters.

### Verdict legend

| Verdict | Meaning |
|---|---|
| ✅ **AVOIDED** | The app genuinely does not have this pain point |
| 🟡 **PARTIAL** | Mitigated in part; a meaningful gap remains |
| ❌ **PRESENT** | The pain point exists in this app today |
| 🚨 **AMPLIFIED** | Worse than absent: the app *advertises* the capability but does not deliver it — a trust/credibility risk the incumbents don't carry |
| ➖ **OUT OF SCOPE** | Not applicable to this product's current scope; noted for roadmap awareness |

---

## 2. Executive summary

**Headline: the app's *concept* avoids the market's biggest pains, but its *implementation* currently contains many of them — and in six places it actively advertises capabilities that do not exist, which is the one failure mode more damaging than any the incumbents have.**

Scorecard across the 54 audited pain points:

| Verdict | Count |
|---|---|
| ✅ Avoided | 11 |
| 🟡 Partial | 17 |
| ❌ Present | 18 |
| 🚨 Amplified (advertised-but-missing) | 6 |
| ➖ Out of scope | 2 |

### The ten findings that matter most

1. **The #1 pain point in the entire market — silent certification expiry — is present, and amplified.** Every competitor analysis, forum thread, and switcher story converges on one failure: nobody is told before a certification lapses. This app's Settings page offers "Weekly Expiry Digest" and "Notify Users on Skill Expiry" toggles, and the Notification entity defines `expiry_warning` / `expiry_digest` types — but **no code anywhere creates a Notification record or sends an expiry email**. Reminders exist only for users who log in and look. That is exactly the spreadsheet failure mode this product exists to fix, behind a UI that claims it's fixed. *(§4.1)*
2. **PDF "audit-ready reports" are sold on three screens (Growth tier, £79/mo) and do not exist.** `jspdf`/`html2canvas` are installed but never imported. The employee self-assessment portal and "department & site level views" (Scale, £149/mo) are likewise sold and absent. Charging for named features that don't exist is the fastest way to the "data-hostage / bait" reputation that dominates negative SaaS reviews. *(§6.4)*
3. **Seat limits can never be enforced because the invitation loop is broken.** Nothing ever sets `Invitation.status = 'accepted'`, and `checkTierLimit` counts accepted invitations — so admin/manager seat counts are permanently zero. Invited users also never receive their intended role or team assignments. *(§6.3)*
4. **Tier limits are advisory and already bypassed by the app's own flows.** Bulk CSV import, industry templates, and onboarding all create employees/skills/categories with no limit check; all entity writes are direct client calls the server never re-validates. The Imperva research on Base44 called out client-side-only premium enforcement as a platform-wide anti-pattern — this app repeats it. *(§6.3)*
5. **Authorization is nav-deep only.** `ProtectedRoute` is unused (and broken); any viewer can URL-navigate to `/settings`, `/users`, `/audit-log`, `/matrix` and `/brc/*`. Settings — including full-org data export, module toggles and the delete-organisation dialog — has no role check. Onboarding lets the client self-assign `role: 'admin'`. `checkTrialEnding` lets **unauthenticated** callers through to service-role data. Given Base44's documented 2025 security incidents (Wiz, Imperva), platform defaults must not be trusted to compensate. *(§6.2)*
6. **The BRC module's core loop is not completable.** `BRCClauseStatus.evidence_count` is read in five places and written in zero — so linking real evidence never registers, journey stage 3 ("Add Evidence") is unreachable, and the audit checklist always reports zero evidence. Document creation is a dead route; `BRCDocumentVersion` is unused; five detail pages are stubs; only 44 clauses of one standard (Packaging) are seedable, while five standards are selectable; the readiness score's per-section breakdown collapses into a single bucket. The clause-first design is this product's strongest differentiator — the market genuinely lacks it — but it currently cannot be driven end-to-end. *(§5)*
7. **The audit log claims "tamper-evident" and is not.** Entries are client-written (spoofable, droppable), most operations are never logged (skill/category/team CRUD, required-skill changes, bulk imports, all BRC record changes), and the viewer silently truncates at the 1,000 most recent entries. For a compliance product, the audit trail is the product; auditors reject editable logs. *(§6.6)*
8. **CSV import has the exact failure modes that kill activation.** Positional column mapping, silent row-dropping, aggregate error counts with no row numbers and no error report, no upsert, and no way to import skills or historic assessments at all — the incumbent data every buyer arrives with cannot be migrated. *(§6.1)*
9. **The matrix will choke at the scale the pricing sells.** Unbounded fetches of the append-only assessment table, no memoisation, no virtualisation, O(members × skills × reqSkills) recomputed per keystroke. AG5's most-cited review complaint is grid illegibility past ~100 employees; Scale tier sells 250. *(§4.8)*
10. **GDPR posture is half-built.** Genuine strengths (SAR export, soft-delete redaction for evidence, DPA/privacy pages) are undermined by `deleteOrganisation` not deleting any of the 14 BRC entities, `EvidenceFile`, or `User` records, and by a statutory footer shipping with blank company number and ICO registration. *(§6.7)*

### Where the app genuinely beats the market (protect these)

- **Clause-by-clause evidence mapping as the BRC module's spine** — the research found sites hand-building clause spreadsheets because neither binders nor generic eQMS organise evidence the way the auditor walks the standard. No incumbent in the researched set does this natively. *(§5.1)*
- **Pricing model**: employees are tracked records; only admin/manager seats are limited. This sidesteps the category's structural complaint (per-seat pricing across a mostly-passive workforce). *(§6.4)*
- **Fixed, product-defined 5-level proficiency scale with distinct binary/levelled types** — avoids the "vague scale" chaos of Excel, though it needs behavioural anchors. *(§4.4)*
- **Append-only assessment history** with assessor identity and date on every record — the right substrate for audit-grade competence evidence.
- **Onboarding**: industry templates, labelled demo data, empty states with clear CTAs, and a getting-started checklist — close to textbook against activation research.
- **Trial design**: `payment_method_collection: 'if_required'` with downgrade-to-free (not lockout) on expiry, and ungated exports — the opposite of the data-hostage pattern.
- **Action Centre concept** — one surface aggregating 11 categories of overdue/expiring compliance items directly addresses "missed review dates" and "management review as data-aggregation slog".

---

## 3. How to read Parts 4–6

Each pain point follows the same shape:

> **Market evidence** — what users of competing products/processes actually complain about, and where.
> **This app** — what the code does today, with file references.
> **Verdict** and **Fix** — what would close the gap.

---

## 4. Part A — Skills matrix & competency management pain points

### 4.1 Silent certification/training expiry ⭢ 🚨 AMPLIFIED

**Market evidence.** The single most-cited defect of the spreadsheet process and the differentiator every tool markets against: "a static spreadsheet won't notify anyone when a certification is about to expire — someone must remember to check it." A documented forklift-cert lapse on a shared spreadsheet ended in "a six-figure OSHA citation, workers' comp claim, production halt." Certification-tracking guides name staged reminders (60/30/7/on-expiry), repeat-until-acknowledged behaviour, and escalation to a named owner as the baseline. The mirror-image failure — notification floods that train users to ignore alerts (SafetyChain's "excessive emails when a supplier is overdue") — is equally documented, so the target is a digest-plus-escalation design, not an email per event.

**This app.** The data model is ready: `Skill.requires_expiry`, `expiry_warning_days` (default `[30,60,90]`), `SkillAssessment.expiry_date`, an `Organisation.weekly_digest_enabled` / `notify_users_on_expiry` pair of settings (`src/pages/Settings.jsx:374-403`), and a `Notification` entity with `expiry_warning` and `expiry_digest` types. The dashboard shows expiry buckets and the matrix marks amber cells. **But the producer side does not exist**: no code in the repo ever calls `Notification.create`, and the only email senders are welcome, trial-ending, and Stripe receipts (`sendWelcomeEmail`, `checkTrialEnding`, `stripeWebhook`). There is no scheduled expiry sweep. The notification bell (`src/components/NotificationCenter.jsx`) polls a table nothing writes to. Additionally, only the *largest* value of `expiry_warning_days` is ever used (`src/lib/ragUtils.js:30-33`) — the multi-stage `[30,60,90]` config is effectively a single 90-day threshold.

**Verdict: 🚨 AMPLIFIED.** The app has the spreadsheet's failure mode behind a settings UI that claims otherwise.
**Fix.** A scheduled backend function (Base44 automation) that: scans latest assessments per user×skill; emits `Notification` records and emails at each configured warning threshold and on expiry; escalates unacknowledged expiries to team managers then admins; and sends the Monday digest when `weekly_digest_enabled`. Until it ships, remove or "coming soon"-label the two Settings toggles.

### 4.2 The instantly-stale matrix / maintenance burden ⭢ 🟡 PARTIAL

**Market evidence.** The most recurrent pain across every source type: matrices are "out of date as soon as they were sent"; HRIS skills tabs are "a tab nobody updates"; even dedicated tools (MuchSkills, Skills DB Pro) draw complaints that currency "requires ongoing time and effort." Turnover makes it structural — manufacturing averages ~40%/yr, so the matrix decays continuously. What good looks like: updating must be faster than editing a cell; staleness must be visible ("last reviewed 14 months ago"); joins/leaves should flow from the HR source of truth.

**This app.** Genuinely better than a spreadsheet: one live shared matrix, click-a-cell assessment (`AssessmentModal`), one-skill-many-people bulk assessment (`BulkAssessmentModal`), and append-only history resolving to latest-wins (`src/utils/assessmentUtils.js`). Gaps: **no staleness signal anywhere** — a green cell assessed three years ago with no expiry renders identically to one assessed yesterday; no re-assessment cadence per skill (only expiry, which most skills won't set); no HRIS sync or API, so joiners/leavers are manual; no per-row expiry in bulk assessment (a group course with staggered validity can't be recorded, `BulkAssessmentModal.jsx` shares one date across rows).

**Verdict: 🟡 PARTIAL.**
**Fix.** Add an "assessed N months ago" staleness tint/filter on the matrix; an optional `review_interval_months` per skill feeding the same reminder engine as §4.1; per-row expiry dates in bulk assessment.

### 4.3 Evidence scattered everywhere; nothing linked to the competency record ⭢ 🚨 AMPLIFIED

**Market evidence.** "Training evidence lives in spreadsheets, email inboxes, and LMS dashboards nobody checks"; when the auditor asks for the certificate behind a green cell, teams dig through inboxes. "The gap between a certificate existing and the record reflecting it is an audit finding." Evidence attachment is a named differentiator for audit-focused tools.

**This app.** The backend is *fully built*: `EvidenceFile` entity (with `linked_entity_type: 'skill_assessment'` in its enum, retention and redaction fields), `uploadEvidence` with MIME/extension/size validation and per-tier storage quotas, `deleteEvidence` with tenant isolation, role checks, soft-delete redaction and audit logging. **No UI calls any of it.** Certificates cannot be attached to assessments anywhere in the product. The BRC evidence-linking modal links *records to clauses* but cannot attach files either.

**Verdict: 🚨 AMPLIFIED** — a complete, quota-priced evidence subsystem (storage quotas are even listed per tier) with zero user-facing surface.
**Fix.** Wire `uploadEvidence` into `AssessmentModal` (attach certificate → show paperclip on cell → open from tooltip/profile), the BRC clause detail page, and CAPA/NC records. This single wiring job converts a top-three market pain into a headline feature.

### 4.4 Vague scales, assessor subjectivity & rating inflation ⭢ 🟡 PARTIAL

**Market evidence.** "If the same operator is Level 3 on day shift and Level 1 on night shift, the issue is supervisor calibration, not the operator." Undefined 1–5 scales mean every assessor invents their own meaning; auditors probing "what does 2 mean?" get inconsistent answers. Manager leniency bias and self-assessment inflation (managers rank employees lower than self-ratings 50% of the time) are well documented; behaviourally-anchored descriptors reportedly cut rating discrepancy ~30%.

**This app.** The scale is fixed and product-defined — binary (Not Competent / Competent) and levelled (Not Trained / Awareness / Working Knowledge / Competent / Expert), consistent across the org (`src/lib/ragUtils.js:66-74`) — which avoids Excel's per-tab scale drift. Every assessment records assessor identity and date, and notes are supported. Gaps: **no behavioural anchors or per-level descriptions** shown at the point of assessment (the labels are one word; the modal offers no guidance); label definitions are duplicated in three files and can drift; there is no calibration aid (no distribution-by-assessor view); and there is **no self-assessment vs manager-validation workflow at all** — nothing to inflate, but also nothing for the sold "employee portal" (see §6.4). Most importantly, the levelled scale cannot actually gate anything: the only UI that sets team requirements hard-codes `minimum_proficiency: 1` (`src/components/ManageRequiredSkillsModal.jsx:41`), so "requires Competent (3)" is unexpressible even though `ragUtils.js:38` supports it end-to-end.

**Verdict: 🟡 PARTIAL.**
**Fix.** Add a minimum-level selector for levelled skills in `ManageRequiredSkillsModal` (small change, unlocks the whole levelled system); show level descriptors in the assessment modal; add per-skill descriptor text as an optional field.

### 4.5 Completion ≠ competence (the LMS gap) ⭢ ✅ AVOIDED

**Market evidence.** LMSs prove someone "clicked through slides fast enough to hit Submit," not that they can do the task; auditors increasingly ask "how do you know they're competent?" BRCGS Clause 7.1 makes competence (not course completion) a Fundamental Requirement whose failure is an automatic major non-conformity.

**This app.** The data model is competence-first: assessments are proficiency judgments by a named assessor with a date and optional expiry — not course completions. The BRC Training page reads the same assessment data, so the compliance module inherits competence rather than completion. This is the right side of the divide, and worth defending in marketing language.

**Verdict: ✅ AVOIDED** (by design). The gap that remains is evidence attachment (§4.3) to *prove* the judgment.

### 4.6 Document-revision → retraining loop ⭢ ❌ PRESENT

**Market evidence.** When an SOP is revised, everyone trained on it must be retrained on the new version — "the revision-triggers-retraining loop is what closes the compliance gap most organizations struggle with." AG5 draws criticism for being "purely a competency matrix tool" with no document linkage; the gap between QMS document control and skills tools forces two systems.

**This app.** Nothing links a `Skill` to a `BRCDocument` (or any document/version), so a procedure revision cannot flag affected people for retraining. The pieces exist on both sides of the gap (skills with expiry; BRC documents with versions in schema) but nothing connects them — and the BRC document module itself is currently read-only (§5.2).

**Verdict: ❌ PRESENT.** Roadmap item rather than bug — but note it is *the* structural differentiator for a combined skills+compliance product; no researched competitor closes this loop well at SME price points.

### 4.7 Bulk import & data migration ⭢ ❌ PRESENT

**Market evidence.** "Every buyer starts with a spreadsheet to import." AG5 reviewers explicitly ask for self-service Excel import; Skills Base users report exports that can't round-trip back in; broken CSV import is the single biggest activation killer for tools replacing spreadsheets — header-mapping confusion, rigid validation, errors reported only after submission, no partial-import error report.

**This app.** `BulkImportModal.jsx` imports *people only*: exactly three positional columns (`Team, Member Name, Member Email`), header skipped by position so a reordered file mis-maps silently; the hand-rolled parser mishandles escaped quotes/embedded newlines/BOM; rows missing team+name are silently dropped; failures are swallowed by bare `catch {}` into aggregate counters — "37 failed" with **no row numbers, no reasons, no downloadable error report**; no email validation; no upsert (existing people are skipped, not updated). **There is no import for skills, categories, requirements, or historic assessments at all** — the actual training matrix a buyer arrives with cannot be migrated, only its people. A template download exists (good). The import also performs no tier check (see §6.3).

**Verdict: ❌ PRESENT.**
**Fix.** Column-mapping UI with fuzzy auto-match; per-row pre-commit validation preview; per-row error report (downloadable); upsert mode; and — highest value — an assessment/matrix import (person × skill grid, the shape their Excel already has).

### 4.8 Grid legibility & performance at scale ⭢ ❌ PRESENT

**Market evidence.** AG5's most-cited review con: "when there are more than 100 competencies and/or employees, the overview can become unclear and error sensitivity increases significantly." Slow performance is a top negative across five QMS products ("slow frequently with long load times" — Safefood 360; "slows when handling large datasets" — ETQ).

**This app.** `SkillsMatrix.jsx` fetches six entities unbounded — including the append-only `SkillAssessment` history table, which grows forever — builds a full latest-map, then renders every member × skill cell as a Radix-tooltip-wrapped button with **no virtualisation and no memoisation**; `getReq()` does linear scans per cell, so the status grid is O(members × skills × reqSkills) recomputed **on every search keystroke**. Legibility work is genuinely good (frozen columns, sticky headers, category bands, compliance/coverage summaries, filters, mobile card layout). At Free/Starter scale it will feel fine; at the Growth/Scale headcounts the pricing page sells (100–250 employees × mature skill library × years of history) both fetch and render will degrade badly.

**Verdict: ❌ PRESENT** (latent — will surface exactly when a customer grows into the paid tiers).
**Fix.** `useMemo` the derived grids keyed on data+filters (hours of work, biggest win); cap/aggregate assessment fetch server-side (latest-per-pair endpoint or periodic compaction); virtualise rows past ~50 members; debounce search.

### 4.9 Skills taxonomy bloat & duplicate curation ⭢ 🟡 PARTIAL

**Market evidence.** Cinode: "managing the skill database is quite a headache… duplicates and nearly identical terms clutter the list"; enterprise practitioners describe 200-deep curation queues and taxonomies stale within months; over-scoping ("cataloguing 3,000 skills before proving value") kills projects.

**This app.** Naturally protected at SME scale: org-scoped libraries, curated industry templates (~13–14 skills each — the "start small" best practice), categories with colour/order, archive status. No duplicate detection on create, no merge tool, no rename-with-history — acceptable now; will matter at Growth+ tier when libraries are unlimited.

**Verdict: 🟡 PARTIAL** (low severity today).

### 4.10 No action loop: assessment without development ⭢ 🟡 PARTIAL

**Market evidence.** "A matrix that leads to no action frustrates employees"; AG5/Skills Base/MuchSkills all draw the "purely a matrix, training planning needs another tool" complaint; assessment experienced as surveillance when it produces no development.

**This app.** Gap analysis is real and good: per-team coverage, RAG counts, level histograms, per-skill drill-down, individual compliance, and a **training-needs CSV** (one row per person×skill needing action with current/required levels — `GapAnalysis.jsx:169-204`). There is no training-action tracking (no "booked/completed" state, no owner, no due date), so the loop closes outside the app in — inevitably — a spreadsheet. No cross-team/org-wide gap view either.

**Verdict: 🟡 PARTIAL.**
**Fix.** A minimal `TrainingAction` record (person, skill, owner, due date, status) generated from gap analysis and surfaced in the Action-Centre pattern would close the loop without becoming an LMS.

### 4.11 Multi-site fragmentation ⭢ 🚨 AMPLIFIED

**Market evidence.** Each site builds its own matrix with its own scale and names, so results "can't be combined later without confusion"; cross-site comparability is what executives buy Scale-tier products for.

**This app.** Teams are flat — no department/site hierarchy exists. Yet "Department & site level views" is a named selling point of the £149/mo Scale tier (`checkTierLimit/entry.ts` upgrade prompts, `tierConfig.js`), and the `site_level_views` gate exists server-side with zero callers because there is no feature to gate.

**Verdict: 🚨 AMPLIFIED** — sold, not built.
**Fix.** Either build a minimal site grouping over teams, or remove the claim from tier copy until it exists.

### 4.12 Deskless / shop-floor access ⭢ 🟡 PARTIAL

**Market evidence.** Most frontline workers have no corporate email or desk; tools assuming both push plants back to paper. Wet-glove touchscreens, shared tablets, kiosk sign-off stations, and offline draft persistence are the recurring asks; ~60% of the global workforce is deskless.

**This app.** Better than most incumbents: responsive layout with an off-canvas sidebar, a real mobile card layout for the matrix, viewers get a self-view (`/my-profile`) with a SAR export. Gaps: employees require email-based accounts (managed `TeamMember` records don't log in, which is fine for tracking but means no self-service acknowledgement); BRC pages have no mobile layouts (tables overflow); no kiosk/shared-device mode; no offline/draft persistence — a dropped connection mid-assessment loses the entry.

**Verdict: 🟡 PARTIAL.**

### 4.13 Per-seat pricing across the whole workforce ⭢ ✅ AVOIDED

**Market evidence.** The category's structural pricing complaint: tools price per tracked employee (€3–10/user/mo), so a 300-operative plant pays thousands monthly for records only 3 admins touch. "Seat pricing that works for 80 employees becomes prohibitive at 800."

**This app.** Employees are tracked *records* (managed `TeamMember`s), priced in org-level bands; only admin/manager seats are counted. This is precisely the "what good looks like" model from the research. (Enforcement of those bands is broken — §6.3 — but the *model* is right.)

**Verdict: ✅ AVOIDED.** Market this loudly.

### 4.14 Works-council / GDPR perception of competency data ⭢ 🟡 PARTIAL

**Market evidence.** Skill ratings about named employees are personal data; EU deployments face works-council co-determination and "surveillance tool" perception; retention limits, SAR support, and stated residency are increasingly screened for.

**This app.** SAR export exists (`MyProfile.jsx:44-100`, audit-logged), plus privacy policy, cookie policy, and DPA pages — unusually complete for this stage. Gaps in §6.7 (incomplete erasure, blank statutory footer, no retention automation, no stated residency).

**Verdict: 🟡 PARTIAL.**

---

## 5. Part B — BRCGS / food-safety QMS pain points

### 5.1 No native clause-by-clause evidence mapping ⭢ 🟡 PARTIAL (concept ✅, execution ❌)

**Market evidence.** The standard has ~350 auditable clauses; sites hand-build clause-by-clause Excel matrices ("take each clause, put it into a spreadsheet, audit each looking for evidence, keep a column for gaps") because generic eQMS is organised by module, not by the standard. IFSQN's most-downloaded artifacts are homemade clause checklists. This is the single clearest unclaimed wedge in the researched market.

**This app.** Clause-first architecture is the BRC module's spine: `BRCClause` → `BRCClauseStatus` (5-state) → `BRCClauseEvidenceLink` (9 linkable record types), a clause browser with per-section grouping, a pre-audit checklist with CSV export, a readiness score, and a 6-stage journey engine. **Execution breaks the loop in five places:**
- `BRCClauseStatus.evidence_count` is read in five files and **written by nothing** except the demo seeder — linking real evidence never increments it, so journey stage 3 ("Add Evidence") is unreachable and the checklist reports 0 evidence forever.
- All three evidence-link writers omit `linked_by_user_id`, a schema-**required** field (`EvidenceLinkModal.jsx:64-71`, `NCFormModal.jsx:36-41`, `ClausePickerModal.jsx:64`) — either failing validation or storing audit-incomplete links.
- Only 44 clauses of **one** standard (Packaging Issue 7, "a representative subset") exist; all five standards are selectable in settings, four of them yielding an empty module. The 44-clause subset itself is a liability for real audit prep against a ~350-clause standard.
- `seedBrcClauses` has **no caller** — the UI tells users "an admin can seed clause data from the super-admin panel," which doesn't exist in this repo.
- The readiness score's `by_section` groups on `issue_number` (always `'7'`), collapsing every clause into one bucket; the UI derives sections differently (`clause_number.split('.')[0]`), so the two disagree.

**Verdict: 🟡 PARTIAL.** The differentiator is real; it just doesn't run end-to-end yet.
**Fix (ordered).** Write `evidence_count` (and `last_reviewed_*`) transactionally when links change — or better, compute it server-side in `recomputeReadinessScore`; add `linked_by_user_id` at all three call sites; key `by_section` on the derived section; wire `seedBrcClauses` into BRC settings/onboarding; complete clause data per supported standard and hide unsupported standards from selection.

### 5.2 Document control & version chaos ⭢ 🚨 AMPLIFIED

**Market evidence.** The "double-update trap" (update the doc, the Excel index, and the floor copies — each step a divergence risk); obsolete SOPs on the floor as a top BRCGS/SQF NC trigger; missed review dates discovered by the auditor; and — in software — Qualio-style complaints about unbrowsable document modules and editors that mangle formatting.

**This app.** `BRCDocument` and `BRCDocumentVersion` entities exist with the right fields (status, review dates, versions). But the documents page is **read-only**: `/brc/documents/new` is a dead route (`BrcDocumentDetail.jsx:30,53` renders "Document not found"), no `BRCDocument.create` exists anywhere in `src/`, and `BRCDocumentVersion` has zero code references — no version history UI, no supersede workflow. The only documents an org can ever have are the ~12 demo-seeded ones. Review-date reminders inherit the §4.1 problem (Action Centre shows overdue in-app; nothing pushes).

**Verdict: 🚨 AMPLIFIED** — a listed module of a paid add-on (£49/mo) that cannot create a document.
**Fix.** Ship minimal CRUD + version supersede (new version → old auto-marked superseded, version list on detail page). File attachment via the already-built `uploadEvidence` (§4.3) makes this a genuine document register.

### 5.3 CAPAs/NCs that go stale ⭢ 🟡 PARTIAL

**Market evidence.** "Corrective actions end up in spreadsheets where they're forgotten"; auditors treat open-CAPA age itself as a system-health finding (">20% of open CAPAs 30+ days overdue" as a process failure); rigid single-owner workflows (Mango: "inability to assign and track actions to multiple stakeholders") are the software-side gripe.

**This app.** CAPA and NC have full create/update flows with status, severity, due dates and owners; the Action Centre computes overdue CAPAs/NCs; overdue items gate the BRC journey's "Close Gaps" stage; analytics show closure rate and average days. Gaps: no reminders/escalation (§4.1 again — overdue is visible only to someone who looks); detail routes for NCs are stubs, so working a single NC end-to-end (evidence, comments, verification) isn't possible; `BRCCAPA.effectiveness_review` is in schema with no UI (effectiveness verification is exactly what FDA/BRCGS findings cite); an **Action Centre bug** caps the list with `.slice(0,50)` *before* `.sort()` (`BrcActionCentre.jsx:171-173`), so with >50 alerts it silently drops arbitrary — possibly the most critical — items; and its module-level `new Date()` goes stale in a long-lived tab.

**Verdict: 🟡 PARTIAL.**
**Fix.** Swap the slice/sort order (one-line bug); build NC/CAPA detail pages; add effectiveness-review prompt on closure; route overdue items through the §4.1 reminder engine.

### 5.4 Shallow root-cause analysis rejected by auditors ⭢ ❌ PRESENT

**Market evidence.** Sites report BRCGS RCA rejected outright ("oversight by the team" deemed unsatisfactory) with certificates held pending resubmission; auditors expect structured methods (5 Whys, fishbone); "most Excel NC logs have a single free-text root-cause cell that invites restating the problem."

**This app.** Exactly that: `root_cause` is a single small free-text textarea on both NC and Complaint forms (`NCFormModal.jsx:116`, `ComplaintFormModal.jsx:100`). No method scaffolding, no prompts, no link from complaint RCA to a CAPA (`BRCComplaint.capa_id` exists in schema, unused).

**Verdict: ❌ PRESENT.**
**Fix.** A lightweight guided 5-Whys component (why₁…why₅ + root-cause statement + category) would materially differentiate — the research found consultants selling training courses for exactly this gap.

### 5.5 Internal audit schedules that silently slip ⭢ 🟡 PARTIAL

**Market evidence.** BRCGS 3.4.1 requires audits spread across ≥4 dates/year; sites get NCs for empty quarters; nothing in a spreadsheet escalates a skipped audit.

**This app.** `BRCAudit` supports scheduling with types and statuses; the dashboard/checklist read audit state. But there's no spread-across-the-year check, no escalation when a scheduled date passes (Action Centre covers CAPA/NC/calibration/supplier/document dates — scheduled audits going overdue are not among its 11 alert sources), and the audit detail page is a stub. `BRCAudit.next_audit_date` and `nc_count` are schema-only.

**Verdict: 🟡 PARTIAL.**

### 5.6 Management review as a data-aggregation slog ⭢ 🟡 PARTIAL

**Market evidence.** BRC 1.1.3 inputs (audit results, complaints, NC trends, objectives, previous actions) live in a dozen places; preparation is manual gather-and-paste; forum members beg for templates because nothing auto-assembles the inputs.

**This app.** `BRCManagementReview` records exist with attendees/inputs/outputs/actions and a form modal — a structured minute-book, which beats Word. But inputs are typed in by hand even though the app *holds the data* (complaint counts, NC trends, CAPA closure, readiness delta are all computed in `BrcAnalytics.jsx`). The auto-assembly opportunity — pre-populating a review with the period's actual numbers — is the differentiator the market asks for and is unbuilt.

**Verdict: 🟡 PARTIAL.**

### 5.7 Supplier approval & certificate continuity ⭢ 🟡 PARTIAL

**Market evidence.** Chasing supplier certificates by email consumes QA time; certificate continuity gaps ("uncertified for even two weeks while receiving product") draw NCs; audit-day ASL scrambles; and — on the software side — supplier-overdue notification floods (SafetyChain).

**This app.** `BRCSupplier` holds approval status, risk, certification with expiry, review dates; Action Centre flags overdue and 60-day supplier reviews. Gaps: supplier detail page is a stub; no certificate *file* storage (§4.3 wiring would fix); no continuity view (history of certification windows vs receipt of goods is out of scope, but even a cert-expiry timeline is absent); reminders in-app only.

**Verdict: 🟡 PARTIAL.**

### 5.8 Operational registers (calibration, pest control, glass, cleaning) ⭢ 🟡 PARTIAL

**Market evidence.** Calibration gaps can cost audit grades ("Major NC for a single instrument out of spec"); pest-control paperwork is authored by contractors and "often confusing or lacking"; glass registers drift from the floor; cleaning/hygiene documentation failures sit in certification-body top-5 NC data.

**This app.** Dedicated registers exist for calibration, pest control visits, and glass/brittle items with due dates, statuses and Action Centre integration — genuinely more than most horizontal skills tools offer. Gaps: calibration detail stub; no certificate attachment (again §4.3); no cleaning/hygiene records module (arguably fine — scope); no walk-the-line check workflow for the glass register (the audited activity is the periodic physical check, and the register has no check-log).

**Verdict: 🟡 PARTIAL.** `BRCGlassItem` having no inspection log is the most audit-exposed gap here.

### 5.9 Complaint trending ⭢ 🟡 PARTIAL

**Market evidence.** BRCGS 3.10.2 requires complaints "analysed for significant trends"; sites manually pivot Excel logs; even Safefood 360 can't separate customer/supplier/other complaints for trending.

**This app.** Complaints have categories, severity, status, and `BrcAnalytics.jsx` charts complaint categories — a real trending start. Gaps: no time-series trend (period-over-period), no complaints-per-million-units normalisation, stale-complaint alerting exists (>30 days) but complaint→CAPA linkage (`capa_id`) is schema-only.

**Verdict: 🟡 PARTIAL.**

### 5.10 Single-person dependency / "the QMS lives in the QA manager's head" ⭢ 🟡 PARTIAL

**Market evidence.** The meta-pain: one person connects the dots; a two-week holiday or resignation exposes it ("previous QA manager left without notice and took records with him"). Unannounced audits (BRCGS) make "audit-ready only when the QA manager is in" untenable.

**This app.** Centralising records, statuses and the Action Centre genuinely mitigates this — it's the product's reason to exist. But an access-control bug undermines it: `quality_manager` is referenced in `Layout.jsx:240` and `deleteEvidence` yet **is not in the `User.role` enum**, and a `manager` role falls through to viewer nav — so **managers cannot see the BRC module at all**; in practice exactly one admin runs BRC, recreating the single-person dependency inside the tool. Also: the readiness score is only recomputed by a manual button despite its docstring claiming nightly automation; and the destructive "Re-seed (Replace All)" demo button sits in production BRC settings and resolves its target org via `created_by` email rather than `organisation_id` (`seedBrcDemoData/entry.ts:21`).

**Verdict: 🟡 PARTIAL.**
**Fix.** Give managers scoped BRC access (or add the `quality_manager` role properly); automate the recompute; move demo re-seed behind an explicit safeguard and fix its org resolution.

### 5.11 Audit-prep-as-a-project & the evidence pack ⭢ 🟡 PARTIAL

**Market evidence.** "Weeks of reconstructing records before every visit"; SafetyCulture-class complaints that "data just sits in their cloud"; auditors expect records "retrievable in minutes"; one-click clause-organised evidence packs are advertised only by niche newcomers because incumbents lack them.

**This app.** The pre-audit checklist (4 readiness gates + per-section clause status + CSV export) is a strong start and maps to how auditors walk the standard. Missing: the actual **evidence pack export** (clause → linked records → attached files as a single PDF/ZIP) — currently impossible anyway until §4.3/§5.1 wiring lands; and the checklist CSV hand-rolls its own escaping instead of using `exportUtils` (consistency risk).

**Verdict: 🟡 PARTIAL** — with the clause spine in place, the evidence-pack export is the highest-value BRC feature not yet built.

### 5.12 The 4-hour traceability / mass-balance test ⭢ ➖ OUT OF SCOPE

BRCGS's timed traceability challenge is a batch/lot concern; this app doesn't model production records. Legitimate scope boundary — but worth stating explicitly in marketing so BRC-module buyers don't assume it's covered.

### 5.13 Clunky, slow, rigid, expensive (legacy eQMS cluster) ⭢ ✅ AVOIDED (today)

**Market evidence.** The dominant negative across MasterControl/Q-Pulse/ETQ/Intelex: "clunky and outdated," "way too much clicking," months-long implementations, ~$10k–30k/yr against a free-Excel incumbent, per-user pricing excluding the shop floor, hardcoded workflows.

**This app.** Modern UI, form modals with sensible defaults, self-serve setup with templates and demo data, org-band pricing with a £49/mo BRC add-on — squarely in the underserved gap between free Excel and $10k platforms identified by the research (IFSQN posters literally describe being "a VERY small company with almost no capital" priced out of everything). Watchouts: §4.8 performance (the "slow" complaint is earned at scale, not at launch) and keeping form friction low as fields accrete.

**Verdict: ✅ AVOIDED** — this positioning is the business case; protect it.

---

## 6. Part C — Cross-cutting SaaS pain points

### 6.1 Onboarding & first-run value ⭢ ✅ AVOIDED (with two integrity caveats)

**Market evidence.** Empty-state paralysis kills activation; forced full setup before value is why 55–75% of HRIS implementations miss objectives; templates and labelled sample data dramatically lift conversion; value must arrive in <10 minutes with partial data.

**This app.** Close to textbook: a 5-step wizard (org → plan → template skills → team → invites), 6 industry templates sized to "start small" best practice, per-page empty states with clear CTAs, a dismissible getting-started checklist with progress, BRC demo data one click away and labelled. Caveats: **nothing routes a fresh user to `/onboarding`** (only a Dashboard empty-state button); `onboarding_step` is persisted but never read, so resuming (including returning from Stripe with `?step=3`) restarts at step 1; template import bypasses tier limits (§6.3); and the plan step **optimistically writes the paid tier before checkout**, so an abandoned checkout leaves a free org marked as paid with no correcting webhook (`Onboarding.jsx:115`; `stripeWebhook` handles no `checkout.session.expired`).

**Verdict: ✅ core avoided; fix the routing/resume and the optimistic tier write.**

### 6.2 Client-side-only authorization / platform trust (Base44) ⭢ ❌ PRESENT

**Market evidence.** The most damaging multi-tenant SaaS vulnerability class: authorization living only in frontend JS, IDOR, cross-tenant leaks. **Base44 specifically** had two documented 2025 incidents: Wiz found unauthenticated registration into any private Base44 app via public `app_id` (patched July 2025); Imperva found stored-XSS account takeover and **premium features enforced only client-side**. The lesson both write-ups draw: apps on Base44 must add their own server-side per-entity authorization and test it by calling APIs directly with another tenant's IDs.

**This app.** The backend *functions* are good citizens (org derived from the authenticated user, tenant checks in `deleteEvidence`, admin checks in Stripe/delete flows). But the app's data plane is direct client entity calls, with isolation delegated entirely to Base44 platform rules **not visible in this repo**, and:
- **No route guards**: `ProtectedRoute.jsx` is unused and broken (references `authChecked`/`checkUserAuth` that `AuthContext` doesn't provide); any viewer can URL-navigate to `/settings`, `/users`, `/audit-log`, `/matrix`, `/brc/*`.
- **`Settings.jsx` has no role check** — org rename, notification config, module toggles, full-org export, bulk import, and the delete-org dialog are reachable by any authenticated user (only the final `deleteOrganisation` call re-checks admin server-side).
- **Onboarding self-assigns admin** from the client (`Onboarding.jsx:104` — `updateMe({role:'admin'})`), meaning role escalation is a client-side write.
- **`checkTrialEnding/entry.ts`**: `if (user && user.role !== 'admin') return 403` — an **unauthenticated** caller (`user === null`) passes into `asServiceRole` reads of every organisation and admin email.
- **`ModuleToggleSection.jsx:59`** writes `Organisation.modules` directly from the client — the BRC paywall is a client-side `if`; `requireBrcModule` exists server-side and is called by nothing.
- Two queries omit the org filter entirely (`TeamDetail.jsx:80-81`); manager "scoping" is browser-side filtering over full-org fetches, so a manager's browser holds every employee's data.

**Verdict: ❌ PRESENT — the highest-priority category in this audit.**
**Fix (ordered).** (1) Verify/configure Base44 entity-level row security per entity, then test by calling entity APIs with a second tenant's IDs; (2) fix `checkTrialEnding`'s auth inversion (one line); (3) add a working route guard and role checks on Settings/Users/AuditLog; (4) move role assignment and module toggling behind backend functions; (5) stop self-assigning admin client-side (do it in a backend function during org creation).

### 6.3 Tier limits enforced only in UI / broken seat counting ⭢ ❌ PRESENT

**Market evidence.** Imperva's Base44 finding — premium enforcement only client-side — plus the general complaint pattern of limits that are inconsistent (bypassable in one flow, enforced in another), and surprise limits mid-workflow.

**This app.** `checkTierLimit` is a well-built server function (org from auth, per-resource counts, helpful upgrade prompts) — but it is *advisory*: entity writes are direct client calls, and the function is consulted at only 4 call sites. Bypasses already shipped: `BulkImportModal` (unlimited employees, no check), `TemplatePickerModal` and `Onboarding` (unlimited skills/categories). The gated features `pdf_export`, `csv_export`, `site_level_views` have **zero callers** — CSV export is dispensed free everywhere (fine for users, but it contradicts the tier copy that sells it on Starter). And **seat limits are permanently unenforceable**: seats are counted as `Invitation.filter({status:'accepted'})`, but nothing in the codebase ever sets `status:'accepted'` — there is no invitation-acceptance handler at all, so invited users also never get their intended role or `team_ids`. Finally, `useTierCheck` has no try/catch: a function error hangs the modal silently.

**Verdict: ❌ PRESENT.**
**Fix.** Complete the invitation loop (on first login, match `User.email` to pending invitations → apply role/teams → mark accepted); route bulk/template creates through the same check; align tier copy with what's actually gated; long-term, enforce limits in write-path backend functions rather than advisory pre-checks.

### 6.4 Selling features that don't exist ⭢ 🚨 AMPLIFIED

**Market evidence.** Trust research is unambiguous: surprise gaps between promise and product are remembered as bait; "no data export," phantom features, and destructive trials top the SaaS red-flag lists buyers now screen for. None of the researched competitors' complaints are as damaging as "we paid for X and it isn't there."

**This app.** Currently promises, in tier copy, upgrade prompts and onboarding: **"Audit-ready PDF reports"** (Growth) — `jspdf`/`html2canvas` installed, imported nowhere; the only PDF path is `window.print()`. **"Employee self-assessment portal"** (Growth) — no self-assessment exists anywhere. **"Department & site level views"** and **"Advanced analytics dashboard"** (Scale) — no site model, no dashboard beyond the standard one. **"Weekly expiry digest" / expiry notifications** (Settings toggles) — no producer (§4.1). The BRC add-on lists document control — read-only (§5.2). Also inconsistent: `Onboarding.jsx` contains dead pricing (£29/£59/£119) alongside the real £39/£79/£149, and the annual BRC price is unreachable from two of its three purchase entry points (`BillingSection.jsx:78`, `ModuleToggleSection.jsx:41` hard-code `monthly`).

**Verdict: 🚨 AMPLIFIED — the most reputation-dangerous finding in this audit.**
**Fix.** Triage each claim: build it (print-based PDF report is days of work given the print CSS already exists), or strip it from copy until built. Delete the dead pricing constants.

### 6.5 Trial expiry, cancellation & data hostage ⭢ ✅ AVOIDED

**Market evidence.** Trials that end in lockout, deletion threats, paid/degraded exports, and hidden cancellation are top screened-for red flags ("data hostage").

**This app.** Trial ends → Stripe cancels → webhook downgrades to free; data persists. Cancellation via self-serve Stripe portal. Exports are free everywhere (matrix CSV, training-needs CSV, 5-file full-org export, SAR export, BRC checklist CSV). Small issues only: the 5-file export fires five simultaneous downloads (browsers block all but the first — the code comments acknowledge the missing ZIP), and what happens when a downgraded org is *over* free-tier limits is undefined (recommended: read-only over-limit, never hidden data).

**Verdict: ✅ AVOIDED.**

### 6.6 Missing/editable audit trail ⭢ 🟡 PARTIAL (claim: 🚨)

**Market evidence.** Auditors don't accept logs that can be edited after the fact; frameworks expect append-only records with actor, timestamp, and before/after values. Excel's inability to show "who changed a cell, when" is a named blocker in regulated contexts; a skills tool where a rating can be silently backdated "is worthless as evidence."

**This app.** An `AuditLogEntry` entity, a dedicated viewer with search/filters, and ~20 logged action types — far ahead of Excel. But: the UI subtitle claims **"Tamper-evident record"** while entries are client-written ordinary rows (spoofable, suppressible — 13 call sites swallow failures with `.catch(() => {})`, 5 others can throw into the UI); **no before/after values**; large silent gaps (skill/category/team CRUD, required-skill changes — `ManageRequiredSkillsModal` deletes and recreates the whole set untracked — bulk imports, assessment deletions, and *every* BRC record mutation); two entries logged with no actor; and the viewer hard-caps at the 1,000 most recent entries, silently truncating history — for a compliance product, the most consequential cap in the app. Assessments themselves are append-only (good) but `SkillAssessment` records can be created with arbitrary `assessed_date`s and there's no correction/void workflow.

**Verdict: 🟡 PARTIAL, with the "tamper-evident" claim itself 🚨.**
**Fix.** Write audit entries server-side (or via a single backend function) with before/after values; cover the silent operations; paginate the viewer with export; remove or make true the "tamper-evident" claim (server-side writes + no update/delete permission on the entity gets most of the way).

### 6.7 GDPR & data-protection completeness ⭢ ❌ PRESENT

**Market evidence.** Competency assessments about named employees are personal data; UK/EU SME buyers screen for residency, DPA, retention automation, SAR support, and complete erasure. Cornerstone documents a dedicated skills-matrix GDPR deletion procedure — the bar for handling this data class.

**This app.** Strong pieces: SAR export, privacy/cookie/DPA/terms pages, cookie consent banner, evidence soft-delete with retention fields in schema. Broken pieces: **`deleteOrganisation` deletes 8 entity types but none of the 14 BRC entities, no `EvidenceFile`s, and no `User` records** — a BRC customer's erasure request leaves audits, NCs, complaints (which contain customer names), and evidence metadata behind; `EvidenceFile.retention_until` has no enforcement; no per-type retention settings; no stated data residency; and the site footer ships "Conryx Ltd" with **blank** company number, ICO registration and registered office (`SiteFooter.jsx:5-10`) — a UK compliance SaaS with empty statutory fields is a credibility own-goal on every page.

**Verdict: ❌ PRESENT.**
**Fix.** Extend `deleteOrganisation` to all entities; fill in the statutory footer; state residency in the DPA; schedule retention enforcement.

### 6.8 Notification design (fatigue vs silence) ⭢ ❌ PRESENT

Covered in §4.1 for the silence half. The fatigue half is currently moot (nothing sends), but the *design* should be decided before the producer ships: the research's "unclaimed middle ground" is digest-by-default + escalation-on-overdue + per-user preferences. The `Organisation`-level toggles that exist are org-wide; per-user channel preferences don't exist. Email deliverability is delegated to Base44's `Core.SendEmail` (sender domain/SPF/DKIM not controllable in-repo — verify in platform); all current emails go to `users[0]` of the admin list — a single arbitrary admin.

**Verdict: ❌ PRESENT** (absence side); design recommendation recorded for the build.

### 6.9 Roles: admin-or-nothing, no auditor access, offboarding ⭢ 🟡 PARTIAL

**Market evidence.** Coarse roles are the classic anti-pattern ("to let a supervisor update their team's training you must make them a full admin"); external auditors need time-limited read-only access (competitors advertise one-click auditor exports *because* tools lack auditor roles); offboarding must archive, not delete, to preserve history.

**This app.** Three roles with real differentiation (admin/manager/viewer), manager team-scoping in the matrix/gap pages, and `TeamMember` records separate from login users (so employees don't consume seats — good). Gaps: scoping is client-side filtering (§6.2); **no read-only auditor role** — on audit day the choice is admin-login-sharing or CSV printouts, the exact market complaint; `manager` role locked out of BRC entirely (§5.10); `User.status:'inactive'` exists but the Users page flow is deletion (`user.deleted` audit action) with assessments left orphaned rather than an archive-with-history pattern; `Invitation.team_ids` collected but never applied (§6.3).

**Verdict: 🟡 PARTIAL.** An auditor role is cheap to add (viewer + org-wide read + no PII beyond need + expiry date) and is a sales feature in this market.

### 6.10 Reliability UX: unhandled failures ⭢ ❌ PRESENT

**Market evidence.** "Slow/broken/inconsistent" is the top review-negative cluster across the QMS category; silent failures erode the daily-use trust a compliance system depends on.

**This app.** Nearly every page's `loadData()` is an un-caught `Promise.all` — any single failed request leaves an **infinite skeleton** with no message and no retry (`SkillsMatrix.jsx:141-162`, `Dashboard.jsx:341-357`, and every BRC page); most save handlers likewise. One root `ErrorBoundary` only. `useTierCheck` failures hang modals (§6.3). The `useOrganisation` hook caches org/user in module-level globals never invalidated — stale roles/tiers can persist across navigation and re-login.

**Verdict: ❌ PRESENT.**
**Fix.** A shared `loadData` wrapper (try/catch → error state → retry button) applied across pages; try/catch in `useTierCheck`; invalidate the org cache on auth change.

### 6.11 Backups, bulk-mistake recovery ⭢ 🟡 PARTIAL

**Market evidence.** 70% of SaaS-using businesses have lost SaaS data; admins wrongly assume the vendor backs everything up; bad imports overwriting good records and accidental bulk deletions are the common self-inflicted wounds; recycle-bin patterns and scheduled self-serve exports are the mitigations.

**This app.** Positives: assessments append-only; BRC records have no delete; evidence is redact-not-delete; exports are free (a customer *can* keep copies). Negatives: `ManageRequiredSkillsModal` deletes and recreates the entire requirement set on every save (a crash mid-save loses the team's requirements, untracked); member deletion orphans assessments; no undo on bulk assessment; no scheduled/automated customer export; platform backup posture unverifiable in-repo.

**Verdict: 🟡 PARTIAL.**

### 6.12 Kiosk/shared-device & offline ⭢ ❌ PRESENT (roadmap)

Covered in §4.12 — no kiosk mode, no draft persistence. For the food-manufacturing segment both are adoption levers; neither is table stakes for launch. Recorded as roadmap items with the market evidence attached.

### 6.13 Integrations & API access ⭢ ❌ PRESENT (roadmap)

**Market evidence.** Weak HRIS/LMS integration is the most consistent point-tool con (MuchSkills, Cinode, 365Talents, Visual Workforce); without joiner/leaver sync, the maintenance pain the tool was bought to solve reappears as re-keying. API gated to top tiers is the related complaint.

**This app.** No API, no webhooks, no SSO/SCIM, no scheduled CSV sync. At the current SME target this is survivable (CSV import is the integration), which is why it's rated roadmap rather than launch-blocking — but it caps the ceiling of "the matrix stays current by itself" (§4.2).

---

## 7. Ranked action plan

### P0 — Integrity & trust (do before marketing pushes)

| # | Action | Closes | Effort |
|---|---|---|---|
| 1 | Fix `checkTrialEnding` auth inversion (unauthenticated → service role) | §6.2 | Trivial |
| 2 | Verify Base44 entity row-security per entity; test cross-tenant reads with a second org's IDs | §6.2 | Small |
| 3 | Add route/role guards (fix `ProtectedRoute`, gate Settings/Users/AuditLog); move admin self-assignment and module toggles server-side | §6.2 | Medium |
| 4 | Reconcile tier copy with reality: build or remove PDF reports, employee portal, site views, expiry digest toggles; delete dead pricing; fix BRC annual purchase path | §6.4, §4.11, §4.1 | Medium |
| 5 | Fix Action Centre sort-after-slice bug (critical alerts silently dropped) | §5.3 | Trivial |
| 6 | Complete `deleteOrganisation` erasure (BRC entities, EvidenceFile, Users); fill statutory footer | §6.7 | Small |
| 7 | Remove/qualify the "tamper-evident" audit-log claim until server-side | §6.6 | Trivial |

### P1 — Close the market's #1 pains (the competitive core)

| # | Action | Closes | Effort |
|---|---|---|---|
| 8 | Build the reminder engine: scheduled expiry sweep → Notification records + emails at each warning threshold → manager/admin escalation → Monday digest | §4.1, §5.3, §5.5, §5.7 | Large |
| 9 | Wire evidence upload UI into assessments, clauses, CAPAs/NCs, suppliers, calibration | §4.3, §5.1, §5.7, §5.8 | Medium |
| 10 | Fix the BRC evidence loop: write `evidence_count` (server-side), add `linked_by_user_id`, fix `by_section`, wire `seedBrcClauses`, hide unseeded standards | §5.1 | Medium |
| 11 | Complete the invitation loop (accept → role + teams + status); makes seat limits enforceable | §6.3 | Medium |
| 12 | Route bulk import & templates through tier checks; add try/catch to `useTierCheck` | §6.3 | Small |
| 13 | BRC document CRUD + version supersede | §5.2 | Medium |
| 14 | Minimum-proficiency selector in required-skills modal (+ level descriptors in assessment modal) | §4.4 | Small |
| 15 | Import v2: column mapping, per-row pre-commit validation, downloadable error report, upsert, and assessment-grid import | §4.7 | Large |
| 16 | Matrix performance: memoise derived grids, bound assessment fetch, virtualise, debounce search | §4.8 | Medium |

### P2 — Differentiators & hardening

| # | Action | Closes |
|---|---|---|
| 17 | Auditor read-only role (time-limited) + clause-organised evidence-pack export | §6.9, §5.11 |
| 18 | Server-side audit logging with before/after values; cover silent ops; paginate + export viewer | §6.6 |
| 19 | Shared load-error/retry wrapper across pages; invalidate org cache on auth change | §6.10 |
| 20 | Staleness indicators + review cadence on skills; per-row expiry in bulk assessment | §4.2 |
| 21 | Guided 5-Whys RCA on NCs/complaints; complaint→CAPA link; CAPA effectiveness review | §5.4, §5.3 |
| 22 | Management review auto-assembly from the period's actual data | §5.6 |
| 23 | Training-action tracking from gap analysis (owner, due date, status) | §4.10 |
| 24 | NC/CAPA/audit/supplier/calibration detail pages (replace stubs) | §5.3, §5.5, §5.7 |
| 25 | Skill↔document link for revision-triggered retraining (category-defining feature) | §4.6 |
| 26 | Archive-not-delete offboarding; ZIP the full-org export; over-limit read-only policy on downgrade | §6.9, §6.5 |
| 27 | Kiosk mode, draft persistence, glass-register walk-the-line check log | §6.12, §5.8 |

---

## 8. Appendix — source index

Sources are grouped by research stream; all were used in the agent research summarised above.

**Skills-matrix / competency tools & process:**
AG5 reviews (Capterra) · Skills Base (itqlick, SelectHub) · MuchSkills (SoftwareAdvice UK) · Cinode (G2) · Skills DB Pro (itqlick) · iMocha (Hirevire) · TalentGuard / Kahuna (G2, Research.com, Cloud Assess) · Cornerstone (WeReadReviews, Valamis) · SAP TIH (SAP Community, SAP KBA 3407109, TalenTeam) · Workday Skills Cloud (Gartner Peer Insights, Fuel50, Workera, Praxikon) · Excel-process pain (Skillpanel, Sprad, Symestic, Workprove, Zoho People, AG5 templates) · assessment integrity (SHRM, Engagedly, ScienceDirect S0361368212000924X, RewardsDNA, Docebo) · audit-readiness (Elsmar Cove threads 56474/73187/77173, IFSQN, Assure Food Safety, Smithers, SafetyChain BRC, MangoApps, SkillProof, Vekuri, Merca, CompMatrix, Training Tiger) · expiry tracking (Expiration Reminder, Aquilon LMS, ExpiryEdge, SkillsInventory) · deskless (Flip, Scootee, MangoApps, CloudApper) · taxonomy (Gloat, Sevoir, SkillsDB, Deloitte-via-SkillsDB).

**Food-safety QMS / BRCGS:**
Safefood 360 (Capterra, IFSQN threads 26369/25675) · SafetyChain (Capterra, SelectHub) · Mango QHSE (Capterra) · Qualio (G2, Cognidox) · isoTracker (SoftwareAdvice) · MasterControl (SelectHub, Capterra, Elsmar 81215) · Q-Pulse (GetApp AU, Ideagen community) · ETQ Reliance (G2, SelectHub) · Intelex (G2) · Effivity (Capterra) · SafetyCulture (Fluix, Taqtics) · BRCGS process (IFSQN threads 15697/33202/36384/42671/44780/44806/46189/46684/46795/47262/47709/48899/49817/50243, Techni-K, HACCP Mentor, Klipspringer, CFS Compliance, 1stc, FSNS top-10 NC data, QIMA/WQS top-5 NCs, Assure Food Safety, Stevens Traceability) · document control (Food Industry Hub, Alleratech, FoodReady, Primority, ExpiryEdge) · CAPA/RCA (Miratag, iFactory, The FDA Group, Quality Forward, ThinkFree, Rephine) · suppliers (QIA, IDT, DocumentCompliance, Alleratech) · QA-role pain (Food Safety Experts, FoodChain ID) · pricing (IFSQN 43213, QTRACA, Cloudtheapp, OpenRegulatory).

**Cross-cutting SaaS:**
CSV import/activation (CSVBox ×3) · empty states (Pixxen, SaaSFactor, Appcues, DesignRevision) · implementation failure (Kami Workforce, HRLaunch, Gartner-via-both) · reminders (Remindax, ExpiryEdge, Cryotos) · notification fatigue (Courier, MagicBell, NotiGrid) · deliverability (DMARKOFF, Sixteen Ventures, Mailtrap) · RBAC (EnterpriseReady, AppOmni, SaaSUI, BetterCloud, HRIS Consultants) · offboarding (CharlieHR, Oracle, CSA) · **Base44 security incidents (Wiz "critical vulnerability Base44" July 2025; Imperva "critical flaws in Base44" — data exposure, ATO, client-side-only premium enforcement; Infosecurity Magazine)** · OWASP multi-tenant cheat sheet · billing dark patterns (Foundey, GetMonetizely) · data hostage (Jotform, Genie AI, Turley Law, Alphonso Labs, AIonX) · audit trails (SWF Consultancy, SG Systems, Arena) · SaaS data loss (CPO Magazine, Rewind, TechTarget) · GDPR/HR (Ciphr, DPO Consulting, Osborne Clarke, Cornerstone GDPR skills-matrix deletion doc) · deskless/kiosk/offline (Flip, Plex Mobile, QT9, IDmelon, OLOID, WorkEasy, Microsoft frontline, BuildersAI, Alpha Software, GetJobReport, Evenglory, Dozuki, FormRift, GoAudits).

**Codebase evidence:** all file/line references inline throughout Parts A–C refer to this repository at commit `fb728cd`.
