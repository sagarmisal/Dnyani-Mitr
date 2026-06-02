// OccasionService — next-occurrence math for fixed-date occasions, the
// "upcoming occasions" feed for suggestions, a birthday-cluster helper, and
// validated CRUD over the occasions collection (Iter 10).

import StateManager from '../core/state.js';
import { Occasion } from '../models/Occasion.js';
import ReminderService from './ReminderService.js';

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
        if (!occasion || !occasion.month || !occasion.day) return null;
        const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
        const make = (year) => {
            const m = occasion.month - 1;
            const lastDay = new Date(year, m + 1, 0).getDate(); // days in that month/year
            const d = Math.min(occasion.day, lastDay);
            return new Date(year, m, d);
        };
        let dt = make(today.getFullYear());
        if (dt < today) dt = make(today.getFullYear() + 1);
        return dt;
    }

    static _isoLocal(date) {
        const pad = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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
