import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, BookOpen, ClipboardCheck, AlertTriangle, TrendingUp, Clock,
  ChevronRight, CheckCircle2, Circle, X,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useOrganisation from '@/lib/useOrganisation';
import MetricCard from '@/components/MetricCard';
import RAGBar from '@/components/RAGBar';
import RAGBadge from '@/components/RAGBadge';
import EmptyState from '@/components/EmptyState';
import { getRAGStatus } from '@/lib/ragUtils';
import { parseISO, differenceInDays, startOfWeek, endOfWeek, endOfMonth, isAfter, isBefore, isWithinInterval } from 'date-fns';

// ─── Onboarding Checklist ──────────────────────────────────────────────────
function OnboardingChecklist({ org, assessmentCount, teamCount, skillCount, onDismiss }) {
  const items = [
    { label: 'Skills added to library',      done: skillCount > 0 },
    { label: 'First team created',            done: teamCount > 0 },
    { label: 'First assessment completed',    done: assessmentCount > 0 },
    { label: 'Required skills assigned to a team', done: false }, // simplified check
  ];
  const allDone = items.every(i => i.done);
  if (allDone) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-blue-900 mb-2">Getting started checklist</p>
          <ul className="space-y-1.5">
            {items.map(item => (
              <li key={item.label} className="flex items-center gap-2 text-sm">
                {item.done
                  ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  : <Circle className="w-4 h-4 text-blue-300 shrink-0" />}
                <span className={item.done ? 'text-muted-foreground line-through' : 'text-blue-900'}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <button onClick={onDismiss} className="text-blue-400 hover:text-blue-600 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Expiry bucket helpers ─────────────────────────────────────────────────
function bucketExpiries(expiries) {
  const today = new Date();
  const weekEnd   = endOfWeek(today, { weekStartsOn: 1 });
  const monthEnd  = endOfMonth(today);

  const thisWeek  = expiries.filter(e => e.daysLeft >= 0 && isBefore(parseISO(e.expiry_date), weekEnd));
  const thisMonth = expiries.filter(e => e.daysLeft >= 0 && !isBefore(parseISO(e.expiry_date), weekEnd) && isBefore(parseISO(e.expiry_date), monthEnd));
  const next30_60 = expiries.filter(e => e.daysLeft > 30 && e.daysLeft <= 60);
  const next60_90 = expiries.filter(e => e.daysLeft > 60 && e.daysLeft <= 90);

  return { thisWeek, thisMonth, next30_60, next60_90 };
}

function ExpiryBucket({ label, items, urgency }) {
  const [open, setOpen] = useState(true);
  if (items.length === 0) return null;
  const colors = {
    critical: 'text-red-700 bg-red-50 border-red-200',
    high:     'text-amber-700 bg-amber-50 border-amber-200',
    medium:   'text-amber-600 bg-amber-50/60 border-amber-100',
    low:      'text-blue-700 bg-blue-50 border-blue-100',
  };
  return (
    <div className={`rounded-lg border ${colors[urgency]} overflow-hidden`}>
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold"
        onClick={() => setOpen(o => !o)}
      >
        <span>{label} ({items.length})</span>
        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="divide-y divide-current/10 border-t border-current/20">
          {items.slice(0, 8).map((exp, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 bg-white/60">
              <div>
                <p className="text-sm font-medium text-foreground">{exp.user_name}</p>
                <p className="text-xs text-muted-foreground">{exp.skill_name} — {exp.team_name || ''}</p>
              </div>
              <span className="text-xs font-mono text-muted-foreground shrink-0 ml-2">
                {exp.daysLeft <= 0 ? 'EXPIRED' : `${exp.daysLeft}d`}
              </span>
            </div>
          ))}
          {items.length > 8 && (
            <p className="px-3 py-1.5 text-xs text-muted-foreground text-center bg-white/40">
              +{items.length - 8} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { org, user } = useOrganisation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checklistDismissed, setChecklistDismissed] = useState(
    () => localStorage.getItem(`checklist_dismissed_${org?.id}`) === 'true'
  );

  useEffect(() => {
    if (!org) return;
    loadData();
  }, [org]);

  async function loadData() {
    const isManager = user?.role === 'manager';

    const [allUsers, skills, assessments, teams, teamMembers, teamReqSkills] = await Promise.all([
      base44.entities.User.filter({ organisation_id: org.id }),
      base44.entities.Skill.filter({ organisation_id: org.id, status: 'active' }),
      base44.entities.SkillAssessment.filter({ organisation_id: org.id }),
      base44.entities.Team.filter({ organisation_id: org.id }),
      base44.entities.TeamMember.filter({ organisation_id: org.id }),
      base44.entities.TeamRequiredSkill.filter({ organisation_id: org.id }),
    ]);

    // Scope teams for managers
    const visibleTeams = isManager
      ? teams.filter(t => t.manager_ids?.includes(user.id))
      : teams;

    // Current assessment map
    const currentAssessments = {};
    [...assessments]
      .sort((a, b) => (a.assessed_date || '').localeCompare(b.assessed_date || ''))
      .forEach(a => { currentAssessments[`${a.user_id}-${a.skill_id}`] = a; });

    // Expiry analysis — scoped to visible teams
    const today = new Date();
    let expired = 0;
    const allUpcomingExpiries = [];
    const visibleTeamIds = new Set(visibleTeams.map(t => t.id));
    const teamById = Object.fromEntries(teams.map(t => [t.id, t]));

    Object.values(currentAssessments).forEach(a => {
      if (!a.expiry_date) return;
      // Scope to visible teams
      const memberTeams = teamMembers
        .filter(m => m.user_id === a.user_id && visibleTeamIds.has(m.team_id))
        .map(m => teamById[m.team_id]?.name)
        .filter(Boolean);
      if (!isManager || memberTeams.length > 0 || !isManager) {
        const expDate = parseISO(a.expiry_date);
        const daysLeft = differenceInDays(expDate, today);
        if (daysLeft < 0) expired++;
        else if (daysLeft <= 90) {
          allUpcomingExpiries.push({
            ...a,
            daysLeft,
            team_name: memberTeams[0] || '',
          });
        }
      }
    });
    allUpcomingExpiries.sort((a, b) => a.daysLeft - b.daysLeft);

    // Team compliance
    const teamStats = visibleTeams.map(team => {
      const members = teamMembers.filter(m => m.team_id === team.id);
      const reqSkills = teamReqSkills.filter(r => r.team_id === team.id && r.is_required);
      let green = 0, amber = 0, red = 0, grey = 0;
      members.forEach(member => {
        reqSkills.forEach(req => {
          const assessment = currentAssessments[`${member.user_id}-${req.skill_id}`];
          const skill = skills.find(s => s.id === req.skill_id);
          const status = getRAGStatus(assessment, skill, req);
          if (status === 'green') green++;
          else if (status === 'amber') amber++;
          else if (status === 'red') red++;
          else grey++;
        });
      });
      const total = green + amber + red + grey;
      return {
        ...team,
        memberCount: members.length,
        green, amber, red, grey,
        compliance: total > 0 ? Math.round((green / total) * 100) : 0,
      };
    });

    // Org-wide compliance (admin only)
    let totalRequired = 0, totalGreen = 0;
    if (!isManager) {
      teamReqSkills.filter(r => r.is_required).forEach(req => {
        const members = teamMembers.filter(m => m.team_id === req.team_id);
        members.forEach(member => {
          totalRequired++;
          const assessment = currentAssessments[`${member.user_id}-${req.skill_id}`];
          const skill = skills.find(s => s.id === req.skill_id);
          if (getRAGStatus(assessment, skill, req) === 'green') totalGreen++;
        });
      });
    }

    // Recent assessments (last 8, newest first)
    const recentAssessments = [...assessments]
      .sort((a, b) => (b.assessed_date || '').localeCompare(a.assessed_date || ''))
      .slice(0, 8);

    setData({
      userCount: allUsers.length,
      skillCount: skills.length,
      assessmentCount: assessments.length,
      teamCount: teams.length,
      compliancePercent: totalRequired > 0 ? Math.round((totalGreen / totalRequired) * 100) : 0,
      expired,
      expiringIn30: allUpcomingExpiries.filter(e => e.daysLeft <= 30).length,
      teamStats,
      expiries: allUpcomingExpiries,
      recentAssessments,
    });
    setLoading(false);
  }

  const handleDismissChecklist = () => {
    localStorage.setItem(`checklist_dismissed_${org?.id}`, 'true');
    setChecklistDismissed(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="Welcome to SkillsMatrix"
        description="Set up your organisation to get started."
        actionLabel="Set Up Organisation"
        onAction={() => window.location.href = '/onboarding'}
      />
    );
  }

  const expiryBuckets = bucketExpiries(data.expiries);
  const hasExpiries = data.expiries.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {user?.role === 'manager' ? 'Your team overview' : `${org.name} skills compliance`}
        </p>
      </div>

      {/* Onboarding checklist */}
      {!checklistDismissed && !org.onboarding_completed && (
        <OnboardingChecklist
          org={org}
          skillCount={data.skillCount}
          teamCount={data.teamCount}
          assessmentCount={data.assessmentCount}
          onDismiss={handleDismissChecklist}
        />
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard icon={Users}         label="Active Users"      value={data.userCount} />
        <MetricCard icon={BookOpen}      label="Skills"            value={data.skillCount} />
        <MetricCard icon={ClipboardCheck} label="Assessments"      value={data.assessmentCount} />
        {user?.role === 'admin' && (
          <MetricCard icon={TrendingUp}  label="Compliance"        value={`${data.compliancePercent}%`} subtext="required skills current" />
        )}
        <MetricCard
          icon={AlertTriangle}
          label="Expired"
          value={data.expired}
          className={data.expired > 0 ? 'border-red-200 bg-red-50/40' : ''}
        />
        <MetricCard
          icon={Clock}
          label="Expiring ≤30d"
          value={data.expiringIn30}
          className={data.expiringIn30 > 0 ? 'border-amber-200 bg-amber-50/40' : ''}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Health */}
        <div className="bg-card border border-border rounded-xl">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-base font-semibold">Team Health</h2>
            <Link to="/teams" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {data.teamStats.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground text-center">No teams yet</p>
            ) : (
              data.teamStats.map(team => (
                <Link
                  key={team.id}
                  to={`/teams/${team.id}`}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{team.name}</p>
                    <p className="text-xs text-muted-foreground">{team.memberCount} members</p>
                  </div>
                  <div className="w-28 hidden sm:block">
                    <RAGBar green={team.green} amber={team.amber} red={team.red} grey={team.grey} showLabels />
                  </div>
                  <span className="text-sm font-bold w-10 text-right shrink-0">{team.compliance}%</span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Expiry Timeline */}
        <div className="bg-card border border-border rounded-xl">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-base font-semibold">Expiry Timeline</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Skills expiring in the next 90 days</p>
          </div>
          <div className="p-4 space-y-2">
            {!hasExpiries ? (
              <p className="text-sm text-muted-foreground text-center py-4">No upcoming expiries</p>
            ) : (
              <>
                <ExpiryBucket label="This week"    items={expiryBuckets.thisWeek}  urgency="critical" />
                <ExpiryBucket label="This month"   items={expiryBuckets.thisMonth} urgency="high" />
                <ExpiryBucket label="30 – 60 days" items={expiryBuckets.next30_60} urgency="medium" />
                <ExpiryBucket label="60 – 90 days" items={expiryBuckets.next60_90} urgency="low" />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {data.recentAssessments.length > 0 && (
        <div className="bg-card border border-border rounded-xl">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-base font-semibold">Recent Activity</h2>
          </div>
          <div className="divide-y divide-border">
            {data.recentAssessments.map((a, i) => (
              <div key={i} className="px-5 py-3 text-sm">
                <span className="font-medium">{a.assessed_by_name || 'System'}</span>
                <span className="text-muted-foreground"> assessed </span>
                <span className="font-medium">{a.user_name}</span>
                <span className="text-muted-foreground"> on </span>
                <span className="font-medium">{a.skill_name}</span>
                <span className="text-muted-foreground"> — {a.assessed_date}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}