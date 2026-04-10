import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Users, Mail, RefreshCw, XCircle, UserPlus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useOrganisation from '@/lib/useOrganisation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/EmptyState';
import InviteUserModal from '@/components/InviteUserModal';
import AddEmployeeModal from '@/components/AddEmployeeModal';
import { format, parseISO } from 'date-fns';

const STATUS_COLORS = {
  active:   'bg-green-100 text-green-700',
  pending:  'bg-amber-100 text-amber-700',
  inactive: 'bg-gray-100 text-gray-600',
};

export default function UsersPage() {
  const { org, user } = useOrganisation();
  const [users, setUsers]           = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teams, setTeams]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showInvite, setShowInvite] = useState(false);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [tab, setTab]               = useState('users');
  const [revoking, setRevoking]     = useState(null);
  const [resending, setResending]   = useState(null);

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
    .filter(u => filterStatus === 'all' || (u.status || 'active') === filterStatus)
    .filter(u =>
      !search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
    );

  const getUserTeams = (userId) => {
    return teamMembers
      .filter(m => m.user_id === userId)
      .map(m => teams.find(t => t.id === m.team_id)?.name)
      .filter(Boolean);
  };

  const pendingInvitations = invitations.filter(i => i.status === 'pending');

  const handleRevoke = async (inv) => {
    setRevoking(inv.id);
    await base44.entities.Invitation.update(inv.id, { status: 'revoked' });
    await base44.entities.AuditLogEntry.create({
      organisation_id: org.id,
      actor_user_id: user?.id,
      actor_display: user?.full_name,
      action: 'invitation.revoked',
      target_type: 'invitation',
      target_id: inv.id,
      target_display: inv.email,
      detail: JSON.stringify({ role: inv.role }),
    });
    setRevoking(null);
    loadData();
  };

  const handleResend = async (inv) => {
    setResending(inv.id);
    // Update the invitation expiry (48h from now)
    const newExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    await base44.entities.Invitation.update(inv.id, { expires_at: newExpiry, status: 'pending' });
    // Re-send the invite email via base44 auth
    try { await base44.users.inviteUser(inv.email, inv.role === 'admin' ? 'admin' : 'user'); } catch (_) {}
    await base44.entities.AuditLogEntry.create({
      organisation_id: org.id,
      actor_user_id: user?.id,
      actor_display: user?.full_name,
      action: 'invitation.resent',
      target_type: 'invitation',
      target_id: inv.id,
      target_display: inv.email,
      detail: JSON.stringify({}),
    });
    setResending(null);
    loadData();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try { return format(parseISO(dateStr), 'dd MMM yyyy'); } catch { return dateStr; }
  };

  if (loading) return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{users.length} users in {org.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAddEmployee(true)}>
            <UserPlus className="w-4 h-4 mr-1.5" /> Add Employee
          </Button>
          <Button onClick={() => setShowInvite(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Invite User
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'users' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setTab('users')}
        >
          Active Users ({users.length})
        </button>
        <button
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'invitations' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          onClick={() => setTab('invitations')}
        >
          Invitations ({pendingInvitations.length})
        </button>
      </div>

      {tab === 'users' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="viewer">Viewer</option>
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {filteredUsers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No users found"
              description="Invite users or add employees to get started."
              actionLabel="Invite User"
              onAction={() => setShowInvite(true)}
            />
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Name</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Email</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Role</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">Status</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">Teams</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden xl:table-cell">Last Login</th>
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden xl:table-cell">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredUsers.map(u => {
                      const status = u.status || 'active';
                      return (
                        <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <Link to={`/users/${u.id}`} className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold shrink-0">
                                {(u.full_name || 'U')[0].toUpperCase()}
                              </div>
                              <span className="text-sm font-medium text-foreground hover:text-primary">
                                {u.full_name || 'Unnamed'}
                              </span>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{u.email}</td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="text-[10px] capitalize">{u.role || 'viewer'}</Badge>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[status] || STATUS_COLORS.inactive}`}>
                              {status}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <div className="flex gap-1 flex-wrap">
                              {getUserTeams(u.id).map((t, i) => (
                                <Badge key={i} variant="outline" className="text-[10px]">{t}</Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground hidden xl:table-cell">
                            {formatDate(u.last_login_at)}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground hidden xl:table-cell">
                            {formatDate(u.created_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'invitations' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {invitations.filter(i => i.status !== 'accepted').length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No invitations</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3">Email</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Role</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">Status</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Invited By</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">Expires</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invitations
                    .filter(i => i.status !== 'accepted')
                    .map(inv => (
                      <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium">{inv.email}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="text-[10px] capitalize">{inv.role}</Badge>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${
                            inv.status === 'pending'  ? 'bg-amber-100 text-amber-700' :
                            inv.status === 'revoked'  ? 'bg-red-100 text-red-700' :
                            inv.status === 'expired'  ? 'bg-gray-100 text-gray-600' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                          {inv.invited_by_name || '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                          {inv.expires_at ? formatDate(inv.expires_at) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            {inv.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  disabled={resending === inv.id}
                                  onClick={() => handleResend(inv)}
                                >
                                  {resending === inv.id
                                    ? <span className="animate-pulse">Sending…</span>
                                    : <><RefreshCw className="w-3 h-3 mr-1" /> Resend</>
                                  }
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                                  disabled={revoking === inv.id}
                                  onClick={() => handleRevoke(inv)}
                                >
                                  {revoking === inv.id
                                    ? <span className="animate-pulse">Revoking…</span>
                                    : <><XCircle className="w-3 h-3 mr-1" /> Revoke</>
                                  }
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showInvite && (
        <InviteUserModal orgId={org.id} teams={teams} onClose={() => setShowInvite(false)} onSaved={loadData} />
      )}
      {showAddEmployee && (
        <AddEmployeeModal orgId={org.id} teams={teams} onClose={() => setShowAddEmployee(false)} onSaved={loadData} />
      )}
    </div>
  );
}
