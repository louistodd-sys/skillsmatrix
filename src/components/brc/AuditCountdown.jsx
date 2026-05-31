import { CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BRC_STANDARD_LABELS } from '@/lib/brcModuleGuard';

export default function AuditCountdown({ org }) {
  const targetDate = org?.brc_audit_target_date;
  const standard   = org?.brc_standard;

  if (!targetDate) {
    return (
      <div className="bg-card border border-dashed border-border rounded-xl p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <CalendarDays className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">No audit date set</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            <Link to="/brc/settings" className="text-primary hover:underline">Set your target audit date</Link> to track your countdown.
          </p>
        </div>
      </div>
    );
  }

  const now   = new Date();
  const audit = new Date(targetDate);
  const days  = Math.ceil((audit - now) / 86400000);
  const weeks = Math.round(days / 7);

  const urgency = days <= 30 ? 'red' : days <= 90 ? 'amber' : 'green';
  const bgCls   = urgency === 'red' ? 'bg-rag-red-light border-rag-red/30' :
                  urgency === 'amber' ? 'bg-rag-amber-light border-rag-amber/30' :
                  'bg-rag-green-light border-rag-green/30';
  const textCls = urgency === 'red' ? 'text-rag-red-text' :
                  urgency === 'amber' ? 'text-rag-amber-text' : 'text-rag-green-text';

  return (
    <div className={`border rounded-xl p-5 flex items-center gap-4 ${bgCls}`}>
      <div className={`w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center shrink-0`}>
        <CalendarDays className={`w-5 h-5 ${textCls}`} />
      </div>
      <div className="flex-1">
        <p className={`text-sm font-semibold ${textCls}`}>
          {days > 0 ? `Audit in ${days} days (≈ ${weeks} weeks)` : days === 0 ? 'Audit is today!' : `Audit was ${Math.abs(days)} days ago`}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {standard ? `${BRC_STANDARD_LABELS[standard]} · ` : ''}
          Target: {audit.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>
    </div>
  );
}