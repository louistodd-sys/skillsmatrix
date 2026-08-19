/**
 * sendExpiryReminders — the expiry reminder engine.
 *
 * Modes:
 *   { mode: 'daily' }  (default) — for every latest assessment with an expiry
 *     date, fires an in-app Notification when the days-remaining first drops
 *     inside each of the skill's warning thresholds (default 30/60/90), and a
 *     Notification + email when the assessment has expired. Each event fires
 *     once per assessment per threshold (deduped via Notification.dedupe_key),
 *     so a missed run is caught up on the next one rather than skipped.
 *   { mode: 'digest' } — Monday summary: one Notification + email per
 *     admin/manager listing everything expired or expiring within 90 days.
 *     Honours Organisation.weekly_digest_enabled.
 *
 * Recipients:
 *   - Managers of every team the person belongs to, plus all org admins.
 *   - The person themselves when Organisation.notify_users_on_expiry is on:
 *     in-app if they have a login (their TeamMember.user_id matches a User),
 *     by email otherwise (managed members have an email but no login).
 *
 * Auth: authenticated org admin (runs for their org only), or the scheduler
 * with the x-cron-secret header (runs for all organisations).
 * Schedule: daily run once a day, digest run Mondays.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DAY_MS = 24 * 60 * 60 * 1000;

function daysUntil(dateStr, now) {
  return Math.ceil((new Date(dateStr).getTime() - now.getTime()) / DAY_MS);
}

function latestAssessments(assessments) {
  const map = {};
  const sorted = [...assessments].sort((a, b) => (a.assessed_date || '').localeCompare(b.assessed_date || ''));
  for (const a of sorted) map[`${a.user_id}-${a.skill_id}`] = a;
  return Object.values(map);
}

async function processOrg(base44, org, mode, now) {
  const svc = base44.asServiceRole.entities;
  const orgId = org.id;

  const [skills, assessments, users, teams, teamMembers, existingNotifs] = await Promise.all([
    svc.Skill.filter({ organisation_id: orgId, status: 'active' }),
    svc.SkillAssessment.filter({ organisation_id: orgId }),
    svc.User.filter({ organisation_id: orgId }),
    svc.Team.filter({ organisation_id: orgId }),
    svc.TeamMember.filter({ organisation_id: orgId }),
    svc.Notification.filter({ organisation_id: orgId, type: mode === 'digest' ? 'expiry_digest' : 'expiry_warning' }),
  ]);

  const skillById = Object.fromEntries(skills.map(s => [s.id, s]));
  const loginUserIds = new Set(users.map(u => u.id));
  const admins = users.filter(u => u.role === 'admin' && u.status !== 'inactive');
  const existingKeys = new Set(existingNotifs.map(n => n.dedupe_key).filter(Boolean));

  // member user_id → their teams' manager user ids
  const managersByMember = {};
  for (const tm of teamMembers) {
    const team = teams.find(t => t.id === tm.team_id);
    if (!team || !Array.isArray(team.manager_ids)) continue;
    if (!managersByMember[tm.user_id]) managersByMember[tm.user_id] = new Set();
    for (const mid of team.manager_ids) {
      if (loginUserIds.has(mid)) managersByMember[tm.user_id].add(mid);
    }
  }
  const memberEmailById = {};
  for (const tm of teamMembers) {
    if (tm.user_email) memberEmailById[tm.user_id] = tm.user_email;
  }

  const latest = latestAssessments(assessments).filter(a => a.expiry_date && skillById[a.skill_id]);

  let notificationsCreated = 0;
  let emailsSent = 0;

  const createNotification = async (userId, type, title, body, dedupeKey, link) => {
    if (dedupeKey && existingKeys.has(`${userId}:${dedupeKey}`)) return;
    await svc.Notification.create({
      organisation_id: orgId,
      user_id: userId,
      type,
      title,
      body,
      link: link || '/matrix',
      dedupe_key: dedupeKey ? `${userId}:${dedupeKey}` : undefined,
    });
    if (dedupeKey) existingKeys.add(`${userId}:${dedupeKey}`);
    notificationsCreated++;
  };

  const sendEmail = async (to, subject, body) => {
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to, from_name: 'Skills Matrix App', subject, body,
      });
      emailsSent++;
    } catch (_) {
      // Email failure must not abort the whole run.
    }
  };

  if (mode === 'digest') {
    if (org.weekly_digest_enabled === false) return { notificationsCreated, emailsSent };

    const expired = latest.filter(a => daysUntil(a.expiry_date, now) < 0);
    const expiring = latest
      .filter(a => { const d = daysUntil(a.expiry_date, now); return d >= 0 && d <= 90; })
      .sort((a, b) => (a.expiry_date || '').localeCompare(b.expiry_date || ''));

    if (expired.length === 0 && expiring.length === 0) return { notificationsCreated, emailsSent };

    // ISO week key so a re-run in the same week can't double-send
    const weekKey = `${now.getUTCFullYear()}-W${Math.ceil(((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / DAY_MS + 1) / 7)}`;
    const lines = [
      ...expired.slice(0, 15).map(a => `• EXPIRED — ${a.user_name || a.user_id}: ${a.skill_name || 'skill'} (expired ${a.expiry_date})`),
      ...expiring.slice(0, 15).map(a => `• ${a.user_name || a.user_id}: ${a.skill_name || 'skill'} expires ${a.expiry_date} (${daysUntil(a.expiry_date, now)} days)`),
    ];
    const title = `Weekly expiry digest: ${expired.length} expired, ${expiring.length} expiring within 90 days`;
    const body = `${lines.join('\n')}${(expired.length + expiring.length) > 30 ? '\n…and more — see the matrix.' : ''}`;

    const recipients = users.filter(u => (u.role === 'admin' || u.role === 'manager') && u.status !== 'inactive');
    for (const r of recipients) {
      await createNotification(r.id, 'expiry_digest', title, body, `digest:${weekKey}`, '/matrix');
      await sendEmail(r.email, `[${org.name}] ${title}`, `Hi ${r.full_name || ''},\n\n${body}\n\nOpen the matrix: /matrix\n\n— Skills Matrix App`);
    }
    return { notificationsCreated, emailsSent };
  }

  // ── Daily mode ──────────────────────────────────────────────────────────
  for (const a of latest) {
    const skill = skillById[a.skill_id];
    const d = daysUntil(a.expiry_date, now);
    const thresholds = (Array.isArray(skill.expiry_warning_days) && skill.expiry_warning_days.length
      ? skill.expiry_warning_days : [30, 60, 90]).slice().sort((x, y) => x - y);

    // Recipients: team managers of the person + org admins
    const recipientIds = new Set([...(managersByMember[a.user_id] || []), ...admins.map(u => u.id)]);

    if (d < 0) {
      const title = `${a.user_name || 'A team member'}'s "${a.skill_name || 'skill'}" has expired`;
      const body = `Expired on ${a.expiry_date}. Book refresher training and re-assess to restore compliance.`;
      for (const rid of recipientIds) {
        await createNotification(rid, 'expiry_warning', title, body, `expired:${a.id}`, '/matrix');
      }
      // Expiry is the one event important enough for immediate email
      const emailKey = `expired-email:${a.id}`;
      if (!existingKeys.has(emailKey)) {
        for (const admin of admins) {
          await sendEmail(admin.email, `[${org.name}] Skill expired: ${a.user_name || ''} — ${a.skill_name || ''}`,
            `Hi ${admin.full_name || ''},\n\n${title}.\n${body}\n\n— Skills Matrix App`);
        }
        existingKeys.add(emailKey);
        // Persist the email marker as a self-notification on the first admin
        if (admins[0]) {
          await createNotification(admins[0].id, 'expiry_warning', title, `${body} (email sent)`, `expired-email:${a.id}`, '/matrix');
        }
      }
      if (org.notify_users_on_expiry) {
        if (loginUserIds.has(a.user_id)) {
          await createNotification(a.user_id, 'expiry_warning', `Your "${a.skill_name || 'skill'}" has expired`, body, `expired-self:${a.id}`, '/my-profile');
        } else if (memberEmailById[a.user_id]) {
          const selfKey = `expired-self-email:${a.id}`;
          if (!existingKeys.has(selfKey)) {
            await sendEmail(memberEmailById[a.user_id], `[${org.name}] Your ${a.skill_name || 'skill'} certification has expired`,
              `Hi ${a.user_name || ''},\n\nYour "${a.skill_name || 'skill'}" expired on ${a.expiry_date}. Please speak to your manager about refresher training.\n\n— ${org.name} via Skills Matrix App`);
            existingKeys.add(selfKey);
            if (admins[0]) {
              await createNotification(admins[0].id, 'expiry_warning', `Notified ${a.user_name || 'member'} of expired ${a.skill_name || 'skill'}`, 'Email sent to the team member.', selfKey, '/matrix');
            }
          }
        }
      }
      continue;
    }

    // Warning thresholds: fire once per threshold, smallest applicable first
    for (const t of thresholds) {
      if (d <= t) {
        const title = `${a.user_name || 'A team member'}'s "${a.skill_name || 'skill'}" expires in ${d} day${d === 1 ? '' : 's'}`;
        const body = `Expires ${a.expiry_date}. Book refresher training before it lapses (${t}-day warning).`;
        for (const rid of recipientIds) {
          await createNotification(rid, 'expiry_warning', title, body, `warn${t}:${a.id}`, '/matrix');
        }
        if (org.notify_users_on_expiry && loginUserIds.has(a.user_id)) {
          await createNotification(a.user_id, 'expiry_warning', `Your "${a.skill_name || 'skill'}" expires in ${d} day${d === 1 ? '' : 's'}`, body, `warn${t}-self:${a.id}`, '/my-profile');
        }
        break; // only the tightest threshold per run; earlier ones deduped anyway
      }
    }
  }

  return { notificationsCreated, emailsSent };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  const cronSecret = Deno.env.get('CRON_SECRET');
  const isScheduler = !!cronSecret && req.headers.get('x-cron-secret') === cronSecret;
  const isAdmin = !!user && user.role === 'admin';
  if (!isAdmin && !isScheduler) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const mode = body.mode === 'digest' ? 'digest' : 'daily';
  const now = new Date();

  let orgs;
  if (isAdmin && !isScheduler) {
    orgs = await base44.asServiceRole.entities.Organisation.filter({ id: user.organisation_id });
  } else {
    orgs = await base44.asServiceRole.entities.Organisation.list();
  }

  const results = [];
  for (const org of orgs) {
    try {
      const r = await processOrg(base44, org, mode, now);
      results.push({ organisation_id: org.id, ...r });
    } catch (err) {
      results.push({ organisation_id: org.id, error: String(err?.message || err) });
    }
  }

  return Response.json({
    mode,
    processed: results.length,
    notifications: results.reduce((s, r) => s + (r.notificationsCreated || 0), 0),
    emails: results.reduce((s, r) => s + (r.emailsSent || 0), 0),
    results,
  });
});
