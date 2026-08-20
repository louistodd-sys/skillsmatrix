import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useOrganisation from '@/lib/useOrganisation';
import { enabledStandards, standardShort } from '@/lib/standardsRegistry';

/**
 * Pill switcher for organisations working to more than one standard.
 * Switching writes the org's active standard (brc_standard), which every
 * clause-based view keys off — so the whole module follows the selection.
 * Renders nothing for single-standard organisations.
 */
export default function StandardSwitcher() {
  const { org, refreshOrg } = useOrganisation();
  const [switching, setSwitching] = useState(null);
  const enabled = enabledStandards(org);

  if (enabled.length < 2) return null;

  const active = org?.brc_standard && enabled.includes(org.brc_standard) ? org.brc_standard : enabled[0];

  const handleSwitch = async (std) => {
    if (std === active || switching) return;
    setSwitching(std);
    try {
      await base44.entities.Organisation.update(org.id, { brc_standard: std });
      await refreshOrg();
    } catch {
      // Failed switch leaves the current standard active — nothing to clean up.
    }
    setSwitching(null);
  };

  return (
    <div className="inline-flex rounded-lg border border-border p-1 bg-muted/30 print:hidden" role="tablist" aria-label="Standard">
      {enabled.map(std => (
        <button
          key={std}
          type="button"
          role="tab"
          aria-selected={std === active}
          onClick={() => handleSwitch(std)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            std === active ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {switching === std ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : standardShort(std)}
        </button>
      ))}
    </div>
  );
}
