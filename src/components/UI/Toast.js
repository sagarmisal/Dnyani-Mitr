// Toast Notification Utility

export class Toast {
    static _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static show(message, type = 'info', duration = 3000) {
        let container = document.getElementById('toast-container');

        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.setAttribute('aria-live', 'polite');
            container.setAttribute('role', 'status');
            container.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        max-width: calc(100vw - 2rem);
      `;
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        // Colors based on type
        const colors = {
            success: { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' },
            error: { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' },
            warning: { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
            info: { bg: '#e0f2fe', text: '#075985', border: '#bae6fd' }
        }[type] || { bg: '#e0f2fe', text: '#075985', border: '#bae6fd' };

        toast.style.cssText = `
      background: ${colors.bg};
      color: ${colors.text};
      border: 1px solid ${colors.border};
      padding: 1rem 1.5rem;
      border-radius: 0.5rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      min-width: 250px;
      animation: slideIn 0.3s ease-out;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

        // Use textContent for the message to prevent XSS, then build structure
        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '\u2715';
        closeBtn.setAttribute('aria-label', 'Dismiss');
        closeBtn.style.cssText = 'background: none; border: none; font-size: 1.25rem; cursor: pointer; color: inherit; margin-left: 1rem; opacity: 0.5; padding: 0.25rem;';

        toast.appendChild(messageSpan);
        toast.appendChild(closeBtn);

        container.appendChild(toast);

        // Auto remove
        const timer = setTimeout(() => {
            this.remove(toast);
        }, duration);

        // Manual remove
        closeBtn.addEventListener('click', () => {
            clearTimeout(timer);
            this.remove(toast);
        });
    }

    static remove(toast) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease-in';

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
}

// Add CSS keyframes
if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
    document.head.appendChild(style);
}
