import { useState, useEffect } from 'react';
import { BookOpen, Download } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useOrganisation from '@/lib/useOrganisation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import RAGBadge from '@/components/RAGBadge';
import { getRAGStatus, getProficiencyLabel } from '@/lib/ragUtils';

export default function MyProfile() {
  const { org, user } = useOrganisation();
  const [skills, setSkills] = useState([]);
  const [categories, setCategories] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [reqSkills, setReqSkills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (org && user) loadData();
  }, [org, user]);

  async function loadData() {
    const [s, c, a, tm, t, trs] = await Promise.all([
      base44.entities.Skill.filter({ organisation_id: org.id, status: 'active' }),
      base44.entities.SkillCategory.filter({ organisation_id: org.id }),
      base44.entities.SkillAssessment.filter({ organisation_id: org.id, user_id: user.id }),
      base44.entities.TeamMember.filter({ organisation_id: org.id, user_id: user.id }),
      base44.entities.Team.filter({ organisation_id: org.id }),
      base44.entities.TeamRequiredSkill.filter({ organisation_id: org.id }),
    ]);
    setSkills(s);
    setCategories(c.sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
    setAssessments(a);
    setTeamMembers(tm);
    setTeams(t);
    setReqSkills(trs);
    setLoading(false);
  }

  const exportData = () => {
    const rows = [['Skill', 'Category', 'Proficiency', 'Assessed Date', 'Expiry Date', 'Assessed By']];
    assessments.forEach(a => {
      const skill = skills.find(s => s.id === a.skill_id);
      const cat = categories.find(c => c.id === skill?.category_id);
      rows.push([
        a.skill_name || skill?.name || '',
        cat?.name || '',
        getProficiencyLabel(a.proficiency_level, skill?.scale_type),
        a.assessed_date || '',
        a.expiry_date || '',
        a.assessed_by_name || '',
      ]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${user.full_name?.replace(/\s/g, '-') || 'user'}-skills-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="h-64 rounded-xl bg-muted animate-pulse" />;

  const currentAssessments = {};
  assessments.forEach(a => {
    if (!currentAssessments[a.skill_id] || a.assessed_date > currentAssessments[a.skill_id].assessed_date) {
      currentAssessments[a.skill_id] = a;
    }
  });

  const userTeamIds = teamMembers.map(m => m.team_id);
  const userTeams = teams.filter(t => userTeamIds.includes(t.id));
  const userReqSkillIds = new Set();
  reqSkills.filter(r => userTeamIds.includes(r.team_id) && r.is_required).forEach(r => userReqSkillIds.add(r.skill_id));

  const groupedSkills = categories.map(cat => ({
    ...cat,
    skills: skills.filter(s => s.category_id === cat.id),
  })).filter(g => g.skills.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Skills Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">{user?.full_name} — {user?.email}</p>
        </div>
        <Button variant="outline" onClick={exportData}>
          <Download className="w-4 h-4 mr-1.5" /> Export My Data
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {userTeams.map(t => <Badge key={t.id} variant="outline">{t.name}</Badge>)}
      </div>

      {groupedSkills.map(cat => (
        <div key={cat.id} className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.colour || '#6B7280' }} />
            <h2 className="text-sm font-semibold">{cat.name}</h2>
          </div>
          <div className="divide-y divide-border">
            {cat.skills.map(skill => {
              const assessment = currentAssessments[skill.id];
              const isRequired = userReqSkillIds.has(skill.id);
              const req = reqSkills.find(r => r.skill_id === skill.id && r.is_required);
              const status = getRAGStatus(assessment, skill, req);
              return (
                <div key={skill.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{skill.name}</span>
                      {isRequired && <Badge variant="outline" className="text-[9px]">Required</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {assessment ? getProficiencyLabel(assessment.proficiency_level, skill.scale_type) : 'Not Assessed'}
                      {assessment?.assessed_date && ` — ${assessment.assessed_date}`}
                      {assessment?.expiry_date && ` — Expires ${assessment.expiry_date}`}
                    </p>
                  </div>
                  <RAGBadge status={status} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}