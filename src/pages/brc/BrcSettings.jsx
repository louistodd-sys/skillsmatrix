import BrcModuleGuard from '@/components/BrcModuleGuard';
import { Settings, Loader2, Save, Database, CheckCircle2, AlertTriangle, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import useOrganisation from '@/lib/useOrganisation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { STANDARDS } from '@/lib/standardsRegistry';

const FAMILY_LABELS = {
  iso: 'ISO management standards',
  brcgs: 'BRCGS food & packaging standards',
};

function BrcSettingsContent() {
  const { org, user, refreshOrg } = useOrganisation();
  const [enabled, setEnabled] = useState([]);          // standards the org works to
  const [active, setActive] = useState('');            // standard shown in clause views
  const [targetDate, setTargetDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState(null);
  const [clauseCounts, setClauseCounts] = useState({}); // standard → count
  const [loadingClauses, setLoadingClauses] = useState(null);
  const [clauseResult, setClauseResult] = useState(null);

  useEffect(() => {
    if (!org) return;
    const en = (Array.isArray(org.compliance_standards) && org.compliance_standards.length > 0)
      ? org.compliance_standards
      : (org.brc_standard ? [org.brc_standard] : []);
    setEnabled(en);
    setActive(org.brc_standard || en[0] || '');
    setTargetDate(org.brc_audit_target_date || '');
  }, [org?.id]);

  // Clause library status for every enabled standard
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const counts = {};
      for (const std of enabled) {
        try {
          const rows = await base44.entities.BRCClause.filter({ standard: std }, 'display_order', 1000);
          counts[std] = rows.length;
        } catch { counts[std] = null; }
      }
      if (!cancelled) setClauseCounts(counts);
    })();
    return () => { cancelled = true; };
  }, [enabled.join(',')]);

  const toggleStandard = (key) => {
    setEnabled(prev => {
      const next = prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key];
      // Keep the active standard valid
      if (!next.includes(active)) setActive(next[0] || '');
      return next;
    });
  };

  const handleLoadClauses = async (std) => {
    setLoadingClauses(std);
    setClauseResult(null);
    try {
      const res = await base44.functions.invoke('seedBrcClauses', { standard: std });
      setClauseResult(res.data);
      const rows = await base44.entities.BRCClause.filter({ standard: std }, 'display_order', 1000);
      setClauseCounts(c => ({ ...c, [std]: rows.length }));
    } catch {
      setClauseResult({ success: false, message: 'Failed to load the clause library — please try again.' });
    }
    setLoadingClauses(null);
  };

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.Organisation.update(org.id, {
      compliance_standards:  enabled,
      brc_standard:          active || null,
      brc_audit_target_date: targetDate || null,
    });
    await base44.entities.AuditLogEntry.create({
      organisation_id: org.id,
      actor_user_id:   user?.id,
      actor_display:   user?.full_name || user?.email,
      action:          'brc_settings.updated',
      target_type:     'organisation',
      target_id:       org.id,
      target_display:  org.name,
      detail: JSON.stringify({ compliance_standards: enabled, active_standard: active, target_date: targetDate }),
    }).catch(() => {});
    await refreshOrg();
    // Keep per-standard readiness scores in step with the new selection
    base44.functions.invoke('recomputeReadinessScore', {}).catch(() => {});
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const families = ['iso', 'brcgs'];

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" /> Compliance Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Choose the standards your organisation is audited against — you can run several side by side.</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-5">
        {/* Standard selection, grouped by family */}
        {families.map(family => (
          <div key={family}>
            <Label>{FAMILY_LABELS[family]}</Label>
            <div className="mt-2 space-y-1.5">
              {Object.entries(STANDARDS).filter(([, s]) => s.family === family).map(([key, std]) => (
                <label
                  key={key}
                  className={`flex items-center gap-3 py-1.5 ${std.available ? 'cursor-pointer group' : 'opacity-50 cursor-not-allowed'}`}
                  onClick={() => std.available && toggleStandard(key)}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${enabled.includes(key) ? 'bg-primary border-primary' : 'border-border group-hover:border-muted-foreground'}`}>
                    {enabled.includes(key) && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <span className="text-sm text-foreground">
                    {std.label} <span className="text-xs text-muted-foreground">({std.edition}{std.available ? '' : ' — coming soon'})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}

        {/* Active standard for clause views */}
        {enabled.length > 1 && (
          <div>
            <Label>Standard shown in clause views</Label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-1">Clause mapping, the checklist and the readiness dashboard focus on one standard at a time — switchable from those pages too.</p>
            <select
              className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={active}
              onChange={e => setActive(e.target.value)}
            >
              {enabled.map(key => (
                <option key={key} value={key}>{STANDARDS[key]?.label || key}</option>
              ))}
            </select>
          </div>
        )}

        {/* Clause library status per enabled standard */}
        {enabled.filter(std => clauseCounts[std] === 0).map(std => (
          <div key={std} className="flex items-start gap-2 p-3 rounded-lg text-sm bg-amber-50 border border-amber-200 text-amber-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="font-medium">No clause library loaded for {STANDARDS[std]?.short || std}</p>
              <p className="text-xs mt-0.5">The clause mapping, checklist and readiness score need the standard's clauses. Load them once — this doesn't touch any of your own data.</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => handleLoadClauses(std)} disabled={!!loadingClauses}>
                {loadingClauses === std ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Loading…</> : `Load ${STANDARDS[std]?.short || std} clauses`}
              </Button>
            </div>
          </div>
        ))}
        {clauseResult && (
          <p className={`text-xs ${clauseResult.success === false ? 'text-red-600' : 'text-green-700'}`}>
            {clauseResult.message || (clauseResult.seeded ? `${clauseResult.seeded} clauses loaded.` : 'Clause library loaded.')}
          </p>
        )}

        <div>
          <Label>Target Audit Date</Label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-1">Your next external audit — drives the countdown and journey stages.</p>
          <Input
            type="date"
            className="mt-1"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
          />
        </div>

        <Button onClick={handleSave} disabled={saving || enabled.length === 0}>
          {saving
            ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving…</>
            : saved
              ? '✓ Saved'
              : <><Save className="w-4 h-4 mr-1.5" /> Save Compliance Settings</>
          }
        </Button>
      </div>

      {/* Demo Data Seeding */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" /> Seed Demo Data
        </h2>
        <p className="text-sm text-muted-foreground">
          Populate the system with realistic BRC compliance data — documents, clause statuses, and evidence links.
          This is useful for onboarding and demonstration. Existing data will be replaced if you choose to re-seed.
        </p>

        {seedResult && (
          <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${seedResult.success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
            {seedResult.success
              ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-green-600" />
              : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />}
            <div>
              <p className="font-medium">{seedResult.success ? 'Demo data seeded!' : 'Seeding failed'}</p>
              {seedResult.success && (
                <p className="text-xs text-green-700 mt-0.5">
                  {seedResult.documents_created} documents · {seedResult.statuses_created} clause statuses · {seedResult.evidence_links_created} evidence links
                </p>
              )}
              {!seedResult.success && <p className="text-xs mt-0.5">{seedResult.error}</p>}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={seeding}
            onClick={async () => {
              setSeeding(true);
              setSeedResult(null);
              const res = await base44.functions.invoke('seedBrcDemoData', {});
              setSeedResult(res.data);
              setSeeding(false);
            }}
          >
            {seeding ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Seeding…</> : <><Database className="w-3.5 h-3.5 mr-1.5" /> Seed Demo Data</>}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={seeding}
            onClick={async () => {
              if (!confirm('This will delete and replace all existing BRC documents and clause statuses. Continue?')) return;
              setSeeding(true);
              setSeedResult(null);
              const res = await base44.functions.invoke('seedBrcDemoData', { force: true });
              setSeedResult(res.data);
              setSeeding(false);
            }}
          >
            Re-seed (Replace All)
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function BrcSettings() {
  return <BrcModuleGuard><BrcSettingsContent /></BrcModuleGuard>;
}