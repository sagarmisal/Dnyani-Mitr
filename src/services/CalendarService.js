// Calendar Service (Iter 11) — pure derivation. Owns NO state.
//
// Answers "what is on this day?" for ANY day in ANY year, which the existing
// reminder machinery cannot do:
//   - `Reminder` normalizes its date to the current/next year at construction
//     (`normalizeEventDate`), so it can never represent August 2027 or a past year.
//   - `ReminderService.getRemindersForMonth(monthIndex)` is year-blind: month 7
//     cannot distinguish August 2026 from August 2027.
// So this service resolves annual dates itself via `resolveAnnualDate(year, m, d)`
// and emits its own lightweight items. It still REUSES ReminderService for id
// generation, handled/snoozed annotation and contact-due derivation rather than
// reimplementing any of it (plan G6: no forked logic).

import StateManager from '../core/state.js';
import { visitorDisplayName } from '../utils/formatters.js';
import VisitorService from './VisitorService.js';
import ReminderService from './ReminderService.js';
import { Reminder } from '../models/Reminder.js';
import { Occasion } from '../models/Occasion.js';
import { resolveAnnualDate, toLocalISODate, localDayKey } from '../utils/formatters.js';
import { compareNames } from '../utils/devanagari.js';
import { SCHEDULED_ITEM_STATUS, SCHEDULED_ITEM_DIRECTION } from '../utils/constants.js';

const DEFAULT_LOOKBACK_DAYS = 30;

export const CALENDAR_ITEM_KINDS = {
    EVENT: 'event',           // birthday / anniversary / death / custom
    CONTACT_DUE: 'contactDue',
    OCCASION: 'occasion',     // festival, civic day, foundation day
    CAMPAIGN: 'campaign',
    FOLLOW_UP: 'followUp',
    INTERACTION: 'interaction', // something already logged that day
    SCHEDULED: 'scheduled'      // a planned visit/call/meeting/task
};

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Month/day of a stored event date, read TEXTUALLY when it looks like YYYY-MM-DD.
 * `new Date('1985-08-15')` parses as UTC midnight, which lands on the previous
 * local day in any negative-offset timezone — a bug class this iteration exists
 * to remove. Only fall back to Date parsing for formats we cannot read directly.
 */
function monthDayOf(raw) {
    if (typeof raw === 'string') {
        const m = DAY_KEY.exec(raw.slice(0, 10));
        if (m) return { month: parseInt(m[2], 10), day: parseInt(m[3], 10) };
    }
    const d = raw instanceof Date ? raw : new Date(raw);
    if (isNaN(d.getTime())) return null;
    return { month: d.getMonth() + 1, day: d.getDate() };
}

function yearOf(dayKey) {
    const m = DAY_KEY.exec(dayKey);
    return m ? parseInt(m[1], 10) : null;
}

class CalendarService {
    // ─── Public API ────────────────────────────────────────────────────────

    /**
     * Everything falling between two local day keys, inclusive.
     *
     * @param {string} startKey 'YYYY-MM-DD'
     * @param {string} endKey   'YYYY-MM-DD'
     * @returns {{days: Object<string, Array>, monthWide: Object<string, Array>}}
     *   `days` is keyed by day; `monthWide` is keyed by 'YYYY-MM' and holds
     *   month-only events, which have no day and must never be pinned to the 1st.
     */
    getItemsForRange(startKey, endKey) {
        const days = {};
        const monthWide = {};
        if (!DAY_KEY.test(startKey || '') || !DAY_KEY.test(endKey || '')) {
            return { days, monthWide };
        }
        if (endKey < startKey) return { days, monthWide };

        const ctx = this._context(startKey, endKey);

        this._addEventReminders(ctx, days, monthWide);   // B1
        this._addContactDue(ctx, days);                  // B2
        this._addOccasions(ctx, days);                   // B2
        this._addCampaigns(ctx, days);                   // B2
        this._addFollowUps(ctx, days);                   // B3
        this._addInteractions(ctx, days);                // B3
        this._addScheduledItems(ctx, days);              // B4

        Object.keys(days).forEach(k => days[k].sort(compareItems));
        return { days, monthWide };
    }

