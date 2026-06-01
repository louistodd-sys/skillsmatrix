import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TIER_LIMITS = {
  free:         { employees: 10,  skills: 10,  categories: 3,    admin_seats: 1,    manager_seats: 0    },
  essential:    { employees: 50,  skills: 30,  categories: null, admin_seats: 2,    manager_seats: null },
  professional: { employees: 500, skills: null, categories: null, admin_seats: null, manager_seats: null },
};

const UPGRADE_PROMPTS = {
  employee_limit: {
    free:      { target: 'Essential',    message: "You've reached the 10-member limit on Free. Upgrade to Essential to track up to 50 members.",      unlocks: ['Up to 50 members', '30 skills', 'Gap analysis reports', 'CSV export', 'Employee portal', 'Unlimited managers'] },
    essential: { target: 'Professional', message: "You've reached the 50-member limit. Upgrade to Professional to track up to 500 members.",           unlocks: ['Up to 500 members', 'Unlimited skills', 'PDF reports', 'Advanced analytics', 'Site-level views', 'Unlimited admin seats'] },
  },
  skill_limit: {
    free:      { target: 'Essential',    message: "You've reached the 10-skill limit on Free. Upgrade to Essential to track up to 30 skills.",          unlocks: ['Up to 30 skills', 'Up to 50 members', 'Gap analysis reports', 'CSV export', 'Employee portal'] },
    essential: { target: 'Professional', message: "You've reached the 30-skill limit. Upgrade to Professional for unlimited skills.",                   unlocks: ['Unlimited skills', 'Up to 500 members', 'PDF reports', 'Advanced analytics'] },
  },
  category_limit: {
    free:      { target: 'Essential',    message: "You've used all 3 categories. Upgrade to Essential for unlimited categories.",                       unlocks: ['Unlimited categories', 'Up to 50 members', 'Gap analysis reports', 'CSV export'] },
  },
  manager_seat_limit: {
    free:      { target: 'Essential',    message: "Manager seats are not available on Free. Upgrade to Essential for unlimited managers.",              unlocks: ['Unlimited manager seats', 'Gap analysis reports', 'CSV export', 'Employee portal'] },
  },
  admin_seat_limit: {
    free:      { target: 'Essential',    message: "Free includes 1 admin seat. Upgrade to Essential for 2 admin seats.",                               unlocks: ['2 admin seats', 'Unlimited managers', 'Up to 50 members', 'Gap analysis reports'] },
    essential: { target: 'Professional', message: "Essential includes 2 admin seats. Upgrade to Professional for unlimited admin seats.",               unlocks: ['Unlimited admin seats', 'Up to 500 members', 'PDF reports', 'Advanced analytics'] },
  },
  csv_export: {
    free:      { target: 'Essential',    message: "CSV export is available on Essential and above.",                                                   unlocks: ['CSV export', 'Gap analysis reports', 'Employee portal', 'Up to 50 members'] },
  },
  pdf_export: {
    free:      { target: 'Professional', message: "PDF reports are available on Professional.",                                                        unlocks: ['PDF reports', 'Advanced analytics', 'Site-level views', 'Up to 500 members'] },
    essential: { target: 'Professional', message: "PDF reports are available on Professional.",                                                        unlocks: ['PDF reports', 'Advanced analytics', 'Site-level views', 'Unlimited admin seats'] },
  },
  site_level_views: {
    free:      { target: 'Professional', message: "Site-level views are available on Professional.",                                                   unlocks: ['Site-level views', 'Advanced analytics', 'PDF reports', 'Up to 500 members'] },
    essential: { target: 'Professional', message: "Site-level views are available on Professional.",                                                   unlocks: ['Site-level views', 'Advanced analytics', 'PDF reports', 'Unlimited admin seats'] },
  },
};

