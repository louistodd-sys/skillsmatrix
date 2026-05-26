import BrcModuleGuard from '@/components/BrcModuleGuard';
import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import useOrganisation from '@/lib/useOrganisation';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const STATUS_OPTIONS = ['not_started','in_progress','evidence_attached','ready','needs_review'];
const STATUS_LABELS  = { not_started:'Not Started', in_progress:'In Progress', evidence_attached:'Evidence Attached', ready:'Ready', needs_review:'Needs Review' };

function BrcClauseDetailContent() {
  const { clauseId } = useParams();
  const { org, user } = useOrganisation();
  const [clause, setClause] = useState(null);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('not_started');

  useEffect(() => {
    if (!org || !clauseId) return;
    Promise.all([
      base44.entities.BRCClause.filter({ id: clauseId }),
      base44.entities.BRCClauseStatus.filter({ organisation_id: org.id, clause_id: clauseId }),
    ]).then(([cl, st]) => {
      if (cl[0]) setClause(cl[0]);
      if (st[0]) {
        setStatus(st[0]);
        setNotes(st[0].notes || '');
        setSelectedStatus(st[0].status || 'not_started');
      }
    });
  }, [org?.id, clauseId]);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      organisation_id:   org.id,
      clause_id:         clauseId,
      status:            selectedStatus,
      notes,
      last_reviewed_date: new Date().toISOString().split('T')[0],
      last_reviewed_by:  user?.id,
    };
    let record;
    if (status?.id) {
      record = await base44.entities.BRCClauseStatus.update(status.id, payload);
    } else {
      record = await base44.entities.BRCClauseStatus.create(payload);
    }
    setStatus(record);
    await base44.entities.AuditLogEntry.create({
      organisation_id: org.id,
      actor_user_id:   user?.id,
      actor_display:   user?.full_name || user?.email,
      action:          'brc_clause_status.updated',
      target_type:     'brc_clause_status',
      target_id:       record.id || clauseId,
      target_display:  clause?.clause_number || clauseId,
      detail: JSON.stringify({ status: selectedStatus }),
    }).catch(() => {});
    setSaving(false);
  };

  if (!clause) return <div className="h-32 bg-muted animate-pulse rounded-xl" />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Link to="/brc/clauses" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">{clause.clause_number} — {clause.title}</h1>
        {clause.is_fundamental && <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Fundamental</span>}
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Description</p>
          <p className="text-sm text-foreground">{clause.description}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Evidence Requirement</p>
          <p className="text-sm text-foreground">{clause.evidence_requirement}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-base font-semibold">Compliance Status</h2>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</label>
          <select
            className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</label>
          <textarea
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-24 resize-y"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add notes about evidence, actions, or observations…"
          />
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? 'Saving…' : 'Save Status'}
        </Button>
      </div>
    </div>
  );
}

export default function BrcClauseDetail() {
  return <BrcModuleGuard><BrcClauseDetailContent /></BrcModuleGuard>;
}