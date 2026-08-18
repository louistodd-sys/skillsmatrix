import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Grid3X3, Search, Users, ChevronDown, ChevronUp, Download, Printer,
  SlidersHorizontal, X, Info,
} from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import useOrganisation from '@/lib/useOrganisation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/EmptyState';
import AssessmentModal from '@/components/AssessmentModal';
import BulkAssessmentModal from '@/components/BulkAssessmentModal';
import { getRAGStatus, getProficiencyLabel, getRAGLabel } from '@/lib/ragUtils';
import { getLatestAssessments } from '@/utils/assessmentUtils';
import { usePageMeta } from '@/lib/pageMeta';
import { formatDate, pluralise } from '@/lib/format';
import { downloadCSV, exportFilename } from '@/lib/exportUtils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ─── Layout constants ──────────────────────────────────────────────────────
const CELL    = 46;  // skill cell px (width + height)
const NAME    = 232; // name column width px
const COL     = 56;  // skill column width px
const SUMMARY = 96;  // per-person summary column width px
const CAT_H   = 40;  // category header row height px
const HEAD_H  = 168; // skill name header height px

// ─── Status colour palette ─────────────────────────────────────────────────
const S = {
  green: { bg: '#16a34a', fg: '#ffffff' },
  amber: { bg: '#d97706', fg: '#ffffff' },
  red:   { bg: '#dc2626', fg: '#ffffff' },
  grey:  { bg: '#f1f5f9', fg: '#64748b' },
};

const STATUS_LABELS = {
  green: 'Current',
  amber: 'Expiring',
  red:   'Gap',
  grey:  'Unassessed',
};

// Symbol shown inside each cell
function getCellSymbol(assessment, skill) {
  if (!assessment) return '—';
  if (skill.scale_type === 'binary') return assessment.proficiency_level >= 1 ? '✓' : '✗';
  return String(assessment.proficiency_level);
}

// Coverage % → colour style
function pctStyle(pct) {
  if (pct >= 80) return { bg: '#dcfce7', fg: '#15803d' };
  if (pct >= 50) return { bg: '#fef3c7', fg: '#92400e' };
  return { bg: '#fee2e2', fg: '#991b1b' };
}

