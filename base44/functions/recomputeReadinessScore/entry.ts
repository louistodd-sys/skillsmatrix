/**
 * recomputeReadinessScore — Phase 4 (Section 4.4)
 * Computes BRC audit-readiness score for one or all orgs.
 * - Called by scheduled automation nightly for all BRC orgs.
 * - Called server-side after any BRC entity state change.
 *
 * Input: { organisation_id? } — omit to run for all BRC orgs (scheduler use).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const STATUS_RAG = {
  not_started:      'red',
  in_progress:      'amber',
  evidence_attached:'amber',
  needs_review:     'amber',
  ready:            'green',
};

async function computeForOrg(base44, orgId) {
  const [clauses, statuses] = await Promise.all([
    base44.asServiceRole.entities.BRCClauseStatus.filter({ organisation_id: orgId }),
    base44.asServiceRole.entities.BRCClause.list('display_order', 500),
  ]);

  // Find the org to get its standard
  const orgs = await base44.asServiceRole.entities.Organisation.filter({ id: orgId });
  if (!orgs.length) return null;
  const org = orgs[0];
  if (!org.brc_standard) return null;

  const orgClauses = statuses; // already org-scoped
  const statusMap = Object.fromEntries(orgClauses.map(s => [s.clause_id, s]));

  // Reconcile evidence_count on every clause status from the actual links —
  // this is the authoritative recount behind the client-side sync helper.
  const links = await base44.asServiceRole.entities.BRCClauseEvidenceLink.filter({ organisation_id: orgId });
  const linkCounts = {};
  for (const link of links) {
    linkCounts[link.clause_id] = (linkCounts[link.clause_id] || 0) + 1;
  }
  await Promise.all(orgClauses
    .filter(s => (linkCounts[s.clause_id] || 0) !== (s.evidence_count || 0))
    .map(s => base44.asServiceRole.entities.BRCClauseStatus.update(s.id, {
      evidence_count: linkCounts[s.clause_id] || 0,
    }))
  );

  let red = 0, amber = 0, green = 0;
  const bySection = {};

  for (const clause of clauses.filter(c => c.standard === org.brc_standard)) {
    const st = statusMap[clause.id];
    const rag = st ? (STATUS_RAG[st.status] || 'red') : 'red';
    if (rag === 'red')   red++;
    if (rag === 'amber') amber++;
    if (rag === 'green') green++;

    // Group by the standard's section — the leading part of the clause number
    // ("4.6" → section "4"). issue_number is the standard issue (e.g. "7") and
    // is the same for every clause, so it must never be the grouping key.
    const section = String(clause.clause_number || '').split('.')[0] || 'unknown';
    if (!bySection[section]) bySection[section] = { red: 0, amber: 0, green: 0 };
    bySection[section][rag]++;
  }

  const total = red + amber + green;
  const overallPercent = total > 0 ? Math.round((green / total) * 100) : 0;

  const score = {
    overall_percent: overallPercent,
    red_count:   red,
    amber_count: amber,
    green_count: green,
    by_section:  bySection,
    computed_at: new Date().toISOString(),
  };

  await base44.asServiceRole.entities.Organisation.update(orgId, {
    brc_readiness_score: score,
  });

  return score;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Determine context — can be called by scheduler (no user) or by a user action
  let user = null;
  try { user = await base44.auth.me(); } catch (_) {}

  const body = await req.json().catch(() => ({}));
  const { organisation_id } = body;

  const cronSecret = Deno.env.get('CRON_SECRET');
  const isScheduler = !!cronSecret && req.headers.get('x-cron-secret') === cronSecret;

  if (!user && !isScheduler) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // An authenticated user may only recompute their own organisation — the
  // requested organisation_id is honoured only for scheduler calls.
  const targetOrgId = user ? user.organisation_id : organisation_id || null;

  if (targetOrgId) {
    // Single org
    const score = await computeForOrg(base44, targetOrgId);
    return Response.json({ success: true, organisation_id: targetOrgId, score });
  }

  // Scheduler: all orgs with brc_compliance module
  const allOrgs = await base44.asServiceRole.entities.Organisation.list();
  const brcOrgs = allOrgs.filter(o => Array.isArray(o.modules) && o.modules.includes('brc_compliance'));

  const results = [];
  for (const org of brcOrgs) {
    const score = await computeForOrg(base44, org.id);
    results.push({ organisation_id: org.id, score });
  }

  return Response.json({ success: true, processed: results.length, results });
});