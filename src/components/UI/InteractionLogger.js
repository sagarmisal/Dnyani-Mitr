// InteractionLogger Component — Modal with full + quick modes
// Replaces prompt() for interaction logging throughout the app

import InteractionService from '../../services/InteractionService.js';
import ReminderService from '../../services/ReminderService.js';
import VisitorService from '../../services/VisitorService.js';
import ActivationManager from '../../core/activation.js';
import { Toast } from './Toast.js';
import {
  INTERACTION_TYPES, INTERACTION_TYPE_LABELS,
  INTERACTION_OUTCOMES, INTERACTION_OUTCOME_LABELS,
  DEFAULT_MESSAGE_TEMPLATES, ORGANIZATION
} from '../../utils/constants.js';
import StateManager from '../../core/state.js';
import { normalizePhone } from '../../utils/formatters.js';

export class InteractionLogger {

  /**
   * Show quick-action buttons inline (for reminder tiles).
   * Each button logs an interaction + marks the reminder in one tap.
   * @param {Object} opts
   * @param {string} opts.visitorId
   * @param {string} opts.reminderId - Reminder to mark as contacted
   * @param {string} [opts.contactName] - For WhatsApp template
   * @param {string} [opts.phone] - For WhatsApp/call/SMS deep link
   * @param {string} [opts.email] - For email deep link
   * @param {string} [opts.eventType] - Birthday/Anniversary/Death for template selection
   * @param {Function} [opts.onDone] - Callback after action
   */
  /**
   * Defense-in-depth: even if a reminder tile for a DoNotContact visitor slips
   * through (stale cached UI state, late toggle, etc.), every comm-button entry
   * point validates the flag here at click time. Returns true if BLOCKED so
   * callers can early-return; surfaces a Toast so the user understands.
   *
   * Per CLAUDE.md protocol: "DoNotContact visitors MUST be excluded from
   * reminders, lapsed detection, and communication buttons."
   */
  static _blockedByDoNotContact(visitorId, contactName) {
    if (!visitorId) return false;
    try {
      const visitor = VisitorService.getById(visitorId);
      if (visitor?.doNotContact) {
        Toast.show(
          `${contactName || 'This contact'} is marked Do Not Contact — communication blocked.`,
          'warning',
          4000
        );
        return true;
      }
    } catch (e) {
      // Service unavailable / lookup error — fail open. Worst case the comm
      // proceeds for a visitor whose DNC flag we couldn't read; we'd rather
      // a working button than a stuck one if the data layer is broken.
      console.warn('DoNotContact check failed:', e);
    }
    return false;
  }

  static quickAction(type, opts) {
    const { visitorId, reminderId, contactName, phone, eventType, onDone } = opts;

    if (InteractionLogger._blockedByDoNotContact(visitorId, contactName)) return;

    const typeMap = {
      'whatsapp': INTERACTION_TYPES.WHATSAPP,
      'called': INTERACTION_TYPES.CALL,
      'visited': INTERACTION_TYPES.VISIT,
      'sms': INTERACTION_TYPES.SMS
    };

    const noteMap = {
      'whatsapp': `WhatsApp wish sent${eventType ? ` (${eventType})` : ''}`,
      'called': `Called${eventType ? ` for ${eventType}` : ''}`,
      'visited': `Visited${eventType ? ` for ${eventType}` : ''}`,
      'sms': `SMS sent${eventType ? ` (${eventType})` : ''}`
    };

    const interactionType = typeMap[type] || INTERACTION_TYPES.OTHER;
    const notes = noteMap[type] || 'Action taken via Dashboard';

    try {
      // Log the interaction
      InteractionService.log({
        visitorId,
        interactionType,
        notes,
        outcome: 'successful'
      });

      // Mark the reminder as contacted
      if (reminderId) {
        ReminderService.recordAction(reminderId, 'contacted', `${type}: ${notes}`);
      }

      // Open communication channel if applicable
      if (type === 'whatsapp' && phone) {
        InteractionLogger.openWhatsApp(phone, contactName, eventType);
      } else if (type === 'called' && phone) {
        InteractionLogger.openCall(phone);
      } else if (type === 'sms' && phone) {
        InteractionLogger.openSMS(phone, contactName, eventType);
      }

      const label = INTERACTION_TYPE_LABELS[interactionType] || type;
      Toast.show(`${label} logged!`, 'success');

      if (onDone) onDone();
    } catch (err) {
      console.error('Quick action failed:', err);
      Toast.show('Failed to log action', 'error');
    }
  }