// ─── Status key ────────────────────────────────────────────────────────────
function MatrixLegend() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm print:hidden">
      <div className="flex items-center justify-between gap-4 px-4 py-2.5 flex-wrap">
        <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap">
          {[
            ['green', 'Current',    '#16a34a', 'Assessed, in date and at the required level'],
            ['amber', 'Expiring',   '#d97706', 'Still valid, but inside the renewal window'],
            ['red',   'Gap',        '#dc2626', 'Missing, expired or below the required level'],
            ['grey',  'Unassessed', '#f1f5f9', 'Not required for this team and not assessed'],
          ].map(([status, label, bg, help]) => (
            <span key={status} className="flex items-center gap-1.5" title={help}>
              <span
                className="w-4 h-4 rounded"
                style={{ background: bg, boxShadow: status === 'grey' ? 'inset 0 0 0 1.5px #cbd5e1' : 'none' }}
              />
              <span className="text-xs font-medium text-foreground">{label}</span>
            </span>
          ))}
        </div>
        <button
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0 rounded focus:outline-none focus:ring-2 focus:ring-ring"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
        >
          <Info className="w-3.5 h-3.5" />
          How to read this matrix
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {open && (
        <div className="px-4 pb-3.5 pt-3 border-t border-border space-y-2">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span><span className="font-semibold text-foreground">✓ / ✗</span> Pass / fail (pass-fail skills)</span>
            <span><span className="font-semibold text-foreground">0–4</span> Proficiency level (levelled skills)</span>
            <span><span className="font-semibold text-foreground">—</span> Not yet assessed</span>
            <span><span className="font-semibold text-foreground">•</span> Corner dot marks a skill that is expiring</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Levels: <span className="text-foreground">0</span> Not trained ·
            {' '}<span className="text-foreground">1</span> Awareness ·
            {' '}<span className="text-foreground">2</span> Working knowledge ·
            {' '}<span className="text-foreground">3</span> Competent ·
            {' '}<span className="text-foreground">4</span> Expert
          </p>
          <p className="text-xs text-muted-foreground">
            Click any cell to record an assessment, or a skill name to assess the whole team at once.
            The right-hand column shows each person's compliance against their required skills;
            the bottom row shows how much of the team is current for each skill.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────
export default function SkillsMatrix() {
  const { org, user } = useOrganisation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [teams, setTeams]                   = useState([]);
  const [selectedTeam, setSelectedTeam]     = useState(searchParams.get('team') || 'all');
  const [members, setMembers]               = useState([]);
  const [skills, setSkills]                 = useState([]);
  const [categories, setCategories]         = useState([]);
  const [assessments, setAssessments]       = useState([]);
  const [reqSkills, setReqSkills]           = useState([]);
  const [loading, setLoading]               = useState(true);

  const [searchMember, setSearchMember]         = useState('');
  const [filterCategory, setFilterCategory]     = useState('all');
  const [showOnlyRequired, setShowOnlyRequired] = useState(false);
  const [showOnlyExpiring, setShowOnlyExpiring] = useState(false);
  const [assessingCell, setAssessingCell]       = useState(null);
  const [bulkSkill, setBulkSkill]               = useState(null);

  useEffect(() => { if (org) loadData(); }, [org]);

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

  // Latest assessment per user+skill
  const currentAssessments = useMemo(() => getLatestAssessments(assessments), [assessments]);

  // ── Members ─────────────────────────────────────────────────────────────
  let filteredMembers = members;
  if (selectedTeam !== 'all') {
    const ids = new Set(members.filter(m => m.team_id === selectedTeam).map(m => m.user_id));
    filteredMembers = members.filter(m => ids.has(m.user_id));
  }
  const memberMap = {};
  filteredMembers.forEach(m => { if (!memberMap[m.user_id]) memberMap[m.user_id] = m; });
  let uniqueMembers = Object.values(memberMap);
  uniqueMembers.sort((a, b) => (a.user_name || '').localeCompare(b.user_name || ''));
  const totalMembers = uniqueMembers.length;
  if (searchMember) {
    uniqueMembers = uniqueMembers.filter(m =>
      (m.user_name || '').toLowerCase().includes(searchMember.toLowerCase())
    );
  }

  // Requirement lookup
  const getReq = (userId, skillId) => {
    if (selectedTeam !== 'all')
      return reqSkills.find(r => r.team_id === selectedTeam && r.skill_id === skillId);
    const tm = members.find(m => m.user_id === userId);
    return tm ? reqSkills.find(r => r.team_id === tm.team_id && r.skill_id === skillId) : undefined;
  };

  // ── Skills ──────────────────────────────────────────────────────────────
  let visibleSkills = skills;
  if (filterCategory !== 'all') {
    visibleSkills = visibleSkills.filter(s => s.category_id === filterCategory);
  }
  if (showOnlyRequired && selectedTeam !== 'all') {
    const reqIds = new Set(
      reqSkills.filter(r => r.team_id === selectedTeam && r.is_required).map(r => r.skill_id)
    );
    visibleSkills = visibleSkills.filter(s => reqIds.has(s.id));
  }
  if (showOnlyExpiring) {
    visibleSkills = visibleSkills.filter(s =>
      uniqueMembers.some(m => {
        const st = getRAGStatus(currentAssessments[`${m.user_id}-${s.id}`], s, getReq(m.user_id, s.id));
        return st === 'amber' || st === 'red';
      })
    );
  }

  const groupedSkills = categories
    .map(cat => ({ ...cat, skills: visibleSkills.filter(s => s.category_id === cat.id) }))
    .filter(g => g.skills.length > 0);
  const allVisibleSkills = groupedSkills.flatMap(g => g.skills);

  const teamName = selectedTeam === 'all'
    ? 'All teams'
    : (teams.find(t => t.id === selectedTeam)?.name || 'Team');

  usePageMeta({
    subtitle: loading
      ? undefined
      : `${teamName} · ${pluralise(totalMembers, 'member')} · ${pluralise(allVisibleSkills.length, 'skill')}`,
  });

  // The compliance column only docks to the right edge when the matrix is wider
  // than the screen — otherwise it would float away from the last skill column.
  const scrollRef = useRef(null);
  const [scrollsSideways, setScrollsSideways] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () =>
      setScrollsSideways(NAME + SUMMARY + COL * allVisibleSkills.length > el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [allVisibleSkills.length, loading]);

  // `right: auto` keeps the column in normal flow when nothing is off-screen.
  const dockedRight = scrollsSideways ? 0 : 'auto';

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-11 rounded-xl bg-muted animate-pulse" />
        <div className="h-11 rounded-xl bg-muted animate-pulse w-2/3" />
        <div className="h-96 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <EmptyState
        icon={Grid3X3}
        title="Your matrix is waiting on skills"
        description="Add the skills, tickets and certificates you track — or import a ready-made industry template — and they become the columns of your matrix."
        actionLabel="Go to Skills Library"
        onAction={() => navigate('/skills-library')}
      />
    );
  }

  if (members.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No people to assess yet"
        description="Create a team and add your people — each person becomes a row in the matrix."
        actionLabel="Go to Teams"
        onAction={() => navigate('/teams')}
      />
    );
  }

  // ── Derived stats ───────────────────────────────────────────────────────
  const statusFor = (member, skill) =>
    getRAGStatus(currentAssessments[`${member.user_id}-${skill.id}`], skill, getReq(member.user_id, skill.id));

  // Per-skill coverage % (column totals)
  const skillCompliance = {};
  allVisibleSkills.forEach(skill => {
    let green = 0;
    uniqueMembers.forEach(m => { if (statusFor(m, skill) === 'green') green++; });
    skillCompliance[skill.id] = uniqueMembers.length > 0
      ? Math.round((green / uniqueMembers.length) * 100)
      : 0;
  });

  // Per-person compliance against required skills (row totals)
  const memberSummary = {};
  uniqueMembers.forEach(member => {
    let green = 0, required = 0, gaps = 0, expiring = 0;
    allVisibleSkills.forEach(skill => {
      const status = statusFor(member, skill);
      const isRequired = !!getReq(member.user_id, skill.id)?.is_required;
      if (isRequired) {
        required++;
        if (status === 'green') green++;
      }
      if (status === 'red') gaps++;
      if (status === 'amber') expiring++;
    });
    memberSummary[member.user_id] = {
      required, green, gaps, expiring,
      pct: required > 0 ? Math.round((green / required) * 100) : null,
    };
  });

  const overallPct = (() => {
    let green = 0, required = 0;
    Object.values(memberSummary).forEach(s => { green += s.green; required += s.required; });
    return required > 0 ? Math.round((green / required) * 100) : null;
  })();

  const activeFilterCount =
    (filterCategory !== 'all' ? 1 : 0) +
    (showOnlyRequired ? 1 : 0) +
    (showOnlyExpiring ? 1 : 0) +
    (searchMember ? 1 : 0);

  const clearFilters = () => {
    setFilterCategory('all');
    setShowOnlyRequired(false);
    setShowOnlyExpiring(false);
    setSearchMember('');
  };

  // ── Export ──────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const header1 = ['', ...groupedSkills.flatMap(cat => cat.skills.map(() => cat.name)), 'Compliance %'];
    const header2 = ['Team member', ...allVisibleSkills.map(s => s.name), ''];
    const rows = uniqueMembers.map(member => [
      member.user_name || 'Unknown',
      ...allVisibleSkills.map(skill => {
        const assessment = currentAssessments[`${member.user_id}-${skill.id}`];
        const status = statusFor(member, skill);
        const level = assessment
          ? getProficiencyLabel(assessment.proficiency_level, skill.scale_type)
          : 'Not assessed';
        const expiry = assessment?.expiry_date ? ` (expires ${formatDate(assessment.expiry_date)})` : '';
        return `${STATUS_LABELS[status]} — ${level}${expiry}`;
      }),
      memberSummary[member.user_id].pct === null ? 'n/a' : `${memberSummary[member.user_id].pct}%`,
    ]);
    const coverage = [
      'Coverage %',
      ...allVisibleSkills.map(s => `${skillCompliance[s.id]}%`),
      overallPct === null ? 'n/a' : `${overallPct}%`,
    ];

    downloadCSV(
      exportFilename('skills-matrix', teamName),
      [
        [`Skills matrix — ${org?.name || ''}`],
        [`${teamName} · exported ${formatDate(new Date())}`],
        [],
        header1, header2, ...rows, [], coverage,
      ]
    );
  };

  // ── Shared cell styling ─────────────────────────────────────────────────
  const catBorder  = (ci) => ci > 0 ? '3px solid #ffffff' : '1px solid hsl(var(--border))';
  const cellBorder = (si, ci) => si === 0 && ci > 0 ? '3px solid hsl(var(--border))' : '1px solid hsl(var(--border))';

  return (
    <div className="space-y-4">
      {/* ── Print-only report header (screen shows this via the top bar) ── */}
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold text-foreground">Skills Matrix</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {org?.name ? `${org.name} · ` : ''}{teamName} · {pluralise(uniqueMembers.length, 'person', 'people')} ·
          {' '}{pluralise(allVisibleSkills.length, 'skill')} · printed {formatDate(new Date())}
        </p>
        <div className="flex gap-4 mt-2">
          {[['Current', '#16a34a'], ['Expiring', '#d97706'], ['Gap', '#dc2626'], ['Unassessed', '#f1f5f9']].map(([label, bg]) => (
            <span key={label} className="flex items-center gap-1.5 text-xs">
              <span className="w-3 h-3 rounded" style={{ background: bg, boxShadow: 'inset 0 0 0 1px #cbd5e1' }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Status key ── */}
      <MatrixLegend />

      {/* ── Controls ── */}
      <div className="flex flex-wrap gap-2 items-center print:hidden">
        <div className="flex items-center gap-2">
          <label htmlFor="matrix-team" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Team
          </label>
          <select
            id="matrix-team"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
            value={selectedTeam}
            onChange={e => { setSelectedTeam(e.target.value); setShowOnlyRequired(false); }}
          >
            {user?.role === 'admin' && <option value="all">All teams</option>}
            {teams
              .filter(t => user?.role === 'admin' || t.manager_ids?.includes(user?.id))
              .map(t => <option key={t.id} value={t.id}>{t.name}</option>)
            }
          </select>
        </div>

        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          aria-label="Filter by skill category"
        >
          <option value="all">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search people…"
            value={searchMember}
            onChange={e => setSearchMember(e.target.value)}
            className="pl-8 h-9 w-44 text-sm"
            aria-label="Search team members"
          />
        </div>

        {selectedTeam !== 'all' && (
          <Button
            type="button"
            variant={showOnlyRequired ? 'default' : 'outline'}
            size="sm"
            className="h-9"
            aria-pressed={showOnlyRequired}
            onClick={() => setShowOnlyRequired(v => !v)}
          >
            Required skills only
          </Button>
        )}

        <Button
          type="button"
          variant={showOnlyExpiring ? 'default' : 'outline'}
          size="sm"
          className="h-9"
          aria-pressed={showOnlyExpiring}
          onClick={() => setShowOnlyExpiring(v => !v)}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
          Gaps &amp; expiring only
        </Button>

        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="h-9 px-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline rounded focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <X className="w-3.5 h-3.5" />
            Clear {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'}
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden lg:inline">
            Showing {uniqueMembers.length} of {totalMembers} people
          </span>
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={handleExportCSV}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => window.print()}>
            <Printer className="w-3.5 h-3.5 mr-1.5" /> Print
          </Button>
        </div>
      </div>

      {/* ── Desktop matrix ── */}
      <div className="hidden md:block rounded-xl border border-border bg-card shadow-sm overflow-hidden print:border-0 print:shadow-none">
        <div
          ref={scrollRef}
          className="matrix-scroll overflow-auto"
          style={{ maxHeight: 'calc(100vh - 320px)', minHeight: 280 }}
        >
          <TooltipProvider delayDuration={150}>
            <table
              style={{
                borderCollapse: 'separate',
                borderSpacing: 0,
                width: 'max-content',
                minWidth: '100%',
                tableLayout: 'fixed',
              }}
            >
              <colgroup>
                <col style={{ width: NAME }} />
                {allVisibleSkills.map(s => <col key={s.id} style={{ width: COL }} />)}
                <col style={{ width: SUMMARY }} />
                {/* Filler soaks up any spare width so the data columns stay tight
                    together instead of stretching across the page. */}
                <col style={{ width: 'auto' }} />
              </colgroup>

              <thead>
                {/* ── Row 1: category bands ── */}
                <tr>
                  <th
                    rowSpan={2}
                    scope="col"
                    style={{
                      position: 'sticky', left: 0, top: 0, zIndex: 40,
                      width: NAME, padding: '0 16px',
                      background: 'hsl(var(--muted))',
                      borderBottom: '2px solid hsl(var(--border))',
                      borderRight: '2px solid hsl(var(--border))',
                      textAlign: 'left', verticalAlign: 'bottom',
                    }}
                  >
                    <span className="text-2xs font-bold uppercase tracking-widest text-muted-foreground block pb-3">
                      Team member
                    </span>
                  </th>

                  {groupedSkills.map((cat, ci) => (
                    <th
                      key={cat.id}
                      colSpan={cat.skills.length}
                      scope="colgroup"
                      style={{
                        position: 'sticky', top: 0, zIndex: 20,
                        background: 'hsl(var(--muted))',
                        color: 'hsl(var(--foreground))',
                        height: CAT_H,
                        padding: '0 8px',
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        borderBottom: `3px solid ${cat.colour || '#6B7280'}`,
                        borderLeft: catBorder(ci),
                      }}
                    >
                      <span
                        className="inline-flex items-center gap-1.5"
                        style={{ position: 'sticky', left: NAME + 14, right: SUMMARY + 14 }}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: cat.colour || '#6B7280' }}
                        />
                        {cat.name}
                      </span>
                    </th>
                  ))}

                  <th
                    rowSpan={2}
                    scope="col"
                    style={{
                      position: 'sticky', top: 0, right: dockedRight, zIndex: 40,
                      width: SUMMARY,
                      background: 'hsl(var(--muted))',
                      borderBottom: '2px solid hsl(var(--border))',
                      borderLeft: '2px solid hsl(var(--border))',
                      textAlign: 'center', verticalAlign: 'bottom',
                      padding: '0 6px',
                    }}
                  >
                    <span className="text-2xs font-bold uppercase tracking-widest text-muted-foreground block pb-3 leading-tight">
                      Compliance
                    </span>
                  </th>

                  <th
                    rowSpan={2}
                    aria-hidden="true"
                    style={{
                      position: 'sticky', top: 0, zIndex: 10,
                      background: 'hsl(var(--muted))',
                      borderBottom: '2px solid hsl(var(--border))',
                    }}
                  />
                </tr>

                {/* ── Row 2: skill names (vertical) ── */}
                <tr>
                  {groupedSkills.map((cat, ci) =>
                    cat.skills.map((skill, si) => (
                      <th
                        key={skill.id}
                        scope="col"
                        style={{
                          position: 'sticky', top: CAT_H, zIndex: 10,
                          width: COL,
                          height: HEAD_H,
                          background: 'hsl(var(--card))',
                          borderBottom: '2px solid hsl(var(--border))',
                          borderLeft: cellBorder(si, ci),
                          padding: '8px 2px 10px',
                          verticalAlign: 'bottom',
                        }}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className="group flex flex-col items-center justify-end w-full rounded focus:outline-none focus:ring-2 focus:ring-ring"
                              style={{ height: HEAD_H - 20 }}
                              onClick={() => setBulkSkill(skill)}
                            >
                              <span
                                style={{
                                  writingMode: 'vertical-rl',
                                  transform: 'rotate(180deg)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxHeight: HEAD_H - 38,
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  lineHeight: 1.2,
                                  color: 'hsl(var(--foreground))',
                                }}
                              >
                                {skill.name}
                              </span>
                              <Users
                                style={{ width: 13, height: 13, marginTop: 5, flexShrink: 0 }}
                                className="text-muted-foreground opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity"
                              />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p className="font-semibold">{skill.name}</p>
                            <p className="text-xs text-muted-foreground">{cat.name}</p>
                            <p className="text-xs mt-1 text-primary">Click to assess every listed person on this skill</p>
                          </TooltipContent>
                        </Tooltip>
                      </th>
                    ))
                  )}
                </tr>
              </thead>

              <tbody>
                {uniqueMembers.length === 0 && (
                  <tr>
                    <td
                      colSpan={allVisibleSkills.length + 3}
                      className="py-12 px-4 text-center text-sm text-muted-foreground"
                    >
                      No people match your filters.{' '}
                      <button onClick={clearFilters} className="text-primary hover:underline">Clear filters</button>
                    </td>
                  </tr>
                )}

                {uniqueMembers.map((member, ri) => {
                  const summary = memberSummary[member.user_id];
                  const rowBg = ri % 2 === 0 ? 'matrix-row-even' : 'matrix-row-odd';
                  return (
                    <tr key={member.user_id} className="group">
                      {/* Sticky name */}
                      <th
                        scope="row"
                        className={`${rowBg} matrix-cell`}
                        style={{
                          position: 'sticky', left: 0, zIndex: 10,
                          width: NAME, height: CELL + 8,
                          padding: '0 16px',
                          borderBottom: '1px solid hsl(var(--border))',
                          borderRight: '2px solid hsl(var(--border))',
                          textAlign: 'left',
                          whiteSpace: 'nowrap',
                          fontWeight: 600,
                        }}
                      >
                        <span className="text-sm font-semibold text-foreground">
                          {member.user_name || 'Unknown'}
                        </span>
                        {member.is_managed_member && (
                          <span className="block text-2xs text-muted-foreground font-normal leading-none mt-0.5">
                            Managed profile
                          </span>
                        )}
                      </th>

                      {/* Skill cells */}
                      {groupedSkills.map((cat, ci) =>
                        cat.skills.map((skill, si) => {
                          const assessment = currentAssessments[`${member.user_id}-${skill.id}`];
                          const req        = getReq(member.user_id, skill.id);
                          const status     = getRAGStatus(assessment, skill, req);
                          const sym        = getCellSymbol(assessment, skill);
                          const label      = getRAGLabel(status, assessment, skill, req);
                          const profLabel  = getProficiencyLabel(assessment?.proficiency_level, skill.scale_type);

                          return (
                            <td
                              key={skill.id}
                              className={`${rowBg} matrix-cell`}
                              style={{
                                padding: '3px 5px',
                                borderBottom: '1px solid hsl(var(--border))',
                                borderLeft: cellBorder(si, ci),
                                textAlign: 'center',
                              }}
                            >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className="relative rounded-md transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-ring active:scale-95"
                                    style={{
                                      width: CELL,
                                      height: CELL,
                                      background: S[status].bg,
                                      color: S[status].fg,
                                      fontSize: 19,
                                      fontWeight: 700,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      lineHeight: 1,
                                      boxShadow: status === 'grey' ? 'inset 0 0 0 1.5px #cbd5e1' : 'none',
                                    }}
                                    onClick={() => setAssessingCell({ userId: member.user_id, userName: member.user_name, skill, assessment })}
                                    aria-label={`${member.user_name} — ${skill.name}: ${label}. Click to assess.`}
                                  >
                                    {sym}
                                    {status === 'amber' && (
                                      // Non-colour cue for expiring, for colour-blind readers
                                      <span
                                        aria-hidden="true"
                                        style={{
                                          position: 'absolute', top: 3, right: 3,
                                          width: 6, height: 6, borderRadius: 999,
                                          background: '#ffffff',
                                        }}
                                      />
                                    )}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="w-60">
                                  <p className="font-semibold text-sm">{member.user_name}</p>
                                  <p className="text-xs text-muted-foreground mb-2">{skill.name} · {cat.name}</p>
                                  <div className="space-y-0.5 text-xs">
                                    <p><span className="font-medium">Status:</span> {label}</p>
                                    <p><span className="font-medium">Level:</span> {profLabel}</p>
                                    {req?.is_required && (
                                      <p>
                                        <span className="font-medium">Required:</span>{' '}
                                        {getProficiencyLabel(req.minimum_proficiency ?? 1, skill.scale_type)} or above
                                      </p>
                                    )}
                                    {assessment?.assessed_date && (
                                      <p><span className="font-medium">Assessed:</span> {formatDate(assessment.assessed_date)}</p>
                                    )}
                                    {assessment?.expiry_date && (
                                      <p><span className="font-medium">Expires:</span> {formatDate(assessment.expiry_date)}</p>
                                    )}
                                    {assessment?.assessed_by_name && (
                                      <p><span className="font-medium">By:</span> {assessment.assessed_by_name}</p>
                                    )}
                                    {assessment?.notes && (
                                      <p className="italic text-muted-foreground">“{assessment.notes}”</p>
                                    )}
                                  </div>
                                  <p className="text-xs text-primary mt-2">Click to assess</p>
                                </TooltipContent>
                              </Tooltip>
                            </td>
                          );
                        })
                      )}

                      {/* Per-person compliance */}
                      <td
                        className={`${rowBg} matrix-cell`}
                        style={{
                          position: scrollsSideways ? 'sticky' : 'static',
                          right: dockedRight, zIndex: 10,
                          width: SUMMARY,
                          borderBottom: '1px solid hsl(var(--border))',
                          borderLeft: '2px solid hsl(var(--border))',
                          textAlign: 'center',
                          padding: '4px 8px',
                        }}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-default">
                              <span
                                className="text-sm font-bold tabular-nums"
                                style={{
                                  color: summary.pct === null ? 'hsl(var(--muted-foreground))'
                                    : summary.pct >= 80 ? '#15803d'
                                    : summary.pct >= 50 ? '#92400e'
                                    : '#991b1b',
                                }}
                              >
                                {summary.pct === null ? '—' : `${summary.pct}%`}
                              </span>
                              <span className="block text-2xs text-muted-foreground leading-none mt-0.5 tabular-nums">
                                {summary.required > 0 ? `${summary.green}/${summary.required}` : 'none required'}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p className="text-xs">
                              {summary.required > 0
                                ? `${summary.green} of ${summary.required} required skills current`
                                : 'No required skills set for this person’s team'}
                            </p>
                            {summary.gaps > 0 && <p className="text-xs">{summary.gaps} gap{summary.gaps === 1 ? '' : 's'}</p>}
                            {summary.expiring > 0 && <p className="text-xs">{summary.expiring} expiring</p>}
                          </TooltipContent>
                        </Tooltip>
                      </td>

                      <td
                        aria-hidden="true"
                        className={`${rowBg} matrix-cell`}
                        style={{ borderBottom: '1px solid hsl(var(--border))' }}
                      />
                    </tr>
                  );
                })}
              </tbody>

              {/* ── Coverage % footer (stays visible while scrolling) ── */}
              {uniqueMembers.length > 0 && (
                <tfoot>
                  <tr>
                    <th
                      scope="row"
                      style={{
                        position: 'sticky', left: 0, bottom: 0, zIndex: 30,
                        width: NAME,
                        padding: '8px 16px',
                        background: 'hsl(var(--muted))',
                        borderTop: '2px solid hsl(var(--border))',
                        borderRight: '2px solid hsl(var(--border))',
                        textAlign: 'left',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                        Team coverage
                      </span>
                    </th>

                    {groupedSkills.map((cat, ci) =>
                      cat.skills.map((skill, si) => {
                        const pct = skillCompliance[skill.id] ?? 0;
                        const ps  = pctStyle(pct);
                        return (
                          <td
                            key={skill.id}
                            style={{
                              position: 'sticky', bottom: 0, zIndex: 20,
                              textAlign: 'center',
                              padding: '6px 5px',
                              background: 'hsl(var(--muted))',
                              borderTop: '2px solid hsl(var(--border))',
                              borderLeft: cellBorder(si, ci),
                            }}
                          >
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className="rounded font-bold cursor-default tabular-nums"
                                  style={{ background: ps.bg, color: ps.fg, fontSize: 12, padding: '4px 2px' }}
                                >
                                  {pct}%
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">{skill.name}: {pct}% of listed people are current</p>
                              </TooltipContent>
                            </Tooltip>
                          </td>
                        );
                      })
                    )}

                    <td
                      style={{
                        position: 'sticky', bottom: 0, right: dockedRight, zIndex: 30,
                        width: SUMMARY,
                        textAlign: 'center',
                        padding: '6px 8px',
                        background: 'hsl(var(--muted))',
                        borderTop: '2px solid hsl(var(--border))',
                        borderLeft: '2px solid hsl(var(--border))',
                      }}
                    >
                      <span className="text-sm font-extrabold text-foreground tabular-nums">
                        {overallPct === null ? '—' : `${overallPct}%`}
                      </span>
                    </td>

                    <td
                      aria-hidden="true"
                      style={{
                        position: 'sticky', bottom: 0, zIndex: 10,
                        background: 'hsl(var(--muted))',
                        borderTop: '2px solid hsl(var(--border))',
                      }}
                    />
                  </tr>
                </tfoot>
              )}
            </table>
          </TooltipProvider>
        </div>
      </div>

      {/* ── Mobile: card per person ── */}
      <div className="md:hidden space-y-3">
        {uniqueMembers.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No people match your filters.
          </p>
        )}
        {uniqueMembers.map(member => {
          const summary = memberSummary[member.user_id];
          let g = 0, a = 0, r = 0, gr = 0;
          allVisibleSkills.forEach(skill => {
            const st = statusFor(member, skill);
            if (st === 'green') g++;
            else if (st === 'amber') a++;
            else if (st === 'red') r++;
            else gr++;
          });

          return (
            <div key={member.user_id} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Member row header */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/30 border-b border-border">
                <div className="min-w-0">
                  <p className="text-md font-bold text-foreground leading-tight truncate">
                    {member.user_name || 'Unknown'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {summary.pct === null
                      ? 'No required skills'
                      : `${summary.pct}% compliant · ${summary.green}/${summary.required} required current`}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {[['green', g], ['amber', a], ['red', r], ['grey', gr]].map(
                    ([st, cnt]) => cnt > 0 && (
                      <span
                        key={st}
                        className="w-8 h-8 rounded-md flex items-center justify-center text-sm font-bold"
                        style={{
                          background: S[st].bg,
                          color: S[st].fg,
                          boxShadow: st === 'grey' ? 'inset 0 0 0 1.5px #cbd5e1' : 'none',
                        }}
                        title={`${cnt} ${STATUS_LABELS[st].toLowerCase()}`}
                      >
                        {cnt}
                      </span>
                    )
                  )}
                </div>
              </div>

              {/* Skills grid */}
              <div className="p-3 space-y-4">
                {groupedSkills.map(cat => (
                  <div key={cat.id}>
                    <p className="text-2xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 text-muted-foreground">
                      <span className="w-2 h-2 rounded-full" style={{ background: cat.colour || '#6B7280' }} />
                      {cat.name}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {cat.skills.map(skill => {
                        const assessment = currentAssessments[`${member.user_id}-${skill.id}`];
                        const status     = statusFor(member, skill);
                        const sym        = getCellSymbol(assessment, skill);
                        return (
                          <button
                            key={skill.id}
                            className="flex flex-col items-center gap-1 group w-14"
                            onClick={() => setAssessingCell({ userId: member.user_id, userName: member.user_name, skill, assessment })}
                            aria-label={`${skill.name}: ${STATUS_LABELS[status]}. Tap to assess.`}
                          >
                            <span
                              className="w-11 h-11 rounded-lg flex items-center justify-center font-bold text-lg transition-transform group-active:scale-95"
                              style={{
                                background: S[status].bg,
                                color: S[status].fg,
                                boxShadow: status === 'grey' ? 'inset 0 0 0 1.5px #cbd5e1' : 'none',
                              }}
                            >
                              {sym}
                            </span>
                            <span className="text-2xs text-muted-foreground text-center leading-tight line-clamp-2">
                              {skill.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bulk assess hint */}
      {uniqueMembers.length > 0 && (
        <p className="hidden md:flex items-center gap-2 text-xs text-muted-foreground print:hidden">
          <Users className="w-3.5 h-3.5" />
          Tip: click a skill name to assess everyone in the list at once — useful after a group training session.
        </p>
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
