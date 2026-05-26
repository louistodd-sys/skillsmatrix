import BrcModuleGuard from '@/components/BrcModuleGuard';
import { Settings, Loader2, Save } from 'lucide-react';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import useOrganisation from '@/lib/useOrganisation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BRC_STANDARD_LABELS } from '@/lib/brcModuleGuard';

function BrcSettingsContent() {
  const { org, user, refreshOrg } = useOrganisation();
  const [form, setForm] = useState({ brc_standard: '', brc_audit_target_date: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

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
    </div>
  );
}

export default function BrcSettings() {
  return <BrcModuleGuard><BrcSettingsContent /></BrcModuleGuard>;
}