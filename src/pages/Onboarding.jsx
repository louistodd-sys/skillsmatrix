import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, BookOpen, Users, Send, Check, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useOrganisation from '@/lib/useOrganisation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { industryTemplates } from '@/lib/industryTemplates';

const steps = [
  { icon: Building2, label: 'Organisation' },
  { icon: BookOpen, label: 'Skills' },
  { icon: Users, label: 'Team' },
  { icon: Send, label: 'Invite' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, refreshUser, refreshOrg } = useOrganisation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [orgName, setOrgName] = useState('');
  const [timezone, setTimezone] = useState('Europe/London');

  // Step 2
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // Step 3
  const [teamName, setTeamName] = useState('');

  // Step 4
  const [inviteEmails, setInviteEmails] = useState('');

  // State
  const [orgId, setOrgId] = useState(null);

  const handleStep1 = async () => {
    if (!orgName.trim()) return;
    setLoading(true);
    const newOrg = await base44.entities.Organisation.create({
      name: orgName.trim(),
      slug: orgName.trim().toLowerCase().replace(/[^a-z0-9]/g, '-'),
      timezone,
      onboarding_step: 2,
    });
    setOrgId(newOrg.id);
    await base44.auth.updateMe({ organisation_id: newOrg.id, role: 'admin', status: 'active' });
    await refreshUser();
    setLoading(false);
    setStep(2);
  };

  const handleStep2 = async () => {
    if (!orgId) return;
    setLoading(true);
    if (selectedTemplate) {
      const template = industryTemplates.find(t => t.id === selectedTemplate);
      for (const cat of template.categories) {
        const newCat = await base44.entities.SkillCategory.create({
          organisation_id: orgId,
          name: cat.name,
          colour: cat.colour,
        });
        await base44.entities.Skill.bulkCreate(
          cat.skills.map(s => ({
            organisation_id: orgId,
            category_id: newCat.id,
            name: s.name,
            scale_type: s.scale_type,
            requires_expiry: s.requires_expiry,
            expiry_warning_days: [30, 60, 90],
            status: 'active',
          }))
        );
      }
    }
    await base44.entities.Organisation.update(orgId, { onboarding_step: 3 });
    setLoading(false);
    setStep(3);
  };

  const handleStep3 = async () => {
    if (!orgId) return;
    setLoading(true);
    if (teamName.trim()) {
      await base44.entities.Team.create({
        organisation_id: orgId,
        name: teamName.trim(),
        manager_ids: [user?.id],
      });
    }
    await base44.entities.Organisation.update(orgId, { onboarding_step: 4 });
    setLoading(false);
    setStep(4);
  };

  const handleStep4 = async () => {
    setLoading(true);
    if (inviteEmails.trim()) {
      const emails = inviteEmails.split(/[,\n]/).map(e => e.trim()).filter(Boolean);
      for (const email of emails) {
        await base44.entities.Invitation.create({
          organisation_id: orgId,
          email,
          role: 'viewer',
          invited_by_user_id: user?.id,
          invited_by_name: user?.full_name,
          status: 'pending',
        });
        await base44.users.inviteUser(email, 'user');
      }
    }
    await base44.entities.Organisation.update(orgId, { onboarding_completed: true, onboarding_step: 5 });
    await refreshOrg();
    setLoading(false);
    navigate('/');
  };

  const timezones = ['Europe/London', 'Europe/Dublin', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome', 'US/Eastern', 'US/Central', 'US/Pacific'];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {step > i + 1 ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className="text-xs text-muted-foreground hidden sm:block">{s.label}</span>
              {i < 3 && <div className={`w-8 h-0.5 ${step > i + 1 ? 'bg-green-500' : 'bg-border'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-sm p-6 sm:p-8">
          {/* Step 1: Organisation */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Set up your organisation</h2>
                <p className="text-sm text-muted-foreground mt-1">Tell us about your company to get started</p>
              </div>
              <div>
                <Label>Organisation Name <span className="text-destructive">*</span></Label>
                <Input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="e.g. Acme Engineering Ltd" className="mt-1" />
              </div>
              <div>
                <Label>Timezone</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm mt-1" value={timezone} onChange={e => setTimezone(e.target.value)}>
                  {timezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
              <Button className="w-full" onClick={handleStep1} disabled={loading || !orgName.trim()}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4 ml-1" /></>}
              </Button>
            </div>
          )}

          {/* Step 2: Skills */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Add your skills</h2>
                <p className="text-sm text-muted-foreground mt-1">Choose an industry template or add skills manually later</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {industryTemplates.map(t => (
                  <button
                    key={t.id}
                    className={`text-left p-3 rounded-lg border-2 transition-all ${selectedTemplate === t.id ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'}`}
                    onClick={() => setSelectedTemplate(selectedTemplate === t.id ? null : t.id)}
                  >
                    <span className="text-lg mr-2">{t.icon}</span>
                    <span className="text-sm font-medium">{t.name}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
                <Button className="flex-1" onClick={handleStep2} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : selectedTemplate ? <>Import & Continue <ArrowRight className="w-4 h-4 ml-1" /></> : <>Skip for now <ArrowRight className="w-4 h-4 ml-1" /></>}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Team */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Create your first team</h2>
                <p className="text-sm text-muted-foreground mt-1">Teams help you organise your workforce</p>
              </div>
              <div>
                <Label>Team Name</Label>
                <Input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="e.g. Production, Maintenance, Sales" className="mt-1" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
                <Button className="flex-1" onClick={handleStep3} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : teamName.trim() ? <>Create & Continue <ArrowRight className="w-4 h-4 ml-1" /></> : <>Skip <ArrowRight className="w-4 h-4 ml-1" /></>}
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Invite */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Send className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Invite your team</h2>
                <p className="text-sm text-muted-foreground mt-1">Add email addresses of people you'd like to invite</p>
              </div>
              <div>
                <Label>Email Addresses</Label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none"
                  rows={4}
                  value={inviteEmails}
                  onChange={e => setInviteEmails(e.target.value)}
                  placeholder="Enter emails, one per line or comma-separated"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
                <Button className="flex-1" onClick={handleStep4} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : inviteEmails.trim() ? <>Send Invites & Finish</> : <>Finish Setup</>}
                </Button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          You can always change these settings later.
        </p>
      </div>
    </div>
  );
}