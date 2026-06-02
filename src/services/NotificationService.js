// NotificationService — schedules a daily reminder digest + an upcoming-occasion
// nudge as LOCAL notifications (offline; device-local; no server).
//
// Accessed via the runtime Capacitor plugin (window.Capacitor.Plugins.LocalNotifications)
// rather than a static import, mirroring SmsService — so the web bundle is
// unaffected and everything NO-OPs gracefully on desktop / non-Capacitor.

import ReminderService from './ReminderService.js';
import OccasionService from './OccasionService.js';

const DIGEST_ID = 1001;
const OCCASION_ID = 1002;

class NotificationService {
    static _plugin() {
        return (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins)
            ? window.Capacitor.Plugins.LocalNotifications
            : null;
    }

    static _isNative() {
        return !!(typeof window !== 'undefined'
            && window.Capacitor
            && typeof window.Capacitor.isNativePlatform === 'function'
            && window.Capacitor.isNativePlatform());
    }

    /** True only when local notifications can actually be scheduled (native + plugin). */
    static isAvailable() {
        return this._isNative() && !!this._plugin();
    }

    static async requestPermission() {
        const plugin = this._plugin();
        if (!plugin) return { granted: false, reason: 'unavailable' };
        try {
            const res = await plugin.requestPermissions();
            return { granted: res && res.display === 'granted', state: res && res.display };
        } catch (e) {
            return { granted: false, reason: e && e.message ? e.message : String(e) };
        }
    }

    /**
     * Reconcile scheduled notifications with the current settings. Idempotent:
     * cancels existing app notifications and reschedules from scratch. Safe to
     * call on every launch and whenever the setting changes. NO-OP off-device.
     * @returns {Promise<{scheduled:number, reason?:string}>}
     */
    static async sync(settings) {
        if (!this.isAvailable()) return { scheduled: 0, reason: 'not-native' };
        if (!settings || !settings.notificationsEnabled) {
            await this.cancelAll();
            return { scheduled: 0, reason: 'disabled' };
        }
        const perm = await this.requestPermission();
        if (!perm.granted) return { scheduled: 0, reason: 'denied' };

        await this.cancelAll();
        const notifications = this._buildSchedule(settings);
        if (notifications.length) {
            try {
                await this._plugin().schedule({ notifications });
            } catch (e) {
                console.error('NotificationService: schedule failed', e);
                return { scheduled: 0, reason: 'schedule-error' };
            }
        }
        return { scheduled: notifications.length };
    }

    static async cancelAll() {
        const plugin = this._plugin();
        if (!plugin) return;
        try {
            // Only cancel the IDs we own, so we never touch other apps' notifications.
            await plugin.cancel({ notifications: [{ id: DIGEST_ID }, { id: OCCASION_ID }] });
        } catch (e) { /* nothing pending — ignore */ }
    }

    /**
     * Build the notification set from current data. Pure given the services'
     * outputs; each source is guarded so one failing doesn't sink the other.
     */
    static _buildSchedule(settings) {
        const notifications = [];
        const [hh, mm] = String(settings.notificationDigestTime || '09:00').split(':').map(n => parseInt(n, 10));
        const hour = Number.isInteger(hh) ? Math.min(23, Math.max(0, hh)) : 9;
        const minute = Number.isInteger(mm) ? Math.min(59, Math.max(0, mm)) : 0;
        const at = { on: { hour, minute }, allowWhileIdle: true }; // daily recurring

        // Daily reminder digest
        try {
            const reminders = ReminderService.generateReminders(settings.reminderLookahead || 7) || [];
            const dueToday = reminders.filter(r => r.daysUntil === 0).length;
            if (reminders.length > 0) {
                notifications.push({
                    id: DIGEST_ID,
                    title: 'Dnyani Mitr — Reminders',
                    body: dueToday > 0
                        ? `${dueToday} due today, ${reminders.length} coming up.`
                        : `${reminders.length} reminders coming up.`,
                    schedule: at
                });
            }
        } catch (e) { console.error('NotificationService: digest build failed', e); }

        // Upcoming-occasion nudge (next one within 7 days)
        try {
            const up = OccasionService.upcomingWithin(7);
            if (up.length) {
                const u = up[0];
                const when = u.daysUntil === 0 ? 'today' : (u.daysUntil === 1 ? 'tomorrow' : `in ${u.daysUntil} days`);
                notifications.push({
                    id: OCCASION_ID,
                    title: 'Upcoming occasion',
                    body: `${u.occasion.nameMr || u.occasion.name} is ${when}. Send greetings.`,
                    schedule: at
                });
            }
        } catch (e) { console.error('NotificationService: occasion build failed', e); }

        return notifications;
    }
}

export default NotificationService;