    /**
     * 6x7 grid of local-date cells for a month, including the leading/trailing
     * days needed to fill the first and last weeks.
     *
     * @param {number} year
     * @param {number} month 1-12. Deliberately NOT the 0-11 index that
     *   `getRemindersForMonth` takes — that off-by-one is a standing trap.
     * @param {string} startsOn 'sun' (Indian wall-calendar convention) | 'mon'
     */
    getMonthMatrix(year, month, startsOn = null) {
        const settings = StateManager.getSettings();
        const weekStart = (startsOn || settings.calendarStartsOn || 'sun') === 'mon' ? 1 : 0;

        const first = new Date(year, month - 1, 1);
        const offset = (first.getDay() - weekStart + 7) % 7;

        const gridStart = new Date(year, month - 1, 1 - offset);
        const cells = [];
        for (let i = 0; i < 42; i++) {
            cells.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
        }

        const startKey = toLocalISODate(cells[0]);
        const endKey = toLocalISODate(cells[41]);
        const { days, monthWide } = this.getItemsForRange(startKey, endKey);
        const todayKey = toLocalISODate(new Date());

        const grid = cells.map(d => {
            const key = toLocalISODate(d);
            const items = days[key] || [];
            return {
                date: key,
                day: d.getDate(),
                inMonth: d.getMonth() === month - 1,
                isToday: key === todayKey,
                isPast: key < todayKey,
                items,
                count: items.length,
                counts: countByKind(items),
                // Red-dot signal for the grid: a past day still carrying something
                // nobody has dealt with (plan G1/G12).
                hasUnhandledPast: key < todayKey && items.some(isUnhandled)
            };
        });

        const weeks = [];
        for (let w = 0; w < 6; w++) weeks.push(grid.slice(w * 7, w * 7 + 7));

        return {
            year,
            month,
            weekStart,
            weeks,
            cells: grid,
            monthWide: monthWide[`${year}-${String(month).padStart(2, '0')}`] || []
        };
    }

    /**
     * Unhandled items from the recent past, for the pinned "Needs catching up"
     * group. Returns the FULL list plus a total — the UI caps the display at 5
     * and shows "+N more" (plan G17). There is deliberately no bulk "mark all
     * contacted": it would write `contacted` against people nobody contacted.
     */
    getOverdueBacklog(todayKey = null) {
        const today = todayKey || toLocalISODate(new Date());
        const settings = StateManager.getSettings();
        const back = settings.reminderLookbackDays ?? DEFAULT_LOOKBACK_DAYS;

        const from = new Date(today + 'T00:00:00');
        from.setDate(from.getDate() - back);
        const startKey = toLocalISODate(from);

        const yesterday = new Date(today + 'T00:00:00');
        yesterday.setDate(yesterday.getDate() - 1);
        const endKey = toLocalISODate(yesterday);

        if (endKey < startKey) return { items: [], total: 0 };

        const { days } = this.getItemsForRange(startKey, endKey);
        const items = Object.keys(days)
            .sort()
            .reverse()                     // most recent first — freshest miss is most actionable
            .flatMap(k => days[k].filter(isUnhandled));

        return { items, total: items.length };
    }

    // ─── Internals ─────────────────────────────────────────────────────────

    _context(startKey, endKey) {
        const settings = StateManager.getSettings();
        const ahead = settings.reminderLookahead ?? 7;
        const back = settings.reminderLookbackDays ?? DEFAULT_LOOKBACK_DAYS;

        const startYear = yearOf(startKey);
        const endYear = yearOf(endKey);
        const years = [];
        for (let y = startYear; y <= endYear; y++) years.push(y);

        return {
            startKey,
            endKey,
            years,
            cycleWindow: back + ahead,
            // Do-not-contact visitors are excluded from every derived reminder,
            // exactly as generateReminders does. They still appear via their own
            // logged interactions and scheduled items, which are records of fact.
            visitors: VisitorService.getAll().filter(v => !v.doNotContact),
            allVisitors: VisitorService.getAll(),
            reminderActions: StateManager.getReminderActions(),
            interactions: StateManager.getInteractions(),
            occasions: StateManager.getOccasions(),
            campaigns: StateManager.getCampaigns(),
            scheduledItems: StateManager.getScheduledItems()
        };
    }

