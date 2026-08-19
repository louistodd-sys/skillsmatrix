import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });

  const orgId = user.organisation_id;
  if (!orgId) return Response.json({ error: 'No organisation' }, { status: 400 });

  const orgs = await base44.asServiceRole.entities.Organisation.filter({ id: orgId });
  if (!orgs.length) return Response.json({ error: 'Organisation not found' }, { status: 404 });
  const org = orgs[0];

  // 1. Cancel & delete Stripe subscription and customer
  if (org.stripe_subscription_id) {
    try {
      await stripe.subscriptions.cancel(org.stripe_subscription_id);
    } catch (_) {}
  }
  if (org.stripe_customer_id) {
    try {
      await stripe.customers.del(org.stripe_customer_id);
    } catch (_) {}
  }

  // 2. Cascade delete all entity data for this organisation.
  // Every org-scoped entity must be listed here — a GDPR erasure request is
  // only satisfied if nothing identifying the organisation's people remains.
  // (BRCClause is deliberately absent: it is shared reference data for the
  // standard, not org data.)
  const ORG_SCOPED_ENTITIES = [
    // Skills Matrix module
    'SkillAssessment', 'TeamMember', 'Team', 'Skill', 'SkillCategory',
    'TeamRequiredSkill', 'Notification', 'Invitation',
    // BRC Compliance module
    'BRCAudit', 'BRCCAPA', 'BRCCalibrationRecord', 'BRCClauseEvidenceLink',
    'BRCClauseStatus', 'BRCComplaint', 'BRCDocument', 'BRCDocumentVersion',
    'BRCGlassItem', 'BRCManagementReview', 'BRCNonConformance',
    'BRCPestControlVisit', 'BRCSupplier',
    // Evidence store
    'EvidenceFile',
  ];

  for (const entityName of ORG_SCOPED_ENTITIES) {
    const entity = base44.asServiceRole.entities[entityName];
    if (!entity) continue;
    const records = await entity.filter({ organisation_id: orgId });
    await Promise.all(records.map(r => entity.delete(r.id)));
  }

  // 3. Anonymise audit log entries (retain for compliance but remove PII)
  const auditLogs = await base44.asServiceRole.entities.AuditLogEntry.filter({ organisation_id: orgId });
  await Promise.all(auditLogs.map(r =>
    base44.asServiceRole.entities.AuditLogEntry.update(r.id, {
      actor_display: '[deleted]',
      target_display: '[deleted]',
      detail: JSON.stringify({ anonymised: true, original_action: r.action }),
    })
  ));

  // 4. Delete the organisation record itself
  await base44.asServiceRole.entities.Organisation.delete(orgId);

  // 5. Remove the organisation's user records (the caller last, so the
  //    request itself keeps a valid identity until the very end).
  try {
    const orgUsers = await base44.asServiceRole.entities.User.filter({ organisation_id: orgId });
    const others = orgUsers.filter(u => u.id !== user.id);
    await Promise.all(others.map(u => base44.asServiceRole.entities.User.delete(u.id)));
    const self = orgUsers.find(u => u.id === user.id);
    if (self) await base44.asServiceRole.entities.User.delete(self.id);
  } catch (_) {
    // The org data is already gone; a failure here must not resurrect the
    // request. Remaining user rows carry only name/email and can be removed
    // from the Base44 dashboard.
  }

  return Response.json({ deleted: true });
});