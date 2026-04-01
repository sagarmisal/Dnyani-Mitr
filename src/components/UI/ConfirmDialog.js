// Confirm Dialog — Promise-based modal replacing native confirm()/alert()

export class ConfirmDialog {
  // Singleton guard — only one dialog at a time
  static _active = null;

  /**
   * Escape HTML to prevent XSS
   */
  static _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show a confirmation dialog.
   * @param {Object} options
   * @param {string} options.title - Dialog title
   * @param {string} options.message - Dialog message (supports newlines)
   * @param {string} [options.confirmText='Confirm'] - Confirm button text
   * @param {string|null} [options.cancelText='Cancel'] - Cancel button text, null to hide
   * @param {string} [options.type='info'] - 'danger' | 'warning' | 'info'
   * @returns {Promise<boolean>} true if confirmed, false if cancelled
   */
  static show({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'info' }) {
    // Dismiss any existing dialog before opening a new one
    if (ConfirmDialog._active) {
      ConfirmDialog._active.dismiss();
    }

    return new Promise((resolve) => {
      let resolved = false;
      const previousFocus = document.activeElement;

      // Lock body scroll
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      // Build backdrop
      const backdrop = document.createElement('div');
      backdrop.className = 'confirm-dialog-backdrop';

      // Button class based on type
      const btnClass = type === 'danger' ? 'btn btn-error'
        : type === 'warning' ? 'btn btn-warning'
        : 'btn btn-primary';

      // Build card — all user-supplied strings are HTML-escaped
      const card = document.createElement('div');
      card.className = 'confirm-dialog-card';
      card.setAttribute('role', 'dialog');
      card.setAttribute('aria-modal', 'true');
      card.setAttribute('aria-labelledby', 'confirm-dialog-title');
      card.setAttribute('aria-describedby', 'confirm-dialog-message');
      card.innerHTML = `
        <h3 class="confirm-dialog-title" id="confirm-dialog-title">${ConfirmDialog._escapeHtml(title)}</h3>
        <div class="confirm-dialog-message" id="confirm-dialog-message">${ConfirmDialog._escapeHtml(message).replace(/\n/g, '<br>')}</div>
        <div class="confirm-dialog-actions">
          ${cancelText !== null ? `<button class="btn btn-secondary" data-action="cancel">${ConfirmDialog._escapeHtml(cancelText)}</button>` : ''}
          <button class="${btnClass}" data-action="confirm">${ConfirmDialog._escapeHtml(confirmText)}</button>
        </div>
      `;

      backdrop.appendChild(card);

      const cleanup = () => {
        if (resolved) return; // Guard against double-resolve
        resolved = true;
        ConfirmDialog._active = null;

        // Unlock body scroll
        document.body.style.overflow = prevOverflow;

        // Animate out
        backdrop.style.opacity = '0';
        backdrop.style.transition = 'opacity 0.15s ease-in';
        setTimeout(() => {
          if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        }, 150);

        document.removeEventListener('keydown', onKeydown);

        // Restore focus
        if (previousFocus && previousFocus.focus) {
          previousFocus.focus();
        }
      };

      const onConfirm = () => { cleanup(); resolve(true); };
      const onCancel = () => { cleanup(); resolve(false); };

      // Button clicks
      card.querySelector('[data-action="confirm"]').addEventListener('click', onConfirm);
      const cancelBtn = card.querySelector('[data-action="cancel"]');
      if (cancelBtn) cancelBtn.addEventListener('click', onCancel);

      // Backdrop click
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          cancelText !== null ? onCancel() : onConfirm();
        }
      });

      // Keyboard
      const onKeydown = (e) => {
        if (e.key === 'Escape') {
          cancelText !== null ? onCancel() : onConfirm();
        } else if (e.key === 'Enter') {
          onConfirm();
        } else if (e.key === 'Tab') {
          // Focus trap — keep focus within dialog
          const focusable = card.querySelectorAll('button');
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };
      document.addEventListener('keydown', onKeydown);

      // Store active dialog reference for singleton guard
      ConfirmDialog._active = { dismiss: () => { cleanup(); resolve(false); } };

      // Mount
      document.body.appendChild(backdrop);

      // Focus the safe default button (cancel for destructive, confirm for info-only)
      const focusTarget = cancelBtn || card.querySelector('[data-action="confirm"]');
      if (focusTarget) focusTarget.focus();
    });
  }
}
