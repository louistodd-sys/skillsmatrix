/**
 * setModuleEnabled — server-side module toggle for an organisation.
 * Replaces the previous client-side Organisation.modules write so the
 * BRC paywall is enforced on the server, not in the browser.
 *
 * Rules:
 * - Caller must be an admin of the organisation.
 * - skills_matrix is core and cannot be disabled.
 * - brc_compliance can only be enabled with an active/trialing BRC
 *   subscription on the organisation.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const KNOWN_MODULES = new Set(['skills_matrix', 'brc_compliance']);

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') {
    return Response.json({ error: 'Forbidden: admin role required.' }, { status: 403 });
  }

  const orgId = user.organisation_id;
  if (!orgId) return Response.json({ error: 'No organisation' }, { status: 400 });

  const { module, enabled } = await req.json().catch(() => ({}));
  if (!KNOWN_MODULES.has(module) || typeof enabled !== 'boolean') {
    return Response.json({ error: 'Expected { module, enabled }.' }, { status: 400 });
  }
  if (module === 'skills_matrix' && !enabled) {
    return Response.json({ error: 'Skills Matrix is the core module and cannot be disabled.' }, { status: 422 });
  }

  const orgs = await base44.asServiceRole.entities.Organisation.filter({ id: orgId });
  if (!orgs.length) return Response.json({ error: 'Organisation not found' }, { status: 404 });
  const org = orgs[0];

  if (module === 'brc_compliance' && enabled) {
    const brcStatus = org.brc_subscription_status;
    if (brcStatus !== 'active' && brcStatus !== 'trialing') {
      return Response.json({
        error: 'BRC Compliance requires an active subscription.',
        reason: 'not_entitled',
      }, { status: 402 });
    }
  }

  const current = Array.isArray(org.modules) ? org.modules : ['skills_matrix'];
  const updated = enabled
    ? [...new Set([...current, module])]
    : current.filter((m) => m !== module);

  await base44.asServiceRole.entities.Organisation.update(orgId, { modules: updated });

  await base44.asServiceRole.entities.AuditLogEntry.create({
    organisation_id: orgId,
    actor_user_id: user.id,
    actor_display: user.full_name || user.email,
    action: enabled ? 'module.enabled' : 'module.disabled',
    target_type: 'organisation',
    target_id: orgId,
    target_display: org.name,
    detail: JSON.stringify({ module, modules_after: updated }),
  }).catch(() => {});

  return Response.json({ modules: updated });
});
