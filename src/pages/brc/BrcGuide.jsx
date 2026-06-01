import BrcModuleGuard from '@/components/BrcModuleGuard';
import { useState } from 'react';
import useOrganisation from '@/lib/useOrganisation';
import { BookOpen, CheckCircle2, Circle, ChevronDown, ChevronUp, Settings, Map, FileText, AlertTriangle, ClipboardCheck, ScrollText } from 'lucide-react';
import { Link } from 'react-router-dom';

const STEPS = [
  {
    num: 1,
    icon: Settings,
    title: 'Configure Your Standard & Audit Date',
    why: 'The app needs to know which BRCGS standard applies to your site so it can load the correct set of clauses to map against.',
    what: 'Go to BRC Settings and select your standard (e.g., BRCGS Packaging Issue 7). Also enter your target certification audit date — this will show a countdown on the dashboard.',
    href: '/brc/settings',
    cta: 'Go to BRC Settings',
    done: (org) => !!(org?.brc_standard && org?.brc_audit_target_date),
  },
  {
    num: 2,
    icon: Map,
    title: 'Map Each Clause to Your Current Status',
    why: 'Every BRC clause must be assessed against your site\'s compliance. This gives the auditor confidence that you have reviewed every requirement.',
    what: 'Open Clause Mapping and work through each section. For each clause, click it to open the detail view, read the evidence requirement, and set its status (Not Started → In Progress → Evidence Attached → Ready). Start with Section 1 and the ★ Fundamental clauses.',
    href: '/brc/clauses',
    cta: 'Open Clause Mapping',
    done: (org, data) => data?.notStartedCount === 0 && data?.totalClauses > 0,
  },
  {
    num: 3,
    icon: FileText,
    title: 'Attach Evidence to Every Clause',
    why: 'An auditor will ask "show me the evidence". Each clause needs at least one piece of evidence — a document, audit record, calibration certificate, training record, or other record from your registers.',
    what: 'On each clause detail page, click "Add Evidence" to link existing records from your BRC registers (Documents, Audits, Calibration, Suppliers, etc.). You can also link to clauses from within each register using the "Link to Clause" button on any record.',
    href: '/brc/clauses',
    cta: 'View Clause Mapping',
    done: (org, data) => data?.noEvidenceCount === 0 && data?.totalClauses > 0,
  },
  {
    num: 4,
    icon: AlertTriangle,
    title: 'Close All Gaps — Raise NCs & CAPAs',
    why: 'Any clause that has a known non-conformance must have a corresponding CAPA (Corrective & Preventive Action). Open NCs at audit time will be a major finding.',
    what: 'If you find a gap during clause mapping, raise a Non-Conformance (NC) and immediately create a CAPA against it. Track the CAPA to completion before the audit. Check the Action Centre to confirm no overdue CAPAs or NCs remain.',
    href: '/brc/action-centre',
    cta: 'Open Action Centre',
    done: (org, data) => data?.overdueCount === 0,
  },
  {
    num: 5,
    icon: ClipboardCheck,
    title: 'Run the Pre-Audit Checklist',
    why: 'This is your final internal review before the certifying body arrives. It confirms all fundamental clauses are green, your score is ≥ 80%, and no outstanding issues remain.',
    what: 'Open the Pre-Audit Checklist and review each section. All ★ Fundamental clauses must be marked Ready. Aim for a readiness score of ≥ 80%. Any clause not ready should either be addressed or have an active CAPA explaining the gap.',
    href: '/brc/audit-checklist',
    cta: 'Open Pre-Audit Checklist',
    done: (org) => (org?.brc_readiness_score?.overall_percent ?? 0) >= 80,
  },
  {
    num: 6,
    icon: ScrollText,
    title: 'Schedule & Complete an Internal Audit',
    why: 'An internal audit before the certification audit identifies any remaining gaps and demonstrates a working audit programme — itself a BRC requirement.',
    what: 'Go to Internal Audits and schedule a pre-certification internal audit. Assign a lead auditor, complete the audit, and record any findings as NCs. Resolve all findings before the certification date.',
    href: '/brc/audits',
    cta: 'Open Internal Audits',
    done: () => false,
  },
];