  /**
   * Snooze a reminder with selectable duration
   */
  static snooze(reminderId, days, onDone) {
    try {
      ReminderService.recordAction(reminderId, 'snoozed', `Snoozed ${days} day(s)`, days);
      Toast.show(`Snoozed for ${days} day(s)`, 'success');
      if (onDone) onDone();
    } catch (err) {
      Toast.show('Failed to snooze', 'error');
    }
  }

  /**
   * Open the full interaction logger modal
   */
  static showFull(opts = {}) {
    const { visitorId, visitorName, prefillType, prefillNotes, onDone } = opts;

    // Remove any existing modal
    const existing = document.querySelector('.interaction-logger-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'interaction-logger-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const today = new Date().toISOString().split('T')[0];

    overlay.innerHTML = `
      <div class="interaction-logger-modal">
        <div class="interaction-logger-header">
          <h3>Log Interaction${visitorName ? ` — ${InteractionLogger._escapeHtml(visitorName)}` : ''}</h3>
          <button class="interaction-logger-close" aria-label="Close">&times;</button>
        </div>

        <div class="interaction-logger-body">
          <div class="form-group">
            <label class="form-label">Type *</label>
            <select id="il-type" class="form-select">
              ${Object.entries(INTERACTION_TYPE_LABELS).map(([val, label]) =>
                `<option value="${val}" ${prefillType === val ? 'selected' : ''}>${label}</option>`
              ).join('')}
            </select>
          </div>

          <div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label class="form-label">Date</label>
              <input type="date" id="il-date" class="form-input" value="${today}" />
            </div>
            <div class="form-group">
              <label class="form-label">Outcome</label>
              <select id="il-outcome" class="form-select">
                <option value="">— Select —</option>
                ${Object.entries(INTERACTION_OUTCOME_LABELS).map(([val, label]) =>
                  `<option value="${val}">${label}</option>`
                ).join('')}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea id="il-notes" class="form-textarea" rows="3" placeholder="What happened?">${InteractionLogger._escapeHtml(prefillNotes || '')}</textarea>
          </div>

          <div class="form-row" style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label class="form-label">Duration (minutes)</label>
              <input type="number" id="il-duration" class="form-input" min="0" placeholder="Optional" />
            </div>
            <div class="form-group">
              <label class="form-label">Follow-up Date</label>
              <input type="date" id="il-followup-date" class="form-input" />
            </div>
          </div>

          <div class="form-group" id="il-followup-notes-group" style="display:none;">
            <label class="form-label">Follow-up Notes</label>
            <input type="text" id="il-followup-notes" class="form-input" placeholder="What to do next..." />
          </div>
        </div>

        <div class="interaction-logger-footer">
          <button class="btn btn-secondary" id="il-cancel">Cancel</button>
          <button class="btn btn-primary" id="il-save">Save Interaction</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    // Show follow-up notes when follow-up date is set
    const followUpDate = overlay.querySelector('#il-followup-date');
    const followUpGroup = overlay.querySelector('#il-followup-notes-group');
    followUpDate.addEventListener('change', () => {
      followUpGroup.style.display = followUpDate.value ? 'block' : 'none';
    });

    // Close handlers
    const close = () => {
      overlay.remove();
      document.body.style.overflow = '';
    };

    overlay.querySelector('.interaction-logger-close').addEventListener('click', close);
    overlay.querySelector('#il-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
      // Focus trap
      if (e.key === 'Tab') {
        const focusable = overlay.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
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
    });

    // Save handler
    overlay.querySelector('#il-save').addEventListener('click', () => {
      const type = overlay.querySelector('#il-type').value;
      const date = overlay.querySelector('#il-date').value;
      const outcome = overlay.querySelector('#il-outcome').value || null;
      const notes = overlay.querySelector('#il-notes').value.trim();
      const duration = parseInt(overlay.querySelector('#il-duration').value, 10) || null;
      const fDate = overlay.querySelector('#il-followup-date').value || null;
      const fNotes = overlay.querySelector('#il-followup-notes')?.value.trim() || '';

      try {
        InteractionService.log({
          visitorId,
          interactionType: type,
          notes,
          interactionDate: date ? new Date(date).toISOString() : undefined,
          outcome,
          duration,
          followUpDate: fDate,
          followUpNotes: fNotes
        });

        Toast.show('Interaction logged!', 'success');
        close();
        if (onDone) onDone();
      } catch (err) {
        Toast.show('Failed to log interaction: ' + err.message, 'error');
      }
    });

    // Focus the type selector
    overlay.querySelector('#il-type').focus();
  }

  // --- Communication deep links ---

  /**
   * Compose a message from templates, substituting all variables.
   * Central method — all callers use this to ensure consistent substitution.
   * @param {string} eventType - 'Birthday' | 'Anniversary' | 'Death' | null
   * @param {string} contactName
   * @returns {string} Composed message
   */
  static composeMessage(eventType, contactName) {
    const settings = StateManager.getSettings();
    const templates = settings.messageTemplates || {};
    const machineInfo = ActivationManager.getMachineInfo();
    const orgName = settings.organizationName || ORGANIZATION;

    let templateKey = 'followUp';
    if (eventType === 'Birthday') templateKey = 'birthday';
    else if (eventType === 'Anniversary') templateKey = 'anniversary';
    else if (eventType === 'Death') templateKey = 'deathAnniversary';

    let message = templates[templateKey] || '';
    return message
      .replace(/\{name\}/g, contactName || '')
      .replace(/\{org\}/g, orgName)
      .replace(/\{volunteer\}/g, machineInfo?.machineName || '');
  }

  /**
   * Detect if running on a mobile device (APK or mobile browser)
   * where tel:/sms: protocols are supported.
   */
  static _isMobileDevice() {
    // Capacitor native app
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) return true;
    // Mobile browser detection via user agent
    return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
  }

  static openWhatsApp(phone, contactName, eventType, visitorId = null) {
    if (visitorId && InteractionLogger._blockedByDoNotContact(visitorId, contactName)) return;
    const normalized = normalizePhone(phone);
    if (!normalized) return;

    const message = InteractionLogger.composeMessage(eventType, contactName);
    const url = `https://wa.me/91${normalized}?text=${encodeURIComponent(message)}`;
    InteractionLogger.openExternalUrl(url);
  }

  /**
   * Open an external HTTPS URL that should leave the app.
   * Capacitor Android routes `window.open(url, '_blank')` through
   * WebChromeClient.onCreateWindow, which doesn't trigger the bridge's
   * external-intent path — so wa.me silently fails. A synthetic anchor click
   * goes through shouldOverrideUrlLoading instead, which Capacitor intercepts
   * and externalises via Intent.ACTION_VIEW.
   */
  static openExternalUrl(url) {
    if (InteractionLogger._isCapacitorNative()) {
      const a = document.createElement('a');
      a.href = url;
      a.rel = 'noopener noreferrer';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 100);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  static _isCapacitorNative() {
    return !!(window.Capacitor
      && typeof window.Capacitor.isNativePlatform === 'function'
      && window.Capacitor.isNativePlatform());
  }

  static openCall(phone, visitorId = null, contactName = null) {
    if (visitorId && InteractionLogger._blockedByDoNotContact(visitorId, contactName)) return;
    const normalized = normalizePhone(phone);
    if (!normalized) return;
    if (!InteractionLogger._isMobileDevice()) {
      Toast.show('Phone calls are only available on mobile devices', 'warning');
      return;
    }
    InteractionLogger._openProtocolLink(`tel:+91${normalized}`);
  }

  static openSMS(phone, contactName, eventType, visitorId = null) {
    if (visitorId && InteractionLogger._blockedByDoNotContact(visitorId, contactName)) return;
    const normalized = normalizePhone(phone);
    if (!normalized) return;
    if (!InteractionLogger._isMobileDevice()) {
      Toast.show('SMS is only available on mobile devices', 'warning');
      return;
    }

    const message = InteractionLogger.composeMessage(eventType, contactName);
    InteractionLogger._openProtocolLink(`sms:+91${normalized}?body=${encodeURIComponent(message)}`);
  }

  static openEmail(email, contactName, eventType, visitorId = null) {
    if (visitorId && InteractionLogger._blockedByDoNotContact(visitorId, contactName)) return;
    if (!email) return;
    const settings = StateManager.getSettings();
    const orgName = settings.organizationName || ORGANIZATION;
    const subject = eventType ? `${eventType} Wishes — ${orgName}` : `Greetings — ${orgName}`;
    const body = `Dear ${contactName || ''},\n\n`;
    InteractionLogger._openProtocolLink(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  }

  /**
   * Open a protocol link (tel:, sms:, mailto:) reliably across
   * both desktop browsers and Capacitor WebView.
   * window.open() fails for these protocols on desktop Chrome.
   * Using a temporary <a> element with click() works everywhere.
   */
  static _openProtocolLink(url) {
    const a = document.createElement('a');
    a.href = url;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 100);
  }

  static _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
