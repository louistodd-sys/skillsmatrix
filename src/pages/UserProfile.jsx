import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Trash2, UserCog } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useOrganisation from '@/lib/useOrganisation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import RAGBadge from '@/components/RAGBadge';
import AssessmentModal from '@/components/AssessmentModal';
import DeleteUserModal from '@/components/DeleteUserModal';
import { getRAGStatus, getProficiencyLabel } from '@/lib/ragUtils';

export default function UserProfile() {
  const { userId } = useParams();
  const { org, user: currentUser } = useOrganisation();
  const [profileUser, setProfileUser] = useState(null);
  const [isManagedMember, setIsManagedMember] = useState(false);
  const [skills, setSkills] = useState([]);
  const [categories, setCategories] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [myManagedTeamIds, setMyManagedTeamIds] = useState([]);
  const [teams, setTeams] = useState([]);
  const [reqSkills, setReqSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assessingSkill, setAssessingSkill] = useState(null);
  const [expandedSkill, setExpandedSkill] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (org) loadData();
  }, [org, userId]);

  async function loadData() {
    const [s, c, a, tm, t, trs] = await Promise.all([
      base44.entities.Skill.filter({ organisation_id: org.id, status: 'active' }),
      base44.entities.SkillCategory.filter({ organisation_id: org.id }),
      base44.entities.SkillAssessment.filter({ organisation_id: org.id, user_id: userId }),
      base44.entities.TeamMember.filter({ organisation_id: org.id, user_id: userId }),
      base44.entities.Team.filter({ organisation_id: org.id }),
      base44.entities.TeamRequiredSkill.filter({ organisation_id: org.id }),
    ]);

    // Resolve whether this is a User or a managed Member
    const users = await base44.entities.User.filter({ id: userId });
    let resolved = users[0] || null;
    let managed = false;

    if (!resolved) {
      // Not a registered user — check if this is a managed employee.
      // Managed employees have is_managed_member:true on their TeamMember record;
      // their name/email is denormalised there (no separate entity required).
      const managedTm = tm.find(m => m.is_managed_member);
      if (managedTm) {
        resolved = {
          id: userId,
          full_name: managedTm.user_name || `Employee ${userId.slice(0, 8)}`,
          email: managedTm.user_email || '(no email)',
          role: 'managed employee',
          job_title: null,
        };
        managed = true;
      }
    }

    // Determine which teams this manager manages (for permission scoping)
    let managedTeamIds = [];
    if (currentUser?.role === 'manager') {
      managedTeamIds = t
        .filter(team => team.manager_ids?.includes(currentUser.id))
        .map(team => team.id);
    }

    setProfileUser(resolved);
    setIsManagedMember(managed);
    setSkills(s);
    setCategories(c.sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
    setAssessments(a);
    setTeamMembers(tm);
    setMyManagedTeamIds(managedTeamIds);
    setTeams(t);
    setReqSkills(trs);
    setLoading(false);
  }

  const handleDelete = async () => {
    // Delete all skill assessments
    const userAssessments = await base44.entities.SkillAssessment.filter({
      organisation_id: org.id,
      user_id: userId,
    });
    await Promise.all(userAssessments.map(a => base44.entities.SkillAssessment.delete(a.id)));

    // Delete team memberships
    const userMemberships = await base44.entities.TeamMember.filter({
      organisation_id: org.id,
      user_id: userId,
    });
    await Promise.all(userMemberships.map(m => base44.entities.TeamMember.delete(m.id)));

    // Managed members have no separate entity — TeamMember records already deleted above.
    if (!isManagedMember) {
      try { await base44.entities.User.delete(userId); } catch (_) { /* may be handled by auth system */ }
    }

    // Write audit log entry (anonymised — stores ID not name for GDPR)
    await base44.entities.AuditLogEntry.create({
      organisation_id: org.id,
      actor_user_id: currentUser?.id,
      actor_display: currentUser?.full_name,
      action: 'user.deleted',
      target_type: 'user',
      target_id: userId,
      target_display: `Deleted User [${userId.slice(0, 8)}]`,
      detail: JSON.stringify({ name_at_deletion: profileUser?.full_name }),
    });

    setShowDeleteModal(false);
    window.location.href = '/users';
  };

  if (loading) return <div className="h-64 rounded-xl bg-muted animate-pulse" />;
  if (!profileUser) return <p className="text-muted-foreground p-4">User not found.</p>;

  // Current assessments map
  const currentAssessments = {};
  const assessmentHistory = {};
  const sorted = [...assessments].sort((a, b) => (a.assessed_date || '').localeCompare(b.assessed_date || ''));
  sorted.forEach(a => {
    currentAssessments[a.skill_id] = a;
    if (!assessmentHistory[a.skill_id]) assessmentHistory[a.skill_id] = [];
    assessmentHistory[a.skill_id].push(a);
  });

  const userTeamIds = teamMembers.map(m => m.team_id);
  const userTeams = teams.filter(t => userTeamIds.includes(t.id));

  // Permission: admin can assess anyone; manager can only assess users in their teams
  const canAssess =
    currentUser?.role === 'admin' ||
    (currentUser?.role === 'manager' &&
      userTeamIds.some(id => myManagedTeamIds.includes(id)));

  const canDelete = currentUser?.role === 'admin';

  // Summary stats — only required skills
  const userReqSkillIds = new Set(
    reqSkills
      .filter(r => userTeamIds.includes(r.team_id) && r.is_required)
      .map(r => r.skill_id)
  );
  let greenCount = 0, amberCount = 0, redCount = 0, greyCount = 0;
  skills.forEach(skill => {
    if (!userReqSkillIds.has(skill.id)) return;
    const req = reqSkills.find(r => r.skill_id === skill.id && userTeamIds.includes(r.team_id));
    const status = getRAGStatus(currentAssessments[skill.id], skill, req);
    if (status === 'green') greenCount++;
    else if (status === 'amber') amberCount++;
    else if (status === 'red') redCount++;
    else greyCount++;
  });

  const groupedSkills = categories.map(cat => ({
    ...cat,
    skills: skills.filter(s => s.category_id === cat.id),
  })).filter(g => g.skills.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/users" className="hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Users
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{profileUser.full_name}</span>
      </div>

      {/* Profile Header */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold shrink-0">
            {(profileUser.full_name || 'U')[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">{profileUser.full_name}</h1>
              {isManagedMember && (
                <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                  <UserCog className="w-3 h-3" /> Managed Employee
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{profileUser.email}</p>
            {profileUser.job_title && (
              <p className="text-xs text-muted-foreground">{profileUser.job_title}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {!isManagedMember && (
                <Badge variant="secondary" className="capitalize">{profileUser.role || 'viewer'}</Badge>
              )}
              {userTeams.map(t => <Badge key={t.id} variant="outline">{t.name}</Badge>)}
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="text-right hidden sm:flex gap-3">
              <div className="text-center">
                <p className="text-lg font-bold text-green-600">{greenCount}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Current</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-amber-600">{amberCount}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Expiring</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-red-600">{redCount + greyCount}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Missing</p>
              </div>
            </div>
            {canDelete && (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setShowDeleteModal(true)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete User
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Skills by Category */}
      {groupedSkills.map(cat => (
        <div key={cat.id} className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.colour || '#6B7280' }} />
            <h2 className="text-sm font-semibold">{cat.name}</h2>
          </div>
          <div className="divide-y divide-border">
            {cat.skills.map(skill => {
              const assessment = currentAssessments[skill.id];
              const isRequired = userReqSkillIds.has(skill.id);
              const req = reqSkills.find(r => r.skill_id === skill.id && userTeamIds.includes(r.team_id));
              const status = getRAGStatus(assessment, skill, req);
              const history = assessmentHistory[skill.id] || [];

              return (
                <div key={skill.id}>
                  <div
                    className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setExpandedSkill(expandedSkill === skill.id ? null : skill.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{skill.name}</span>
                        {isRequired && <Badge variant="outline" className="text-[9px]">Required</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {assessment
                          ? getProficiencyLabel(assessment.proficiency_level, skill.scale_type)
                          : 'Not Assessed'}
                        {assessment?.assessed_date && ` — Assessed ${assessment.assessed_date}`}
                        {assessment?.expiry_date && ` — Expires ${assessment.expiry_date}`}
                        {assessment?.assessed_by_name && ` — by ${assessment.assessed_by_name}`}
                      </p>
                    </div>
                    <RAGBadge status={status} />
                    {canAssess && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={e => { e.stopPropagation(); setAssessingSkill(skill); }}
                      >
                        Assess
                      </Button>
                    )}
                  </div>
                  {expandedSkill === skill.id && history.length > 0 && (
                    <div className="px-5 pb-3 ml-5 border-l-2 border-border">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Assessment History</p>
                      {[...history].reverse().map((h, i) => (
                        <div key={i} className="flex items-center gap-3 text-xs text-muted-foreground py-1">
                          <span>{h.assessed_date}</span>
                          <span className="font-medium text-foreground">
                            {getProficiencyLabel(h.proficiency_level, skill.scale_type)}
                          </span>
                          {h.expiry_date && <span>Expires {h.expiry_date}</span>}
                          {h.notes && <span className="italic">"{h.notes}"</span>}
                          <span>by {h.assessed_by_name || 'System'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {assessingSkill && (
        <AssessmentModal
          userId={userId}
          userName={profileUser.full_name}
          skill={assessingSkill}
          existingAssessment={currentAssessments[assessingSkill.id]}
          orgId={org.id}
          onClose={() => setAssessingSkill(null)}
          onSaved={loadData}
        />
      )}

      {showDeleteModal && (
        <DeleteUserModal
          user={profileUser}
          onConfirm={handleDelete}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}