    _inRange(ctx, key) {
        return key >= ctx.startKey && key <= ctx.endKey;
    }

    _push(days, key, item) {
        if (!days[key]) days[key] = [];
        days[key].push(item);
    }

    _visitorName(visitor) {
        return visitorDisplayName(visitor);   // D-07 fallback to the number
    }

    _visitorNameLegacy(visitor) {
        const self = visitor.contacts?.find(c => c.relationType === 'SELF');
        return self?.name || visitor.contacts?.[0]?.name || 'Unknown';
    }

    /** B1 — annual events resolved into whatever year the range covers. */
    _addEventReminders(ctx, days, monthWide) {
        ctx.visitors.forEach(visitor => {
            (visitor.contacts || []).forEach(contact => {
                ReminderService.extractEvents(contact).forEach(event => {
                    if (!event.date) return;

                    // A month-only event has no day. Pinning it to the 1st would
                    // invent a date the user never gave us (plan F10), so it goes
                    // to a month-wide bucket the UI renders above the grid.
                    if (event.monthOnly) {
                        const md = monthDayOf(event.date);
                        if (!md) return;
                        ctx.years.forEach(year => {
                            const bucket = `${year}-${String(md.month).padStart(2, '0')}`;
                            const firstOfMonth = `${bucket}-01`;
                            const lastOfMonth = `${bucket}-${String(new Date(year, md.month, 0).getDate()).padStart(2, '0')}`;
                            if (lastOfMonth < ctx.startKey || firstOfMonth > ctx.endKey) return;
                            if (!monthWide[bucket]) monthWide[bucket] = [];
                            monthWide[bucket].push(this._eventItem(ctx, visitor, contact, event, null, true));
                        });
                        return;
                    }

                    const md = monthDayOf(event.date);
                    if (!md) return;

                    ctx.years.forEach(year => {
                        const resolved = resolveAnnualDate(year, md.month, md.day);
                        if (!resolved) return;
                        const key = toLocalISODate(resolved);
                        if (!this._inRange(ctx, key)) return;
                        this._push(days, key, this._eventItem(ctx, visitor, contact, event, key, false));
                    });
                });
            });
        });
    }

    _eventItem(ctx, visitor, contact, event, dateKey, isMonthWide) {
        // Build a Reminder purely to obtain the canonical id and the handled
        // annotation — its own normalized date is discarded, because it can only
        // ever describe the current/next year. The id is year-independent
        // (hash of visitor+contact+type+rawDate), so annotation stays correct.
        const reminder = new Reminder(visitor, contact, event.type, event.date, event.monthOnly);
        ReminderService.annotateHandled(reminder, ctx.reminderActions, ctx.cycleWindow);

        return {
            kind: CALENDAR_ITEM_KINDS.EVENT,
            date: dateKey,
            monthWide: isMonthWide,
            eventType: event.type,
            title: `${contact.name} — ${event.type}`,
            visitorId: visitor.id,
            visitorName: this._visitorName(visitor),
            contactId: contact.id,
            contactName: contact.name,
            reminderId: reminder.id,
            rawDate: event.date,
            handled: !!reminder.handled,
            handledReason: reminder.handledReason || null,
            handledAt: reminder.handledAt || null,
            handledUntil: reminder.handledUntil || null
        };
    }

