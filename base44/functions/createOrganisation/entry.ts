/**
 * createOrganisation — server-side org creation during onboarding.
 * Creates the organisation and assigns the calling user as its admin.
 * Replaces the previous client-side flow where the browser called
 * auth.updateMe({ role: 'admin' }) directly — role assignment must never
 * be a client-side write.
 *
 * Guard: only a user with NO organisation may create one. An existing
 * member of an organisation cannot use this to escalate to admin or to
 * move themselves to a new organisation.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  if (user.organisation_id) {
    return Response.json({ error: 'You already belong to an organisation.' }, { status: 409 });
  }

  const { name, timezone } = await req.json().catch(() => ({}));
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) {
    return Response.json({ error: 'Organisation name is required.' }, { status: 400 });
  }
  if (trimmed.length > 120) {
    return Response.json({ error: 'Organisation name is too long.' }, { status: 400 });
  }

  const org = await base44.asServiceRole.entities.Organisation.create({
    name: trimmed,
    slug: trimmed.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    timezone: typeof timezone === 'string' && timezone ? timezone : 'Europe/London',
    subscription_tier: 'free',
    onboarding_step: 2,
  });

  await base44.asServiceRole.entities.User.update(user.id, {
    organisation_id: org.id,
    role: 'admin',
    status: 'active',
  });

  await base44.asServiceRole.entities.AuditLogEntry.create({
    organisation_id: org.id,
    actor_user_id: user.id,
    actor_display: user.full_name || user.email,
    action: 'organisation.created',
    target_type: 'organisation',
    target_id: org.id,
    target_display: trimmed,
    detail: JSON.stringify({ timezone: org.timezone }),
  }).catch(() => {});

  return Response.json({ organisation: org });
});
