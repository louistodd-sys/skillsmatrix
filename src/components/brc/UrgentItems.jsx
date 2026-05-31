import { useMemo } from 'react';
import { AlertTriangle, Clock, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUS_LABEL = {
  not_started:      'Not Started',
  in_progress:      'In Progress',
  evidence_attached:'Evidence Attached',
  needs_review:     'Needs Review',
  ready:            'Ready',
};

const STATUS_RAG = {
  not_started:      'red',
  in_progress:      'amber',
  evidence_attached:'amber',
  needs_review:     'amber',
  ready:            'green',
};

function RagDot({ rag }) {
  const cls = rag === 'red'
    ? 'bg-rag-red'
    : rag === 'amber'
    ? 'bg-rag-amber'
    : 'bg-rag-green';
  return <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${cls}`} />;
}

export default function UrgentItems({ clauses, statuses, auditTargetDate }) {
  const statusMap = useMemo(() => Object.fromEntries((statuses || []).map(s => [s.clause_id, s])), [statuses]);

  const urgentClauses = useMemo(() => {
    return (clauses || [])
      .map(c => ({ ...c, status: statusMap[c.id] || null }))
      .filter(c => {
        const rag = STATUS_RAG[c.status?.status || 'not_started'];
        return rag === 'red' || (rag === 'amber' && c.is_fundamental);
      })
      .sort((a, b) => {
        // Fundamentals first, then reds, then clause order
        if (a.is_fundamental !== b.is_fundamental) return a.is_fundamental ? -1 : 1;
        const ra = STATUS_RAG[a.status?.status || 'not_started'];
        const rb = STATUS_RAG[b.status?.status || 'not_started'];
        if (ra !== rb) return ra === 'red' ? -1 : 1;
        return (a.display_order || 0) - (b.display_order || 0);
      })
      .slice(0, 10);
  }, [clauses, statusMap]);

  // Days until audit
  const daysUntil = useMemo(() => {
    if (!auditTargetDate) return null;
    const diff = Math.ceil((new Date(auditTargetDate) - new Date()) / 86400000);
    return diff;
  }, [auditTargetDate]);

  if (!urgentClauses.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center justify-center gap-2 min-h-[180px]">
        <span className="text-2xl">🎉</span>
        <p className="font-semibold text-foreground">No urgent items</p>
        <p className="text-sm text-muted-foreground">All fundamental clauses are on track.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rag-red" />
          <h3 className="font-semibold text-foreground">Urgent — Requires Attention</h3>
          <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-rag-red-light text-rag-red-text text-xs font-bold">
            {urgentClauses.length}
          </span>
        </div>
        {daysUntil !== null && (
          <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
            daysUntil <= 30 ? 'bg-rag-red-light text-rag-red-text' :
            daysUntil <= 90 ? 'bg-rag-amber-light text-rag-amber-text' :
            'bg-muted text-muted-foreground'
          }`}>
            <Clock className="w-3.5 h-3.5" />
            {daysUntil > 0 ? `Audit in ${daysUntil}d` : 'Audit overdue'}
          </div>
        )}
      </div>
      <ul className="divide-y divide-border">
        {urgentClauses.map(c => {
          const rag = STATUS_RAG[c.status?.status || 'not_started'];
          const label = STATUS_LABEL[c.status?.status || 'not_started'];
          return (
            <li key={c.id}>
              <Link
                to={`/brc/clauses/${c.id}`}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors group"
              >
                <RagDot rag={rag} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {c.clause_number} — {c.title}
                    {c.is_fundamental && (
                      <span className="ml-2 text-xs font-bold uppercase tracking-wide text-rag-red-text bg-rag-red-light px-1.5 py-0.5 rounded-md">
                        Fundamental
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label} · {c.status?.evidence_count || 0} evidence item(s)</p>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </Link>
            </li>
          );
        })}
      </ul>
      {clauses.length > 10 && (
        <div className="px-5 py-3 border-t border-border">
          <Link to="/brc/clauses?filter=urgent" className="text-xs text-primary font-medium hover:underline">
            View all urgent clauses →
          </Link>
        </div>
      )}
    </div>
  );
}