    /** B2 — contact-due is a ONE-OFF target date, never annualized. */
    _addContactDue(ctx, days) {
        ctx.visitors.forEach(visitor => {
            const reminder = ReminderService.generateFrequencyReminder(visitor);
            if (!reminder) return;
            const key = reminder.eventDate;
            if (!DAY_KEY.test(key || '') || !this._inRange(ctx, key)) return;

            ReminderService.annotateHandled(reminder, ctx.reminderActions, ctx.cycleWindow);
            this._push(days, key, {
                kind: CALENDAR_ITEM_KINDS.CONTACT_DUE,
                date: key,
                title: `${this._visitorName(visitor)} — contact due`,
                visitorId: visitor.id,
                visitorName: this._visitorName(visitor),
                reminderId: reminder.id,
                handled: !!reminder.handled,
                handledReason: reminder.handledReason || null,
                handledAt: reminder.handledAt || null,
                handledUntil: reminder.handledUntil || null
            });
        });
    }

    /**
     * B2 + Phase O — fixed occasions recur on their month/day; movable ones are
     * read from their per-year table and are simply ABSENT for a year nobody has
     * set. Never extrapolated: a festival on the wrong day is worse than none.
     */
    _addOccasions(ctx, days) {
        ctx.occasions.forEach(raw => {
            if (!raw) return;
            const occasion = raw instanceof Occasion ? raw : new Occasion(raw);
            ctx.years.forEach(year => {
                const md = occasion.resolveFor(year);
                if (!md) return;
                const resolved = resolveAnnualDate(year, md.month, md.day);
                if (!resolved) return;
                const key = toLocalISODate(resolved);
                if (!this._inRange(ctx, key)) return;
                this._push(days, key, {
                    kind: CALENDAR_ITEM_KINDS.OCCASION,
                    date: key,
                    title: occasion.name || occasion.nameMr || 'Occasion',
                    nameMr: occasion.nameMr || '',
                    occasionId: occasion.id,
                    builtin: occasion.builtin === true,
                    movable: occasion.movable === true,
                    handled: false
                });
            });
        });
    }

    /** B2 — campaigns sit on their own intended date, which may be a full timestamp. */
    _addCampaigns(ctx, days) {
        ctx.campaigns.forEach(campaign => {
            const key = localDayKey(campaign?.date);
            if (!key || !this._inRange(ctx, key)) return;
            this._push(days, key, {
                kind: CALENDAR_ITEM_KINDS.CAMPAIGN,
                date: key,
                title: campaign.name || 'Campaign',
                campaignId: campaign.id,
                status: campaign.status,
                handled: campaign.status === 'sent' || campaign.status === 'cancelled'
            });
        });
    }

    /** B3 — an open follow-up: a date was set and nobody has closed it. */
    _addFollowUps(ctx, days) {
        const byId = new Map(ctx.allVisitors.map(v => [v.id, v]));
        ctx.interactions.forEach(i => {
            if (!i || !i.followUpDate) return;
            if (i.followUpCompletedAt) return;          // missing/undefined counts as open
            const key = localDayKey(i.followUpDate);
            if (!key || !this._inRange(ctx, key)) return;
            const visitor = byId.get(i.visitorId);
            this._push(days, key, {
                kind: CALENDAR_ITEM_KINDS.FOLLOW_UP,
                date: key,
                title: `Follow up — ${visitor ? this._visitorName(visitor) : 'Unknown'}`,
                visitorId: i.visitorId,
                visitorName: visitor ? this._visitorName(visitor) : 'Unknown',
                interactionId: i.id,
                notes: i.followUpNotes || '',
                handled: false
            });
        });
    }

    /** B3 — what was already logged that day. A record of fact: always handled. */
    _addInteractions(ctx, days) {
        const byId = new Map(ctx.allVisitors.map(v => [v.id, v]));
        ctx.interactions.forEach(i => {
            const key = localDayKey(i?.interactionDate);
            if (!key || !this._inRange(ctx, key)) return;
            const visitor = byId.get(i.visitorId);
            this._push(days, key, {
                kind: CALENDAR_ITEM_KINDS.INTERACTION,
                date: key,
                title: `${visitor ? this._visitorName(visitor) : 'Unknown'} — ${i.interactionType}`,
                visitorId: i.visitorId,
                visitorName: visitor ? this._visitorName(visitor) : 'Unknown',
                interactionId: i.id,
                interactionType: i.interactionType,
                notes: i.notes || '',
                handled: true
            });
        });
    }

