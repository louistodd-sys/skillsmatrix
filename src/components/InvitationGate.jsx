import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

// Pages a user without an organisation may still visit.
const OPEN_PATHS = ['/onboarding', '/privacy', '/terms', '/cookies', '/dpa'];

/**
 * Completes the invitation loop on login. When an authenticated user has no
 * organisation yet, this asks the backend to accept any pending invitation
 * matching their email (applying role + team assignments). If there is none,
 * they are routed to onboarding to create their own organisation.
 */
export default function InvitationGate() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const ran = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user || user.organisation_id || ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const res = await base44.functions.invoke('acceptInvitation', {});
        if (res.data?.accepted) {
          toast.success(
            res.data.downgraded
              ? `Welcome to ${res.data.organisation_name}! You joined as a viewer — no seats were free for your invited role; an admin can change this later.`
              : `Welcome to ${res.data.organisation_name}!`
          );
          // Full reload so the module-level org/user caches pick up the new
          // organisation everywhere.
          window.location.href = '/';
        } else if (!OPEN_PATHS.includes(location.pathname)) {
          navigate('/onboarding');
        }
      } catch {
        // Leave the user where they are — the dashboard shows the
        // "Set Up Organisation" empty state as a fallback.
      }
    })();
  }, [isAuthenticated, user, location.pathname, navigate]);

  return null;
}
