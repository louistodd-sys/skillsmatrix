/**
 * Client-side Compliance module guard (module key remains 'brc_compliance'
 * for data compatibility; the module now covers BRCGS and ISO standards).
 * NOTE: This is UX-only — server-side enforcement lives in backend functions
 * and entity rules.
 */
import { STANDARDS } from '@/lib/standardsRegistry';

export function hasBrcModule(org) {
  if (!org) return false;
  return Array.isArray(org.modules) && org.modules.includes('brc_compliance');
}

export function hasSkillsMatrixModule(org) {
  if (!org) return false;
  // Default to true for backwards compatibility (pre-backfill orgs)
  if (!Array.isArray(org.modules) || org.modules.length === 0) return true;
  return org.modules.includes('skills_matrix');
}

export function hasMultipleModules(org) {
  if (!org) return false;
  return Array.isArray(org.modules) && org.modules.length > 1;
}

// Returns true if the org has a paid/active BRC entitlement
export function hasBrcEntitlement(org) {
  if (!org) return false;
  return org.brc_subscription_status === 'active' || org.brc_subscription_status === 'trialing';
}

export const MODULE_SKILLS_MATRIX  = 'skills_matrix';
export const MODULE_BRC_COMPLIANCE = 'brc_compliance';

// Labels now come from the standards registry (which also carries ISO
// standards, section names and per-standard behaviour). Kept as a re-export
// so existing imports keep working.
export const BRC_STANDARD_LABELS = Object.fromEntries(
  Object.entries(STANDARDS).map(([key, std]) => [key, std.label])
);