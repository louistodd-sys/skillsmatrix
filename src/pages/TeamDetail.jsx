import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Users, Plus, Trash2, BookOpen, ArrowLeft, Settings2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useOrganisation from '@/lib/useOrganisation';
import { Button } from '@/components/ui/button';
import MetricCard from '@/components/MetricCard';
import RAGBar from '@/components/RAGBar';
import RAGBadge from '@/components/RAGBadge';
import AddMemberModal from '@/components/AddMemberModal';
import ManageRequiredSkillsModal from '@/components/ManageRequiredSkillsModal';
import { getRAGStatus, getProficiencyLabel } from '@/lib/ragUtils';

export default function TeamDetail() {
  const { teamId } = useParams();
  const { org } = useOrganisation();
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [reqSkills, setReqSkills] = useState([]);
  const [skills, setSkills] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showReqSkills, setShowReqSkills] = useState(false);

  useEffect(() => {
    if (org) loadData();
  }, [org, teamId]);

  async function loadData() {
    const [teams, tm, trs, s, a, u] = await Promise.all([
      base44.entities.Team.filter({ id: teamId }),
      base44.entities.TeamMember.filter({ team_id: teamId }),
      base44.entities.TeamRequiredSkill.filter({ team_id: teamId }),
      base44.entities.Skill.filter({ organisation_id: org.id, status: 'active' }),
      base44.entities.SkillAssessment.filter({ organisation_id: org.id }),
      base44.entities.User.filter({ organisation_id: org.id }),
    ]);
    setTeam(teams[0]);
    setMembers(tm);
    setReqSkills(trs);
    setSkills(s);
    setAssessments(a);
    setAllUsers(u);
    setLoading(false);
  }

  const removeMember = async (memberId) => {
    if (!confirm('Remove this member from the team?')) return;
    await base44.entities.TeamMember.delete(memberId);
    loadData();
  };

  if (loading) return <div className="h-64 rounded-xl bg-muted animate-pulse" />;
  if (!team) return <p className="text-muted-foreground">Team not found</p>;

  const currentAssessments = {};
  assessments.forEach(a => {
    const key = `${a.user_id}-${a.skill_id}`;
    if (!currentAssessments[key] || a.assessed_date > currentAssessments[key].assessed_date) {
      currentAssessments[key] = a;
    }
  });

  const required = reqSkills.filter(r => r.is_required);
  let totalGreen = 0, totalAmber = 0, totalRed = 0, totalGrey = 0;
  members.forEach(m => {
    required.forEach(req => {
      const assessment = currentAssessments[`${m.user_id}-${req.skill_id}`];
      const skill = skills.find(s => s.id === req.skill_id);
      const status = getRAGStatus(assessment, skill, req);
      if (status === 'green') totalGreen++;
      else if (status === 'amber') totalAmber++;
      else if (status === 'red') totalRed++;
      else totalGrey++;
    });
  });
  const totalSlots = totalGreen + totalAmber + totalRed + totalGrey;
  const compliance = totalSlots > 0 ? Math.round((totalGreen / totalSlots) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/teams" className="hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Teams
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{team.name}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{team.name}</h1>
          {team.description && <p className="text-sm text-muted-foreground mt-1">{team.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowReqSkills(true)}>
            <Settings2 className="w-4 h-4 mr-1.5" /> Required Skills
          </Button>
          <Button onClick={() => setShowAddMember(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Add Member
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={Users} label="Members" value={members.length} />
        <MetricCard icon={BookOpen} label="Required Skills" value={required.length} />
        <MetricCard label="Compliance" value={`${compliance}%`} />
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">RAG Summary</p>
          <RAGBar green={totalGreen} amber={totalAmber} red={totalRed} grey={totalGrey} showLabels />
        </div>
      </div>

      {/* Members */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">Team Members</h2>
        </div>
        {members.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No members yet. Add your first team member.</div>
        ) : (
          <div className="divide-y divide-border">
            {members.map(m => {
              const memberUser = allUsers.find(u => u.id === m.user_id);
              let mGreen = 0, mRed = 0, mAmber = 0, mGrey = 0;
              required.forEach(req => {
                const assessment = currentAssessments[`${m.user_id}-${req.skill_id}`];
                const skill = skills.find(s => s.id === req.skill_id);
                const status = getRAGStatus(assessment, skill, req);
                if (status === 'green') mGreen++;
                else if (status === 'amber') mAmber++;
                else if (status === 'red') mRed++;
                else mGrey++;
              });
              const mTotal = mGreen + mAmber + mRed + mGrey;
              const mComp = mTotal > 0 ? Math.round((mGreen / mTotal) * 100) : 0;

              return (
                <div key={m.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
                    {(m.user_name || memberUser?.full_name || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link to={`/users/${m.user_id}`} className="text-sm font-medium text-foreground hover:text-primary">
                      {m.user_name || memberUser?.full_name || m.user_email}
                    </Link>
                    <p className="text-xs text-muted-foreground">{m.user_email || memberUser?.email}</p>
                  </div>
                  <div className="w-24 hidden sm:block">
                    <RAGBar green={mGreen} amber={mAmber} red={mRed} grey={mGrey} />
                  </div>
                  <span className="text-sm font-semibold text-foreground w-12 text-right">{mComp}%</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeMember(m.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAddMember && (
        <AddMemberModal
          teamId={teamId}
          orgId={org.id}
          existingMemberIds={members.map(m => m.user_id)}
          onClose={() => setShowAddMember(false)}
          onSaved={loadData}
        />
      )}
      {showReqSkills && (
        <ManageRequiredSkillsModal
          teamId={teamId}
          orgId={org.id}
          existingReqSkills={reqSkills}
          onClose={() => setShowReqSkills(false)}
          onSaved={loadData}
        />
      )}
    </div>
  );
}