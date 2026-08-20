// OccasionService — next-occurrence math for fixed-date occasions, the
// "upcoming occasions" feed for suggestions, a birthday-cluster helper, and
// validated CRUD over the occasions collection (Iter 10).

import StateManager from '../core/state.js';
import { Occasion } from '../models/Occasion.js';
import ReminderService from './ReminderService.js';
import { resolveAnnualDate, toLocalISODate } from '../utils/formatters.js';

class OccasionService {

    /**
     * Next calendar occurrence of an occasion (this year if still ahead, else
     * next year). Day is clamped to the month's real length so Feb-29 on a
     * non-leap year resolves to Feb-28 rather than rolling into March.
     * @param {Object} occasion - { month (1-12), day (1-31) }
     * @param {Date} [from] - reference "today" (local). Defaults to now.
     * @returns {Date|null}
     */
    static nextOccurrence(occasion, from = new Date()) {
        if (!occasion) return null;
        const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());

        // Iter 11 (Phase O): a MOVABLE festival is read from its per-year table.
        // If this year's entry has passed and next year has no entry, the answer
        // is null — the caller omits it and the Occasions manager asks for a date.
        // We never extrapolate a lunar festival from last year's Gregorian date.
        if (occasion.movable === true) {
            const model = occasion instanceof Occasion ? occasion : new Occasion(occasion);
            for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
                const md = model.resolveFor(year);
                if (!md) continue;
                const dt = resolveAnnualDate(year, md.month, md.day);
                if (dt && dt >= today) return dt;
            }
            return null;
        }

        if (!occasion.month || !occasion.day) return null;

        // Iter 11 (A2): the leap-clamping year math moved to the shared
        // resolveAnnualDate() so the calendar and this service can never drift
        // apart. Behaviour here is unchanged — pinned by the characterization suite.
        let dt = resolveAnnualDate(today.getFullYear(), occasion.month, occasion.day);
        if (!dt) return null;
        if (dt < today) dt = resolveAnnualDate(today.getFullYear() + 1, occasion.month, occasion.day);
        return dt;
    }

    /**
     * Movable occasions with no date set for a year — the "needs a date" state
     * (plan O4). Surfaced in the Occasions manager so the table gets extended
     * BEFORE the year turns, rather than after a festival is missed.
     */
    static needingDates(year = new Date().getFullYear(), occasions = null) {
        const list = Array.isArray(occasions) ? occasions : StateManager.getOccasions();
        return list
            .map(o => (o instanceof Occasion ? o : new Occasion(o)))
            .filter(o => o.needsDateFor(year));
    }

    /** Set a movable occasion's date for one year. `mmdd` is 'MM-DD'. */
    static setDateForYear(occasionId, year, mmdd) {
        const list = StateManager.getOccasions();
        const found = list.find(o => o.id === occasionId);
        if (!found) return false;
        if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(mmdd || '')) return false;
        const dates = { ...(found.dates || {}), [String(year)]: mmdd };
        return StateManager.updateOccasion(occasionId, { dates, movable: true });
    }

    static _isoLocal(date) {
        return toLocalISODate(date);
    }

    /**
     * Occasions whose next occurrence falls within `days` from `from` (inclusive,
     * daysUntil 0 = today), sorted soonest-first.
     * @returns {Array<{occasion, date: Date, isoDate: string, daysUntil: number}>}
     */
    static upcomingWithin(days = 30, from = new Date(), occasions = null) {
        const list = Array.isArray(occasions) ? occasions : StateManager.getOccasions();
        const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
        return list
            .map(o => {
                const date = this.nextOccurrence(o, today);
                if (!date) return null;
                const daysUntil = Math.round((date - today) / 86400000);
                return { occasion: o, date, isoDate: this._isoLocal(date), daysUntil };
            })
            .filter(x => x && x.daysUntil >= 0 && x.daysUntil <= days)
            .sort((a, b) => a.daysUntil - b.daysUntil);
    }

    /**
     * Upcoming birthdays within `days` (a "birthday cluster" campaign source).
     * Reuses ReminderService so the birthday logic stays in one place.
     */
    static birthdaysWithin(days = 7) {
        try {
            const reminders = ReminderService.generateReminders(days, 0) || [];
            return reminders.filter(r => r.eventType === 'Birthday');
        } catch (e) {
            console.error('OccasionService.birthdaysWithin failed:', e);
            return [];
        }
    }

    // ─── CRUD (validated) ──────────────────────────────────────────────────
    static list() {
        return StateManager.getOccasions();
    }

    /**
     * Create an occasion. Returns { ok, occasion?, errors? }.
     */
    static add(data) {
        const errors = Occasion.validate(data);
        if (errors.length) return { ok: false, errors };
        const occasion = new Occasion({ ...data, builtin: false });
        StateManager.addOccasion(occasion.toJSON());
        return { ok: true, occasion };
    }

    /**
     * Update an occasion (built-in or custom). Returns { ok, errors? }.
     */
    static update(id, data) {
        const errors = Occasion.validate(data);
        if (errors.length) return { ok: false, errors };
        // Normalize through the model so month/day/templates stay well-formed,
        // but keep the original id + builtin flag.
        const existing = StateManager.getOccasions().find(o => o.id === id);
        if (!existing) return { ok: false, errors: ['Occasion not found.'] };
        const normalized = new Occasion({ ...existing, ...data, id, builtin: existing.builtin }).toJSON();
        const saved = StateManager.updateOccasion(id, normalized);
        return saved ? { ok: true } : { ok: false, errors: ['Could not save occasion.'] };
    }

    static remove(id) {
        return StateManager.deleteOccasion(id);
    }
}

export default OccasionService;
