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

  // 2. Cascade delete all entity data for this organisation
  const [assessments, teamMembers, teams, skills, categories, reqSkills, notifications, invitations] = await Promise.all([
    base44.asServiceRole.entities.SkillAssessment.filter({ organisation_id: orgId }),
    base44.asServiceRole.entities.TeamMember.filter({ organisation_id: orgId }),
    base44.asServiceRole.entities.Team.filter({ organisation_id: orgId }),
    base44.asServiceRole.entities.Skill.filter({ organisation_id: orgId }),
    base44.asServiceRole.entities.SkillCategory.filter({ organisation_id: orgId }),
    base44.asServiceRole.entities.TeamRequiredSkill.filter({ organisation_id: orgId }),
    base44.asServiceRole.entities.Notification.filter({ organisation_id: orgId }),
    base44.asServiceRole.entities.Invitation.filter({ organisation_id: orgId }),
  ]);

  await Promise.all([
    ...assessments.map(r => base44.asServiceRole.entities.SkillAssessment.delete(r.id)),
    ...teamMembers.map(r => base44.asServiceRole.entities.TeamMember.delete(r.id)),
    ...teams.map(r => base44.asServiceRole.entities.Team.delete(r.id)),
    ...skills.map(r => base44.asServiceRole.entities.Skill.delete(r.id)),
    ...categories.map(r => base44.asServiceRole.entities.SkillCategory.delete(r.id)),
    ...reqSkills.map(r => base44.asServiceRole.entities.TeamRequiredSkill.delete(r.id)),
    ...notifications.map(r => base44.asServiceRole.entities.Notification.delete(r.id)),
    ...invitations.map(r => base44.asServiceRole.entities.Invitation.delete(r.id)),
  ]);

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

  return Response.json({ deleted: true });
});