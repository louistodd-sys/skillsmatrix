import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * SectionReadiness — horizontal bar per BRC section from cached brc_readiness_score.by_section
 */
export default function SectionReadiness({ bySection }) {
  const sections = useMemo(() => {
    if (!bySection) return [];
    return Object.entries(bySection).map(([section, counts]) => {
      const total = (counts.red || 0) + (counts.amber || 0) + (counts.green || 0);
      const pct = total > 0 ? Math.round(((counts.green || 0) / total) * 100) : 0;
      return { section, ...counts, total, pct };
    }).sort((a, b) => a.pct - b.pct);
  }, [bySection]);

  if (!sections.length) return null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Readiness by Section</h3>
        <Link to="/brc/clauses" className="text-xs text-primary font-medium hover:underline flex items-center gap-0.5">
          View all <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <ul className="divide-y divide-border">
        {sections.map(({ section, red, amber, green, total, pct }) => (
          <li key={section} className="px-5 py-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-foreground">Section {section}</span>
              <span className={`text-xs font-bold ${
                pct >= 80 ? 'text-rag-green-text' : pct >= 50 ? 'text-rag-amber-text' : 'text-rag-red-text'
              }`}>{pct}%</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
              <div className="h-full bg-rag-green transition-all" style={{ width: `${((green||0)/total)*100}%` }} />
              <div className="h-full bg-rag-amber transition-all" style={{ width: `${((amber||0)/total)*100}%` }} />
              <div className="h-full bg-rag-red transition-all"   style={{ width: `${((red||0)/total)*100}%` }} />
            </div>
            <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
              {green > 0 && <span className="text-rag-green-text">{green} ready</span>}
              {amber > 0 && <span className="text-rag-amber-text">{amber} in progress</span>}
              {red   > 0 && <span className="text-rag-red-text">{red} not started</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}