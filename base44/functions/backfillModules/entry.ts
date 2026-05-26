/**
 * backfillModules — Phase 1 Migration (Section 1.2)
 * Admin-only, idempotent. Sets modules = ["skills_matrix"] on every Organisation
 * that does not already have a modules array.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });

  // Service role needed to iterate ALL organisations
  const allOrgs = await base44.asServiceRole.entities.Organisation.list();

  let updated = 0;
  let skipped = 0;

  for (const org of allOrgs) {
    const hasModules = Array.isArray(org.modules) && org.modules.length > 0;
    if (hasModules) {
      skipped++;
      continue;
    }
    await base44.asServiceRole.entities.Organisation.update(org.id, {
      modules: ['skills_matrix'],
    });

    // Audit trail
    await base44.asServiceRole.entities.AuditLogEntry.create({
      organisation_id: org.id,
      actor_user_id:   user.id,
      actor_display:   user.full_name || user.email,
      action:          'organisation.modules_backfilled',
      target_type:     'organisation',
      target_id:       org.id,
      target_display:  org.name,
      detail: JSON.stringify({ modules: ['skills_matrix'] }),
    }).catch(() => {});

    updated++;
  }

  return Response.json({
    success: true,
    total:   allOrgs.length,
    updated,
    skipped,
    message: `Backfill complete. ${updated} orgs updated, ${skipped} already had modules.`,
  });
});