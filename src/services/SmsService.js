// SmsService — bulk + single SMS dispatch with graceful fallback.
//
// Two paths, picked at runtime:
//   - NATIVE: Capacitor APK + SEND_SMS granted → SmsPlugin.sendSms() sends silently
//             from the volunteer's SIM. One-tap bulk.
//   - PROTOCOL: Desktop / iOS / permission denied / no Capacitor → falls back to
//               the existing `sms:` URI via InteractionLogger.openSMS(), one tap
//               per contact in the system SMS app.
//
// Both paths log an Interaction + mark the Reminder on success — same contract
// as GreetingQueue, satisfying the v3 rule that every quick-action creates an
// Interaction record.

import InteractionService from './InteractionService.js';
import ReminderService from './ReminderService.js';
import { InteractionLogger } from '../components/UI/InteractionLogger.js';
import { INTERACTION_TYPES } from '../utils/constants.js';
import { normalizePhone } from '../utils/formatters.js';

// Pace between sends — leaves room for carrier-side anti-spam heuristics
// and gives the user a visible per-message progress update.
export const SMS_SEND_INTERVAL_MS = 1500;
// Soft cap on a single batch — above this we warn before proceeding.
export const SMS_BATCH_SOFT_CAP = 30;

const CAPABILITY = Object.freeze({
  NATIVE: 'native',
  PROTOCOL: 'protocol',
  NONE: 'none'
});

class SmsService {

  static get CAPABILITY() { return CAPABILITY; }

  static _getPlugin() {
    return (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins)
      ? window.Capacitor.Plugins.Sms
      : null;
  }

  static _isCapacitorNative() {
    return !!(typeof window !== 'undefined'
      && window.Capacitor
      && typeof window.Capacitor.isNativePlatform === 'function'
      && window.Capacitor.isNativePlatform());
  }

  /**
   * Detect the best available send mode. Does NOT request permission — only
   * reports current state. Use requestPermission() to upgrade PROTOCOL → NATIVE.
   * @returns {Promise<{mode: string, granted: boolean, reason?: string}>}
   */
  static async checkCapability() {
    if (!this._isCapacitorNative()) {
      return { mode: CAPABILITY.PROTOCOL, granted: false, reason: 'Not running in Capacitor' };
    }
    const plugin = this._getPlugin();
    if (!plugin || typeof plugin.checkPermission !== 'function') {
      return { mode: CAPABILITY.PROTOCOL, granted: false, reason: 'Sms plugin not registered' };
    }
    try {
      const res = await plugin.checkPermission();
      if (res && res.granted) {
        return { mode: CAPABILITY.NATIVE, granted: true };
      }
      return { mode: CAPABILITY.PROTOCOL, granted: false, reason: 'SEND_SMS not granted' };
    } catch (e) {
      return { mode: CAPABILITY.PROTOCOL, granted: false, reason: e?.message || String(e) };
    }
  }

  /**
   * Trigger Android's runtime permission prompt. Resolves whether the user
   * granted or denied. PROTOCOL fallback is always available regardless.
   */
  static async requestPermission() {
    const plugin = this._getPlugin();
    if (!plugin || !this._isCapacitorNative()) {
      return { granted: false, reason: 'Native SMS path unavailable on this platform' };
    }
    try {
      const res = await plugin.requestPermission();
      return { granted: !!(res && res.granted), state: res?.state };
    } catch (e) {
      return { granted: false, reason: e?.message || String(e) };
    }
  }

  /**
   * Send one SMS via the native plugin. Caller handles fallback decisions —
   * this method only throws if the plugin path fails.
   */
  static async _nativeSendOne(phone, message) {
    const plugin = this._getPlugin();
    if (!plugin) throw new Error('Sms plugin unavailable');
    const normalized = normalizePhone(phone);
    if (!normalized) throw new Error('Invalid phone number');
    const to = `+91${normalized}`;
    const res = await plugin.sendSms({ to, message });
    if (!res || !res.sent) throw new Error('Send did not confirm');
    return res;
  }

