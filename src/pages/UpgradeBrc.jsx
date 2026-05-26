import { Link } from 'react-router-dom';
import { ShieldCheck, FileText, ClipboardList, AlertTriangle, Truck, Wrench, Users2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FEATURES = [
  { icon: ShieldCheck,   label: 'Audit-readiness dashboard',         desc: 'Real-time RAG status across all BRC clauses.' },
  { icon: FileText,      label: 'Document control register',          desc: 'Version-controlled procedures, policies, and forms.' },
  { icon: ClipboardList, label: 'Internal audit scheduling',          desc: 'Plan, conduct, and record internal audits.' },
  { icon: AlertTriangle, label: 'Non-conformance & CAPA workflow',    desc: 'Track NCs from detection to close-out.' },
  { icon: Truck,         label: 'Supplier approval register',         desc: 'Manage and evidence supplier approvals.' },
  { icon: Wrench,        label: 'Equipment calibration register',     desc: 'Track calibration records and due dates.' },
  { icon: Users2,        label: 'Training & competence register',     desc: 'BRC-aligned training records linked to clauses.' },
];

export default function UpgradeBrc() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-2xl w-full space-y-10">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-widest mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            BRC Compliance Readiness
          </div>
          <h1 className="text-3xl font-bold text-foreground font-jakarta">
            Upgrade to unlock BRC Compliance Readiness
          </h1>
          <p className="text-base text-muted-foreground max-w-lg mx-auto">
            A fully integrated compliance module built for food, packaging, and consumer products manufacturers working towards BRCGS certification.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid sm:grid-cols-2 gap-3">
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border shadow-card">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* What's included */}
        <div className="bg-primary/5 border border-primary/15 rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">All plans include:</p>
          <ul className="space-y-2">
            {[
              'Full BRCGS clause mapping for your chosen standard',
              'Evidence linking between clauses and records',
              'Audit-trail for every state change',
              'Shared user, team, and notification infrastructure',
            ].map(item => (
              <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg" className="gap-2">
            <Link to="/settings?tab=billing">
              View Pricing &amp; Upgrade
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}