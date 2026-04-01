// Interaction Model

import { generateId } from '../utils/helpers.js';
import { getCurrentDate } from '../utils/formatters.js';
import { INTERACTION_TYPES } from '../utils/constants.js';

export class Interaction {
    constructor(data = {}) {
        this.id = data.id || generateId('interaction');
        this.visitorId = data.visitorId || null;
        this.contactId = data.contactId || null; // Optional: specific contact
        this.interactionType = data.interactionType || INTERACTION_TYPES.CALL;
        this.notes = data.notes || '';
        this.interactionDate = data.interactionDate || getCurrentDate();
        this.createdAt = data.createdAt || getCurrentDate();
        this.createdBy = data.createdBy || null; // Machine ID
        // v3 fields
        this.outcome = data.outcome || null; // 'successful' | 'no_answer' | 'busy' | 'rescheduled' | 'left_message' | 'other'
        this.duration = (data.duration != null && data.duration !== '') ? Number(data.duration) : null; // minutes
        this.followUpDate = data.followUpDate || null; // ISO date
        this.followUpNotes = data.followUpNotes || '';
    }

    /**
     * Convert to plain object
     */
    toJSON() {
        return {
            id: this.id,
            visitorId: this.visitorId,
            contactId: this.contactId,
            interactionType: this.interactionType,
            notes: this.notes,
            interactionDate: this.interactionDate,
            createdAt: this.createdAt,
            createdBy: this.createdBy,
            outcome: this.outcome,
            duration: this.duration,
            followUpDate: this.followUpDate,
            followUpNotes: this.followUpNotes
        };
    }

    /**
     * Create from plain object
     */
    static fromJSON(data) {
        return new Interaction(data);
    }
}
