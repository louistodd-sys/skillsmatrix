import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * Hook to check tier limits before performing an action.
 * Returns { checking, upgradePrompt, checkLimit, clearPrompt }
 *
 * Usage:
 *   const { checkLimit, upgradePrompt, clearPrompt } = useTierCheck();
 *   const proceed = await checkLimit('employee');        // adding one
 *   const proceed = await checkLimit('skill', 14);       // bulk add of 14
 *   if (!proceed) return; // upgradePrompt may be set — show <UpgradePromptModal>
 */
export default function useTierCheck() {
  const [checking, setChecking] = useState(false);
  const [upgradePrompt, setUpgradePrompt] = useState(null);

  const checkLimit = async (resource, add = 1) => {
    setChecking(true);
    try {
      const res = await base44.functions.invoke('checkTierLimit', { resource, add });
      if (!res.data.allowed) {
        setUpgradePrompt(res.data.upgrade_prompt);
        return false;
      }
      return true;
    } catch {
      // Fail closed but never silently — the old behaviour left the modal
      // hanging with no feedback when this call errored.
      toast.error("Couldn't verify your plan limits — please try again.");
      return false;
    } finally {
      setChecking(false);
    }
  };

  const clearPrompt = () => setUpgradePrompt(null);

  return { checking, upgradePrompt, checkLimit, clearPrompt };
}
