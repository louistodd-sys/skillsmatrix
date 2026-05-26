import BrcModuleGuard from '@/components/BrcModuleGuard';
import { ShieldCheck, TrendingUp, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import useOrganisation from '@/lib/useOrganisation';
import { BRC_STANDARD_LABELS } from '@/lib/brcModuleGuard';

function ScoreRing({ pct, color }) {
  const r = 40, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="butt" />
      <text x="50" y="56" textAnchor="middle" fontSize="18" fontWeight="700" fill={color}
        style={{ transform: 'rotate(90deg)', transformOrigin: '50px 50px' }}>{pct}%</text>
    </svg>
  );
}

function BrcDashboardContent() {
  const { org } = useOrganisation();
  const score = org?.brc_readiness_score || null;
  const overallPct = score?.overall_percent ?? 0;
  const scoreColor = overallPct >= 80 ? '#16a34a' : overallPct >= 50 ? '#d97706' : '#dc2626';
  const standardLabel = org?.brc_standard ? BRC_STANDARD_LABELS[org.brc_standard] || org.brc_standard : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" /> BRC Compliance Readiness
        </h1>
        {standardLabel && (
          <p className="text-sm text-muted-foreground mt-0.5">Standard: {standardLabel}</p>
        )}
        {!org?.brc_standard && (
          <p className="text-sm text-amber-600 mt-0.5">No standard selected — configure in <a href="/brc/settings" className="underline">BRC Settings</a>.</p>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Overall Readiness', value: `${overallPct}%`,         icon: TrendingUp,   color: scoreColor },
          { label: 'Clauses at Risk',   value: score?.red_count   ?? '—', icon: AlertTriangle, color: '#dc2626' },
          { label: 'In Progress',       value: score?.amber_count ?? '—', icon: Clock,         color: '#d97706' },
          { label: 'Ready',             value: score?.green_count ?? '—', icon: CheckCircle2,  color: '#16a34a' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Icon className="w-4.5 h-4.5" style={{ color }} />
            </div>
            <div>
              <p className="text-xl font-bold" style={{ color }}>{value}</p>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Readiness ring */}
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col sm:flex-row items-center gap-6">
        <ScoreRing pct={overallPct} color={scoreColor} />
        <div className="space-y-1">
          <p className="font-semibold text-foreground text-lg">Audit Readiness Score</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Score is computed from clause statuses, evidence freshness, and overdue items.
            {score?.computed_at && (
              <> Last updated {new Date(score.computed_at).toLocaleDateString('en-GB')}.</>
            )}
          </p>
          {!score && (
            <p className="text-xs text-muted-foreground/60 mt-2">
              Score will appear once you begin mapping clauses. Navigate to <a href="/brc/clauses" className="underline text-primary">Clauses</a> to get started.
            </p>
          )}
        </div>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Clause Mapping',         href: '/brc/clauses' },
          { label: 'Document Control',        href: '/brc/documents' },
          { label: 'Internal Audits',         href: '/brc/audits' },
          { label: 'Non-Conformances',        href: '/brc/non-conformances' },
          { label: 'Supplier Register',       href: '/brc/suppliers' },
          { label: 'Training Register',       href: '/brc/training' },
        ].map(({ label, href }) => (
          <a key={href} href={href} className="flex items-center justify-between px-4 py-3 rounded-xl bg-card border border-border hover:border-primary/40 hover:shadow-card-md transition-all group">
            <span className="text-sm font-medium text-foreground">{label}</span>
            <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity text-lg">→</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export default function BrcDashboard() {
  return (
    <BrcModuleGuard>
      <BrcDashboardContent />
    </BrcModuleGuard>
  );
}