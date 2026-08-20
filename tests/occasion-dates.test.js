/**
 * Iteration 11, Phase O — festivals that land on the right day, or not at all.
 *
 * The rule under test everywhere here: a movable festival with no date for a
 * year DOES NOT FIRE and DOES NOT EXTRAPOLATE. A missing greeting is a small
 * loss; a greeting sent to hundreds of supporters on the wrong day is not.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; },
        removeItem: (k) => { delete store[k]; }, clear: () => { store = {}; }
    };
})();
vi.stubGlobal('localStorage', localStorageMock);

vi.mock('../src/core/activation.js', () => ({
    default: { getMachineInfo: () => ({ machineId: 'm1', machineName: 'Office', machineRole: 'root' }) }
}));
vi.mock('../src/core/events.js', () => ({
    default: { emit: vi.fn() },
    EVENTS: {
        STATE_LOADED: 'state:loaded', STATE_CHANGED: 'state:changed', STATE_SAVED: 'state:saved',
        VISITOR_ADDED: 'v:a', VISITOR_UPDATED: 'v:u', VISITOR_DELETED: 'v:d',
        INTERACTION_ADDED: 'i:a', REMINDER_ACTION_CREATED: 'r:a',
        IMPORT_COMPLETED: 'import:completed', REMINDERS_UPDATED: 'r:u'
    }
}));

import StateManager from '../src/core/state.js';
import { Occasion } from '../src/models/Occasion.js';
import OccasionService from '../src/services/OccasionService.js';
import CalendarService, { CALENDAR_ITEM_KINDS } from '../src/services/CalendarService.js';
import { DEFAULT_OCCASIONS } from '../src/utils/constants.js';

const ORIGINAL_TZ = process.env.TZ;

const diwali = () => new Occasion({
    id: 'occasion_diwali', name: 'Diwali', nameMr: 'दिवाळी', movable: true,
    dates: { '2026': '11-08', '2027': '10-29' }, builtin: true
});

beforeAll(async () => {
    process.env.TZ = 'Asia/Kolkata';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-20T06:30:00.000Z'));
    await StateManager.init();
});
afterAll(() => { vi.useRealTimers(); process.env.TZ = ORIGINAL_TZ; });
beforeEach(() => { StateManager.state.occasions = []; StateManager.state.visitors = []; });

describe('Occasion.resolveFor', () => {
    it('resolves a fixed occasion to the same month/day every year', () => {
        const o = new Occasion({ name: 'Independence Day', month: 8, day: 15 });
        expect(o.resolveFor(2026)).toEqual({ month: 8, day: 15 });
        expect(o.resolveFor(2031)).toEqual({ month: 8, day: 15 });
        expect(o.needsDateFor(2031)).toBe(false);
    });

    it('resolves a movable festival from its per-year table', () => {
        const o = diwali();
        expect(o.resolveFor(2026)).toEqual({ month: 11, day: 8 });
        expect(o.resolveFor(2027)).toEqual({ month: 10, day: 29 });
    });

    it('returns null for a year with no entry — it never reuses last year', () => {
        const o = diwali();
        expect(o.resolveFor(2028)).toBeNull();
        expect(o.needsDateFor(2028)).toBe(true);
    });

    it('rejects a malformed table entry rather than half-reading it', () => {
        const o = new Occasion({ name: 'X', movable: true, dates: { '2026': '8-8', '2027': 'Diwali', '2028': '13-01' } });
        expect(o.resolveFor(2026)).toBeNull();
        expect(o.resolveFor(2027)).toBeNull();
        expect(o.resolveFor(2028)).toBeNull();
    });

    it('infers movable from the presence of a date table', () => {
        expect(new Occasion({ name: 'X', dates: { '2026': '11-08' } }).movable).toBe(true);
        expect(new Occasion({ name: 'Y', month: 1, day: 1 }).movable).toBe(false);
    });

    it('round-trips movable and dates through JSON', () => {
        const revived = Occasion.fromJSON(JSON.parse(JSON.stringify(diwali().toJSON())));
        expect(revived.movable).toBe(true);
        expect(revived.dates).toEqual({ '2026': '11-08', '2027': '10-29' });
    });
});

describe('OccasionService — movable awareness', () => {
    it('finds the next occurrence from the table, skipping a date already past', () => {
        const next = OccasionService.nextOccurrence(diwali().toJSON());
        expect(next.getFullYear()).toBe(2026);
        expect(next.getMonth() + 1).toBe(11);
        expect(next.getDate()).toBe(8);
    });

    it('rolls to next year when this year\'s date has passed', () => {
        vi.setSystemTime(new Date('2026-12-01T06:30:00.000Z'));
        const next = OccasionService.nextOccurrence(diwali().toJSON());
        expect(next.getFullYear()).toBe(2027);
        expect(next.getMonth() + 1).toBe(10);
        vi.setSystemTime(new Date('2026-08-20T06:30:00.000Z'));
    });

    it('returns null — never a guess — when the table runs out', () => {
        const stale = new Occasion({ name: 'Diwali', movable: true, dates: { '2020': '11-14' } });
        expect(OccasionService.nextOccurrence(stale.toJSON())).toBeNull();
    });

    it('leaves undated movable festivals out of the upcoming feed', () => {
        StateManager.state.occasions = [
            new Occasion({ id: 'o_fix', name: 'Independence Day', month: 8, day: 15 }).toJSON(),
            new Occasion({ id: 'o_mov', name: 'Diwali', movable: true, dates: {} }).toJSON()
        ];
        const upcoming = OccasionService.upcomingWithin(400);
        expect(upcoming.map(u => u.occasion.id)).toEqual(['o_fix']);
    });

    it('reports which movable occasions still need a date for a year (O4)', () => {
        StateManager.state.occasions = [
            new Occasion({ id: 'o_fix', name: 'Christmas', month: 12, day: 25 }).toJSON(),
            diwali().toJSON(),
            new Occasion({ id: 'o_holi', name: 'Holi', movable: true, dates: {} }).toJSON()
        ];
        expect(OccasionService.needingDates(2026).map(o => o.id)).toEqual(['o_holi']);
        expect(OccasionService.needingDates(2028).map(o => o.id).sort()).toEqual(['occasion_diwali', 'o_holi'].sort());
    });

    it('sets one year\'s date and rejects a malformed one', () => {
        StateManager.state.occasions = [new Occasion({ id: 'o_holi', name: 'Holi', movable: true, dates: {} }).toJSON()];
        expect(OccasionService.setDateForYear('o_holi', 2027, '03-04')).toBe(true);
        expect(StateManager.getOccasions()[0].dates['2027']).toBe('03-04');
        expect(OccasionService.setDateForYear('o_holi', 2027, '3-4')).toBe(false);
        expect(OccasionService.setDateForYear('o_missing', 2027, '03-04')).toBe(false);
    });
});

describe('Calendar integration', () => {
    it('places a movable festival on its table date, and omits the undated year', () => {
        StateManager.state.occasions = [diwali().toJSON()];

        const y26 = CalendarService.getItemsForRange('2026-11-01', '2026-11-30');
        expect(y26.days['2026-11-08'][0].kind).toBe(CALENDAR_ITEM_KINDS.OCCASION);
        expect(y26.days['2026-11-08'][0].movable).toBe(true);

        const y27 = CalendarService.getItemsForRange('2027-10-01', '2027-10-31');
        expect(y27.days['2027-10-29']).toHaveLength(1);

        const y28 = CalendarService.getItemsForRange('2028-01-01', '2028-12-31');
        expect(Object.values(y28.days).flat().some(i => i.occasionId === 'occasion_diwali')).toBe(false);
    });

    it('still places fixed occasions in every year, unchanged', () => {
        StateManager.state.occasions = [new Occasion({ id: 'o_ind', name: 'Independence Day', month: 8, day: 15 }).toJSON()];
        expect(CalendarService.getItemsForRange('2031-08-01', '2031-08-31').days['2031-08-15']).toHaveLength(1);
    });
});

describe('Seeded occasions', () => {
    it('ships the civic days AND the festivals that were missing', () => {
        const names = DEFAULT_OCCASIONS.map(o => o.name);
        expect(names).toContain('Independence Day');
        expect(names).toContain('Diwali');
        expect(names).toContain('Ganesh Chaturthi');
        expect(names).toContain('Makar Sankranti');
    });

    it('seeds every movable festival with an EMPTY table, so no date is invented', () => {
        const movables = DEFAULT_OCCASIONS.filter(o => o.movable === true);
        expect(movables.length).toBeGreaterThanOrEqual(6);
        movables.forEach(o => {
            expect(o.dates).toEqual({});
            expect(o.month).toBeNull();
            expect(new Occasion(o).needsDateFor(2026)).toBe(true);
        });
    });

    it('gives every seeded occasion bilingual templates', () => {
        DEFAULT_OCCASIONS.forEach(o => {
            expect(o.templates.greeting.en).toBeTruthy();
            expect(o.templates.greeting.mr).toBeTruthy();
        });
    });
});
