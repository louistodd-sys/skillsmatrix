/**
 * ModuleSwitcher — appears in the sidebar only when the org has 2+ modules.
 * Stores active module in sessionStorage; defaults to 'skills_matrix'.
 */
import { ShieldCheck, Grid3X3 } from 'lucide-react';
import { hasMultipleModules, MODULE_SKILLS_MATRIX, MODULE_BRC_COMPLIANCE } from '@/lib/brcModuleGuard';

export default function ModuleSwitcher({ org, activeModule, onSwitch }) {
  if (!hasMultipleModules(org)) return null;

  const tabs = [
    { id: MODULE_SKILLS_MATRIX,  label: 'Skills Matrix',    icon: Grid3X3    },
    { id: MODULE_BRC_COMPLIANCE, label: 'Compliance',        icon: ShieldCheck },
  ];

  return (
    <div className="px-3 pb-3 shrink-0">
      <div className="flex rounded-lg overflow-hidden border border-sidebar-border bg-sidebar-accent/40">
        {tabs.map(tab => {
          const isActive = activeModule === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSwitch(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold transition-colors ${
                isActive
                  ? 'bg-sidebar-primary/20 text-white border-b-2 border-sidebar-primary'
                  : 'text-sidebar-foreground/60 hover:text-white hover:bg-sidebar-accent'
              }`}
            >
              <tab.icon className="w-3 h-3 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}