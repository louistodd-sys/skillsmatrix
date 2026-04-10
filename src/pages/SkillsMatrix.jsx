import { useState, useEffect } from 'react';
import { Grid3X3, Search, Layers, BarChart2, Users, ChevronDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useOrganisation from '@/lib/useOrganisation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/EmptyState';
import RAGBadge from '@/components/RAGBadge';
import AssessmentModal from '@/components/AssessmentModal';
import BulkAssessmentModal from '@/components/BulkAssessmentModal';
import { getRAGStatus, getRAGColors, getProficiencyLabel } from '@/lib/ragUtils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ─── RAG Legend ───────────────────────────────────────────────────────────────
function RAGLegend() {
  const items = [
    { color: 'bg-green-500', label: 'Current' },
    { color: 'bg-amber-400', label: 'Expiring Soon' },
    { color: 'bg-red-500',   label: 'Expired / Missing' },
    { color: 'bg-gray-200',  label: 'Not Assessed' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map(({ color, label }) => (
        <span key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={`w-3 h-3 rounded-sm shrink-0 ${color}`} />
          {label}
        </span>
      ))}
    </div>
  );
}

export default function SkillsMatrix() {
  const { org, user } = useOrganisation();
  const [teams, setTeams]           = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [members, setMembers]       = useState([]);
  const [skills, setSkills]         = useState([]);
  const [categories, setCategories] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [reqSkills, setReqSkills]   = useState([]);
  const [loading, setLoading]       = useState(true);

  // Controls
  const [searchMember, setSearchMember]     = useState('');
  const [showOnlyRequired, setShowOnlyRequired] = useState(false);
  const [showOnlyExpiring, setShowOnlyExpiring] = useState(false);
  const [viewMode, setViewMode]             = useState('rag'); // 'rag' | 'level'
  const [assessingCell, setAssessingCell]   = useState(null);
  const [bulkSkill, setBulkSkill]           = useState(null);

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

    if (user?.role === 'manager' && t.length > 0) {
      const myTeam = t.find(team => team.manager_ids?.includes(user.id));
      if (myTeam) setSelectedTeam(myTeam.id);
    }
  }

  if (loading) return <div className="h-96 rounded-xl bg-muted animate-pulse" />;

  // Build current assessment map: `${userId}-${skillId}` → latest assessment
  const currentAssessments = {};
  [...assessments]
    .sort((a, b) => (a.assessed_date || '').localeCompare(b.assessed_date || ''))
    .forEach(a => {
      currentAssessments[`${a.user_id}-${a.skill_id}`] = a;
    });

  // Filter members by team
  let filteredMembers = members;
  if (selectedTeam !== 'all') {
    const ids = new Set(members.filter(m => m.team_id === selectedTeam).map(m => m.user_id));
    filteredMembers = members.filter(m => ids.has(m.user_id));
  }
  // Deduplicate (user can be in multiple teams)
  const memberMap = {};
  filteredMembers.forEach(m => { if (!memberMap[m.user_id]) memberMap[m.user_id] = m; });
  let uniqueMembers = Object.values(memberMap);

  // Sort alphabetically
  uniqueMembers.sort((a, b) => (a.user_name || '').localeCompare(b.user_name || ''));

  // Name search
  if (searchMember) {
    uniqueMembers = uniqueMembers.filter(m =>
      (m.user_name || '').toLowerCase().includes(searchMember.toLowerCase())
    );
  }

  // Helper: get requirement for a skill in the current team context
  const getReq = (userId, skillId) => {
    if (selectedTeam !== 'all') {
      return reqSkills.find(r => r.team_id === selectedTeam && r.skill_id === skillId);
    }
    // For "all teams", use the member's primary team
    const tm = members.find(m => m.user_id === userId);
    return tm ? reqSkills.find(r => r.team_id === tm.team_id && r.skill_id === skillId) : undefined;
  };

  // Filter skills
  let visibleSkills = skills;
  if (showOnlyRequired && selectedTeam !== 'all') {
    const reqIds = new Set(
      reqSkills.filter(r => r.team_id === selectedTeam && r.is_required).map(r => r.skill_id)
    );
    visibleSkills = visibleSkills.filter(s => reqIds.has(s.id));
  }
  if (showOnlyExpiring) {
    visibleSkills = visibleSkills.filter(s =>
      uniqueMembers.some(m => {
        const a = currentAssessments[`${m.user_id}-${s.id}`];
        const status = getRAGStatus(a, s, getReq(m.user_id, s.id));
        return status === 'amber' || status === 'red';
      })
    );
  }

  // Group skills by category
  const groupedSkills = categories
    .map(cat => ({ ...cat, skills: visibleSkills.filter(s => s.category_id === cat.id) }))
    .filter(g => g.skills.length > 0);
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

  // Compute per-skill compliance % for summary row
  const skillCompliance = {};
  allVisibleSkills.forEach(skill => {
    let green = 0;
    uniqueMembers.forEach(m => {
      const a = currentAssessments[`${m.user_id}-${skill.id}`];
      const req = getReq(m.user_id, skill.id);
      if (getRAGStatus(a, skill, req) === 'green') green++;
    });
    skillCompliance[skill.id] = uniqueMembers.length > 0
      ? Math.round((green / uniqueMembers.length) * 100)
      : 0;
  });

  // Column header rotation threshold
  const useVertical = allVisibleSkills.length > 5;

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Skills Matrix</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visual overview of team skills and competencies</p>
        </div>
        <RAGLegend />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Team filter */}
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={selectedTeam}
          onChange={e => setSelectedTeam(e.target.value)}
        >
          {user?.role === 'admin' && <option value="all">All Teams</option>}
          {teams
            .filter(t => user?.role === 'admin' || t.manager_ids?.includes(user?.id))
            .map(t => <option key={t.id} value={t.id}>{t.name}</option>)
          }
        </select>

        {/* Member search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search members…"
            value={searchMember}
            onChange={e => setSearchMember(e.target.value)}
            className="pl-8 h-9 w-44 text-sm"
          />
        </div>

        {/* View mode toggle */}
        <div className="flex items-center rounded-md border border-input overflow-hidden">
          <button
            className={`px-3 h-9 text-xs font-medium flex items-center gap-1.5 transition-colors ${viewMode === 'rag' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'}`}
            onClick={() => setViewMode('rag')}
          >
            <Layers className="w-3.5 h-3.5" /> RAG
          </button>
          <button
            className={`px-3 h-9 text-xs font-medium flex items-center gap-1.5 transition-colors border-l border-input ${viewMode === 'level' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:text-foreground'}`}
            onClick={() => setViewMode('level')}
          >
            <BarChart2 className="w-3.5 h-3.5" /> Level
          </button>
        </div>

        {/* Filters */}
        {selectedTeam !== 'all' && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showOnlyRequired}
              onChange={e => setShowOnlyRequired(e.target.checked)}
              className="rounded border-border"
            />
            Required only
          </label>
        )}
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showOnlyExpiring}
            onChange={e => setShowOnlyExpiring(e.target.checked)}
            className="rounded border-border"
          />
          Expiring / expired only
        </label>
      </div>

      {/* Desktop Matrix */}
      <div className="hidden md:block bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <TooltipProvider delayDuration={150}>
            <table className="border-collapse" style={{ width: 'max-content', minWidth: '100%' }}>
              <thead>
                {/* Category header row */}
                <tr>
                  <th
                    className="sticky left-0 z-20 bg-card px-4 text-left text-xs font-medium text-muted-foreground border-b border-r border-border"
                    style={{ minWidth: 180, height: useVertical ? 'auto' : 36 }}
                    rowSpan={1}
                  />
                  {groupedSkills.map((cat, catIdx) => (
                    <th
                      key={cat.id}
                      colSpan={cat.skills.length}
                      className="px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider border-b border-border"
                      style={{
                        color: cat.colour || '#6B7280',
                        borderLeft: catIdx > 0 ? `2px solid ${cat.colour || '#E2E8F0'}` : undefined,
                      }}
                    >
                      {cat.name}
                    </th>
                  ))}
                </tr>

                {/* Skill name header row */}
                <tr>
                  <th className="sticky left-0 z-20 bg-card border-b border-r border-border" style={{ minWidth: 180 }} />
                  {groupedSkills.map((cat, catIdx) =>
                    cat.skills.map((skill, skillIdx) => {
                      const isFirstInCat = skillIdx === 0;
                      return (
                        <th
                          key={skill.id}
                          className="px-1 border-b border-border align-bottom"
                          style={{
                            minWidth: 40,
                            borderLeft: isFirstInCat && catIdx > 0
                              ? `2px solid ${cat.colour || '#E2E8F0'}`
                              : undefined,
                          }}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="text-[10px] text-muted-foreground font-medium mx-auto cursor-pointer"
                                style={useVertical
                                  ? { writingMode: 'vertical-rl', textOrientation: 'mixed', height: 80, paddingBottom: 4, overflow: 'hidden', maxWidth: 20 }
                                  : { maxWidth: 64, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', paddingBottom: 6 }
                                }
                              >
                                {skill.name}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="font-medium">{skill.name}</p>
                              <p className="text-xs text-muted-foreground">{cat.name}</p>
                            </TooltipContent>
                          </Tooltip>
                          {/* Bulk assess button on header hover */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className="w-full flex justify-center py-0.5 opacity-0 group-hover:opacity-100 hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity"
                                onClick={() => setBulkSkill(skill)}
                                title={`Bulk assess: ${skill.name}`}
                              >
                                <Users className="w-3 h-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                              <p className="text-xs">Bulk assess all members</p>
                            </TooltipContent>
                          </Tooltip>
                        </th>
                      );
                    })
                  )}
                </tr>
              </thead>

              <tbody>
                {uniqueMembers.length === 0 && (
                  <tr>
                    <td colSpan={allVisibleSkills.length + 1} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No members match your search.
                    </td>
                  </tr>
                )}
                {uniqueMembers.map((member, idx) => (
                  <tr
                    key={member.user_id}
                    className={idx % 2 === 0 ? 'bg-card' : 'bg-muted/20'}
                  >
                    {/* Sticky name column */}
                    <td
                      className="sticky left-0 z-10 px-4 py-1.5 text-sm font-medium border-r border-border whitespace-nowrap"
                      style={{ backgroundColor: idx % 2 === 0 ? 'hsl(var(--card))' : 'hsl(var(--muted) / 0.2)' }}
                    >
                      {member.user_name || 'Unknown'}
                    </td>

                    {/* Skill cells */}
                    {groupedSkills.map((cat, catIdx) =>
                      cat.skills.map((skill, skillIdx) => {
                        const assessment = currentAssessments[`${member.user_id}-${skill.id}`];
                        const req = getReq(member.user_id, skill.id);
                        const status = getRAGStatus(assessment, skill, req);
                        const colors = getRAGColors(status);
                        const isFirstInCat = skillIdx === 0;

                        if (viewMode === 'level') {
                          // Level text mode
                          const label = assessment != null
                            ? getProficiencyLabel(assessment.proficiency_level, skill.scale_type)
                            : '—';
                          const short = skill.scale_type === 'binary'
                            ? (assessment ? (assessment.proficiency_level >= 1 ? '✓' : '✗') : '—')
                            : (assessment != null ? String(assessment.proficiency_level) : '—');

                          return (
                            <td
                              key={skill.id}
                              className="px-0.5 py-1 text-center"
                              style={{
                                borderLeft: isFirstInCat && catIdx > 0
                                  ? `2px solid ${cat.colour || '#E2E8F0'}`
                                  : undefined,
                              }}
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className={`w-9 h-9 rounded text-xs font-bold mx-auto flex items-center justify-center border ${colors.bg} ${colors.text} ${colors.border} hover:opacity-80 transition-opacity`}
                                    onClick={() => setAssessingCell({ userId: member.user_id, userName: member.user_name, skill, assessment })}
                                  >
                                    {short}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-medium">{skill.name}</p>
                                  <p className="text-xs">{label}</p>
                                  {assessment?.expiry_date && <p className="text-xs">Expires: {assessment.expiry_date}</p>}
                                  {assessment?.assessed_by_name && <p className="text-xs">By: {assessment.assessed_by_name}</p>}
                                </TooltipContent>
                              </Tooltip>
                            </td>
                          );
                        }

                        // RAG dot mode
                        return (
                          <td
                            key={skill.id}
                            className="px-0.5 py-1 text-center"
                            style={{
                              borderLeft: isFirstInCat && catIdx > 0
                                ? `2px solid ${cat.colour || '#E2E8F0'}`
                                : undefined,
                            }}
                          >
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className={`w-9 h-9 rounded mx-auto block ${colors.cell} hover:opacity-75 hover:scale-105 transition-all`}
                                  onClick={() => setAssessingCell({ userId: member.user_id, userName: member.user_name, skill, assessment })}
                                  aria-label={`${member.user_name} — ${skill.name}: ${status}`}
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">{skill.name}</p>
                                <p className="text-xs">{getProficiencyLabel(assessment?.proficiency_level, skill.scale_type)}</p>
                                {assessment?.expiry_date && <p className="text-xs">Expires: {assessment.expiry_date}</p>}
                                {assessment?.assessed_by_name && <p className="text-xs">By: {assessment.assessed_by_name}</p>}
                                {assessment?.notes && <p className="text-xs italic">"{assessment.notes}"</p>}
                              </TooltipContent>
                            </Tooltip>
                          </td>
                        );
                      })
                    )}
                  </tr>
                ))}

                {/* Compliance summary footer row */}
                {uniqueMembers.length > 0 && (
                  <tr className="border-t-2 border-border bg-muted/40">
                    <td className="sticky left-0 z-10 px-4 py-2 text-xs font-semibold text-muted-foreground border-r border-border bg-muted/40 whitespace-nowrap">
                      Coverage %
                    </td>
                    {groupedSkills.map((cat, catIdx) =>
                      cat.skills.map((skill, skillIdx) => {
                        const pct = skillCompliance[skill.id] ?? 0;
                        const color = pct >= 80 ? 'text-green-700' : pct >= 50 ? 'text-amber-700' : 'text-red-600';
                        return (
                          <td
                            key={skill.id}
                            className="px-0.5 py-2 text-center"
                            style={{
                              borderLeft: skillIdx === 0 && catIdx > 0
                                ? `2px solid ${cat.colour || '#E2E8F0'}`
                                : undefined,
                            }}
                          >
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={`text-[11px] font-bold ${color} cursor-default`}>
                                  {pct}%
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">{skill.name}: {pct}% of members current</p>
                              </TooltipContent>
                            </Tooltip>
                          </td>
                        );
                      })
                    )}
                  </tr>
                )}
              </tbody>
            </table>
          </TooltipProvider>
        </div>
      </div>

      {/* Mobile — card per person */}
      <div className="md:hidden space-y-3">
        {uniqueMembers.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No members match your search.</p>
        )}
        {uniqueMembers.map(member => (
          <div key={member.user_id} className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3">{member.user_name || 'Unknown'}</h3>
            <div className="space-y-2">
              {groupedSkills.map(cat => (
                <div key={cat.id}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: cat.colour || '#6B7280' }}>
                    {cat.name}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.skills.map(skill => {
                      const assessment = currentAssessments[`${member.user_id}-${skill.id}`];
                      const req = getReq(member.user_id, skill.id);
                      const status = getRAGStatus(assessment, skill, req);
                      return (
                        <button
                          key={skill.id}
                          onClick={() => setAssessingCell({ userId: member.user_id, userName: member.user_name, skill, assessment })}
                        >
                          <RAGBadge status={status} label={skill.name} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bulk assess hint */}
      {selectedTeam !== 'all' && uniqueMembers.length > 0 && (
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          <span>Click the <Users className="w-3 h-3 inline" /> icon on any skill column header to bulk-assess all team members at once.</span>
        </div>
      )}

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

      {bulkSkill && (
        <BulkAssessmentModal
          skill={bulkSkill}
          members={uniqueMembers}
          orgId={org.id}
          onClose={() => setBulkSkill(null)}
          onSaved={loadData}
        />
      )}
    </div>
  );
}
