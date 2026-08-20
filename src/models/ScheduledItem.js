// ScheduledItem Model (Iter 11) — a volunteer's own plan for a specific day:
// a visit, a call, a meeting, or a plain task. Distinct from a Reminder, which
// is DERIVED from visitor event dates and cannot be created by hand.
//
// Device-local by design: scheduled items are not part of the sync package
// (see ITERATION_11_PLAN.md G2). The Interaction that completing a
// visitor-linked item creates DOES sync — the record of what happened travels
// even though the plan does not.

import { generateId } from '../utils/helpers.js';
import { getCurrentDate } from '../utils/formatters.js';
import {
    SCHEDULED_ITEM_TYPES,
    SCHEDULED_ITEM_STATUS,
    SCHEDULED_ITEM_DIRECTION,
    SCHEDULED_ITEM_OUTCOME,
    SCHEDULED_ITEM_TITLE_MAX,
    INTERACTION_TYPES
} from '../utils/constants.js';

const VALID_TYPES = Object.values(SCHEDULED_ITEM_TYPES);
const VALID_STATUSES = Object.values(SCHEDULED_ITEM_STATUS);
const VALID_DIRECTIONS = Object.values(SCHEDULED_ITEM_DIRECTION);
const VALID_OUTCOMES = Object.values(SCHEDULED_ITEM_OUTCOME);

// Local day key: YYYY-MM-DD. Deliberately strict — a scheduled item is filed
// under a calendar day, never an instant, so a timestamp here would reintroduce
// the UTC/local off-by-one this iteration exists to remove.
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A day key is well-formed AND names a real calendar day (rejects 2026-02-30). */
function isRealDayKey(value) {
    if (typeof value !== 'string' || !DAY_KEY.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1) return false;
    return d <= new Date(y, m, 0).getDate();
}

export class ScheduledItem {
    constructor(data = {}) {
        this.id = data.id || generateId('sched');
        // Iter 11 (G10-R): inbound is the PRIMARY flow — a supporter phoning to say
        // they are coming. Outbound is a volunteer's own plan. Defaulting to outbound
        // keeps every item created before Phase V correct without a data migration.
        this.direction = VALID_DIRECTIONS.includes(data.direction)
            ? data.direction
            : SCHEDULED_ITEM_DIRECTION.OUTBOUND;
        this.date = data.date || null;                       // 'YYYY-MM-DD', local day
        this.time = data.time || null;                       // 'HH:MM' or null
        this.type = VALID_TYPES.includes(data.type) ? data.type : SCHEDULED_ITEM_TYPES.TASK;
        this.title = (data.title || '').trim();
        this.notes = data.notes || '';
        this.visitorId = data.visitorId || null;             // optional link
        this.status = VALID_STATUSES.includes(data.status) ? data.status : SCHEDULED_ITEM_STATUS.PLANNED;
        this.completedAt = data.completedAt || null;

        // ─── Phase V: inbound intake ──────────────────────────────────────
        // Captured during the phone call, when it is the only chance to get it.
        this.phone = data.phone || null;              // null = caller gave none (never a placeholder)
        this.visitorName = data.visitorName || '';    // denormalised so display never breaks (S3)
        this.headcount = Number.isInteger(data.headcount) ? data.headcount : null;
        this.purpose = data.purpose || '';            // free text; NOT donation tracking

        // The occasion the visit is FOR. Its date is stored separately from the
        // visit date, because the common case is near an occasion, not on it —
        // a daughter's birthday on the 18th, the family visits Sunday the 20th.
        this.occasion = data.occasion ? {
            type: data.occasion.type || null,          // Birthday | Anniversary | Death | Custom
            whose: data.occasion.whose || '',          // the person it belongs to
            relation: data.occasion.relation || null,  // SELF | CHILD | SPOUSE | PARENT | FRIEND
            date: data.occasion.date || null           // 'YYYY-MM-DD', the occasion's OWN date
        } : null;

        // Did they actually come? Auto-completing every announced visit would
        // send a warm thank-you for one that never happened (plan V7).
        this.outcome = VALID_OUTCOMES.includes(data.outcome) ? data.outcome : null;
        this.interactionId = data.interactionId || null;     // set when completion logged one
        this.createdAt = data.createdAt || getCurrentDate();
        this.updatedAt = data.updatedAt || getCurrentDate();
        this.createdBy = data.createdBy || null;             // machine ID
    }

