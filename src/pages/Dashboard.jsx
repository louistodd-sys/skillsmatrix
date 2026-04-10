import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, BookOpen, ClipboardCheck, AlertTriangle, TrendingUp, Clock, ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useOrganisation from '@/lib/useOrganisation';
import MetricCard from '@/components/MetricCard';
import RAGBar from '@/components/RAGBar';
import RAGBadge from '@/components/RAGBadge';
import EmptyState from '@/components/EmptyState';
import { getRAGStatus } from '@/lib/ragUtils';
import { parseISO, differenceInDays } from 'date-fns';

export default function Dashboard() {
  const { org, user } = useOrganisation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org) return;
    loadData();
  }, [org]);

  async function loadData() {
    const [users, skills, assessments, teams, teamMembers, teamReqSkills] = await Promise.all([
      base44.entities.User.filter({ organisation_id: org.id }),
      base44.entities.Skill.filter({ organisation_id: org.id, status: 'active' }),
      base44.entities.SkillAssessment.filter({ organisation_id: org.id }),
      base44.entities.Team.filter({ organisation_id: org.id }),
      base44.entities.TeamMember.filter({ organisation_id: org.id }),
      base44.entities.TeamRequiredSkill.filter({ organisation_id: org.id }),
    ]);

    // Build current assessment map (latest per user+skill)
    const currentAssessments = {};
    assessments.sort((a, b) => a.assessed_date?.localeCompare(b.assessed_date));
    assessments.forEach(a => {
      currentAssessments[`${a.user_id}-${a.skill_id}`] = a;
    });

    // Calculate expiries
    const today = new Date();
    let expired = 0;
    let expiringIn30 = 0;
    const upcomingExpiries = [];

    Object.values(currentAssessments).forEach(a => {
      if (!a.expiry_date) return;
      const expDate = parseISO(a.expiry_date);
      const daysLeft = differenceInDays(expDate, today);
      if (daysLeft < 0) expired++;
      else if (daysLeft <= 30) {
        expiringIn30++;
        upcomingExpiries.push({ ...a, daysLeft });
      }
    });

    upcomingExpiries.sort((a, b) => a.daysLeft - b.daysLeft);

    // Team compliance
    const teamStats = teams.map(team => {
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

    // Required skill compliance
    const reqSkillIds = new Set(teamReqSkills.filter(r => r.is_required).map(r => r.skill_id));
    let totalRequired = 0;
    let totalGreen = 0;
    teamReqSkills.filter(r => r.is_required).forEach(req => {
      const members = teamMembers.filter(m => m.team_id === req.team_id);
      members.forEach(member => {
        totalRequired++;
        const assessment = currentAssessments[`${member.user_id}-${req.skill_id}`];
        const skill = skills.find(s => s.id === req.skill_id);
        const status = getRAGStatus(assessment, skill, req);
        if (status === 'green') totalGreen++;
      });
    });

    // Recent assessments
    const recentAssessments = assessments.slice(-10).reverse();

    setData({
      userCount: users.filter(u => u.status === 'active').length,
      skillCount: skills.length,
      assessmentCount: assessments.length,
      compliancePercent: totalRequired > 0 ? Math.round((totalGreen / totalRequired) * 100) : 0,
      expired,
      expiringIn30,
      teamStats,
      upcomingExpiries: upcomingExpiries.slice(0, 10),
      recentAssessments: recentAssessments.slice(0, 8),
    });
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of {org.name}'s skills compliance</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard icon={Users} label="Active Users" value={data.userCount} />
        <MetricCard icon={BookOpen} label="Skills Tracked" value={data.skillCount} />
        <MetricCard icon={ClipboardCheck} label="Assessments" value={data.assessmentCount} />
        <MetricCard icon={TrendingUp} label="Compliance" value={`${data.compliancePercent}%`} subtext="of required skills current" />
        <MetricCard icon={AlertTriangle} label="Expired Skills" value={data.expired} />
        <MetricCard icon={Clock} label="Expiring in 30 Days" value={data.expiringIn30} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Health */}
        <div className="bg-card border border-border rounded-xl">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-base font-semibold">Team Health</h2>
            <Link to="/teams" className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {data.teamStats.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground text-center">No teams yet</p>
            ) : (
              data.teamStats.map(team => (
                <Link key={team.id} to={`/teams/${team.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{team.name}</p>
                    <p className="text-xs text-muted-foreground">{team.memberCount} members</p>
                  </div>
                  <div className="w-32">
                    <RAGBar green={team.green} amber={team.amber} red={team.red} grey={team.grey} showLabels />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Expiries */}
        <div className="bg-card border border-border rounded-xl">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-base font-semibold">Upcoming Expiries</h2>
          </div>
          <div className="divide-y divide-border">
            {data.upcomingExpiries.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground text-center">No upcoming expiries</p>
            ) : (
              data.upcomingExpiries.map((exp, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{exp.user_name}</p>
                    <p className="text-xs text-muted-foreground">{exp.skill_name}</p>
                  </div>
                  <RAGBadge status={exp.daysLeft <= 0 ? 'red' : 'amber'} label={`${exp.daysLeft}d`} />
                </div>
              ))
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