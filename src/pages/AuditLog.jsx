import { useState, useEffect } from 'react';
import { ScrollText, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useOrganisation from '@/lib/useOrganisation';
import { Input } from '@/components/ui/input';
import EmptyState from '@/components/EmptyState';
import { format, parseISO } from 'date-fns';

export default function AuditLog() {
  const { org } = useOrganisation();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');

  useEffect(() => {
    if (org) loadData();
  }, [org]);

  async function loadData() {
    const l = await base44.entities.AuditLogEntry.filter({ organisation_id: org.id }, '-created_date', 100);
    setLogs(l);
    setLoading(false);
  }

  const actionTypes = [...new Set(logs.map(l => l.action))];
  const filtered = logs
    .filter(l => filterAction === 'all' || l.action === filterAction)
    .filter(l => !search || l.actor_display?.toLowerCase().includes(search.toLowerCase()) || l.target_display?.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="space-y-3">{[...Array(8)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />)}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-1">Record of all significant actions</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by actor or target..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
        >
          <option value="all">All Actions</option>
          {actionTypes.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit log entries" description="Actions will be logged here as they happen." />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Timestamp</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Action</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Actor</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Target</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(log => (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {log.created_date ? format(parseISO(log.created_date), 'dd MMM yyyy HH:mm') : ''}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{log.action}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">{log.actor_display || '—'}</td>
                    <td className="px-4 py-3 text-sm">{log.target_display || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">{log.detail || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}