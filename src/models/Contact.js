// Contact Model

import { generateId } from '../utils/helpers.js';
import { getCurrentDate } from '../utils/formatters.js';
import { RELATIONSHIP_TYPES } from '../utils/constants.js';

export class Contact {
    constructor(data = {}) {
        this.id = data.id || generateId('contact');
        this.visitorId = data.visitorId || null;
        this.relationType = data.relationType || RELATIONSHIP_TYPES.SELF;
        this.name = data.name || '';
        this.phones = data.phones || [];
        this.emails = data.emails || [];
        this.dob = data.dob || null;
        this.dobMonthOnly = data.dobMonthOnly || false;
        this.deathDate = data.deathDate || null;
        this.deathMonthOnly = data.deathMonthOnly || false;
        this.marriageDate = data.marriageDate || null;
        this.marriageMonthOnly = data.marriageMonthOnly || false;
        this.customEvents = data.customEvents || [];
        this.notes = data.notes || '';
        this.createdAt = data.createdAt || getCurrentDate();
        this.updatedAt = data.updatedAt || getCurrentDate();
    }

    /**
     * Add phone number
     */
    addPhone(phone) {
        if (phone && !this.phones.includes(phone)) {
            this.phones.push(phone);
            this.updatedAt = getCurrentDate();
        }
    }

    /**
     * Remove phone number
     */
    removePhone(phone) {
        const index = this.phones.indexOf(phone);
        if (index !== -1) {
            this.phones.splice(index, 1);
            this.updatedAt = getCurrentDate();
        }
    }

    /**
     * Add email
     */
    addEmail(email) {
        if (email && !this.emails.includes(email)) {
            this.emails.push(email);
            this.updatedAt = getCurrentDate();
        }
    }

    /**
     * Remove email
     */
    removeEmail(email) {
        const index = this.emails.indexOf(email);
        if (index !== -1) {
            this.emails.splice(index, 1);
            this.updatedAt = getCurrentDate();
        }
    }

    /**
     * Get primary phone
     */
    getPrimaryPhone() {
        return this.phones[0] || null;
    }

    /**
     * Get primary email
     */
    getPrimaryEmail() {
        return this.emails[0] || null;
    }

    /**
     * Check if this is SELF contact
     */
    isSelf() {
        return this.relationType === RELATIONSHIP_TYPES.SELF;
    }

    /**
     * Get all event dates for reminder generation
     */
    getEventDates() {
        const events = [];

        if (this.dob) {
            events.push({
                type: 'Birthday',
                date: this.dob,
                monthOnly: this.dobMonthOnly
            });
        }

        if (this.marriageDate) {
            events.push({
                type: 'Anniversary',
                date: this.marriageDate,
                monthOnly: this.marriageMonthOnly
            });
        }

        if (this.deathDate) {
            events.push({
                type: 'Death',
                date: this.deathDate,
                monthOnly: this.deathMonthOnly
            });
        }

        // Add custom events
        this.customEvents.forEach(event => {
            events.push({
                type: event.eventType || 'Custom',
                date: event.eventDate,
                monthOnly: event.monthOnly || false
            });
        });

        return events;
    }

    /**
     * Convert to plain object
     */
    toJSON() {
        return {
            id: this.id,
            visitorId: this.visitorId,
            relationType: this.relationType,
            name: this.name,
            phones: this.phones,
            emails: this.emails,
            dob: this.dob,
            dobMonthOnly: this.dobMonthOnly,
            deathDate: this.deathDate,
            deathMonthOnly: this.deathMonthOnly,
            marriageDate: this.marriageDate,
            marriageMonthOnly: this.marriageMonthOnly,
            customEvents: this.customEvents,
            notes: this.notes,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    /**
     * Create from plain object
     */
    static fromJSON(data) {
        return new Contact(data);
    }
}
