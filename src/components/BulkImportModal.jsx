import { useState } from 'react';
import { X, Download, Upload, CheckCircle2, AlertTriangle, Loader2, Users, Grid3X3 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import useModal from '@/hooks/useModal';
import useOrganisation from '@/lib/useOrganisation';
import useTierCheck from '@/hooks/useTierCheck';
import UpgradePromptModal from '@/components/UpgradePromptModal';
import { parseCSV, autoMatchColumns, EMAIL_RE } from '@/lib/csvUtils';
import { downloadCSV, exportFilename } from '@/lib/exportUtils';
import { getLatestAssessments } from '@/utils/assessmentUtils';

const PEOPLE_TEMPLATE = [
  ['Team', 'Member Name', 'Member Email'],
  ['Shift Team A', 'Jane Smith', 'jane.smith@example.com'],
  ['Shift Team A', 'John Doe', 'john.doe@example.com'],
  ['Production Test', 'Alice Brown', 'alice.brown@example.com'],
];

const PEOPLE_FIELDS = [
  { key: 'team',  label: 'Team',  required: true,  labels: ['team', 'team name', 'department', 'group'] },
  { key: 'name',  label: 'Name',  required: true,  labels: ['member name', 'name', 'employee', 'employee name', 'full name', 'person'] },
  { key: 'email', label: 'Email', required: false, labels: ['member email', 'email', 'email address', 'e-mail'] },
];

// Accepted cell tokens for binary skills
const BINARY_TRUE  = new Set(['1', 'y', 'yes', 'true', 'pass', 'competent', 'c', '✓', 'x']);
const BINARY_FALSE = new Set(['0', 'n', 'no', 'false', 'fail', 'not competent', '✗']);

export default function BulkImportModal({ orgId, onClose, onImported }) {
  const dialogRef = useModal(onClose);
  const { user } = useOrganisation();
  const { checkLimit, upgradePrompt, clearPrompt } = useTierCheck();

  const [mode, setMode] = useState('people'); // 'people' | 'assessments'
  const [file, setFile] = useState(null);
  const [rawRows, setRawRows] = useState(null);       // parsed CSV incl. header
  const [mapping, setMapping] = useState({});          // people mode: field → column index
  const [plan, setPlan] = useState(null);              // validated row plan
  const [assessedDate, setAssessedDate] = useState(new Date().toISOString().split('T')[0]);
  const [building, setBuilding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const reset = () => { setRawRows(null); setPlan(null); setResult(null); setError(''); setProgress(0); };

  const handleModeChange = (m) => { setMode(m); setFile(null); reset(); };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setFile(f);
    reset();
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(String(ev.target.result));
      if (rows.length < 2) {
        setError('The file needs a header row plus at least one data row.');
        return;
      }
      setRawRows(rows);
      if (mode === 'people') {
        setMapping(autoMatchColumns(rows[0], PEOPLE_FIELDS));
      }
    };
    reader.readAsText(f);
  };

  const downloadPeopleTemplate = () => downloadCSV('bulk_import_template.csv', PEOPLE_TEMPLATE);

  const downloadMatrixTemplate = async () => {
    const skills = await base44.entities.Skill.filter({ organisation_id: orgId, status: 'active' });
    const header = ['Member Name', ...skills.map(s => s.name)];
    const example = ['Jane Smith', ...skills.map(s => (s.scale_type === 'binary' ? 'yes' : '3'))];
    downloadCSV('assessment_import_template.csv', [header, example]);
  };

  // ── Validation: build an import plan without writing anything ────────────
  const buildPlan = async () => {
    setBuilding(true);
    setError('');
    try {
      if (mode === 'people') await buildPeoplePlan();
      else await buildAssessmentPlan();
    } catch {
      setError('Could not validate the file — please try again.');
    }
    setBuilding(false);
  };

  const buildPeoplePlan = async () => {
    const [teams, members] = await Promise.all([
      base44.entities.Team.filter({ organisation_id: orgId }),
      base44.entities.TeamMember.filter({ organisation_id: orgId }),
    ]);
    const teamByName = new Map(teams.map(t => [t.name.toLowerCase().trim(), t]));
    const memberByTeamName = new Map(members.map(m => [`${m.team_id}::${(m.user_name || '').toLowerCase().trim()}`, m]));
    const memberByEmail = new Map(members.filter(m => m.user_email).map(m => [m.user_email.toLowerCase().trim(), m]));

    // Duplicates INSIDE the file are caught here too — the database snapshot
    // alone can't see two identical rows in one upload.
    const seenInFile = new Map(); // key → first rowNum

    const rows = rawRows.slice(1).map((cells, idx) => {
      const rowNum = idx + 2; // 1-based + header
      const team = mapping.team >= 0 ? String(cells[mapping.team] || '').trim() : '';
      const name = mapping.name >= 0 ? String(cells[mapping.name] || '').trim() : '';
      const email = mapping.email >= 0 ? String(cells[mapping.email] || '').trim() : '';

      if (!team && !name) return { rowNum, action: 'error', reason: 'Both team and name are empty' };
      if (!team) return { rowNum, name, action: 'error', reason: 'Team is empty' };
      if (!name) return { rowNum, team, action: 'error', reason: 'Name is empty' };
      if (email && !EMAIL_RE.test(email)) return { rowNum, team, name, email, action: 'error', reason: `Invalid email: ${email}` };

      const fileKeys = [`${team.toLowerCase()}::${name.toLowerCase()}`, ...(email ? [`email::${email.toLowerCase()}`] : [])];
      const dupOf = fileKeys.map(k => seenInFile.get(k)).find(v => v !== undefined);
      if (dupOf !== undefined) {
        return { rowNum, team, name, email, action: 'skip', reason: `Duplicate of row ${dupOf} in this file` };
      }
      fileKeys.forEach(k => seenInFile.set(k, rowNum));

      const existingTeam = teamByName.get(team.toLowerCase());
      const existing =
        (existingTeam && memberByTeamName.get(`${existingTeam.id}::${name.toLowerCase()}`)) ||
        (email && memberByEmail.get(email.toLowerCase())) || null;

      if (existing) {
        const changes = {};
        if (email && email !== (existing.user_email || '')) changes.user_email = email;
        if (name !== (existing.user_name || '')) changes.user_name = name;
        if (Object.keys(changes).length === 0) {
          return { rowNum, team, name, email, action: 'skip', reason: 'Already exists, nothing to update' };
        }
        return { rowNum, team, name, email, action: 'update', existingId: existing.id, existingUserId: existing.user_id, changes, reason: `Update ${Object.keys(changes).join(', ')}` };
      }

      return { rowNum, team, name, email, action: 'create', newTeam: !existingTeam, reason: existingTeam ? 'New person' : 'New person + new team' };
    });

    setPlan({ kind: 'people', rows });
  };

  const buildAssessmentPlan = async () => {
    const [members, skills, assessments] = await Promise.all([
      base44.entities.TeamMember.filter({ organisation_id: orgId }),
      base44.entities.Skill.filter({ organisation_id: orgId, status: 'active' }),
      base44.entities.SkillAssessment.filter({ organisation_id: orgId }, '-assessed_date', 10000),
    ]);
    const memberByName = new Map();
    for (const m of members) {
      const key = (m.user_name || '').toLowerCase().trim();
      if (key && !memberByName.has(key)) memberByName.set(key, m);
    }
    const skillByName = new Map(skills.map(s => [s.name.toLowerCase().trim(), s]));
    const latest = getLatestAssessments(assessments);

    const header = rawRows[0];
    // Column 0 = person; remaining columns matched to skills by name
    const columnSkills = header.slice(1).map(h => skillByName.get(String(h || '').toLowerCase().trim()) || null);
    const unmatchedColumns = header.slice(1).filter((h, i) => !columnSkills[i] && String(h).trim());

    const rows = [];
    for (let idx = 1; idx < rawRows.length; idx++) {
      const cells = rawRows[idx];
      const rowNum = idx + 1;
      const personName = String(cells[0] || '').trim();
      if (!personName) { rows.push({ rowNum, action: 'error', reason: 'Person name is empty' }); continue; }
      const member = memberByName.get(personName.toLowerCase());
      if (!member) { rows.push({ rowNum, name: personName, action: 'error', reason: 'No person with this name — import people first' }); continue; }

      const cellPlans = [];
      const problems = [];
      for (let c = 1; c < header.length; c++) {
        const skill = columnSkills[c - 1];
        const raw = String(cells[c] ?? '').trim();
        if (!skill || raw === '') continue;
        let level = null;
        if (skill.scale_type === 'binary') {
          const t = raw.toLowerCase();
          if (BINARY_TRUE.has(t)) level = 1;
          else if (BINARY_FALSE.has(t)) level = 0;
          else { problems.push(`"${raw}" is not a yes/no value for ${skill.name}`); continue; }
        } else {
          const n = Number(raw);
          if (!Number.isInteger(n) || n < 0 || n > 4) { problems.push(`"${raw}" is not a level 0–4 for ${skill.name}`); continue; }
          level = n;
        }
        const current = latest[`${member.user_id}-${skill.id}`];
        if (current && Number(current.proficiency_level) === level) continue; // unchanged — skip
        cellPlans.push({ skill, level });
      }

      if (problems.length && cellPlans.length === 0) {
        rows.push({ rowNum, name: personName, action: 'error', reason: problems.join('; ') });
      } else if (cellPlans.length === 0) {
        rows.push({ rowNum, name: personName, action: 'skip', reason: 'No new or changed assessments' });
      } else {
        rows.push({
          rowNum, name: personName, action: 'create', member, cells: cellPlans,
          reason: `${cellPlans.length} assessment${cellPlans.length === 1 ? '' : 's'}${problems.length ? ` (${problems.length} cell${problems.length === 1 ? '' : 's'} skipped: ${problems.join('; ')})` : ''}`,
        });
      }
    }

    setPlan({ kind: 'assessments', rows, unmatchedColumns });
  };

  // ── Execute the plan ──────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!plan) return;
    const actionable = plan.rows.filter(r => r.action === 'create' || r.action === 'update');
    if (actionable.length === 0) return;
    setImporting(true);
    setError('');

    let created = 0, updated = 0, skipped = plan.rows.filter(r => r.action === 'skip').length;
    const failures = plan.rows.filter(r => r.action === 'error')
      .map(r => ({ rowNum: r.rowNum, name: r.name || '', reason: r.reason }));

    if (plan.kind === 'people') {
      const newCount = plan.rows.filter(r => r.action === 'create').length;
      if (newCount > 0 && !(await checkLimit('employee', newCount))) { setImporting(false); return; }

      const teams = await base44.entities.Team.filter({ organisation_id: orgId });
      const teamByName = new Map(teams.map(t => [t.name.toLowerCase().trim(), t]));

      let done = 0;
      for (const row of actionable) {
        try {
          if (row.action === 'update') {
            // A person can belong to several teams (several TeamMember rows
            // sharing user_id), and their name is denormalised onto
            // assessments — update everywhere, like EditEmployeeModal does.
            const rowsForUser = await base44.entities.TeamMember.filter({
              organisation_id: orgId, user_id: row.existingUserId,
            });
            await Promise.all(
              (rowsForUser.length ? rowsForUser : [{ id: row.existingId }])
                .map(m => base44.entities.TeamMember.update(m.id, row.changes))
            );
            if (row.changes.user_name) {
              const theirAssessments = await base44.entities.SkillAssessment.filter({
                organisation_id: orgId, user_id: row.existingUserId,
              });
              await Promise.all(theirAssessments.map(a =>
                base44.entities.SkillAssessment.update(a.id, { user_name: row.changes.user_name })
              ));
            }
            updated++;
          } else {
            let team = teamByName.get(row.team.toLowerCase());
            if (!team) {
              team = await base44.entities.Team.create({ organisation_id: orgId, name: row.team, display_order: 0, manager_ids: [] });
              teamByName.set(row.team.toLowerCase(), team);
            }
            const memberId = crypto.randomUUID();
            await base44.entities.TeamMember.create({
              organisation_id: orgId,
              team_id: team.id,
              user_id: memberId,
              user_name: row.name,
              user_email: row.email || null,
              is_managed_member: true,
              member_id: memberId,
            });
            created++;
          }
        } catch (err) {
          failures.push({ rowNum: row.rowNum, name: row.name, reason: String(err?.message || 'Save failed') });
        }
        done++;
        setProgress(Math.round((done / actionable.length) * 100));
      }
    } else {
      let done = 0;
      for (const row of actionable) {
        for (const cell of row.cells) {
          try {
            await base44.entities.SkillAssessment.create({
              organisation_id: orgId,
              user_id: row.member.user_id,
              user_name: row.member.user_name,
              skill_id: cell.skill.id,
              skill_name: cell.skill.name,
              proficiency_level: cell.level,
              assessed_date: assessedDate,
              assessed_by_user_id: user?.id,
              assessed_by_name: user?.full_name ? `${user.full_name} (import)` : 'CSV import',
            });
            created++;
          } catch (err) {
            failures.push({ rowNum: row.rowNum, name: row.name, reason: `${cell.skill.name}: ${String(err?.message || 'save failed')}` });
          }
        }
        done++;
        setProgress(Math.round((done / actionable.length) * 100));
      }
    }

    await base44.entities.AuditLogEntry.create({
      organisation_id: orgId,
      actor_user_id: user?.id,
      actor_display: user?.full_name || user?.email,
      action: 'data.imported',
      target_type: 'import',
      target_id: plan.kind,
      target_display: file?.name || 'CSV import',
      detail: JSON.stringify({ kind: plan.kind, created, updated, skipped, failed: failures.length }),
    }).catch(() => {});

    setResult({ created, updated, skipped, failures });
    setImporting(false);
    if (created > 0 || updated > 0) onImported();
  };

  const downloadErrorReport = () => {
    if (!result?.failures?.length) return;
    downloadCSV(
      exportFilename('import-errors', plan?.kind || ''),
      [['Row', 'Name', 'Problem'], ...result.failures.map(f => [f.rowNum, f.name, f.reason])]
    );
  };

  // ── Derived counts for the preview ────────────────────────────────────────
  const counts = plan ? {
    create: plan.rows.filter(r => r.action === 'create').length,
    update: plan.rows.filter(r => r.action === 'update').length,
    skip:   plan.rows.filter(r => r.action === 'skip').length,
    error:  plan.rows.filter(r => r.action === 'error').length,
  } : null;

  const ACTION_STYLES = {
    create: 'bg-green-100 text-green-700',
    update: 'bg-blue-100 text-blue-700',
    skip:   'bg-gray-100 text-gray-600',
    error:  'bg-red-100 text-red-700',
  };

  const peopleMappingComplete = mode !== 'people' || (mapping.team >= 0 && mapping.name >= 0);

  return (
    <>
    {upgradePrompt && <UpgradePromptModal prompt={upgradePrompt} onClose={clearPrompt} />}
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1} className="bg-card rounded-xl border border-border shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold">Bulk Import</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Import people or a whole assessment matrix from CSV — everything is validated before anything is saved</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 -m-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Mode */}
          <div className="flex gap-2">
            {[
              ['people', Users, 'People', 'Teams + employees'],
              ['assessments', Grid3X3, 'Assessment matrix', 'Person × skill grid'],
            ].map(([m, Icon, label, sub]) => (
              <button
                key={m}
                type="button"
                onClick={() => handleModeChange(m)}
                className={`flex-1 text-left p-3 rounded-lg border-2 transition-colors ${mode === m ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'}`}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Icon className="w-4 h-4" /> {label}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{sub}</span>
              </button>
            ))}
          </div>

          {/* Template + upload */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-medium text-foreground">
                {mode === 'people'
                  ? 'Columns: team, name, email — any order, any headings; you map them below.'
                  : 'First column: person name. Every other column heading must match a skill name; cells hold ✓/yes/no or levels 0–4.'}
              </p>
              <Button variant="outline" size="sm" onClick={mode === 'people' ? downloadPeopleTemplate : downloadMatrixTemplate}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Template
              </Button>
            </div>
            <label className="cursor-pointer block">
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFile} />
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors bg-background">
                <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">{file ? file.name : 'Click to choose a CSV file…'}</span>
              </div>
            </label>
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
              </p>
            )}
          </div>

          {/* Column mapping (people mode) */}
          {rawRows && mode === 'people' && !plan && !result && (
            <div className="rounded-lg border border-border p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Match your columns</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PEOPLE_FIELDS.map(field => (
                  <div key={field.key}>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {field.label}{field.required && ' *'}
                    </label>
                    <select
                      className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={mapping[field.key] ?? -1}
                      onChange={e => setMapping(m => ({ ...m, [field.key]: Number(e.target.value) }))}
                    >
                      <option value={-1}>— not in file —</option>
                      {rawRows[0].map((h, i) => (
                        <option key={i} value={i}>{String(h || `Column ${i + 1}`)}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {!peopleMappingComplete && <p className="text-xs text-amber-700">Team and Name must both be mapped.</p>}
            </div>
          )}

          {/* Assessment date (assessments mode) */}
          {rawRows && mode === 'assessments' && !plan && !result && (
            <div className="rounded-lg border border-border p-4 flex items-center gap-3 flex-wrap">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assessed date for imported records</label>
              <input
                type="date"
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={assessedDate}
                onChange={e => setAssessedDate(e.target.value)}
              />
            </div>
          )}

          {/* Validation preview */}
          {plan && !result && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className={`px-2 py-0.5 rounded-full font-semibold ${ACTION_STYLES.create}`}>{counts.create} to create</span>
                {counts.update > 0 && <span className={`px-2 py-0.5 rounded-full font-semibold ${ACTION_STYLES.update}`}>{counts.update} to update</span>}
                {counts.skip > 0 && <span className={`px-2 py-0.5 rounded-full font-semibold ${ACTION_STYLES.skip}`}>{counts.skip} unchanged</span>}
                {counts.error > 0 && <span className={`px-2 py-0.5 rounded-full font-semibold ${ACTION_STYLES.error}`}>{counts.error} with problems</span>}
              </div>
              {plan.kind === 'assessments' && plan.unmatchedColumns?.length > 0 && (
                <p className="text-xs text-amber-700">
                  Ignored columns (no matching skill): {plan.unmatchedColumns.join(', ')}
                </p>
              )}
              <div className="rounded-lg border border-border overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground w-12">Row</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Person</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground w-20">Action</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {plan.rows.map((row) => (
                      <tr key={row.rowNum} className="hover:bg-muted/20">
                        <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{row.rowNum}</td>
                        <td className="px-3 py-1.5 font-medium">{row.name || '—'}{row.team ? <span className="text-muted-foreground font-normal"> · {row.team}</span> : ''}</td>
                        <td className="px-3 py-1.5">
                          <span className={`px-1.5 py-0.5 rounded-full font-semibold capitalize ${ACTION_STYLES[row.action]}`}>{row.action}</span>
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">{row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">Nothing has been saved yet — rows with problems are left out; fix them in your file and re-upload, or import the valid rows now.</p>
            </div>
          )}

          {/* Progress */}
          {importing && (
            <div className="space-y-1">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground text-center">{progress}%</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`rounded-lg border p-4 space-y-1 ${result.failures.length ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
              <div className="flex items-center gap-2 text-green-800 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4" /> Import complete
              </div>
              <p className="text-xs text-green-700">{result.created} created{result.updated > 0 ? `, ${result.updated} updated` : ''}</p>
              {result.skipped > 0 && <p className="text-xs text-muted-foreground">{result.skipped} unchanged rows skipped</p>}
              {result.failures.length > 0 && (
                <div className="pt-1 space-y-1.5">
                  <p className="text-xs text-destructive">{result.failures.length} row{result.failures.length === 1 ? '' : 's'} not imported.</p>
                  <Button variant="outline" size="sm" onClick={downloadErrorReport}>
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Download error report
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={onClose}>{result ? 'Close' : 'Cancel'}</Button>
          {rawRows && !plan && !result && (
            <Button onClick={buildPlan} disabled={building || !peopleMappingComplete}>
              {building ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Checking…</> : 'Validate file'}
            </Button>
          )}
          {plan && !result && (
            <Button onClick={handleImport} disabled={importing || (counts.create + counts.update) === 0}>
              {importing
                ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Importing…</>
                : <><Upload className="w-4 h-4 mr-1.5" /> Import {counts.create + counts.update} row{(counts.create + counts.update) === 1 ? '' : 's'}</>}
            </Button>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
