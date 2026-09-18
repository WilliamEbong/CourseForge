/** Native modal dialogs with focus return, backdrop close and an in-page confirm (no window.confirm). */

const returnTo = new WeakMap<HTMLDialogElement, HTMLElement | null>();

export function openDialog(dialog: HTMLDialogElement, opener?: HTMLElement | null): void {
  if (dialog.open) return;
  returnTo.set(dialog, opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null));
  dialog.showModal();
}

/** Close; `restoreFocus: false` when the caller moves focus itself (e.g. navigation). */
export function closeDialog(dialog: HTMLDialogElement, restoreFocus = true): void {
  if (!restoreFocus) returnTo.set(dialog, null);
  if (dialog.open) dialog.close();
}

export function closeAll(root: ParentNode, restoreFocus = false): void {
  for (const d of root.querySelectorAll<HTMLDialogElement>('dialog[open]')) closeDialog(d, restoreFocus);
}

export function wireDialogs(root: ParentNode): void {
  for (const dialog of root.querySelectorAll<HTMLDialogElement>('dialog.cf-dialog')) {
    dialog.addEventListener('close', () => {
      const target = returnTo.get(dialog);
      returnTo.delete(dialog);
      if (target?.isConnected) target.focus();
    });
    // Dialogs have no padding of their own, so a click whose target is the <dialog> hit the backdrop.
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog && dialog.id !== 'cf-confirm') closeDialog(dialog);
      const close = (e.target as Element).closest('[data-cf-close]');
      if (close && dialog.contains(close)) closeDialog(dialog);
    });
    // Escape always closes, even from a search field (where the browser would only clear the text).
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dialog.open) {
        e.preventDefault();
        closeDialog(dialog);
      }
    });
  }
}

export function confirmDialog(dialog: HTMLDialogElement, title: string, message: string, yesLabel: string): Promise<boolean> {
  const titleEl = dialog.querySelector('[data-cf-confirm-title]');
  const msgEl = dialog.querySelector('[data-cf-confirm-message]');
  const yes = dialog.querySelector<HTMLButtonElement>('[data-cf-confirm="yes"]');
  const no = dialog.querySelector<HTMLButtonElement>('[data-cf-confirm="no"]');
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (yes) yes.textContent = yesLabel;
  return new Promise((resolve) => {
    let answer = false;
    const onClick = (e: Event) => {
      const btn = (e.target as Element).closest('[data-cf-confirm]');
      if (!btn) return;
      answer = btn.getAttribute('data-cf-confirm') === 'yes';
      dialog.close();
    };
    const onClose = () => {
      dialog.removeEventListener('click', onClick);
      resolve(answer);
    };
    dialog.addEventListener('click', onClick);
    dialog.addEventListener('close', onClose, { once: true });
    openDialog(dialog);
    no?.focus();
  });
}
