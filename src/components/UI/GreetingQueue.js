// GreetingQueue Component — Batch "Send Greetings" workflow
// Opens WhatsApp one-by-one with pre-filled messages, tracks progress,
// persists state to localStorage to survive WebView kills on MIUI/ColorOS.

import InteractionService from '../../services/InteractionService.js';
import ReminderService from '../../services/ReminderService.js';
import { Toast } from './Toast.js';
import { InteractionLogger } from './InteractionLogger.js';
import { INTERACTION_TYPES } from '../../utils/constants.js';
import { normalizePhone } from '../../utils/formatters.js';

const QUEUE_STORAGE_KEY = 'NGOApp_GreetingQueue';

export class GreetingQueue {

  /**
   * Launch the greeting queue modal.
   * @param {Array} items - Array of { visitorId, reminderId, contactName, phone, eventType }
   * @param {Function} onComplete - Called when queue finishes or is closed
   */
  static start(items, onComplete) {
    // Filter to items with valid phones
    const queue = items.filter(item => !!normalizePhone(item.phone));

    if (queue.length === 0) {
      Toast.show('No contacts with valid phone numbers to send greetings', 'warning');
      return;
    }

    const state = {
      queue,
      currentIndex: 0,
      sent: [],
      skipped: [],
      startedAt: new Date().toISOString()
    };

    GreetingQueue._saveState(state);
    GreetingQueue._showModal(state, onComplete);
  }

  /**
   * Check for and resume an interrupted queue (cold-start recovery).
   * Call this on app start / route load.
   * @param {Function} onComplete - Called when resumed queue finishes
   * @returns {boolean} true if a queue was resumed
   */
  static tryResume(onComplete) {
    const state = GreetingQueue._loadState();
    if (!state || !state.queue || state.queue.length === 0) return false;

    // Check if queue is stale (> 30 min old)
    const age = Date.now() - new Date(state.startedAt).getTime();
    if (age > 30 * 60 * 1000) {
      GreetingQueue._clearState();
      return false;
    }

    // Check if the current item was being sent (we opened WhatsApp but didn't get confirmation)
    // Mark it as sent (optimistic — user likely sent it since they initiated the action)
    if (state.pendingSend) {
      const pendingIdx = state.pendingSend.index;
      const item = state.queue[pendingIdx];
      if (item) {
        GreetingQueue._logInteraction(item);
        GreetingQueue._markReminder(item);
        state.sent.push(pendingIdx);
      }
      state.pendingSend = null;
      state.currentIndex = pendingIdx + 1;
      GreetingQueue._saveState(state);
    }

    GreetingQueue._showModal(state, onComplete);
    return true;
  }

