/**
 * setActiveStandard — switches which enabled standard the compliance module's
 * clause views focus on (Organisation.brc_standard).
 *
 * Exists so the StandardSwitcher never writes the Organisation entity from
 * the browser: entity rules can then deny client Organisation writes outright
 * without breaking standard switching, and managers (who can use the
 * compliance module but must not touch billing fields) get a path that can
 * only ever change this one field.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const KNOWN_STANDARDS = new Set([
  'brcgs_packaging', 'brcgs_food', 'brcgs_storage', 'brcgs_agents_brokers',
  'brcgs_consumer_products', 'iso_9001', 'iso_14001', 'iso_45001',
]);

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin' && user.role !== 'manager') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  const orgId = user.organisation_id;
  if (!orgId) return Response.json({ error: 'No organisation' }, { status: 400 });

  const { standard } = await req.json().catch(() => ({}));
  if (!KNOWN_STANDARDS.has(standard)) {
    return Response.json({ error: 'Unknown standard' }, { status: 400 });
  }

  const orgs = await base44.asServiceRole.entities.Organisation.filter({ id: orgId });
  if (!orgs.length) return Response.json({ error: 'Organisation not found' }, { status: 404 });
  const org = orgs[0];

  const enabled = (Array.isArray(org.compliance_standards) && org.compliance_standards.length > 0)
    ? org.compliance_standards
    : (org.brc_standard ? [org.brc_standard] : []);
  if (!enabled.includes(standard)) {
    return Response.json({ error: 'Standard is not enabled for this organisation.' }, { status: 422 });
  }

  await base44.asServiceRole.entities.Organisation.update(orgId, { brc_standard: standard });
  return Response.json({ active_standard: standard });
});
