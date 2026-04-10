import { differenceInDays, parseISO, isValid } from 'date-fns';

/**
 * Get RAG status for a skill assessment
 * Returns: 'green' | 'amber' | 'red' | 'grey'
 */
export function getRAGStatus(assessment, skill, teamRequirement) {
  if (!assessment) return 'grey';

  const { proficiency_level, expiry_date } = assessment;
  const today = new Date();

  // Check expiry
  if (expiry_date) {
    const expDate = parseISO(expiry_date);
    if (isValid(expDate)) {
      if (expDate < today) return 'red';
      const daysUntilExpiry = differenceInDays(expDate, today);
      const warningDays = skill?.expiry_warning_days?.[0] || 60;
      if (daysUntilExpiry <= warningDays) return 'amber';
    }
  }

  // Check minimum proficiency if team requirement exists
  if (teamRequirement && teamRequirement.is_required) {
    const minProf = teamRequirement.minimum_proficiency || 1;
    if (proficiency_level < minProf) return 'red';
  }

  return 'green';
}

export function getRAGLabel(status) {
  switch (status) {
    case 'green': return 'Current';
    case 'amber': return 'Expiring Soon';
    case 'red': return 'Expired';
    case 'grey': return 'Not Assessed';
    default: return 'Unknown';
  }
}

export function getProficiencyLabel(level, scaleType) {
  if (level === null || level === undefined) return 'Not Assessed';
  if (scaleType === 'binary') {
    return level >= 1 ? 'Competent' : 'Not Competent';
  }
  const labels = ['Not Trained', 'Awareness', 'Working Knowledge', 'Competent', 'Expert'];
  return labels[level] || 'Unknown';
}

export function getRAGColors(status) {
  switch (status) {
    case 'green': return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', dot: 'bg-green-500' };
    case 'amber': return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', dot: 'bg-amber-500' };
    case 'red': return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', dot: 'bg-red-500' };
    case 'grey': return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', dot: 'bg-gray-500' };
    default: return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', dot: 'bg-gray-500' };
  }
}