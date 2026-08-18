import { useEffect, useRef } from 'react';

/**
 * Shared modal behaviour: Escape closes, background scroll is locked, focus
 * moves into the dialog on open and returns to the trigger on close, and Tab
 * stays inside the dialog.
 *
 * Usage:
 *   const dialogRef = useModal(onClose);
 *   <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="…">
 */
export default function useModal(onClose) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the first form field — falling back to any focusable control — so
    // keyboard users land on the thing they came to fill in, not the X button.
    const node = dialogRef.current;
    if (node) {
      const field = node.querySelector(
        'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
      );
      const focusable = field || node.querySelector('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
      (focusable || node).focus?.({ preventScroll: true });
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusables = Array.from(
        dialogRef.current.querySelectorAll(
          'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => el.offsetParent !== null);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, []);

  return dialogRef;
}
