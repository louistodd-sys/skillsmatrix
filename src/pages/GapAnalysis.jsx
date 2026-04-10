import { useState, useEffect } from 'react';
import { BarChart3, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useOrganisation from '@/lib/useOrganisation';
import EmptyState from '@/components/EmptyState';
import RAGBar from '@/components/RAGBar';
import RAGBadge from '@/components/RAGBadge';
import { getRAGStatus } from '@/lib/ragUtils';
import { Link } from 'react-router-dom';

export default function GapAnalysis() {
  const { org, user } = useOrganisation();
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [members, setMembers] = useState([]);
  const [skills, setSkills] = useState([]);
  const [categories, setCategories] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [reqSkills, setReqSkills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (org) loadData();
  }, [org]);

  async function loadData() {
    const [t, tm, s, c, a, trs] = await Promise.all([
      base44.entities.Team.filter({ organisation_id: org.id }),
      base44.entities.TeamMember.filter({ organisation_id: org.id }),
      base44.entities.Skill.filter({ organisation_id: org.id, status: 'active' }),
      base44.entities.SkillCategory.filter({ organisation_id: org.id }),
      base44.entities.SkillAssessment.filter({ organisation_id: org.id }),
      base44.entities.TeamRequiredSkill.filter({ organisation_id: org.id }),
    ]);
    const visibleTeams = user?.role === 'admin' ? t : t.filter(team => team.manager_ids?.includes(user?.id));
    setTeams(visibleTeams);
    setMembers(tm);
    setSkills(s);
    setCategories(c);
    setAssessments(a);
    setReqSkills(trs);
    if (visibleTeams.length > 0) setSelectedTeam(visibleTeams[0].id);
    setLoading(false);
  }

  if (loading) return <div className="h-96 rounded-xl bg-muted animate-pulse" />;

  const currentAssessments = {};
  assessments.forEach(a => {
    const key = `${a.user_id}-${a.skill_id}`;
    if (!currentAssessments[key] || a.assessed_date > currentAssessments[key].assessed_date) {
      currentAssessments[key] = a;
    }
  });

  const teamMembers = members.filter(m => m.team_id === selectedTeam);
  const teamReqSkills = reqSkills.filter(r => r.team_id === selectedTeam && r.is_required);

  // Skill coverage
  const skillCoverage = teamReqSkills.map(req => {
    const skill = skills.find(s => s.id === req.skill_id);
    if (!skill) return null;
    let green = 0, amber = 0, red = 0, grey = 0;
    teamMembers.forEach(m => {
      const assessment = currentAssessments[`${m.user_id}-${req.skill_id}`];
      const status = getRAGStatus(assessment, skill, req);
      if (status === 'green') green++;
      else if (status === 'amber') amber++;
      else if (status === 'red') red++;
      else grey++;
    });
    return { skill, green, amber, red, grey, total: green + amber + red + grey, redPercent: (red + grey) / (green + amber + red + grey || 1) };
  }).filter(Boolean).sort((a, b) => b.redPercent - a.redPercent);

  // Individual compliance
  const individualStats = teamMembers.map(m => {
    let green = 0, amber = 0, red = 0, grey = 0;
    teamReqSkills.forEach(req => {
      const skill = skills.find(s => s.id === req.skill_id);
      const assessment = currentAssessments[`${m.user_id}-${req.skill_id}`];
      const status = getRAGStatus(assessment, skill, req);
      if (status === 'green') green++;
      else if (status === 'amber') amber++;
      else if (status === 'red') red++;
      else grey++;
    });
    const total = green + amber + red + grey;
    return { ...m, green, amber, red, grey, compliance: total > 0 ? Math.round((green / total) * 100) : 0, hasRed: red > 0 };
  }).sort((a, b) => a.compliance - b.compliance);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gap Analysis</h1>
          <p className="text-sm text-muted-foreground mt-1">Identify skills gaps and training needs</p>
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={selectedTeam}
          onChange={e => setSelectedTeam(e.target.value)}
        >
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {teamReqSkills.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No required skills set"
          description="Set required skills for this team to see gap analysis."
          actionLabel="Go to Teams"
          onAction={() => window.location.href = '/teams'}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Skill Coverage */}
          <div className="bg-card border border-border rounded-xl">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold">Skill Coverage</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Sorted by most critical first</p>
            </div>
            <div className="divide-y divide-border">
              {skillCoverage.map(item => (
                <div key={item.skill.id} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{item.skill.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.green}/{item.total} current
                    </span>
                  </div>
                  <RAGBar green={item.green} amber={item.amber} red={item.red} grey={item.grey} showLabels />
                </div>
              ))}
            </div>
          </div>

          {/* Individual Status */}
          <div className="bg-card border border-border rounded-xl">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold">Individual Status</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Team member compliance scores</p>
            </div>
            <div className="divide-y divide-border">
              {individualStats.map(m => (
                <Link key={m.user_id} to={`/users/${m.user_id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
                    {(m.user_name || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{m.user_name || 'Unknown'}</span>
                      {m.hasRed && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                    </div>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[10px] text-green-700">{m.green}✓</span>
                      <span className="text-[10px] text-amber-700">{m.amber}⚠</span>
                      <span className="text-[10px] text-red-700">{m.red + m.grey}✗</span>
                    </div>
                  </div>
                  <span className="text-sm font-bold">{m.compliance}%</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}