    /** B4 — planned items. Direction decides which section of the day pane they land in. */
    _addScheduledItems(ctx, days) {
        const byId = new Map(ctx.allVisitors.map(v => [v.id, v]));
        ctx.scheduledItems.forEach(item => {
            if (!item || !DAY_KEY.test(item.date || '')) return;
            if (!this._inRange(ctx, item.date)) return;
            const visitor = item.visitorId ? byId.get(item.visitorId) : null;
            this._push(days, item.date, {
                kind: CALENDAR_ITEM_KINDS.SCHEDULED,
                date: item.date,
                direction: item.direction || SCHEDULED_ITEM_DIRECTION.OUTBOUND,
                time: item.time || null,
                type: item.type,
                title: item.title,
                notes: item.notes || '',
                visitorId: item.visitorId || null,
                // Denormalized so an item whose visitor this device has never seen
                // still renders a name rather than "Unknown" (plan S3).
                visitorName: item.visitorName || (visitor ? this._visitorName(visitor) : null),
                scheduledItemId: item.id,
                status: item.status,
                // Only a PLANNED item is outstanding. Done and cancelled are closed.
                handled: item.status !== SCHEDULED_ITEM_STATUS.PLANNED
            });
        });
    }

    /**
     * Who visited on this date in previous years (UC-06, P2.6).
     *
     * Requested by the NGO, and it needs no new data: every visit is already
     * written down, shown once on its own day, then never surfaced again. It is
     * the highest-value unused asset in the register.
     *
     * It also answers a real problem. Most days have nothing scheduled — with
     * 300 visitors over two years there is less than one visit per calendar
     * date — so the app opens empty and gives no reason to come back. A memory
     * gives a quiet day something to show.
     *
     * THE THREE GUARDS (P2.7), each stopping the feature from doing harm:
     *
     *   1. Never render empty. If the exact day has nothing, widen a few days
     *      either side and SAY so, rather than showing a blank section that
     *      reads as broken.
     *   2. Never offer "we miss you" to someone seen recently. Saying it to a
     *      supporter who came last month is absurd and costs trust. Thanks is
     *      always safe; missing them is not.
     *   3. Never claim thanks for a gift unless one was recorded. Contributions
     *      exist only from P2.13 onward; history has none, and inventing it
     *      would be a lie told in the NGO's name.
     *
     * @param {string} dayKey  'YYYY-MM-DD'
     * @param {Object} [opts]
     * @param {number} [opts.windowDays=3]  how far to widen when exact is empty
     * @param {number} [opts.missMonths=6]  silence before "we miss you" is fair
     * @returns {{items: Array, widened: boolean, windowDays: number}}
     */
    getMemories(dayKey, { windowDays = 3, missMonths = 6 } = {}) {
        const m = DAY_KEY.exec(String(dayKey || ''));
        if (!m) return { items: [], widened: false, windowDays: 0 };

        const year = parseInt(m[1], 10);
        const month = parseInt(m[2], 10);
        const day = parseInt(m[3], 10);

        const interactions = StateManager.getInteractions() || [];
        const visitors = StateManager.getVisitors() || [];
        const byId = new Map(visitors.map(v => [v.id, v]));

        // When we last heard from each person at all — guard 2 rests on this.
        const lastSeen = new Map();
        interactions.forEach(i => {
            const t = new Date(i.interactionDate).getTime();
            if (isNaN(t)) return;
            const prev = lastSeen.get(i.visitorId);
            if (prev === undefined || t > prev) lastSeen.set(i.visitorId, t);
        });

        const anchor = Date.UTC(year, month - 1, day);
        const now = Date.now();

        const build = (spread) => {
            const out = [];
            interactions.forEach(i => {
                const key = localDayKey(i.interactionDate);
                const km = DAY_KEY.exec(String(key || ''));
                if (!km) return;

                const iy = parseInt(km[1], 10);
                if (iy >= year) return;                       // previous years only

                // Month+day compared with the year ignored — the same matcher
                // the birthday reminders already use, finally pointed at visits.
                const gap = Math.round(
                    (Date.UTC(year, parseInt(km[2], 10) - 1, parseInt(km[3], 10)) - anchor) / 86400000
                );
                if (Math.abs(gap) > spread) return;

                const visitor = byId.get(i.visitorId);
                if (!visitor || visitor.isDeleted) return;
                if (visitor.doNotContact) return;             // never resurface them

                const last = lastSeen.get(i.visitorId);
                const monthsSince = last ? (now - last) / 2629800000 : Infinity;

                out.push({
                    kind: CALENDAR_ITEM_KINDS.INTERACTION,
                    memory: true,
                    date: key,
                    yearsAgo: year - iy,
                    dayOffset: gap,
                    visitorId: i.visitorId,
                    visitorName: this._visitorName(visitor),
                    interactionId: i.id,
                    interactionType: i.interactionType,
                    notes: i.notes || '',
                    contribution: Array.isArray(i.contribution) ? i.contribution : [],
                    canSayMissYou: monthsSince >= missMonths,
                    monthsSinceLastSeen: Number.isFinite(monthsSince) ? Math.floor(monthsSince) : null
                });
            });
            out.sort((a, b) =>
                a.yearsAgo - b.yearsAgo || Math.abs(a.dayOffset) - Math.abs(b.dayOffset));
            return out;
        };

        // Guard 1 — exact day first; widen only if it would otherwise be blank.
        const exact = build(0);
        if (exact.length) return { items: exact, widened: false, windowDays: 0 };

        const near = build(windowDays);
        return { items: near, widened: near.length > 0, windowDays };
    }
}

