/**
 * BrcModuleGuard — wraps any BRC page.
 * If the org does not have brc_compliance in modules, shows an upgrade prompt.
 * This is the CLIENT-SIDE gate. Every BRC backend function also enforces server-side.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { ShieldCheck, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useOrganisation from '@/lib/useOrganisation';
import { hasBrcModule } from '@/lib/brcModuleGuard';

export default function BrcModuleGuard({ children }) {
  const { org, loading } = useOrganisation();
  const navigate = useNavigate();

  useEffect(() => {
    // no redirect — show inline message instead
  }, [org, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!org || !hasBrcModule(org)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-4 max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Lock className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-jakarta text-foreground">BRC Compliance Module</h2>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">
            This module is not enabled for your organisation. Enable it in Settings or view the feature overview.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap justify-center">
          <Button asChild size="sm">
            <Link to="/settings?tab=general">Enable in Settings</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/upgrade-brc">
              <ShieldCheck className="w-4 h-4 mr-1.5" /> View Features
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return children;
}