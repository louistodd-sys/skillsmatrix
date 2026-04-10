import { useState, useEffect } from 'react';
import { Grid3X3, Search, Filter } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useOrganisation from '@/lib/useOrganisation';
import { Input } from '@/components/ui/input';
import EmptyState from '@/components/EmptyState';
import RAGBadge from '@/components/RAGBadge';
import AssessmentModal from '@/components/AssessmentModal';
import { getRAGStatus, getRAGColors, getProficiencyLabel } from '@/lib/ragUtils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function SkillsMatrix() {
  const { org, user } = useOrganisation();
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [members, setMembers] = useState([]);
  const [skills, setSkills] = useState([]);
  const [categories, setCategories] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [reqSkills, setReqSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchMember, setSearchMember] = useState('');
  const [showOnlyRequired, setShowOnlyRequired] = useState(false);
  const [assessingCell, setAssessingCell] = useState(null);

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
    setTeams(t);
    setMembers(tm);
    setSkills(s);
    setCategories(c.sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
    setAssessments(a);
    setReqSkills(trs);
    setLoading(false);

    // Auto-select first team for managers
    if (user?.role === 'manager' && t.length > 0) {
      const myTeam = t.find(team => team.manager_ids?.includes(user.id));
      if (myTeam) setSelectedTeam(myTeam.id);
    }
  }

  if (loading) return <div className="h-96 rounded-xl bg-muted animate-pulse" />;

  // Build current assessments map
  const currentAssessments = {};
  assessments.forEach(a => {
    const key = `${a.user_id}-${a.skill_id}`;
    if (!currentAssessments[key] || a.assessed_date > currentAssessments[key].assessed_date) {
      currentAssessments[key] = a;
    }
  });

  // Filter members by team
  let visibleMembers = members;
  if (selectedTeam !== 'all') {
    const teamMemberIds = new Set(members.filter(m => m.team_id === selectedTeam).map(m => m.user_id));
    visibleMembers = members.filter(m => teamMemberIds.has(m.user_id));
  }

  // Deduplicate members
  const memberMap = {};
  visibleMembers.forEach(m => {
    if (!memberMap[m.user_id]) memberMap[m.user_id] = m;
  });
  let uniqueMembers = Object.values(memberMap);

  // Filter by search
  if (searchMember) {
    uniqueMembers = uniqueMembers.filter(m =>
      (m.user_name || '').toLowerCase().includes(searchMember.toLowerCase())
    );
  }

  // Filter skills
  let visibleSkills = skills;
  if (showOnlyRequired && selectedTeam !== 'all') {
    const reqSkillIds = new Set(reqSkills.filter(r => r.team_id === selectedTeam && r.is_required).map(r => r.skill_id));
    visibleSkills = skills.filter(s => reqSkillIds.has(s.id));
  }

  // Group skills by category
  const groupedSkills = categories.map(cat => ({
    ...cat,
    skills: visibleSkills.filter(s => s.category_id === cat.id),
  })).filter(g => g.skills.length > 0);

  const allVisibleSkills = groupedSkills.flatMap(g => g.skills);

  if (skills.length === 0) {
    return (
      <EmptyState
        icon={Grid3X3}
        title="Skills Matrix"
        description="Add skills to your library first to see the matrix view."
        actionLabel="Go to Skills Library"
        onAction={() => window.location.href = '/skills-library'}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Skills Matrix</h1>
        <p className="text-sm text-muted-foreground mt-1">Visual overview of team skills and competencies</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={selectedTeam}
          onChange={e => setSelectedTeam(e.target.value)}
        >
          {user?.role === 'admin' && <option value="all">All Teams</option>}
          {teams.filter(t => user?.role === 'admin' || t.manager_ids?.includes(user?.id)).map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search members..." value={searchMember} onChange={e => setSearchMember(e.target.value)} className="pl-9 w-48" />
        </div>
        {selectedTeam !== 'all' && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyRequired}
              onChange={e => setShowOnlyRequired(e.target.checked)}
              className="rounded border-border"
            />
            Required skills only
          </label>
        )}
      </div>

      {/* Matrix - Desktop */}
      <div className="hidden md:block bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <TooltipProvider>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-card px-4 py-3 text-left text-xs font-medium text-muted-foreground border-b border-r border-border min-w-[180px]">
                    Team Member
                  </th>
                  {groupedSkills.map(cat => (
                    <th
                      key={cat.id}
                      colSpan={cat.skills.length}
                      className="px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wider border-b border-border"
                      style={{ color: cat.colour || '#6B7280' }}
                    >
                      {cat.name}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="sticky left-0 z-10 bg-card border-b border-r border-border" />
                  {allVisibleSkills.map(skill => (
                    <th key={skill.id} className="px-1 py-2 border-b border-border min-w-[40px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="text-[10px] text-muted-foreground font-medium truncate max-w-[60px] mx-auto cursor-help" style={{ writingMode: allVisibleSkills.length > 8 ? 'vertical-rl' : undefined, textOrientation: allVisibleSkills.length > 8 ? 'mixed' : undefined, height: allVisibleSkills.length > 8 ? '80px' : 'auto' }}>
                            {skill.name}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent><p>{skill.name}</p></TooltipContent>
                      </Tooltip>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uniqueMembers.map((member, idx) => (
                  <tr key={member.user_id} className={idx % 2 === 0 ? 'bg-card' : 'bg-muted/30'}>
                    <td className="sticky left-0 z-10 px-4 py-2 text-sm font-medium border-r border-border" style={{ backgroundColor: idx % 2 === 0 ? 'hsl(var(--card))' : 'hsl(var(--muted) / 0.3)' }}>
                      {member.user_name || 'Unknown'}
                    </td>
                    {allVisibleSkills.map(skill => {
                      const assessment = currentAssessments[`${member.user_id}-${skill.id}`];
                      const req = reqSkills.find(r => r.team_id === (selectedTeam !== 'all' ? selectedTeam : members.find(m => m.user_id === member.user_id)?.team_id) && r.skill_id === skill.id);
                      const status = getRAGStatus(assessment, skill, req);
                      const colors = getRAGColors(status);
                      return (
                        <td key={skill.id} className="px-1 py-1 text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className={`w-8 h-8 rounded-md ${colors.dot} hover:opacity-80 transition-opacity mx-auto block`}
                                onClick={() => setAssessingCell({ userId: member.user_id, userName: member.user_name, skill, assessment })}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">{skill.name}</p>
                              <p className="text-xs">{getProficiencyLabel(assessment?.proficiency_level, skill.scale_type)}</p>
                              {assessment?.expiry_date && <p className="text-xs">Expires: {assessment.expiry_date}</p>}
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </TooltipProvider>
        </div>
      </div>

      {/* Matrix - Mobile (Card view) */}
      <div className="md:hidden space-y-4">
        {uniqueMembers.map(member => (
          <div key={member.user_id} className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">{member.user_name || 'Unknown'}</h3>
            <div className="flex flex-wrap gap-1.5">
              {allVisibleSkills.map(skill => {
                const assessment = currentAssessments[`${member.user_id}-${skill.id}`];
                const req = reqSkills.find(r => r.skill_id === skill.id);
                const status = getRAGStatus(assessment, skill, req);
                return (
                  <button
                    key={skill.id}
                    onClick={() => setAssessingCell({ userId: member.user_id, userName: member.user_name, skill, assessment })}
                  >
                    <RAGBadge status={status} label={skill.name.slice(0, 12)} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {assessingCell && (
        <AssessmentModal
          userId={assessingCell.userId}
          userName={assessingCell.userName}
          skill={assessingCell.skill}
          existingAssessment={assessingCell.assessment}
          orgId={org.id}
          onClose={() => setAssessingCell(null)}
          onSaved={loadData}
        />
      )}
    </div>
  );
}