  /**
   * Log the interaction + mark the reminder for one item. Mirrors GreetingQueue's
   * contract: every successful send creates an Interaction record so timelines,
   * engagement scores, and coordinator analytics see SMS the same way they see
   * call / WhatsApp / visit.
   *
   * Returns a status object so callers can distinguish:
   *   - SMS sent + record written (full success)
   *   - SMS sent + record write failed (partial — surface in summary)
   * We never block on a logging failure: the SMS was already sent to the carrier,
   * we just couldn't update local state. The result lets the UI flag it.
   */
  static _logAndMark(item, notes) {
    const status = { logged: true, reminderMarked: true, logError: null, reminderError: null };
    try {
      InteractionService.log({
        visitorId: item.visitorId,
        interactionType: INTERACTION_TYPES.SMS,
        notes: notes || `SMS sent${item.eventType ? ` (${item.eventType})` : ''}`,
        outcome: 'successful'
      });
    } catch (e) {
      status.logged = false;
      status.logError = e?.message || String(e);
      console.error('SmsService: failed to log interaction', e);
    }
    try {
      if (item.reminderId) {
        ReminderService.recordAction(
          item.reminderId,
          'contacted',
          `SMS sent${item.eventType ? ` (${item.eventType})` : ''}`
        );
      }
    } catch (e) {
      status.reminderMarked = false;
      status.reminderError = e?.message || String(e);
      console.error('SmsService: failed to mark reminder', e);
    }
    return status;
  }

  static _composeMessage(item) {
    return InteractionLogger.composeMessage(item.eventType, item.contactName);
  }

  /**
   * Send a batch via the native plugin. Used by SmsBatchQueue after permission
   * is confirmed. Paces sends, reports progress, never blocks the UI thread.
   *
   * @param {Array} items - [{visitorId, reminderId, contactName, phone, eventType}]
   * @param {Object} cb
   * @param {(p:{index, total, status:'sending'|'sent'|'failed', error?, item}) => void} cb.onProgress
   * @param {() => boolean} [cb.shouldCancel] - polled before each send
   * @returns {Promise<{sent:number, failed:number, cancelled:boolean, errors:Array}>}
   */
  static async sendBulkNative(items, { onProgress, shouldCancel } = {}) {
    const result = { sent: 0, failed: 0, cancelled: false, errors: [], logWarnings: [] };
    const total = items.length;

    for (let i = 0; i < total; i++) {
      if (shouldCancel && shouldCancel()) {
        result.cancelled = true;
        break;
      }
      const item = items[i];
      const phone = normalizePhone(item.phone);
      if (!phone) {
        result.failed++;
        result.errors.push({ index: i, item, error: 'Invalid phone number' });
        if (onProgress) onProgress({ index: i, total, status: 'failed', error: 'Invalid phone', item });
        continue;
      }

      if (onProgress) onProgress({ index: i, total, status: 'sending', item });

      try {
        const message = this._composeMessage(item);
        await this._nativeSendOne(item.phone, message);
        // SMS dispatched to carrier — now write the local record. If that fails
        // the message was still sent; we surface a warning rather than counting
        // it as a failure so the user doesn't think a contact was missed.
        const logStatus = this._logAndMark(item);
        result.sent++;
        if (!logStatus.logged || !logStatus.reminderMarked) {
          result.logWarnings.push({
            index: i,
            name: item.contactName,
            logError: logStatus.logError,
            reminderError: logStatus.reminderError
          });
        }
        if (onProgress) onProgress({ index: i, total, status: 'sent', item, logWarning: !logStatus.logged });
      } catch (e) {
        result.failed++;
        const error = e?.message || String(e);
        result.errors.push({ index: i, item, error });
        if (onProgress) onProgress({ index: i, total, status: 'failed', error, item });

        // If permission was revoked mid-batch, abort early — caller will fall back.
        if (error.includes('PERMISSION_DENIED') || /permission/i.test(error)) {
          result.cancelled = true;
          result.permissionRevoked = true;
          break;
        }
      }

      // Pace before next send (skip after the last one).
      if (i < total - 1) {
        await new Promise(resolve => setTimeout(resolve, SMS_SEND_INTERVAL_MS));
      }
    }

    return result;
  }

  /**
   * Open the system SMS app for one contact (protocol path). Fallback for
   * desktop / denied permission / non-Capacitor. Does NOT auto-log — the
   * caller advances the queue when the user confirms they sent it,
   * matching GreetingQueue's "did you send?" pattern.
   */
  static openProtocolForContact(item) {
    InteractionLogger.openSMS(item.phone, item.contactName, item.eventType);
  }

  /**
   * Log the protocol-path send. Called after the user confirms they sent the SMS.
   */
  static confirmProtocolSent(item) {
    this._logAndMark(item, `SMS sent via system app${item.eventType ? ` (${item.eventType})` : ''}`);
  }
}

export default SmsService;
