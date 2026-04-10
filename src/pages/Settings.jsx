import { useState, useEffect } from 'react';
import { Save, Trash2, Download, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useOrganisation from '@/lib/useOrganisation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export default function Settings() {
  const { org, refreshOrg } = useOrganisation();
  const [form, setForm] = useState({
    name: '',
    timezone: 'Europe/London',
    notify_users_on_expiry: false,
    weekly_digest_enabled: true,
  });
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (org) {
      setForm({
        name: org.name || '',
        timezone: org.timezone || 'Europe/London',
        notify_users_on_expiry: org.notify_users_on_expiry || false,
        weekly_digest_enabled: org.weekly_digest_enabled !== false,
      });
    }
  }, [org]);

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.Organisation.update(org.id, form);
    await refreshOrg();
    setSaving(false);
  };

  const handleExport = async () => {
    setExporting(true);
    const [users, teams, skills, assessments, categories, teamMembers] = await Promise.all([
      base44.entities.User.filter({ organisation_id: org.id }),
      base44.entities.Team.filter({ organisation_id: org.id }),
      base44.entities.Skill.filter({ organisation_id: org.id }),
      base44.entities.SkillAssessment.filter({ organisation_id: org.id }),
      base44.entities.SkillCategory.filter({ organisation_id: org.id }),
      base44.entities.TeamMember.filter({ organisation_id: org.id }),
    ]);

    const csvFiles = {
      'users.csv': [['Name', 'Email', 'Role', 'Status'], ...users.map(u => [u.full_name, u.email, u.role, u.status || 'active'])],
      'teams.csv': [['Name', 'Description'], ...teams.map(t => [t.name, t.description || ''])],
      'skills.csv': [['Name', 'Category', 'Scale', 'Requires Expiry', 'Status'], ...skills.map(s => {
        const cat = categories.find(c => c.id === s.category_id);
        return [s.name, cat?.name || '', s.scale_type, s.requires_expiry, s.status];
      })],
      'assessments.csv': [['User', 'Skill', 'Proficiency', 'Assessed Date', 'Expiry Date', 'Assessed By'], ...assessments.map(a => [a.user_name, a.skill_name, a.proficiency_level, a.assessed_date, a.expiry_date || '', a.assessed_by_name || ''])],
    };

    // Download each CSV
    Object.entries(csvFiles).forEach(([filename, rows]) => {
      const csv = rows.map(r => r.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    });

    setExporting(false);
  };

  if (!org) return null;

  const timezones = ['Europe/London', 'Europe/Dublin', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome', 'Europe/Amsterdam', 'Europe/Brussels', 'Europe/Warsaw', 'Europe/Prague', 'US/Eastern', 'US/Central', 'US/Pacific'];

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your organisation settings</p>
      </div>

      {/* Organisation Settings */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-base font-semibold">Organisation</h2>
        <div>
          <Label>Organisation Name</Label>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1" />
        </div>
        <div>
          <Label>Timezone</Label>
          <select
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm mt-1"
            value={form.timezone}
            onChange={e => setForm({ ...form, timezone: e.target.value })}
          >
            {timezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving...</> : <><Save className="w-4 h-4 mr-1.5" /> Save Changes</>}
        </Button>
      </section>

      {/* Notification Settings */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-base font-semibold">Notifications</h2>
        <div className="flex items-center justify-between">
          <div>
            <Label>Notify Users on Skill Expiry</Label>
            <p className="text-xs text-muted-foreground">Send expiry warnings directly to the user</p>
          </div>
          <Switch checked={form.notify_users_on_expiry} onCheckedChange={v => setForm({ ...form, notify_users_on_expiry: v })} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label>Weekly Expiry Digest</Label>
            <p className="text-xs text-muted-foreground">Send a weekly summary of expiring skills</p>
          </div>
          <Switch checked={form.weekly_digest_enabled} onCheckedChange={v => setForm({ ...form, weekly_digest_enabled: v })} />
        </div>
      </section>

      {/* Data Export */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-base font-semibold">Data Export</h2>
        <p className="text-sm text-muted-foreground">Download all organisation data as CSV files for auditing or backup.</p>
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          {exporting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Exporting...</> : <><Download className="w-4 h-4 mr-1.5" /> Export All Data</>}
        </Button>
      </section>

      {/* Danger Zone */}
      <section className="bg-card border border-destructive/30 rounded-xl p-5 space-y-4">
        <h2 className="text-base font-semibold text-destructive">Danger Zone</h2>
        <p className="text-sm text-muted-foreground">Permanently delete this organisation and all associated data. This action cannot be undone.</p>
        <Button variant="destructive" onClick={() => alert('Please contact support to delete your organisation.')}>
          <Trash2 className="w-4 h-4 mr-1.5" /> Delete Organisation
        </Button>
      </section>
    </div>
  );
}