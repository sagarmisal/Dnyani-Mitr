// Occasion Model — an occasion that owns bilingual greeting + invitation
// templates, and knows when it falls.
//
// TWO kinds, because India has both (Iter 11, Phase O):
//   FIXED    — same Gregorian month/day every year. Independence Day, Republic
//              Day, a foundation day, Christmas. Uses `month` + `day`.
//   MOVABLE  — lunar / luni-solar, so the Gregorian date moves every year.
//              Diwali, Ganesh Chaturthi, Gudi Padwa, Holi, Eid. Uses `dates`,
//              a per-year table: { "2026": "11-08", "2027": "10-29" }.
//
// Until Phase O, only month/day existed, and two comments here and in
// constants.js told users they could add "movable festivals" — which was false
// and is how a wrong-day Diwali greeting reaches hundreds of supporters in the
// NGO's name. A movable occasion with no entry for a year does NOT fire and does
// NOT extrapolate: it reports that it needs a date. A missing greeting is a
// small loss; a greeting on the wrong day is a public one.

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
        // { "YYYY": "MM-DD" } for movable festivals. Empty for fixed occasions.
        this.dates = (data.dates && typeof data.dates === 'object') ? { ...data.dates } : {};
        this.movable = data.movable === true || Object.keys(this.dates).length > 0;
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
            movable: this.movable,
            dates: this.dates,
            templates: this.templates,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    static fromJSON(data) {
        return new Occasion(data);
    }

    /**
     * Month/day this occasion falls on in a given year, or null when unknown.
     * A movable occasion with no entry for that year returns null — deliberately,
     * so callers omit it rather than guessing.
     */
    resolveFor(year) {
        if (this.movable) {
            const entry = this.dates ? this.dates[String(year)] : null;
            if (typeof entry !== 'string') return null;
            const m = /^(\d{2})-(\d{2})$/.exec(entry);
            if (!m) return null;
            const month = parseInt(m[1], 10);
            const day = parseInt(m[2], 10);
            if (month < 1 || month > 12 || day < 1 || day > 31) return null;
            return { month, day };
        }
        if (!this.month || !this.day) return null;
        return { month: this.month, day: this.day };
    }

    /** True when this is movable and nobody has set a date for that year yet. */
    needsDateFor(year) {
        return this.movable && !this.resolveFor(year);
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
