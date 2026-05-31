import { useMemo } from 'react';
import { Users2, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * TeamCertStatus — shows per-team BRC training / certification compliance.
 * Uses SkillAssessment records (expiry-based skills) and TeamMember records
 * to derive a simple RAG compliance score per team.
 */
export default function TeamCertStatus({ teams, members, assessments, skills }) {
  const brcSkills = useMemo(() =>
    (skills || []).filter(s => s.requires_expiry && s.status === 'active'),
  [skills]);

  const teamStats = useMemo(() => {
    return (teams || []).map(team => {
      const teamMemberIds = (members || [])
        .filter(m => m.team_id === team.id)
        .map(m => m.user_id);

      if (!teamMemberIds.length) return { team, compliant: 0, warning: 0, overdue: 0, total: 0 };

      const now = new Date();
      const soon = new Date(now); soon.setDate(soon.getDate() + 60);

      let compliant = 0, warning = 0, overdue = 0;

      teamMemberIds.forEach(uid => {
        brcSkills.forEach(skill => {
          const ass = (assessments || []).find(a => a.user_id === uid && a.skill_id === skill.id);
          if (!ass || !ass.expiry_date) {
            overdue++;
          } else {
            const exp = new Date(ass.expiry_date);
            if (exp < now)   overdue++;
            else if (exp < soon) warning++;
            else             compliant++;
          }
        });
      });

      const total = compliant + warning + overdue;
      const pct = total > 0 ? Math.round((compliant / total) * 100) : 0;

      const rag = pct >= 80 ? 'green' : pct >= 50 ? 'amber' : 'red';

      return { team, compliant, warning, overdue, total, pct, rag };
    }).filter(t => t.total > 0)
      .sort((a, b) => a.pct - b.pct);
  }, [teams, members, assessments, brcSkills]);

  if (!teamStats.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <Users2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No team certification data yet.</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Add expiry-based skills and team members to see compliance.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <Users2 className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground">Team Certification Status</h3>
        <span className="ml-1 text-xs text-muted-foreground">({brcSkills.length} expiry-tracked skills)</span>
      </div>
      <ul className="divide-y divide-border">
        {teamStats.map(({ team, compliant, warning, overdue, total, pct, rag }) => (
          <li key={team.id} className="px-5 py-3.5 flex items-center gap-4">
            {/* RAG icon */}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              rag === 'green' ? 'bg-rag-green-light' : rag === 'amber' ? 'bg-rag-amber-light' : 'bg-rag-red-light'
            }`}>
              {rag === 'green'
                ? <CheckCircle2 className="w-4 h-4 text-rag-green" />
                : rag === 'amber'
                ? <Clock className="w-4 h-4 text-rag-amber" />
                : <AlertTriangle className="w-4 h-4 text-rag-red" />
              }
            </div>

            {/* Team name + bar */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <Link to={`/teams/${team.id}`} className="text-sm font-medium text-foreground hover:underline truncate">
                  {team.name}
                </Link>
                <span className={`text-xs font-bold ml-2 shrink-0 ${
                  rag === 'green' ? 'text-rag-green-text' : rag === 'amber' ? 'text-rag-amber-text' : 'text-rag-red-text'
                }`}>{pct}%</span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
                <div className="h-full bg-rag-green transition-all" style={{ width: `${(compliant/total)*100}%` }} />
                <div className="h-full bg-rag-amber transition-all" style={{ width: `${(warning/total)*100}%` }} />
                <div className="h-full bg-rag-red transition-all" style={{ width: `${(overdue/total)*100}%` }} />
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span className="text-rag-green-text font-medium">{compliant} compliant</span>
                {warning > 0 && <span className="text-rag-amber-text font-medium">{warning} expiring soon</span>}
                {overdue > 0 && <span className="text-rag-red-text font-medium">{overdue} overdue/missing</span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}