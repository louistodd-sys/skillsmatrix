/**
 * acceptInvitation — completes the invitation loop.
 *
 * Called by an authenticated user who does not yet belong to an organisation.
 * Finds the newest pending, unexpired invitation matching their email, then
 * (service role): assigns organisation/role/status on their User record,
 * creates TeamMember rows for the invitation's team_ids, and marks the
 * invitation accepted.
 *
 * Seat limits are enforced at accept time: if accepting the invited role
 * would exceed the organisation's admin/manager seats, the user is accepted
 * as a viewer instead and the response says so — they still get in, and an
 * admin can upgrade them after freeing a seat.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TIER_SEATS = {
  free:    { admin: 1,    manager: 0    },
  starter: { admin: 2,    manager: 3    },
  growth:  { admin: 3,    manager: null },
  scale:   { admin: null, manager: null },
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  if (user.organisation_id) {
    return Response.json({ accepted: false, reason: 'already_in_organisation' });
  }
  if (!user.email) {
    return Response.json({ accepted: false, reason: 'no_email' });
  }

  const now = new Date();
  const all = await base44.asServiceRole.entities.Invitation.filter({ status: 'pending' });
  const mine = all
    .filter(inv => (inv.email || '').trim().toLowerCase() === user.email.trim().toLowerCase())
    .sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''));

  const valid = mine.find(inv => !inv.expires_at || new Date(inv.expires_at) > now);

  // Housekeeping: mark any expired pending invitations for this email
  await Promise.all(
    mine.filter(inv => inv.expires_at && new Date(inv.expires_at) <= now)
      .map(inv => base44.asServiceRole.entities.Invitation.update(inv.id, { status: 'expired' }))
  ).catch(() => {});

  if (!valid) {
    return Response.json({ accepted: false, reason: 'no_pending_invitation' });
  }

  const orgId = valid.organisation_id;
  const orgs = await base44.asServiceRole.entities.Organisation.filter({ id: orgId });
  if (!orgs.length) {
    await base44.asServiceRole.entities.Invitation.update(valid.id, { status: 'revoked' });
    return Response.json({ accepted: false, reason: 'organisation_gone' });
  }
  const org = orgs[0];

  // Enforce seat limits at accept time
  let role = valid.role || 'viewer';
  let downgraded = false;
  if (role === 'admin' || role === 'manager') {
    const seats = TIER_SEATS[org.subscription_tier || 'free'] || TIER_SEATS.free;
    const limit = seats[role];
    if (limit !== null) {
      const holders = await base44.asServiceRole.entities.User.filter({ organisation_id: orgId, role });
      if (holders.length >= limit) {
        role = 'viewer';
        downgraded = true;
      }
    }
  }

  await base44.asServiceRole.entities.User.update(user.id, {
    organisation_id: orgId,
    role,
    status: 'active',
  });

  // Apply team assignments from the invitation
  const teamIds = Array.isArray(valid.team_ids) ? valid.team_ids : [];
  for (const teamId of teamIds) {
    const teams = await base44.asServiceRole.entities.Team.filter({ id: teamId });
    if (!teams.length || teams[0].organisation_id !== orgId) continue;
    const existing = await base44.asServiceRole.entities.TeamMember.filter({ team_id: teamId, user_id: user.id });
    if (existing.length) continue;
    await base44.asServiceRole.entities.TeamMember.create({
      organisation_id: orgId,
      team_id: teamId,
      user_id: user.id,
      user_email: user.email,
      user_name: user.full_name || user.email,
    });
  }

  await base44.asServiceRole.entities.Invitation.update(valid.id, {
    status: 'accepted',
    accepted_at: now.toISOString(),
  });

  await base44.asServiceRole.entities.AuditLogEntry.create({
    organisation_id: orgId,
    actor_user_id: user.id,
    actor_display: user.full_name || user.email,
    action: 'invitation.accepted',
    target_type: 'invitation',
    target_id: valid.id,
    target_display: user.email,
    detail: JSON.stringify({ role, downgraded_from: downgraded ? valid.role : undefined, team_ids: teamIds }),
  }).catch(() => {});

  return Response.json({
    accepted: true,
    organisation_id: orgId,
    organisation_name: org.name,
    role,
    downgraded,
  });
});
