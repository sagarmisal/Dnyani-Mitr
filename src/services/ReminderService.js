// Reminder Service - Generate and manage reminders

import StateManager from '../core/state.js';
import VisitorService from './VisitorService.js';
import { Reminder } from '../models/Reminder.js';
import { generateId } from '../utils/helpers.js';
import { getCurrentDate, toLocalISODate } from '../utils/formatters.js';
import { REMINDER_ACTIONS } from '../utils/constants.js';
import EventBus, { EVENTS } from '../core/events.js';

// Recent overdue events stay surfaced for this many days after the event date.
// Belated wishes are still actionable for a couple of weeks; after that they're
// noise. Tune via settings.reminderLookbackDays if needed; default 30.
const DEFAULT_LOOKBACK_DAYS = 30;

class ReminderService {
    /**
     * Generate reminders within the window [today - lookbackDays, today + lookaheadDays].
     *
     * Historical note: prior to Iter 9.1 this filter was `daysUntil >= 0 && <= days`,
     * which silently dropped every overdue event. `getGroupedReminders` had an
     * `overdue` bucket but the generator never produced overdue entries, so the
     * Reminders tab showed nothing on quiet days even when there were recently-
     * missed birthdays. The fix is to let `daysUntil < 0` events through and let
     * Reminder.getUrgency() classify them as 'overdue' as it already does.
     *
     * Includes:
     *   - event-based reminders (birthday/anniversary/death)
     *   - frequency-based "contact due" reminders (A3: when visitor.contactFrequencyDays is overdue)
     */
    generateReminders(lookaheadDays = null, lookbackDays = null) {
        const settings = StateManager.getSettings();
        const ahead = lookaheadDays ?? settings.reminderLookahead ?? 7;
        const back = lookbackDays ?? settings.reminderLookbackDays ?? DEFAULT_LOOKBACK_DAYS;

        const visitors = VisitorService.getAll().filter(v => !v.doNotContact);
        const reminderActions = StateManager.getReminderActions();
        const reminders = [];

        visitors.forEach(visitor => {
            // Event-based reminders (birthday, anniversary, death)
            visitor.contacts.forEach(contact => {
                const events = this.extractEvents(contact);

                events.forEach(event => {
                    const reminder = new Reminder(
                        visitor,
                        contact,
                        event.type,
                        event.date,
                        event.monthOnly
                    );

                    // Window: include recent past (overdue) + future up to lookahead.
                    if (reminder.daysUntil >= -back && reminder.daysUntil <= ahead) {
                        if (!this.isSnoozed(reminder.id, reminderActions)) {
                            // Skip items already marked 'contacted' within the
                            // current cycle. Window-aware: a contacted action from
                            // a previous year (older than back+ahead days) does NOT
                            // suppress this year's reminder.
                            if (!this._isAlreadyContactedThisCycle(reminder.id, reminderActions, back + ahead)) {
                                reminders.push(reminder);
                            }
                        }
                    }
                });
            });

            // Frequency-based reminder (A3) — same expansion: include items
            // that became due in the past `back` days, not just upcoming.
            const freqReminder = this.generateFrequencyReminder(visitor);
            if (freqReminder && freqReminder.daysUntil >= -back && freqReminder.daysUntil <= ahead) {
                if (!this.isSnoozed(freqReminder.id, reminderActions)) {
                    if (!this._isAlreadyContactedThisCycle(freqReminder.id, reminderActions, back + ahead)) {
                        reminders.push(freqReminder);
                    }
                }
            }
        });

        return reminders;
    }

    /**
     * Has this reminder been marked 'contacted' within the current cycle window?
     * The reminderId is stable across years (hash of visitor+contact+eventType+rawDate),
     * so we MUST be window-aware — otherwise a contacted action from last year would
     * suppress this year's reminder forever. The window is back+ahead days, matching
     * the period during which a reminder could legitimately appear.
     */
    _isAlreadyContactedThisCycle(reminderId, reminderActions, windowDays) {
        const cutoff = new Date();
        cutoff.setHours(0, 0, 0, 0);
        cutoff.setDate(cutoff.getDate() - windowDays);
        return reminderActions.some(a =>
            a.reminderId === reminderId &&
            a.action === 'contacted' &&
            a.actionAt &&
            new Date(a.actionAt) >= cutoff
        );
    }

