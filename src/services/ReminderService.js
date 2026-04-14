// Reminder Service - Generate and manage reminders

import StateManager from '../core/state.js';
import VisitorService from './VisitorService.js';
import { Reminder } from '../models/Reminder.js';
import { generateId } from '../utils/helpers.js';
import { getCurrentDate } from '../utils/formatters.js';
import { REMINDER_ACTIONS } from '../utils/constants.js';
import EventBus, { EVENTS } from '../core/events.js';

class ReminderService {
    /**
     * Generate all reminders within lookahead window.
     * Includes:
     *   - event-based reminders (birthday/anniversary/death)
     *   - frequency-based "contact due" reminders (A3: when visitor.contactFrequencyDays is overdue)
     */
    generateReminders(lookaheadDays = null) {
        const settings = StateManager.getSettings();
        const days = lookaheadDays ?? settings.reminderLookahead ?? 7;

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

                    // Check if within lookahead window
                    if (reminder.daysUntil >= 0 && reminder.daysUntil <= days) {
                        // Check if snoozed
                        if (!this.isSnoozed(reminder.id, reminderActions)) {
                            reminders.push(reminder);
                        }
                    }
                });
            });

            // Frequency-based reminder (A3)
            const freqReminder = this._generateFrequencyReminder(visitor);
            if (freqReminder && freqReminder.daysUntil <= days) {
                if (!this.isSnoozed(freqReminder.id, reminderActions)) {
                    reminders.push(freqReminder);
                }
            }
        });

        return reminders;
    }

    /**
     * Generate a "contact due" reminder for a visitor with contactFrequencyDays set.
     * Returns null if no target is set or not yet due (target date > today + lookahead).
     * Due date = (lastInteractionDate OR visitor.createdAt) + contactFrequencyDays.
     */
    _generateFrequencyReminder(visitor) {
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

        // Use ISO date (YYYY-MM-DD) as rawDate so reminder ID is stable across year boundaries
        const isoDue = dueDate.toISOString().split('T')[0];

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
     * Get reminders for a specific month (0-11)
     */
    getRemindersForMonth(monthIndex) {
        const visitors = VisitorService.getAll().filter(v => !v.doNotContact);
        const reminders = [];

        visitors.forEach(visitor => {
            visitor.contacts.forEach(contact => {
                const events = this.extractEvents(contact);
                events.forEach(event => {
                    const date = new Date(event.date);
                    if (!isNaN(date.getTime()) && date.getMonth() === parseInt(monthIndex)) {
                        reminders.push(new Reminder(
                            visitor,
                            contact,
                            event.type,
                            event.date,
                            event.monthOnly
                        ));
                    }
                });
            });
        });

        return reminders.sort((a, b) => {
            const dayA = new Date(a.rawDate).getDate();
            const dayB = new Date(b.rawDate).getDate();
            return dayA - dayB;
        });
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
