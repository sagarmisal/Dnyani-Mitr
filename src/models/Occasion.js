// Occasion Model — a fixed-date (month/day) occasion that owns bilingual
// greeting + invitation templates. Built-ins are seeded from DEFAULT_OCCASIONS;
// users add/edit their own (Foundation Day, movable festivals) via the manager.

import { generateId } from '../utils/helpers.js';
import { getCurrentDate } from '../utils/formatters.js';

// Max valid day per month (index 0 = Jan). February allows 29 (leap years).
const MAX_DAY_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export class Occasion {
    constructor(data = {}) {
        this.id = data.id || generateId('occasion');
        this.name = (data.name || '').trim();
        this.nameMr = (data.nameMr || '').trim();
        const m = parseInt(data.month, 10);
        const d = parseInt(data.day, 10);
        this.month = Number.isInteger(m) ? m : null; // 1-12
        this.day = Number.isInteger(d) ? d : null;   // 1-31
        this.builtin = data.builtin === true;
        const t = data.templates || {};
        this.templates = {
            greeting: { en: (t.greeting && t.greeting.en) || '', mr: (t.greeting && t.greeting.mr) || '' },
            invitation: { en: (t.invitation && t.invitation.en) || '', mr: (t.invitation && t.invitation.mr) || '' }
        };
        // Built-ins are code-defined (no real creation time); user occasions get a stamp.
        this.createdAt = data.createdAt !== undefined ? data.createdAt : (this.builtin ? null : getCurrentDate());
        this.updatedAt = data.updatedAt !== undefined ? data.updatedAt : (this.builtin ? null : getCurrentDate());
    }

    /** Display name in the given language, falling back to the other if empty. */
    displayName(lang = 'en') {
        if (lang === 'mr') return this.nameMr || this.name;
        return this.name || this.nameMr;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            nameMr: this.nameMr,
            month: this.month,
            day: this.day,
            builtin: this.builtin,
            templates: this.templates,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    static fromJSON(data) {
        return new Occasion(data);
    }

    /**
     * Validate occasion input. Returns an array of human-readable error strings
     * (empty array = valid). Guards impossible dates (e.g. 31 Feb) but allows 29 Feb.
     */
    static validate(data = {}) {
        const errors = [];
        const name = (data.name || '').trim();
        const nameMr = (data.nameMr || '').trim();
        if (!name && !nameMr) errors.push('Occasion needs a name (English or Marathi).');

        const m = parseInt(data.month, 10);
        const d = parseInt(data.day, 10);
        if (!Number.isInteger(m) || m < 1 || m > 12) {
            errors.push('Month must be between 1 and 12.');
        }
        if (!Number.isInteger(d) || d < 1 || d > 31) {
            errors.push('Day must be between 1 and 31.');
        }
        if (Number.isInteger(m) && m >= 1 && m <= 12 && Number.isInteger(d) && d >= 1) {
            if (d > MAX_DAY_IN_MONTH[m - 1]) {
                errors.push(`Day ${d} is not valid for that month.`);
            }
        }
        return errors;
    }
}

export default Occasion;
