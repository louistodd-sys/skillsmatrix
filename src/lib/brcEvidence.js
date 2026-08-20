import { base44 } from '@/api/base44Client';

/**
 * Shared helpers for clause evidence links. Every create/delete of a
 * BRCClauseEvidenceLink must go through these so BRCClauseStatus.evidence_count
 * stays in sync — the readiness journey's "Add Evidence" stage and the audit
 * checklist both read that counter.
 */

async function syncClauseStatus(orgId, clauseId) {
  const [links, statuses] = await Promise.all([
    base44.entities.BRCClauseEvidenceLink.filter({ organisation_id: orgId, clause_id: clauseId }),
    base44.entities.BRCClauseStatus.filter({ organisation_id: orgId, clause_id: clauseId }),
  ]);
  const count = links.length;

  if (!statuses.length) {
    await base44.entities.BRCClauseStatus.create({
      organisation_id: orgId,
      clause_id: clauseId,
      status: count > 0 ? 'evidence_attached' : 'not_started',
      evidence_count: count,
    });
    return count;
  }

  const status = statuses[0];
  const patch = { evidence_count: count };
  // Move early-stage clauses forward when evidence arrives; never touch
  // 'ready' or 'needs_review' — those are deliberate reviewer decisions.
  if (count > 0 && (status.status === 'not_started' || status.status === 'in_progress')) {
    patch.status = 'evidence_attached';
  }
  await base44.entities.BRCClauseStatus.update(status.id, patch);
  return count;
}

export async function createEvidenceLink({ orgId, userId, clauseId, linkedEntityType, linkedEntityId, notes }) {
  // linked_by_user_id is schema-required — if the caller's cached user hasn't
  // resolved yet, fetch the authenticated user rather than failing validation.
  let linkedBy = userId;
  if (!linkedBy) {
    try { linkedBy = (await base44.auth.me())?.id; } catch { /* fall through */ }
  }
  const link = await base44.entities.BRCClauseEvidenceLink.create({
    organisation_id: orgId,
    clause_id: clauseId,
    linked_entity_type: linkedEntityType,
    linked_entity_id: linkedEntityId,
    linked_by_user_id: linkedBy || 'unknown',
    ...(notes ? { notes } : {}),
  });
  await syncClauseStatus(orgId, clauseId).catch(() => {});
  return link;
}

export async function deleteEvidenceLink({ orgId, linkId, clauseId }) {
  await base44.entities.BRCClauseEvidenceLink.delete(linkId);
  await syncClauseStatus(orgId, clauseId).catch(() => {});
}
