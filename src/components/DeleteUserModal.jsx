import { useState } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * GDPR-compliant user deletion modal.
 * Requires typed confirmation before allowing deletion.
 * Does NOT close on backdrop click (destructive action safety).
 */
export default function DeleteUserModal({ user, onConfirm, onClose }) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const expectedText = 'DELETE';
  const canDelete = confirmText === expectedText;

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
  };

  return (
    // Backdrop does NOT close on click — this is a destructive action
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-xl border border-destructive/40 shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-destructive/5 rounded-t-xl">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h2 className="text-base font-semibold text-destructive">Delete User</h2>
          </div>
          <button onClick={onClose} disabled={deleting}>
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-4 space-y-2 text-sm">
            <p className="font-medium text-foreground">This will permanently delete:</p>
            <ul className="space-y-1 text-muted-foreground list-disc list-inside">
              <li>User account for <span className="font-medium text-foreground">{user?.full_name || user?.email}</span></li>
              <li>All skill assessments linked to this user</li>
              <li>All team memberships</li>
            </ul>
            <p className="text-muted-foreground pt-1">
              Audit log entries will be anonymised (replaced with "Deleted User") — they are not removed.
              The user will receive a confirmation email.
            </p>
          </div>

          <div>
            <Label>
              Type <span className="font-mono font-bold text-destructive">{expectedText}</span> to confirm
            </Label>
            <Input
              className="mt-1 font-mono"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value.toUpperCase())}
              placeholder={expectedText}
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={deleting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!canDelete || deleting}
              onClick={handleDelete}
            >
              {deleting
                ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Deleting...</>
                : 'Permanently Delete User'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
