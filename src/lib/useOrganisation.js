import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

let cachedOrg = null;
let cachedUser = null;

export default function useOrganisation() {
  const [org, setOrg] = useState(cachedOrg);
  const [user, setUser] = useState(cachedUser);
  const [loading, setLoading] = useState(!cachedOrg);

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
        setUser(me);

        if (me?.organisation_id) {
          const orgs = await base44.entities.Organisation.filter({ id: me.organisation_id });
          if (orgs.length > 0) {
            cachedOrg = orgs[0];
            setOrg(orgs[0]);
          }
        }
      } catch (_) {
        // Not authenticated — AuthContext will handle redirect to login
      }
      setLoading(false);
    }
    load();
  }, []);

  const refreshOrg = async () => {
    if (user?.organisation_id) {
      const orgs = await base44.entities.Organisation.filter({ id: user.organisation_id });
      if (orgs.length > 0) {
        cachedOrg = orgs[0];
        setOrg(orgs[0]);
      }
    }
  };

  const refreshUser = async () => {
    const me = await base44.auth.me();
    cachedUser = me;
    setUser(me);
  };

  const clearCache = () => {
    cachedOrg = null;
    cachedUser = null;
  };

  return { org, user, loading, refreshOrg, refreshUser, clearCache };
}