// ─── Module helpers ────────────────────────────────────────────────────────

/** Outstanding = something a human still has to act on. */
function isUnhandled(item) {
    if (item.handled) return false;
    return item.kind !== CALENDAR_ITEM_KINDS.INTERACTION;
}

const KIND_ORDER = [
    CALENDAR_ITEM_KINDS.SCHEDULED,   // G10-R: plans and inbound visits lead the day
    CALENDAR_ITEM_KINDS.FOLLOW_UP,
    CALENDAR_ITEM_KINDS.EVENT,
    CALENDAR_ITEM_KINDS.CONTACT_DUE,
    CALENDAR_ITEM_KINDS.OCCASION,
    CALENDAR_ITEM_KINDS.CAMPAIGN,
    CALENDAR_ITEM_KINDS.INTERACTION  // already-happened, so last
];

function compareItems(a, b) {
    // Inbound first within scheduled items (G10-R).
    if (a.kind === CALENDAR_ITEM_KINDS.SCHEDULED && b.kind === CALENDAR_ITEM_KINDS.SCHEDULED) {
        const ai = a.direction === SCHEDULED_ITEM_DIRECTION.INBOUND ? 0 : 1;
        const bi = b.direction === SCHEDULED_ITEM_DIRECTION.INBOUND ? 0 : 1;
        if (ai !== bi) return ai - bi;
        if (a.time && b.time && a.time !== b.time) return a.time < b.time ? -1 : 1;
        if (a.time && !b.time) return -1;
        if (!a.time && b.time) return 1;
    }
    const ak = KIND_ORDER.indexOf(a.kind);
    const bk = KIND_ORDER.indexOf(b.kind);
    if (ak !== bk) return ak - bk;
    return compareNames(a.title, b.title);   // P1.3 — locale-pinned, not device-dependent
}

function countByKind(items) {
    const counts = {};
    items.forEach(i => { counts[i.kind] = (counts[i.kind] || 0) + 1; });
    return counts;
}

export default new CalendarService();
