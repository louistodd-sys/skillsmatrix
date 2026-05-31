import { useState, useEffect } from 'react';
import { ShieldCheck, TrendingUp, AlertTriangle, Clock, CheckCircle2, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import BrcModuleGuard from '@/components/BrcModuleGuard';
import useOrganisation from '@/lib/useOrganisation';
import { BRC_STANDARD_LABELS } from '@/lib/brcModuleGuard';
import ReadinessScoreRing from '@/components/brc/ReadinessScoreRing';
import UrgentItems from '@/components/brc/UrgentItems';
import TeamCertStatus from '@/components/brc/TeamCertStatus';
import SectionReadiness from '@/components/brc/SectionReadiness';
import AuditCountdown from '@/components/brc/AuditCountdown';
import { Button } from '@/components/ui/button';

function StatCard({ label, value, icon: Icon, colorClass, bgClass }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bgClass}`}>
        <Icon className={`w-5 h-5 ${colorClass}`} />
      </div>
      <div>
        <p className={`text-2xl font-bold font-jakarta ${colorClass}`}>{value}</p>
        <p className="text-xs text-muted-foreground font-medium mt-0.5 leading-tight">{label}</p>
      </div>
    </div>
  );
}

function BrcDashboardContent() {
  const { org, refreshOrg } = useOrganisation();
  const [clauses,     setClauses]     = useState([]);
  const [statuses,    setStatuses]    = useState([]);
  const [teams,       setTeams]       = useState([]);
  const [members,     setMembers]     = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [skills,      setSkills]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [recomputing, setRecomputing] = useState(false);

  const orgId  = org?.id;
  const score  = org?.brc_readiness_score || null;
  const overallPct = score?.overall_percent ?? 0;

  useEffect(() => {
    if (!orgId || !org?.brc_standard) { setLoading(false); return; }

    async function load() {
      setLoading(true);
      const [cls, sts, tms, mbs, ass, skl] = await Promise.all([
        base44.entities.BRCClause.filter({ standard: org.brc_standard }, 'display_order', 500),
        base44.entities.BRCClauseStatus.filter({ organisation_id: orgId }, '-updated_date', 500),
        base44.entities.Team.filter({ organisation_id: orgId }),
        base44.entities.TeamMember.filter({ organisation_id: orgId }),
        base44.entities.SkillAssessment.filter({ organisation_id: orgId }),
        base44.entities.Skill.filter({ organisation_id: orgId }),
      ]);
      setClauses(cls);
      setStatuses(sts);
      setTeams(tms);
      setMembers(mbs);
      setAssessments(ass);
      setSkills(skl);
      setLoading(false);
    }
    load();
  }, [orgId, org?.brc_standard]);

  const handleRecompute = async () => {
    setRecomputing(true);
    await base44.functions.invoke('recomputeReadinessScore', { organisation_id: orgId });
    await refreshOrg();
    setRecomputing(false);
  };

  const standardLabel = org?.brc_standard ? BRC_STANDARD_LABELS[org.brc_standard] || org.brc_standard : null;
  const scoreColor = overallPct >= 80 ? 'text-rag-green-text' : overallPct >= 50 ? 'text-rag-amber-text' : 'text-rag-red-text';
  const scoreBg    = overallPct >= 80 ? 'bg-rag-green-light' : overallPct >= 50 ? 'bg-rag-amber-light' : 'bg-rag-red-light';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-jakarta text-foreground flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            BRC Compliance Readiness
          </h1>
          {standardLabel
            ? <p className="text-sm text-muted-foreground mt-0.5">{standardLabel}</p>
            : <p className="text-sm text-amber-600 mt-0.5">
                No standard selected — <a href="/brc/settings" className="underline">configure in BRC Settings</a>.
              </p>
          }
        </div>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2 self-start"
          onClick={handleRecompute}
          disabled={recomputing || !orgId}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${recomputing ? 'animate-spin' : ''}`} />
          {recomputing ? 'Recomputing…' : 'Recompute Score'}
        </Button>
      </div>

      {/* Audit countdown banner */}
      <AuditCountdown org={org} />

      {/* KPI stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Overall Readiness"
          value={`${overallPct}%`}
          icon={TrendingUp}
          colorClass={scoreColor}
          bgClass={scoreBg}
        />
        <StatCard
          label="Clauses Not Started"
          value={score?.red_count   ?? '—'}
          icon={AlertTriangle}
          colorClass="text-rag-red-text"
          bgClass="bg-rag-red-light"
        />
        <StatCard
          label="Clauses In Progress"
          value={score?.amber_count ?? '—'}
          icon={Clock}
          colorClass="text-rag-amber-text"
          bgClass="bg-rag-amber-light"
        />
        <StatCard
          label="Clauses Ready"
          value={score?.green_count ?? '—'}
          icon={CheckCircle2}
          colorClass="text-rag-green-text"
          bgClass="bg-rag-green-light"
        />
      </div>

      {/* Score ring + section breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: overall score ring */}
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center justify-center gap-4">
          <ReadinessScoreRing pct={overallPct} size={130} />
          <div className="text-center">
            <p className="font-semibold text-foreground">Audit Readiness Score</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {score
                ? <>Computed from {(score.red_count||0)+(score.amber_count||0)+(score.green_count||0)} clauses. Last updated {new Date(score.computed_at).toLocaleDateString('en-GB')}.</>
                : <>No score yet. Begin mapping <a href="/brc/clauses" className="underline text-primary">clauses</a> to get started.</>
              }
            </p>
          </div>
        </div>

        {/* Right: section-level readiness */}
        <div className="lg:col-span-2">
          <SectionReadiness bySection={score?.by_section} />
        </div>
      </div>

      {/* Urgent items + team cert status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <UrgentItems
          clauses={clauses}
          statuses={statuses}
          auditTargetDate={org?.brc_audit_target_date}
        />
        <TeamCertStatus
          teams={teams}
          members={members}
          assessments={assessments}
          skills={skills}
        />
      </div>

      {!org?.brc_standard && !loading && (
        <div className="bg-rag-amber-light border border-rag-amber/30 rounded-xl p-5 text-sm text-rag-amber-text">
          <strong>Setup required:</strong> Configure your BRC standard in{' '}
          <a href="/brc/settings" className="underline font-medium">BRC Settings</a>{' '}
          to unlock clause mapping and readiness scoring.
        </div>
      )}
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