// Reminder Model (Derived, not stored)

import { normalizeEventDate, getDaysUntil } from '../utils/formatters.js';
import { simpleHash } from '../utils/helpers.js';

export class Reminder {
    constructor(visitor, contact, eventType, eventDate, monthOnly = false) {
        this.visitorId = visitor.id;
        this.contactId = contact.id;
        this.contactName = contact.name;
        this.relationType = contact.relationType;
        this.eventType = eventType;
        this.rawDate = eventDate;
        this.monthOnly = monthOnly;

        // Normalize to current/next year
        this.eventDate = normalizeEventDate(eventDate, monthOnly);
        this.daysUntil = getDaysUntil(this.eventDate);

        // Generate unique ID based on visitor, contact, event type, and raw date
        this.id = this.generateId();
    }

    /**
     * Generate unique reminder ID
     */
    generateId() {
        const str = `${this.visitorId}_${this.contactId}_${this.eventType}_${this.rawDate}`;
        return `reminder_${simpleHash(str)}`;
    }

    /**
     * Check if reminder is overdue
     */
    isOverdue() {
        return this.daysUntil < 0;
    }

    /**
     * Check if reminder is today
     */
    isToday() {
        return this.daysUntil === 0;
    }

    /**
     * Check if reminder is upcoming (within lookahead window)
     */
    isUpcoming(lookaheadDays = 7) {
        return this.daysUntil > 0 && this.daysUntil <= lookaheadDays;
    }

    /**
     * Get urgency level
     */
    getUrgency() {
        if (this.daysUntil < 0) return 'overdue';
        if (this.daysUntil === 0) return 'today';
        if (this.daysUntil <= 7) return 'urgent';
        if (this.daysUntil <= 30) return 'upcoming';
        return 'later';
    }

    /**
     * Convert to plain object
     */
    toJSON() {
        return {
            id: this.id,
            visitorId: this.visitorId,
            contactId: this.contactId,
            contactName: this.contactName,
            relationType: this.relationType,
            eventType: this.eventType,
            eventDate: this.eventDate,
            rawDate: this.rawDate,
            monthOnly: this.monthOnly,
            daysUntil: this.daysUntil,
            urgency: this.getUrgency()
        };
    }
}
