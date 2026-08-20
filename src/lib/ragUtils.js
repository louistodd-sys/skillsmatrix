import { differenceInDays, parseISO, isValid } from 'date-fns';

/**
 * Get RAG status for a skill assessment.
 * Returns: 'green' | 'amber' | 'red' | 'grey'
 *
 * Evaluation order (matches PRD Appendix B):
 *  1. No assessment → grey
 *  2. Expiry date in the past → red (expired)
 *  3. Expiry date within the outermost warning threshold → amber (expiring)
 *  4. Proficiency below team minimum → red (below required level)
 *  5. Otherwise → green
 */
export function getRAGStatus(assessment, skill, teamRequirement) {
  if (!assessment) {
    if (teamRequirement?.is_required) return 'red';
    return 'grey';
  }

  const { proficiency_level, expiry_date } = assessment;
  const today = new Date();

  if (expiry_date) {
    const expDate = parseISO(expiry_date);
    if (isValid(expDate)) {
      if (expDate < today) return 'red';
      const daysUntilExpiry = differenceInDays(expDate, today);
      // Use the LARGEST threshold so the amber zone covers the outermost warning boundary.
      // e.g. [30, 60, 90] → 90 days: anything ≤ 90 days away shows amber.
      const warningDays = skill?.expiry_warning_days?.length
        ? Math.max(...skill.expiry_warning_days)
        : 60;
      if (daysUntilExpiry <= warningDays) return 'amber';
    }
  }

  if (teamRequirement && teamRequirement.is_required) {
    const minProf = Number(teamRequirement.minimum_proficiency ?? 1);
    if (Number(proficiency_level ?? 0) < minProf) return 'red';
  }

  return 'green';
}

/**
 * Returns a human-readable label for a RAG status.
 * Distinguishes between expiry-based red and proficiency-based red.
 */
export function getRAGLabel(status, assessment, skill, teamRequirement) {
  switch (status) {
    case 'green': return 'Current';
    case 'amber': return 'Expiring Soon';
    case 'grey': return 'Not Assessed';
    case 'red': {
      if (!assessment) return 'Not Assessed';
      if (assessment.expiry_date) {
        const expDate = parseISO(assessment.expiry_date);
        if (isValid(expDate) && expDate < new Date()) return 'Expired';
      }
      return 'Below Required Level';
    }
    default: return 'Unknown';
  }
}

// Behaviourally-anchored descriptors shown at the point of assessment so every
// assessor applies the same meaning to a level — the single biggest cause of
// unreliable matrices is each supervisor inventing their own scale.
export const PROFICIENCY_DESCRIPTORS = {
  binary: {
    0: 'Cannot yet perform this task to the required standard, or not observed doing it.',
    1: 'Observed performing this task correctly and safely without supervision.',
  },
  levelled: {
    0: 'No training received; must not perform this task.',
    1: 'Has been trained and understands the task; works only under direct supervision.',
    2: 'Performs the routine task correctly with occasional guidance on exceptions.',
    3: 'Performs the full task independently, including exceptions, to the required standard.',
    4: 'Independent, handles the unexpected, and can train and assess others.',
  },
};

export function getProficiencyLabel(level, scaleType) {
  if (level === null || level === undefined) return 'Not Assessed';
  const n = Number(level);
  if (scaleType === 'binary') {
    return n >= 1 ? 'Competent' : 'Not Competent';
  }
  const labels = ['Not Trained', 'Awareness', 'Working Knowledge', 'Competent', 'Expert'];
  return labels[n] ?? 'Unknown';
}

export function getRAGColors(status) {
  switch (status) {
    case 'green': return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', dot: 'bg-green-500', cell: 'bg-green-500' };
    case 'amber': return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', dot: 'bg-amber-500', cell: 'bg-amber-400' };
    case 'red':   return { bg: 'bg-red-100',   text: 'text-red-700',   border: 'border-red-300',   dot: 'bg-red-500',   cell: 'bg-red-500' };
    case 'grey':  return { bg: 'bg-gray-100',  text: 'text-gray-500',  border: 'border-gray-300',  dot: 'bg-gray-300',  cell: 'bg-gray-200' };
    default:      return { bg: 'bg-gray-100',  text: 'text-gray-500',  border: 'border-gray-300',  dot: 'bg-gray-300',  cell: 'bg-gray-200' };
  }
}