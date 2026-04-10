import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Users, Mail } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useOrganisation from '@/lib/useOrganisation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/EmptyState';
import InviteUserModal from '@/components/InviteUserModal';

export default function UsersPage() {
  const { org, user } = useOrganisation();
  const [users, setUsers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [showInvite, setShowInvite] = useState(false);
  const [tab, setTab] = useState('users');

  useEffect(() => {
    if (org) loadData();
  }, [org]);

  async function loadData() {
    const [u, inv, tm, t] = await Promise.all([
      base44.entities.User.filter({ organisation_id: org.id }),
      base44.entities.Invitation.filter({ organisation_id: org.id }),
      base44.entities.TeamMember.filter({ organisation_id: org.id }),
      base44.entities.Team.filter({ organisation_id: org.id }),
    ]);
    setUsers(u);
    setInvitations(inv);
    setTeamMembers(tm);
    setTeams(t);
    setLoading(false);
  }

  const filteredUsers = users
    .filter(u => filterRole === 'all' || u.role === filterRole)
    .filter(u => !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()));

  const getUserTeams = (userId) => {
    const memberOf = teamMembers.filter(m => m.user_id === userId);
    return memberOf.map(m => teams.find(t => t.id === m.team_id)?.name).filter(Boolean);
  };

  const pendingInvitations = invitations.filter(i => i.status === 'pending');

  if (loading) return <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">{users.length} users in {org.name}</p>
        </div>
        <Button onClick={() => setShowInvite(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Invite User
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'users' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setTab('users')}
        >
          Active Users ({filteredUsers.length})
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'invitations' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setTab('invitations')}
        >
          Pending Invitations ({pendingInvitations.length})
        </button>
      </div>

      {tab === 'users' && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          {filteredUsers.length === 0 ? (
            <EmptyState icon={Users} title="No users found" description="Invite your first team member to get started." actionLabel="Invite User" onAction={() => setShowInvite(true)} />
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Name</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Email</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Role</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Teams</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <Link to={`/users/${u.id}`} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
                              {(u.full_name || 'U')[0].toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-foreground hover:text-primary">{u.full_name || 'Unnamed'}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="text-[10px] capitalize">{u.role || 'viewer'}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {getUserTeams(u.id).map((t, i) => (
                              <Badge key={i} variant="outline" className="text-[10px]">{t}</Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'invitations' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {pendingInvitations.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No pending invitations</p>
          ) : (
            <div className="divide-y divide-border">
              {pendingInvitations.map(inv => (
                <div key={inv.id} className="flex items-center gap-4 px-5 py-3">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">Invited by {inv.invited_by_name} as {inv.role}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] capitalize">{inv.role}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showInvite && (
        <InviteUserModal orgId={org.id} teams={teams} onClose={() => setShowInvite(false)} onSaved={loadData} />
      )}
    </div>
  );
}