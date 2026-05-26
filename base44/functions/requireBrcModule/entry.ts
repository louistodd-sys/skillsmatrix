/**
 * requireBrcModule — Phase 1 helper (Section 1.4)
 * A standalone function that checks module entitlement server-side.
 * Call from every BRC backend function by invoking this as a sub-function,
 * OR import the inline helper below into each BRC function.
 *
 * Returns { allowed: true } or { allowed: false, reason }
 * and logs AuditLogEntry on denial.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ allowed: false, reason: 'unauthenticated' }, { status: 401 });

  const { module_name } = await req.json();
  if (!module_name) return Response.json({ allowed: false, reason: 'module_name required' }, { status: 400 });

  const orgId = user.organisation_id;
  if (!orgId) return Response.json({ allowed: false, reason: 'no_organisation' }, { status: 400 });

  const orgs = await base44.asServiceRole.entities.Organisation.filter({ id: orgId });
  if (!orgs.length) return Response.json({ allowed: false, reason: 'organisation_not_found' }, { status: 404 });

  const org = orgs[0];
  const modules = Array.isArray(org.modules) ? org.modules : ['skills_matrix'];

  if (!modules.includes(module_name)) {
    // Log denial
    await base44.asServiceRole.entities.AuditLogEntry.create({
      organisation_id: orgId,
      actor_user_id:   user.id,
      actor_display:   user.full_name || user.email,
      action:          'module_access_denied',
      target_type:     'module',
      target_id:       module_name,
      target_display:  module_name,
      detail: JSON.stringify({ requested_module: module_name, org_modules: modules }),
    }).catch(() => {});

    return Response.json({ allowed: false, reason: 'module_not_entitled' }, { status: 403 });
  }

  return Response.json({ allowed: true, org_modules: modules });
});