    /**
     * Interaction type to log when a visitor-linked item is completed.
     * A 'task' carries no communication meaning, so it maps to OTHER.
     */
    toInteractionType() {
        switch (this.type) {
            case SCHEDULED_ITEM_TYPES.VISIT: return INTERACTION_TYPES.VISIT;
            case SCHEDULED_ITEM_TYPES.CALL: return INTERACTION_TYPES.CALL;
            case SCHEDULED_ITEM_TYPES.MEETING: return INTERACTION_TYPES.MEETING;
            default: return INTERACTION_TYPES.OTHER;
        }
    }

    /** Only a visitor-linked completion may log an Interaction (G3). */
    shouldLogInteraction() {
        return !!this.visitorId;
    }

    toJSON() {
        return {
            id: this.id,
            direction: this.direction,
            date: this.date,
            time: this.time,
            type: this.type,
            title: this.title,
            notes: this.notes,
            visitorId: this.visitorId,
            status: this.status,
            completedAt: this.completedAt,
            phone: this.phone,
            visitorName: this.visitorName,
            headcount: this.headcount,
            purpose: this.purpose,
            occasion: this.occasion,
            outcome: this.outcome,
            interactionId: this.interactionId,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            createdBy: this.createdBy
        };
    }

    static fromJSON(data) {
        return new ScheduledItem(data);
    }

    /**
     * Validate input. Returns an array of human-readable errors (empty = valid).
     * Follows the Occasion.validate contract so the UI can treat both the same way.
     */
    static validate(data = {}) {
        const errors = [];

        const title = (data.title || '').trim();
        if (!title) {
            errors.push('Give this item a title.');
        } else if (title.length > SCHEDULED_ITEM_TITLE_MAX) {
            errors.push(`Title must be ${SCHEDULED_ITEM_TITLE_MAX} characters or fewer.`);
        }

        if (!isRealDayKey(data.date)) {
            errors.push('Pick a valid date.');
        }

        if (data.time !== null && data.time !== undefined && data.time !== '') {
            if (typeof data.time !== 'string' || !TIME_OF_DAY.test(data.time)) {
                errors.push('Time must look like 14:30, or be left empty.');
            }
        }

        if (data.type !== undefined && data.type !== null && !VALID_TYPES.includes(data.type)) {
            errors.push('Unknown item type.');
        }

        if (data.status !== undefined && data.status !== null && !VALID_STATUSES.includes(data.status)) {
            errors.push('Unknown item status.');
        }

        if (data.direction !== undefined && data.direction !== null && !VALID_DIRECTIONS.includes(data.direction)) {
            errors.push('Unknown item direction.');
        }

        // Phone is the identity key in this app (normalised last 10 digits), so an
        // inbound visit without one cannot be linked to the caller next year. It is
        // required — but the caller may honestly refuse, and a form that BLOCKS makes
        // a staffer type 0000000000, which under last-10-digit dedup merges unrelated
        // supporters. So: explicit null is accepted, a bad number is not.
        if (data.direction === SCHEDULED_ITEM_DIRECTION.INBOUND
            && data.phone !== null && data.phone !== undefined && data.phone !== '') {
            const digits = String(data.phone).replace(/\D/g, '');
            if (digits.length < 10) errors.push('Enter a full phone number, or leave it empty.');
        }

        if (data.headcount !== undefined && data.headcount !== null && data.headcount !== '') {
            const n = Number(data.headcount);
            if (!Number.isInteger(n) || n < 1 || n > 999) errors.push('How many people? Enter a number from 1 to 999.');
        }

        if (data.occasion && data.occasion.date && !isRealDayKey(data.occasion.date)) {
            errors.push('Pick a valid date for the occasion.');
        }

        return errors;
    }
}

export default ScheduledItem;