    /**
     * Generate a "contact due" reminder for a visitor with contactFrequencyDays set.
     * Returns null if no target is set or not yet due (target date > today + lookahead).
     * Due date = (lastInteractionDate OR visitor.createdAt) + contactFrequencyDays.
     */
    generateFrequencyReminder(visitor) {
        if (!visitor.contactFrequencyDays || visitor.contactFrequencyDays <= 0) return null;

        const interactions = StateManager.getInteractions()
            .filter(i => i.visitorId === visitor.id);

        let baselineDate;
        if (interactions.length > 0) {
            baselineDate = interactions.reduce((latest, i) => {
                const d = new Date(i.interactionDate);
                return d > latest ? d : latest;
            }, new Date(0));
        } else if (visitor.createdAt) {
            baselineDate = new Date(visitor.createdAt);
        } else {
            return null;
        }

        if (isNaN(baselineDate.getTime())) return null;

        const dueDate = new Date(baselineDate);
        dueDate.setDate(dueDate.getDate() + visitor.contactFrequencyDays);

        const selfContact = visitor.contacts?.find(c => c.relationType === 'SELF');
        if (!selfContact) return null;

        // Use ISO date (YYYY-MM-DD) as rawDate so reminder ID is stable across year boundaries.
        // Iter 11 (A3): keyed off the LOCAL calendar day, not the UTC one. `toISOString()`
        // reports the UTC date, so in IST a due instant falling between 00:00 and 05:30 local
        // was reported as the previous day — and disagreed with `daysUntil` below, which has
        // always been computed from local midnight. The record was internally inconsistent by
        // one day and the reminder surfaced a day early.
        const isoDue = toLocalISODate(dueDate);

        const reminder = new Reminder(
            visitor,
            selfContact,
            'ContactDue',
            isoDue,
            false
        );

        // The Reminder constructor normalizes dates into the current/next year which is wrong
        // for "ContactDue" (it's a one-off target, not an annual event). Override daysUntil and
        // eventDate with the raw values so urgency/display reflect the actual target date.
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetMidnight = new Date(dueDate);
        targetMidnight.setHours(0, 0, 0, 0);
        reminder.daysUntil = Math.round((targetMidnight - today) / 86400000);
        reminder.eventDate = isoDue;

        return reminder;
    }

    /**
     * Extract events from contact
     */
    extractEvents(contact) {
        const events = [];

        if (contact.dob) {
            events.push({
                type: 'Birthday',
                date: contact.dob,
                monthOnly: contact.dobMonthOnly || false
            });
        }

        if (contact.marriageDate) {
            events.push({
                type: 'Anniversary',
                date: contact.marriageDate,
                monthOnly: contact.marriageMonthOnly || false
            });
        }

        if (contact.deathDate) {
            events.push({
                type: 'Death',
                date: contact.deathDate,
                monthOnly: contact.deathMonthOnly || false
            });
        }

        // Custom events
        if (contact.customEvents && Array.isArray(contact.customEvents)) {
            contact.customEvents.forEach(event => {
                if (event.reminderEnabled !== false) {
                    events.push({
                        type: event.eventType || 'Custom',
                        date: event.eventDate,
                        monthOnly: event.monthOnly || false
                    });
                }
            });
        }

        return events;
    }

