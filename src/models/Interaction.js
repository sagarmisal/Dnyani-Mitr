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
        // Iter 11 (A6): follow-up completion. Storage back-fills this on load, but the
        // model must declare AND serialise it — otherwise a round-trip through
        // fromJSON/toJSON silently drops a completed follow-up and it reappears forever.
        this.followUpCompletedAt = data.followUpCompletedAt || null;

        // P2.11 (J3) — when we sent them a thank-you or a greeting.
        //
        // OPTIMISTIC BY NATURE. We hand off to WhatsApp or the SMS app and
        // never learn whether it arrived, so this records our INTENT to thank
        // someone, not delivery. No screen may claim more than that (PR-3):
        // "आभार पाठवले" is honest, "they received it" would not be.
        this.thankedAt = data.thankedAt || null;

        // P2.13 (J1/J4) — what they brought with them.
        //
        // Tally marks, deliberately NOT donation accounting: no amounts, no
        // receipts, no reconciliation. This is what a balikashram's day
        // actually consists of and what someone will actually fill in while
        // the visitor is still standing there.
        this.contribution = Array.isArray(data.contribution) ? data.contribution : [];
        this.contributionNote = data.contributionNote || '';   // "डाळ, भात, पोळी"

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
            followUpNotes: this.followUpNotes,
            followUpCompletedAt: this.followUpCompletedAt
        };
    }

    /**
     * Create from plain object
     */
    static fromJSON(data) {
        return new Interaction(data);
    }
}