  static _showModal(state, onComplete) {
    // Remove any existing modal
    const existing = document.querySelector('.greeting-queue-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'greeting-queue-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    // Resume detection
    const onResume = () => {
      const saved = GreetingQueue._loadState();
      if (saved && saved.pendingSend != null) {
        // User returned from WhatsApp — mark as sent
        const idx = saved.pendingSend.index;
        const item = saved.queue[idx];
        if (item && !saved.sent.includes(idx)) {
          GreetingQueue._logInteraction(item);
          GreetingQueue._markReminder(item);
          saved.sent.push(idx);
        }
        saved.pendingSend = null;
        saved.currentIndex = idx + 1;
        GreetingQueue._saveState(saved);
        renderCurrentState(saved);
      }
    };

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) onResume();
    });

    const close = (finalState) => {
      overlay.remove();
      document.body.style.overflow = '';
      GreetingQueue._clearState();
      if (onComplete) onComplete(finalState || state);
    };

    const renderCurrentState = (s) => {
      const total = s.queue.length;
      const done = s.sent.length + s.skipped.length;
      const idx = s.currentIndex;
      const isFinished = idx >= total;

      if (isFinished) {
        overlay.innerHTML = GreetingQueue._renderSummary(s);
        overlay.querySelector('#gq-close').addEventListener('click', () => close(s));
        return;
      }

      const current = s.queue[idx];
      const normalized = normalizePhone(current.phone);
      const message = GreetingQueue._composeMessage(current);

      overlay.innerHTML = `
        <div class="greeting-queue-modal">
          <div class="gq-header">
            <h3>Send Greetings</h3>
            <span class="gq-progress">${done + 1} of ${total}</span>
          </div>

          <div class="gq-progress-bar">
            <div class="gq-progress-fill" style="width: ${Math.round((done / total) * 100)}%"></div>
          </div>

          <div class="gq-body">
            <div class="gq-contact-card">
              <div class="gq-contact-name">${GreetingQueue._escapeHtml(current.contactName)}</div>
              <div class="gq-contact-detail">
                ${(current.eventType || current.occasionLabel)
                    ? `<span class="gq-event-badge">${GreetingQueue._eventIcon(current.eventType)} ${GreetingQueue._escapeHtml(current.eventType || current.occasionLabel)}</span>`
                    : ''}
                <span>📞 ${GreetingQueue._escapeHtml(current.phone)}</span>
              </div>
            </div>

            <div class="gq-message-preview">
              <label class="form-label" style="font-size: 0.75rem; color: #64748b;">Message Preview</label>
              <div class="gq-message-text">${GreetingQueue._escapeHtml(message)}</div>
            </div>
          </div>

          <div class="gq-footer">
            <button class="btn btn-secondary btn-sm" id="gq-skip">Skip</button>
            <button class="btn btn-sm" style="background:#ef4444;color:white;border:none;" id="gq-stop">Stop</button>
            <button class="btn btn-primary" id="gq-send" style="flex:1;">
              💬 Open WhatsApp & Send
            </button>
          </div>

          <div class="gq-stats">
            <span style="color:#16a34a;">Sent: ${s.sent.length}</span>
            <span style="color:#94a3b8;">Skipped: ${s.skipped.length}</span>
            <span style="color:#64748b;">Remaining: ${total - done - 1}</span>
          </div>
        </div>
      `;

      // Send button — opens WhatsApp
      overlay.querySelector('#gq-send').addEventListener('click', () => {
        // Persist pending state BEFORE opening WhatsApp (WebView may be killed)
        s.pendingSend = { index: idx };
        GreetingQueue._saveState(s);

        // Open WhatsApp (platform-aware — window.open fails inside Capacitor WebView)
        const url = `https://wa.me/91${normalized}?text=${encodeURIComponent(message)}`;
        InteractionLogger.openExternalUrl(url);

        // If visibilitychange fires quickly (user didn't leave), handle via timeout
        // Otherwise, onResume handler catches the return
        setTimeout(() => {
          // Check if still on this page (didn't navigate away)
          if (document.querySelector('.greeting-queue-overlay')) {
            // User might have sent quickly or cancelled — show "Did you send?" confirmation
            const saved = GreetingQueue._loadState();
            if (saved && saved.pendingSend != null) {
              GreetingQueue._showDidYouSend(overlay, saved, renderCurrentState, close);
            }
          }
        }, 3000);
      });

      // Skip button
      overlay.querySelector('#gq-skip').addEventListener('click', () => {
        s.skipped.push(idx);
        s.currentIndex = idx + 1;
        GreetingQueue._saveState(s);
        renderCurrentState(s);
      });

      // Stop button
      overlay.querySelector('#gq-stop').addEventListener('click', () => close(s));
    };

    renderCurrentState(state);
  }

  static _showDidYouSend(overlay, s, renderCurrentState, close) {
    const idx = s.pendingSend.index;
    const item = s.queue[idx];

    // Replace footer with confirmation
    const footer = overlay.querySelector('.gq-footer');
    if (!footer) return;

    footer.innerHTML = `
      <button class="btn btn-secondary" id="gq-didnt-send">Didn't Send</button>
      <button class="btn btn-primary" id="gq-did-send" style="flex:1;">
        Yes, I Sent It
      </button>
    `;

    overlay.querySelector('#gq-did-send').addEventListener('click', () => {
      GreetingQueue._logInteraction(item);
      GreetingQueue._markReminder(item);
      s.sent.push(idx);
      s.pendingSend = null;
      s.currentIndex = idx + 1;
      GreetingQueue._saveState(s);
      renderCurrentState(s);
    });

    overlay.querySelector('#gq-didnt-send').addEventListener('click', () => {
      s.skipped.push(idx);
      s.pendingSend = null;
      s.currentIndex = idx + 1;
      GreetingQueue._saveState(s);
      renderCurrentState(s);
    });
  }

  static _renderSummary(s) {
    return `
      <div class="greeting-queue-modal">
        <div class="gq-header">
          <h3>Greetings Complete!</h3>
        </div>
        <div class="gq-body" style="text-align:center; padding: 2rem;">
          <div style="font-size:3rem; margin-bottom:1rem;">🎉</div>
          <div class="gq-summary-stats">
            <div class="gq-stat-item gq-stat-sent">
              <div class="gq-stat-number">${s.sent.length}</div>
              <div class="gq-stat-label">Sent</div>
            </div>
            <div class="gq-stat-item gq-stat-skipped">
              <div class="gq-stat-number">${s.skipped.length}</div>
              <div class="gq-stat-label">Skipped</div>
            </div>
            <div class="gq-stat-item gq-stat-total">
              <div class="gq-stat-number">${s.queue.length}</div>
              <div class="gq-stat-label">Total</div>
            </div>
          </div>
          ${s.sent.length > 0 ? `<p style="color:#16a34a; margin-top:1rem;">All sent greetings have been logged as interactions.</p>` : ''}
        </div>
        <div class="gq-footer" style="justify-content:center;">
          <button class="btn btn-primary" id="gq-close">Done</button>
        </div>
      </div>
    `;
  }

  static _logInteraction(item) {
    try {
      InteractionService.log({
        visitorId: item.visitorId,
        interactionType: INTERACTION_TYPES.WHATSAPP,
        notes: item.notes || `WhatsApp greeting sent${item.eventType ? ` (${item.eventType})` : ''}`,
        outcome: 'successful'
      });
    } catch (e) {
      console.error('Failed to log greeting interaction:', e);
    }
  }

  static _markReminder(item) {
    try {
      if (item.reminderId) {
        ReminderService.recordAction(item.reminderId, 'contacted', `WhatsApp greeting sent (${item.eventType})`);
      }
    } catch (e) {
      console.error('Failed to mark reminder:', e);
    }
  }

  static _composeMessage(item) {
    // Campaign items carry a pre-composed message; reminders derive from eventType.
    if (item.message != null) return item.message;
    return InteractionLogger.composeMessage(item.eventType, item.contactName);
  }

  static _eventIcon(eventType) {
    return { 'Birthday': '🎂', 'Anniversary': '💍', 'Death': '🕯️' }[eventType] || '📅';
  }

  static _saveState(state) {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to persist greeting queue state:', e);
    }
  }

  static _loadState() {
    try {
      const data = localStorage.getItem(QUEUE_STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  static _clearState() {
    try {
      localStorage.removeItem(QUEUE_STORAGE_KEY);
    } catch (e) { /* ignore */ }
  }

  static _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
