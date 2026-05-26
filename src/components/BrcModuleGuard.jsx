/**
 * BrcModuleGuard — wraps any BRC page.
 * If the org does not have brc_compliance in modules, redirects to /upgrade-brc.
 * This is the CLIENT-SIDE gate. Every BRC backend function also enforces server-side.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useOrganisation from '@/lib/useOrganisation';
import { hasBrcModule } from '@/lib/brcModuleGuard';

export default function BrcModuleGuard({ children }) {
  const { org, loading } = useOrganisation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && org && !hasBrcModule(org)) {
      navigate('/upgrade-brc', { replace: true });
    }
  }, [org, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!org || !hasBrcModule(org)) return null;

  return children;
}