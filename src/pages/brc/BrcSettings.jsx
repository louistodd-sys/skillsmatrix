import BrcModuleGuard from '@/components/BrcModuleGuard';
import { Settings, Loader2, Save, Database, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import useOrganisation from '@/lib/useOrganisation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BRC_STANDARD_LABELS } from '@/lib/brcModuleGuard';

// Only standards with a seeded clause library are selectable — offering the
// others produced an empty module and a 0% score with no explanation.
const AVAILABLE_STANDARDS = new Set(['brcgs_packaging']);

function BrcSettingsContent() {
  const { org, user, refreshOrg } = useOrganisation();
  const [form, setForm] = useState({ brc_standard: '', brc_audit_target_date: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState(null);
  const [clauseCount, setClauseCount] = useState(null);
  const [loadingClauses, setLoadingClauses] = useState(false);
  const [clauseResult, setClauseResult] = useState(null);

  // How many clauses exist for the selected standard — drives the
  // "Load clause library" prompt below.
  useEffect(() => {
    const std = form.brc_standard;
    if (!std) { setClauseCount(null); return; }
    base44.entities.BRCClause.filter({ standard: std }, 'display_order', 500)
      .then(rows => setClauseCount(rows.length))
      .catch(() => setClauseCount(null));
  }, [form.brc_standard]);

  const handleLoadClauses = async () => {
    setLoadingClauses(true);
    setClauseResult(null);
    try {
      const res = await base44.functions.invoke('seedBrcClauses', { standard: form.brc_standard || 'brcgs_packaging' });
      setClauseResult(res.data);
      const rows = await base44.entities.BRCClause.filter({ standard: form.brc_standard || 'brcgs_packaging' }, 'display_order', 500);
      setClauseCount(rows.length);
    } catch {
      setClauseResult({ success: false, message: 'Failed to load the clause library — please try again.' });
    }
    setLoadingClauses(false);
  };

  useEffect(() => {
    if (org) {
      setForm({
        brc_standard:          org.brc_standard          || '',
        brc_audit_target_date: org.brc_audit_target_date || '',
      });
    }
  }, [org?.id]);

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.Organisation.update(org.id, {
      brc_standard:          form.brc_standard          || null,
      brc_audit_target_date: form.brc_audit_target_date || null,
    });
    await base44.entities.AuditLogEntry.create({
      organisation_id: org.id,
      actor_user_id:   user?.id,
      actor_display:   user?.full_name || user?.email,
      action:          'brc_settings.updated',
      target_type:     'organisation',
      target_id:       org.id,
      target_display:  org.name,
      detail: JSON.stringify(form),
    }).catch(() => {});
    await refreshOrg();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" /> BRC Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configure your BRC standard and target audit date.</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <Label>BRC Standard</Label>
          <select
            className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={form.brc_standard}
            onChange={e => setForm(f => ({ ...f, brc_standard: e.target.value }))}
          >
            <option value="">— Select standard —</option>
            {Object.entries(BRC_STANDARD_LABELS).map(([val, label]) => (
              <option key={val} value={val} disabled={!AVAILABLE_STANDARDS.has(val)}>
                {label}{AVAILABLE_STANDARDS.has(val) ? '' : ' (coming soon)'}
              </option>
            ))}
          </select>
        </div>

        {/* Clause library status for the selected standard */}
        {form.brc_standard && clauseCount === 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg text-sm bg-amber-50 border border-amber-200 text-amber-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="font-medium">No clause library loaded for this standard</p>
              <p className="text-xs mt-0.5">The clause mapping, checklist and readiness score need the standard's clauses. Load them once — this doesn't touch any of your own data.</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={handleLoadClauses} disabled={loadingClauses}>
                {loadingClauses ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Loading…</> : 'Load clause library'}
              </Button>
            </div>
          </div>
        )}
        {clauseResult && (
          <p className={`text-xs ${clauseResult.success === false ? 'text-red-600' : 'text-green-700'}`}>
            {clauseResult.message || (clauseResult.count ? `${clauseResult.count} clauses loaded.` : 'Clause library loaded.')}
          </p>
        )}

        <div>
          <Label>Target Audit Date</Label>
          <Input
            type="date"
            className="mt-1"
            value={form.brc_audit_target_date}
            onChange={e => setForm(f => ({ ...f, brc_audit_target_date: e.target.value }))}
          />
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving
            ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving…</>
            : saved
              ? '✓ Saved'
              : <><Save className="w-4 h-4 mr-1.5" /> Save BRC Settings</>
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