const GLOSSARY = [
  { term: 'Clause', def: 'A specific requirement in the BRC standard. Each clause must be complied with and evidenced during the audit.' },
  { term: 'Fundamental Clause', def: 'Clauses marked ★ that the certifying body inspects first. A major NC against a fundamental clause can result in immediate audit failure.' },
  { term: 'Evidence', def: 'Any document, record, or log that proves you comply with a clause. Examples: a written procedure, a calibration certificate, a training record, or an internal audit finding.' },
  { term: 'Non-Conformance (NC)', def: 'A failure to meet a BRC requirement. NCs are classified as Observation, Minor, Major, or Critical. Major NCs against fundamentals fail the audit.' },
  { term: 'CAPA', def: 'Corrective and Preventive Action. A formal plan to fix a non-conformance (corrective) and prevent recurrence (preventive). All NCs must have a CAPA.' },
  { term: 'Readiness Score', def: 'A percentage showing how many of your clauses are marked Ready. You should aim for ≥ 80% with all fundamentals green before inviting the auditor.' },
  { term: 'Evidence Link', def: 'A connection from a BRC record (document, audit finding, etc.) to the clause it provides evidence for. Use the Add Evidence button on any clause.' },
  { term: 'RAG Status', def: 'Red / Amber / Green — the traffic-light system used throughout the app. Red = not started, Amber = in progress, Green = ready.' },
];

const FAQS = [
  { q: 'What happens if a clause has no evidence?', a: 'The clause stays in "In Progress" or "Not Started" status and reduces your readiness score. At audit, the certifying body will ask to see evidence for every clause. If you can\'t provide it, it becomes a non-conformance finding. Always attach at least one piece of evidence before marking a clause Ready.' },
  { q: 'Do I need to fill in every register?', a: 'You need to populate the registers relevant to your standard and site. For example, if your standard requires pest control records, fill in the Pest Control Log. If you have measuring equipment, fill in the Calibration Register. Each register feeds evidence into clause mapping. Registers you don\'t use don\'t need to be populated.' },
  { q: 'What score do I need to pass?', a: 'The certification body sets their own pass criteria. As a general rule, aim for 80% or above with all ★ Fundamental clauses marked Ready and no major open NCs. The Pre-Audit Checklist in this app will show you a readiness gate that flags if you\'re below this threshold.' },
  { q: 'Can I link the same document to multiple clauses?', a: 'Yes. A procedure or policy often covers multiple clauses. Open each relevant clause and use Add Evidence to link the same document to all applicable clauses.' },
  { q: 'What if I find a gap during the checklist?', a: 'Use the "Raise NC" button on the clause row in the Pre-Audit Checklist. This creates a Non-Conformance record linked to that clause. Then create a CAPA to track the corrective action. Document what you\'ve done to close the gap before the audit.' },
];

function AccordionItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button className="w-full flex items-center justify-between py-3 text-left" onClick={() => setOpen(o => !o)}>
        <span className="text-sm font-medium text-foreground">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {open && <p className="text-sm text-muted-foreground pb-3 leading-relaxed">{a}</p>}
    </div>
  );
}

function BrcGuideContent() {
  const { org } = useOrganisation();

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold font-jakarta text-foreground flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-primary" /> BRC Audit Preparation Guide
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          A step-by-step walkthrough of how to use this app to prepare for your BRC certification audit. Work through the 6 stages in order — each stage builds on the last.
        </p>
      </div>

      {/* 6 Stages */}
      <div className="space-y-4">
        {STEPS.map((step) => {
          const Icon = step.icon;
          const isDone = step.done(org, {});
          return (
            <div key={step.num} className={`border rounded-xl overflow-hidden ${isDone ? 'border-green-200' : 'border-border'}`}>
              <div className={`flex items-start gap-4 p-5 ${isDone ? 'bg-green-50' : 'bg-card'}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isDone ? 'bg-green-500' : 'bg-primary/10'}`}>
                  {isDone
                    ? <CheckCircle2 className="w-5 h-5 text-white" />
                    : <Icon className="w-5 h-5 text-primary" />}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isDone ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                      Step {step.num}
                    </span>
                    <h2 className="text-sm font-semibold text-foreground">{step.title}</h2>
                    {isDone && <span className="text-xs text-green-600 font-medium">✓ Complete</span>}
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Why it matters</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.why}</p>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">What to do</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.what}</p>
                  </div>
                  {!isDone && (
                    <Link
                      to={step.href}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline mt-1"
                    >
                      {step.cta} →
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Terminology guide */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border bg-muted/30">
          <h2 className="text-sm font-semibold text-foreground">BRC Terminology Guide</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Plain-English definitions for terms used throughout this app.</p>
        </div>
        <div className="divide-y divide-border">
          {GLOSSARY.map(({ term, def }) => (
            <div key={term} className="px-5 py-3">
              <p className="text-sm font-semibold text-foreground">{term}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{def}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border bg-muted/30">
          <h2 className="text-sm font-semibold text-foreground">Common Questions</h2>
        </div>
        <div className="px-5">
          {FAQS.map((faq, i) => <AccordionItem key={i} {...faq} />)}
        </div>
      </div>
    </div>
  );
}

export default function BrcGuide() {
  return <BrcModuleGuard><BrcGuideContent /></BrcModuleGuard>;
}