    /**
     * Check if reminder is snoozed
     */
    isSnoozed(reminderId, reminderActions) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return reminderActions.some(action =>
            action.reminderId === reminderId &&
            action.action === REMINDER_ACTIONS.SNOOZED &&
            action.snoozeUntil &&
            new Date(action.snoozeUntil) > today
        );
    }

    /**
     * Get reminders for a specific month (0-11).
     *
     * Unlike the default Reminders view (which hides snoozed/contacted items),
     * this is an explicit "show me everything in <month>" view. We surface
     * everything but annotate each reminder with `handled`/`handledReason`/
     * `handledAt`/`handledUntil` so the UI can dim items the user already
     * acted on. Sort: unhandled first (most actionable on top), handled below,
     * both by day-of-month.
     */
    getRemindersForMonth(monthIndex) {
        const visitors = VisitorService.getAll().filter(v => !v.doNotContact);
        const reminderActions = StateManager.getReminderActions();
        const settings = StateManager.getSettings();
        const ahead = settings.reminderLookahead ?? 7;
        const back = settings.reminderLookbackDays ?? DEFAULT_LOOKBACK_DAYS;
        const cycleWindow = back + ahead;
        const reminders = [];

        visitors.forEach(visitor => {
            visitor.contacts.forEach(contact => {
                const events = this.extractEvents(contact);
                events.forEach(event => {
                    const date = new Date(event.date);
                    if (!isNaN(date.getTime()) && date.getMonth() === parseInt(monthIndex)) {
                        const reminder = new Reminder(
                            visitor,
                            contact,
                            event.type,
                            event.date,
                            event.monthOnly
                        );
                        this.annotateHandled(reminder, reminderActions, cycleWindow);
                        reminders.push(reminder);
                    }
                });
            });
        });

        return reminders.sort((a, b) => {
            if (a.handled !== b.handled) return a.handled ? 1 : -1;
            const dayA = new Date(a.rawDate).getDate();
            const dayB = new Date(b.rawDate).getDate();
            return dayA - dayB;
        });
    }

    /**
     * Mutate `reminder` with handled metadata so the UI can dim it.
     * - snoozed (active): handledReason='snoozed', handledUntil=snoozeUntil
     * - contacted this cycle: handledReason='contacted', handledAt=most recent actionAt
     * - neither: handled=false
     */
    annotateHandled(reminder, reminderActions, cycleWindow) {
        if (this.isSnoozed(reminder.id, reminderActions)) {
            const snoozeAction = reminderActions.find(a =>
                a.reminderId === reminder.id &&
                a.action === REMINDER_ACTIONS.SNOOZED &&
                a.snoozeUntil &&
                new Date(a.snoozeUntil) > new Date()
            );
            reminder.handled = true;
            reminder.handledReason = 'snoozed';
            reminder.handledUntil = snoozeAction?.snoozeUntil || null;
            reminder.handledAt = snoozeAction?.actionAt || null;
            return;
        }
        if (this._isAlreadyContactedThisCycle(reminder.id, reminderActions, cycleWindow)) {
            const contactedAction = reminderActions
                .filter(a => a.reminderId === reminder.id && a.action === REMINDER_ACTIONS.CONTACTED)
                .sort((a, b) => new Date(b.actionAt) - new Date(a.actionAt))[0];
            reminder.handled = true;
            reminder.handledReason = 'contacted';
            reminder.handledAt = contactedAction?.actionAt || null;
            return;
        }
        reminder.handled = false;
    }

    /**
     * Iter 11 (B2/B4): `annotateHandled` and `generateFrequencyReminder` were promoted
     * from private to public so CalendarService can reuse them instead of forking the
     * logic (plan G6). These aliases keep the original names working for any caller or
     * test that still uses them — the behaviour is identical, there is one implementation.
     */
    _annotateHandled(reminder, reminderActions, cycleWindow) {
        return this.annotateHandled(reminder, reminderActions, cycleWindow);
    }

    _generateFrequencyReminder(visitor) {
        return this.generateFrequencyReminder(visitor);
    }

    /**
     * Get reminders grouped by urgency
     */
    getGroupedReminders(lookaheadDays = null) {
        const reminders = this.generateReminders(lookaheadDays);

        const grouped = {
            overdue: [],
            today: [],
            urgent: [],    // 0-7 days
            upcoming: [],  // 8-30 days
            later: []      // 31+ days
        };

        reminders.forEach(reminder => {
            const urgency = reminder.getUrgency();
            if (grouped[urgency]) {
                grouped[urgency].push(reminder);
            } else {
                grouped.later.push(reminder);
            }
        });

        return grouped;
    }

    /**
     * Record reminder action
     */
    recordAction(reminderId, action, note = '', snoozeDays = null) {
        if (!Object.values(REMINDER_ACTIONS).includes(action)) {
            throw new Error(`Invalid reminder action: ${action}`);
        }

        const reminderAction = {
            id: generateId('action'),
            reminderId,
            action,
            note,
            actionAt: getCurrentDate(),
            snoozeUntil: snoozeDays
                ? new Date(Date.now() + snoozeDays * 24 * 60 * 60 * 1000).toISOString()
                : null
        };

        const success = StateManager.addReminderAction(reminderAction);

        if (!success) {
            throw new Error('Failed to record reminder action');
        }

        EventBus.emit(EVENTS.REMINDERS_UPDATED);

        return reminderAction;
    }

    /**
     * Get reminder history for a visitor
     */
    getHistoryForVisitor(visitorId) {
        const reminderActions = StateManager.getReminderActions();
        const reminders = this.generateReminders(365); // Get all for the year

        // Filter actions for this visitor
        const visitorReminders = reminders.filter(r => r.visitorId === visitorId);
        const reminderIds = new Set(visitorReminders.map(r => r.id));

        return reminderActions.filter(action => reminderIds.has(action.reminderId));
    }

    /**
     * Get reminder statistics
     */
    getStats() {
        const reminders = this.generateReminders();
        const grouped = this.getGroupedReminders();

        return {
            total: reminders.length,
            overdue: grouped.overdue.length,
            today: grouped.today.length,
            urgent: grouped.urgent.length,
            upcoming: grouped.upcoming.length
        };
    }
}

// Export singleton instance
export default new ReminderService();