// Storage quota in bytes per tier
const STORAGE_QUOTA_BYTES = {
  free:         100  * 1024 * 1024,
  essential:    5    * 1024 * 1024 * 1024,
  professional: 50   * 1024 * 1024 * 1024,
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { resource, module: requestedModule } = await req.json();
  const module = requestedModule || 'skills_matrix';

  const orgId = user.organisation_id;
  if (!orgId) return Response.json({ error: 'No organisation' }, { status: 400 });

  const orgs = await base44.entities.Organisation.filter({ id: orgId });
  if (!orgs.length) return Response.json({ error: 'Organisation not found' }, { status: 404 });

  const org = orgs[0];
  const tier = org.subscription_tier || 'free';

  // Module entitlement gate
  const orgModules = Array.isArray(org.modules) ? org.modules : ['skills_matrix'];
  if (!orgModules.includes(module)) {
    return Response.json({
      allowed: false,
      has_limit: true,
      current_limit: 0,
      exceeds: true,
      reason: 'module_not_entitled',
      upgrade_prompt: {
        target: 'BRC Compliance Module',
        message: `Your organisation does not have access to the ${module === 'brc_compliance' ? 'BRC Compliance' : module} module.`,
        unlocks: ['BRC Compliance Readiness module'],
      },
    });
  }

  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;

  let currentCount = 0;
  let scenario = null;

  if (resource === 'employee') {
    const members = await base44.entities.TeamMember.filter({ organisation_id: orgId, is_managed_member: true });
    const unique = new Set(members.map(m => m.user_id));
    currentCount = unique.size;
    scenario = 'employee_limit';
  } else if (resource === 'skill') {
    const skills = await base44.entities.Skill.filter({ organisation_id: orgId, status: 'active' });
    currentCount = skills.length;
    scenario = 'skill_limit';
  } else if (resource === 'category') {
    const cats = await base44.entities.SkillCategory.filter({ organisation_id: orgId });
    currentCount = cats.length;
    scenario = 'category_limit';
  } else if (resource === 'manager_seat') {
    const invitations = await base44.entities.Invitation.filter({ organisation_id: orgId, role: 'manager', status: 'accepted' });
    currentCount = invitations.length;
    scenario = 'manager_seat_limit';
  } else if (resource === 'admin_seat') {
    const invitations = await base44.entities.Invitation.filter({ organisation_id: orgId, role: 'admin', status: 'accepted' });
    currentCount = invitations.length;
    scenario = 'admin_seat_limit';
  } else if (resource === 'pdf_export') {
    const allowed = tier === 'professional';
    if (!allowed) {
      return Response.json({ allowed: false, upgrade_prompt: UPGRADE_PROMPTS.pdf_export[tier] || null });
    }
    return Response.json({ allowed: true });
  } else if (resource === 'csv_export') {
    const allowed = tier === 'essential' || tier === 'professional';
    if (!allowed) {
      return Response.json({ allowed: false, upgrade_prompt: UPGRADE_PROMPTS.csv_export[tier] || null });
    }
    return Response.json({ allowed: true });
  } else if (resource === 'site_level_views') {
    const allowed = tier === 'professional';
    if (!allowed) {
      return Response.json({ allowed: false, upgrade_prompt: UPGRADE_PROMPTS.site_level_views[tier] || null });
    }
    return Response.json({ allowed: true });
  } else if (resource === 'evidence_storage_mb') {
    const quotaBytes = STORAGE_QUOTA_BYTES[tier] ?? STORAGE_QUOTA_BYTES.free;
    const existingFiles = await base44.entities.EvidenceFile.filter({ organisation_id: orgId, is_redacted: false });
    const usedBytes = existingFiles.reduce((sum, f) => sum + (f.size_bytes || 0), 0);
    const quotaMB = Math.round(quotaBytes / (1024 * 1024));
    const usedMB  = Math.round(usedBytes  / (1024 * 1024));
    const allowed = usedBytes < quotaBytes;
    return Response.json({ allowed, current: usedMB, limit: quotaMB, used_bytes: usedBytes, quota_bytes: quotaBytes });
  }

  const limitKey = resource === 'employee' ? 'employees'
    : resource === 'skill' ? 'skills'
    : resource === 'category' ? 'categories'
    : resource === 'manager_seat' ? 'manager_seats'
    : 'admin_seats';

  const limit = limits[limitKey];

  if (limit === null) return Response.json({ allowed: true, current: currentCount, limit: null });

  if (currentCount >= limit) {
    const prompt = UPGRADE_PROMPTS[scenario]?.[tier] || null;
    return Response.json({ allowed: false, current: currentCount, limit, upgrade_prompt: prompt });
  }

  return Response.json({ allowed: true, current: currentCount, limit });
});
