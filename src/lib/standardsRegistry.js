/**
 * Single source of truth for every audit standard the Compliance module
 * supports. The clause→status→evidence→readiness engine is standard-agnostic;
 * everything standard-specific (labels, section names, whether the standard
 * defines "fundamental" clauses, whether food-sector registers apply) lives
 * here. The backend seeder (base44/functions/seedBrcClauses) holds the actual
 * clause libraries — `available` below must only be true when a library
 * exists there.
 */

// Annex SL high-level structure shared by modern ISO management standards
const ISO_SECTIONS = {
  '4': 'Context of the Organization',
  '5': 'Leadership',
  '6': 'Planning',
  '7': 'Support',
  '8': 'Operation',
  '9': 'Performance Evaluation',
  '10': 'Improvement',
};

const BRCGS_PACKAGING_SECTIONS = {
  '1': 'Senior Management Commitment',
  '2': 'Hazard & Risk Management',
  '3': 'Product Safety & Quality Management',
  '4': 'Site Standards',
  '5': 'Product & Process Control',
  '6': 'Process Control',
  '7': 'Personnel',
};

export const STANDARDS = {
  // ── BRCGS family (food & packaging sector) ────────────────────────────────
  brcgs_packaging: {
    label: 'BRCGS Packaging Materials',
    short: 'BRCGS Packaging',
    family: 'brcgs',
    edition: 'Issue 7',
    foodSector: true,
    hasFundamentals: true,
    available: true,
    sections: BRCGS_PACKAGING_SECTIONS,
  },
  brcgs_food: {
    label: 'BRCGS Food Safety',
    short: 'BRCGS Food',
    family: 'brcgs',
    edition: 'Issue 9',
    foodSector: true,
    hasFundamentals: true,
    available: false,
    sections: BRCGS_PACKAGING_SECTIONS,
  },
  brcgs_storage: {
    label: 'BRCGS Storage & Distribution',
    short: 'BRCGS S&D',
    family: 'brcgs',
    edition: 'Issue 4',
    foodSector: true,
    hasFundamentals: true,
    available: false,
    sections: BRCGS_PACKAGING_SECTIONS,
  },
  brcgs_agents_brokers: {
    label: 'BRCGS Agents & Brokers',
    short: 'BRCGS A&B',
    family: 'brcgs',
    edition: 'Issue 3',
    foodSector: true,
    hasFundamentals: true,
    available: false,
    sections: BRCGS_PACKAGING_SECTIONS,
  },
  brcgs_consumer_products: {
    label: 'BRCGS Consumer Products',
    short: 'BRCGS CP',
    family: 'brcgs',
    edition: 'Issue 4',
    foodSector: true,
    hasFundamentals: true,
    available: false,
    sections: BRCGS_PACKAGING_SECTIONS,
  },

  // ── ISO family (any manufacturing / services sector) ──────────────────────
  iso_9001: {
    label: 'ISO 9001 Quality Management',
    short: 'ISO 9001',
    family: 'iso',
    edition: '2015',
    foodSector: false,
    hasFundamentals: false,
    available: true,
    sections: ISO_SECTIONS,
  },
  iso_14001: {
    label: 'ISO 14001 Environmental Management',
    short: 'ISO 14001',
    family: 'iso',
    edition: '2015',
    foodSector: false,
    hasFundamentals: false,
    available: true,
    sections: ISO_SECTIONS,
  },
  iso_45001: {
    label: 'ISO 45001 Occupational Health & Safety',
    short: 'ISO 45001',
    family: 'iso',
    edition: '2018',
    foodSector: false,
    hasFundamentals: false,
    available: true,
    sections: ISO_SECTIONS,
  },
};

export function getStandard(key) {
  return STANDARDS[key] || null;
}

export function standardLabel(key) {
  return STANDARDS[key]?.label || key || 'No standard';
}

export function standardShort(key) {
  return STANDARDS[key]?.short || key || '';
}

export function sectionName(standardKey, sectionNumber) {
  const std = STANDARDS[standardKey];
  return std?.sections?.[String(sectionNumber)] || `Section ${sectionNumber}`;
}

export function standardHasFundamentals(key) {
  return !!STANDARDS[key]?.hasFundamentals;
}

/** Standard keys the organisation works to (multi-standard aware). */
export function enabledStandards(org) {
  if (Array.isArray(org?.compliance_standards) && org.compliance_standards.length > 0) {
    return org.compliance_standards.filter(s => STANDARDS[s]);
  }
  return org?.brc_standard && STANDARDS[org.brc_standard] ? [org.brc_standard] : [];
}

/** The standard currently shown in the module's clause-based views. */
export function activeStandard(org) {
  const enabled = enabledStandards(org);
  if (org?.brc_standard && enabled.includes(org.brc_standard)) return org.brc_standard;
  return enabled[0] || null;
}

/** Food-sector registers (glass & brittle plastic, pest control) apply only
 *  when at least one enabled standard is a food-sector standard. */
export function orgHasFoodSectorStandard(org) {
  return enabledStandards(org).some(s => STANDARDS[s]?.foodSector);
}

export const AVAILABLE_STANDARD_KEYS = Object.keys(STANDARDS).filter(k => STANDARDS[k].available);
