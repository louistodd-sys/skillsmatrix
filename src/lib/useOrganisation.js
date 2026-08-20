import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// Module-level cache shared by every hook instance, plus a subscriber set so
// a refresh in ONE component (e.g. the standard switcher) re-renders EVERY
// mounted component that uses this hook — without it, pages kept a stale org
// after another component updated the cache.
let cachedOrg = null;
let cachedUser = null;
const listeners = new Set();

function notifyAll() {
  for (const listener of listeners) listener({ org: cachedOrg, user: cachedUser });
}

export default function useOrganisation() {
  const [org, setOrg] = useState(cachedOrg);
  const [user, setUser] = useState(cachedUser);
  const [loading, setLoading] = useState(!cachedOrg);

  useEffect(() => {
    const listener = ({ org: nextOrg, user: nextUser }) => {
      setOrg(nextOrg);
      setUser(nextUser);
    };
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);

  useEffect(() => {
    if (cachedOrg && cachedUser) {
      setOrg(cachedOrg);
      setUser(cachedUser);
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const me = await base44.auth.me();
        cachedUser = me;

        if (me?.organisation_id) {
          const orgs = await base44.entities.Organisation.filter({ id: me.organisation_id });
          if (orgs.length > 0) {
            cachedOrg = orgs[0];
          }
        }
        notifyAll();
      } catch (_) {
        // Not authenticated — AuthContext will handle redirect to login
      }
      setLoading(false);
    }
    load();
  }, []);

  const refreshOrg = async () => {
    const currentUser = cachedUser || user;
    if (currentUser?.organisation_id) {
      const orgs = await base44.entities.Organisation.filter({ id: currentUser.organisation_id });
      if (orgs.length > 0) {
        cachedOrg = orgs[0];
        notifyAll();
      }
    }
  };

  const refreshUser = async () => {
    const me = await base44.auth.me();
    cachedUser = me;
    notifyAll();
  };

  const clearCache = () => {
    cachedOrg = null;
    cachedUser = null;
    notifyAll();
  };

  return { org, user, loading, refreshOrg, refreshUser, clearCache };
}
