/**
 * ModuleToggleSection — shown in Settings > General (admin only).
 * Lets admins enable/disable product modules for their organisation.
 * 
 * Commercial intent: each module is a separate purchasable product.
 * In production, toggling would be gated by a Stripe entitlement check.
 * For now, admins can toggle directly — the billing/upgrade flow is shown for context.
 */
import { useState } from 'react';
import { Grid3X3, ShieldCheck, Loader2, CheckCircle2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';

const MODULE_INFO = {
  skills_matrix: {
    icon: Grid3X3,
    label: 'Skills Matrix',
    description: 'Workforce skills tracking, gap analysis, team compliance, and certification expiry management.',
    alwaysOn: true, // core product — cannot be disabled
  },
  brc_compliance: {
    icon: ShieldCheck,
    label: 'BRC Compliance Readiness',
    description: 'BRCGS clause mapping, document control, audit scheduling, NC/CAPA workflows, and supplier registers.',
    alwaysOn: false,
  },
};

export default function ModuleToggleSection({ org, onModulesChanged }) {
  const [saving, setSaving] = useState(null);
  const currentModules = Array.isArray(org?.modules) ? org.modules : ['skills_matrix'];

  const isEnabled = (mod) => currentModules.includes(mod);

  const handleToggle = async (mod, enable) => {
    if (MODULE_INFO[mod]?.alwaysOn) return;
    setSaving(mod);

    const updated = enable
      ? [...new Set([...currentModules, mod])]
      : currentModules.filter(m => m !== mod);

    await base44.entities.Organisation.update(org.id, { modules: updated });
    await base44.entities.AuditLogEntry.create({
      organisation_id: org.id,
      action: enable ? 'module.enabled' : 'module.disabled',
      target_type: 'organisation',
      target_id: org.id,
      target_display: org.name,
      detail: JSON.stringify({ module: mod, modules_after: updated }),
    }).catch(() => {});

    setSaving(null);
    onModulesChanged?.();
  };

  return (
    <section className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold">Product Modules</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Enable the tools your organisation needs. Each module can be purchased independently.
        </p>
      </div>

      <div className="space-y-3">
        {Object.entries(MODULE_INFO).map(([key, info]) => {
          const enabled = isEnabled(key);
          const isSaving = saving === key;
          const Icon = info.icon;

          return (
            <div key={key} className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${
              enabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-background'
            }`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                enabled ? 'bg-primary/10' : 'bg-muted'
              }`}>
                <Icon className={`w-5 h-5 ${enabled ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{info.label}</p>
                  {info.alwaysOn && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                      <Lock className="w-3 h-3" /> Core
                    </span>
                  )}
                  {enabled && !info.alwaysOn && (
                    <span className="inline-flex items-center gap-1 text-xs text-rag-green-text bg-rag-green-light px-1.5 py-0.5 rounded-md">
                      <CheckCircle2 className="w-3 h-3" /> Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{info.description}</p>

                {key === 'brc_compliance' && !enabled && (
                  <p className="text-xs text-primary mt-1.5">
                    <Link to="/upgrade-brc" className="underline font-medium">View what's included →</Link>
                  </p>
                )}
              </div>

              <div className="shrink-0 flex items-center">
                {isSaving
                  ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  : <Switch
                      checked={enabled}
                      disabled={info.alwaysOn || !!saving}
                      onCheckedChange={(v) => handleToggle(key, v)}
                    />
                }
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground border-t border-border pt-3">
        Module changes take effect immediately for all users in your organisation.
        {' '}<Link to="/settings?tab=billing" className="text-primary underline">Manage subscription →</Link>
      </p>
    </section>
  );
}