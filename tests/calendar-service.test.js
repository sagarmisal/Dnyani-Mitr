/**
 * Iteration 11, Phase B — CalendarService boundaries.
 *
 * Pinned to Asia/Kolkata with fake timers: the whole point of this service is
 * local-day correctness, so a test that drifts with the runner's timezone would
 * be worse than no test.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = value; },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();
vi.stubGlobal('localStorage', localStorageMock);

vi.mock('../src/core/activation.js', () => ({
    default: {
        getMachineInfo: () => ({ machineId: 'machine_test', machineName: 'Test', machineRole: 'root' })
    }
}));

vi.mock('../src/core/events.js', () => ({
    default: { emit: vi.fn() },
    EVENTS: {
        STATE_LOADED: 'state:loaded', STATE_CHANGED: 'state:changed', STATE_SAVED: 'state:saved',
        VISITOR_ADDED: 'visitor:added', VISITOR_UPDATED: 'visitor:updated', VISITOR_DELETED: 'visitor:deleted',
        INTERACTION_ADDED: 'interaction:added', REMINDER_ACTION_CREATED: 'reminder:action',
        IMPORT_COMPLETED: 'import:completed', REMINDERS_UPDATED: 'reminders:updated'
    }
}));

vi.mock('../src/utils/helpers.js', async (importOriginal) => {
    const actual = await importOriginal();
    let counter = 0;
    return { ...actual, generateId: (prefix) => `${prefix}_${++counter}` };
});

import StateManager from '../src/core/state.js';
import CalendarService, { CALENDAR_ITEM_KINDS } from '../src/services/CalendarService.js';
import { ScheduledItem } from '../src/models/ScheduledItem.js';

const ORIGINAL_TZ = process.env.TZ;
const NOW = new Date('2026-08-20T06:30:00.000Z'); // 12:00 IST, Thu 20 Aug 2026

function visitor(over = {}) {
    return {
        id: over.id || 'visitor_x',
        status: 'active',
        doNotContact: over.doNotContact || false,
        contactFrequencyDays: over.contactFrequencyDays ?? null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        contacts: over.contacts || [{
            id: 'contact_x', relationType: 'SELF', name: over.name || 'सुनीता पाटील',
            phones: ['9876543210'], emails: [],
            dob: over.dob ?? null, dobMonthOnly: over.dobMonthOnly || false,
            marriageDate: over.marriageDate ?? null, marriageMonthOnly: false,
            deathDate: null, deathMonthOnly: false, customEvents: []
        }],
        ...(over.extra || {})
    };
}

function seed({ visitors = [], interactions = [], occasions = [], campaigns = [], scheduledItems = [] } = {}) {
    StateManager.state.visitors = visitors;
    StateManager.state.interactions = interactions;
    StateManager.state.reminderActions = [];
    StateManager.state.occasions = occasions;
    StateManager.state.campaigns = campaigns;
    StateManager.state.scheduledItems = scheduledItems;
}

beforeAll(async () => {
    process.env.TZ = 'Asia/Kolkata';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    await StateManager.init();
});

afterAll(() => {
    vi.useRealTimers();
    process.env.TZ = ORIGINAL_TZ;
});

beforeEach(() => seed());

describe('getItemsForRange — guards', () => {
    it('returns empty structures for malformed or inverted ranges', () => {
        expect(CalendarService.getItemsForRange('nope', '2026-08-31').days).toEqual({});
        expect(CalendarService.getItemsForRange('2026-08-31', '2026-08-01').days).toEqual({});
        expect(CalendarService.getItemsForRange(null, null).monthWide).toEqual({});
    });

    it('handles an empty state and a visitor with no contacts', () => {
        seed({ visitors: [{ id: 'v_empty', status: 'active', contacts: [], createdAt: null }] });
        const { days } = CalendarService.getItemsForRange('2026-08-01', '2026-08-31');
        expect(days).toEqual({});
    });
});

describe('B1 — annual events in arbitrary years', () => {
    it('places a birthday on the right day in a FUTURE year (what getRemindersForMonth cannot do)', () => {
        seed({ visitors: [visitor({ dob: '1985-08-15' })] });

        const y2027 = CalendarService.getItemsForRange('2027-08-01', '2027-08-31');
        expect(y2027.days['2027-08-15']).toHaveLength(1);
        expect(y2027.days['2027-08-15'][0].eventType).toBe('Birthday');

        const y2024 = CalendarService.getItemsForRange('2024-08-01', '2024-08-31');
        expect(y2024.days['2024-08-15']).toHaveLength(1); // and a PAST year too
    });

    it('spans a year boundary, resolving each year separately', () => {
        seed({ visitors: [visitor({ dob: '1990-01-01', marriageDate: '2010-12-31' })] });
        const { days } = CalendarService.getItemsForRange('2026-12-20', '2027-01-10');
        expect(days['2026-12-31']).toHaveLength(1);
        expect(days['2027-01-01']).toHaveLength(1);
        expect(days['2026-01-01']).toBeUndefined();
    });

    it('clamps 29 Feb to 28 Feb in a non-leap year and keeps it on the 29th in a leap year', () => {
        seed({ visitors: [visitor({ dob: '1996-02-29' })] });

        const nonLeap = CalendarService.getItemsForRange('2027-02-01', '2027-02-28');
        expect(nonLeap.days['2027-02-28']).toHaveLength(1);

        const leap = CalendarService.getItemsForRange('2028-02-01', '2028-02-29');
        expect(leap.days['2028-02-29']).toHaveLength(1);
        expect(leap.days['2028-02-28']).toBeUndefined();
    });

    it('diverts a month-only event to monthWide and never onto a day', () => {
        seed({ visitors: [visitor({ dob: '1985-06-01', dobMonthOnly: true })] });
        const { days, monthWide } = CalendarService.getItemsForRange('2026-06-01', '2026-06-30');

        expect(days['2026-06-01']).toBeUndefined();
        expect(monthWide['2026-06']).toHaveLength(1);
        expect(monthWide['2026-06'][0].monthWide).toBe(true);
    });

    it('excludes do-not-contact visitors from derived reminders', () => {
        seed({ visitors: [visitor({ id: 'v_dnc', dob: '1985-08-15', doNotContact: true })] });
        const { days } = CalendarService.getItemsForRange('2026-08-01', '2026-08-31');
        expect(days['2026-08-15']).toBeUndefined();
    });

    it('carries the reminder id so the calendar and the Reminders tab agree', () => {
        seed({ visitors: [visitor({ dob: '1985-08-15' })] });
        const { days } = CalendarService.getItemsForRange('2026-08-01', '2026-08-31');
        expect(days['2026-08-15'][0].reminderId).toMatch(/^reminder_/);
        expect(days['2026-08-15'][0].handled).toBe(false);
    });
});

describe('B2/B3 — the other sources', () => {
    it('places an occasion on its date in each year of the range', () => {
        seed({ occasions: [{ id: 'occ_1', name: 'Independence Day', nameMr: 'स्वातंत्र्य दिन', month: 8, day: 15, builtin: true }] });
        const { days } = CalendarService.getItemsForRange('2026-08-01', '2027-08-31');
        expect(days['2026-08-15'][0].kind).toBe(CALENDAR_ITEM_KINDS.OCCASION);
        expect(days['2027-08-15']).toHaveLength(1);
    });

    it('places a campaign on its intended day even when stored as a full timestamp', () => {
        seed({ campaigns: [{ id: 'camp_1', name: 'Diwali greetings', date: '2026-08-18T09:00:00.000Z', status: 'draft' }] });
        const { days } = CalendarService.getItemsForRange('2026-08-01', '2026-08-31');
        expect(days['2026-08-18'][0].kind).toBe(CALENDAR_ITEM_KINDS.CAMPAIGN);
    });

    it('shows an open follow-up but not a completed one', () => {
        seed({
            visitors: [visitor()],
            interactions: [
                { id: 'i_open', visitorId: 'visitor_x', interactionType: 'call', interactionDate: '2026-08-01T05:30:00.000Z', followUpDate: '2026-08-25', followUpCompletedAt: null },
                { id: 'i_done', visitorId: 'visitor_x', interactionType: 'call', interactionDate: '2026-08-01T05:30:00.000Z', followUpDate: '2026-08-26', followUpCompletedAt: '2026-08-20T05:00:00.000Z' }
            ]
        });
        const { days } = CalendarService.getItemsForRange('2026-08-20', '2026-08-31');
        expect(days['2026-08-25'].some(i => i.kind === CALENDAR_ITEM_KINDS.FOLLOW_UP)).toBe(true);
        expect(days['2026-08-26']).toBeUndefined();
    });

    it('treats a missing followUpCompletedAt as still open', () => {
        seed({
            visitors: [visitor()],
            interactions: [{ id: 'i_legacy', visitorId: 'visitor_x', interactionType: 'call', interactionDate: '2026-08-01T05:30:00.000Z', followUpDate: '2026-08-25' }]
        });
        const { days } = CalendarService.getItemsForRange('2026-08-20', '2026-08-31');
        expect(days['2026-08-25'].some(i => i.kind === CALENDAR_ITEM_KINDS.FOLLOW_UP)).toBe(true);
    });

    it('files a 21:00Z interaction on the NEXT local day, because IST is +05:30', () => {
        seed({
            visitors: [visitor()],
            interactions: [{ id: 'i_late', visitorId: 'visitor_x', interactionType: 'visit', interactionDate: '2026-08-18T21:00:00.000Z', followUpDate: null }]
        });
        const { days } = CalendarService.getItemsForRange('2026-08-01', '2026-08-31');
        expect(days['2026-08-19'].some(i => i.kind === CALENDAR_ITEM_KINDS.INTERACTION)).toBe(true);
        expect(days['2026-08-18']).toBeUndefined();
    });

    it('places contact-due on its one-off target date and does not repeat it annually', () => {
        seed({
            visitors: [visitor({ contactFrequencyDays: 30 })],
            interactions: [{ id: 'i_base', visitorId: 'visitor_x', interactionType: 'call', interactionDate: '2026-08-01T06:00:00.000Z', followUpDate: null }]
        });
        const thisYear = CalendarService.getItemsForRange('2026-08-01', '2026-09-30');
        expect(thisYear.days['2026-08-31'].some(i => i.kind === CALENDAR_ITEM_KINDS.CONTACT_DUE)).toBe(true);

        const nextYear = CalendarService.getItemsForRange('2027-08-01', '2027-09-30');
        const anyDue = Object.values(nextYear.days).flat().some(i => i.kind === CALENDAR_ITEM_KINDS.CONTACT_DUE);
        expect(anyDue).toBe(false);
    });
});

describe('B4 — scheduled items and direction', () => {
    it('includes planned items and marks done/cancelled as handled', () => {
        seed({
            scheduledItems: [
                new ScheduledItem({ title: 'वॉर्ड ३ भेट', date: '2026-08-21' }).toJSON(),
                new ScheduledItem({ title: 'done one', date: '2026-08-21', status: 'done' }).toJSON()
            ]
        });
        const { days } = CalendarService.getItemsForRange('2026-08-01', '2026-08-31');
        const items = days['2026-08-21'];
        expect(items).toHaveLength(2);
        expect(items.find(i => i.title === 'वॉर्ड ३ भेट').handled).toBe(false);
        expect(items.find(i => i.title === 'done one').handled).toBe(true);
    });

    it('sorts inbound visits ahead of outbound plans (G10-R)', () => {
        seed({
            scheduledItems: [
                new ScheduledItem({ title: 'we go out', date: '2026-08-21', direction: 'outbound' }).toJSON(),
                new ScheduledItem({ title: 'XYZ coming', date: '2026-08-21', direction: 'inbound' }).toJSON()
            ]
        });
        const { days } = CalendarService.getItemsForRange('2026-08-21', '2026-08-21');
        expect(days['2026-08-21'][0].title).toBe('XYZ coming');
    });

    it('defaults a legacy item with no direction to outbound', () => {
        seed({ scheduledItems: [{ id: 'sched_legacy', date: '2026-08-21', title: 'legacy', status: 'planned', type: 'task' }] });
        const { days } = CalendarService.getItemsForRange('2026-08-21', '2026-08-21');
        expect(days['2026-08-21'][0].direction).toBe('outbound');
    });

    it('renders a denormalized visitor name when the visitor is unknown to this device (S3)', () => {
        seed({ scheduledItems: [{ id: 'sched_o', date: '2026-08-21', title: 'भेट', status: 'planned', type: 'visit', visitorId: 'visitor_elsewhere', visitorName: 'रमेश जाधव' }] });
        const { days } = CalendarService.getItemsForRange('2026-08-21', '2026-08-21');
        expect(days['2026-08-21'][0].visitorName).toBe('रमेश जाधव');
    });
});

describe('B5 — getMonthMatrix', () => {
    it('returns 6 weeks of 7 local dates, Sunday-first by default', () => {
        const m = CalendarService.getMonthMatrix(2026, 8);
        expect(m.weeks).toHaveLength(6);
        m.weeks.forEach(w => expect(w).toHaveLength(7));
        expect(m.cells).toHaveLength(42);
        expect(new Date(m.cells[0].date + 'T00:00:00').getDay()).toBe(0);
    });

    it('honours a Monday week start', () => {
        const m = CalendarService.getMonthMatrix(2026, 8, 'mon');
        expect(new Date(m.cells[0].date + 'T00:00:00').getDay()).toBe(1);
    });

    it('marks leading and trailing days as outside the month, and today as today', () => {
        const m = CalendarService.getMonthMatrix(2026, 8);
        expect(m.cells[0].inMonth).toBe(false);
        expect(m.cells.filter(c => c.inMonth)).toHaveLength(31);
        expect(m.cells.find(c => c.date === '2026-08-20').isToday).toBe(true);
    });

    it('builds February 2028 (leap) with 29 in-month days', () => {
        const m = CalendarService.getMonthMatrix(2028, 2);
        expect(m.cells.filter(c => c.inMonth)).toHaveLength(29);
    });

    it('counts items per day and flags a past day still carrying something unhandled', () => {
        seed({
            scheduledItems: [
                new ScheduledItem({ title: 'missed', date: '2026-08-18' }).toJSON(),
                new ScheduledItem({ title: 'closed', date: '2026-08-17', status: 'done' }).toJSON()
            ]
        });
        const m = CalendarService.getMonthMatrix(2026, 8);
        expect(m.cells.find(c => c.date === '2026-08-18').hasUnhandledPast).toBe(true);
        expect(m.cells.find(c => c.date === '2026-08-17').hasUnhandledPast).toBe(false);
        expect(m.cells.find(c => c.date === '2026-08-18').counts.scheduled).toBe(1);
    });

    it('surfaces month-only events on the matrix without putting them on a day', () => {
        seed({ visitors: [visitor({ dob: '1985-08-01', dobMonthOnly: true })] });
        const m = CalendarService.getMonthMatrix(2026, 8);
        expect(m.monthWide).toHaveLength(1);
        expect(m.cells.find(c => c.date === '2026-08-01').count).toBe(0);
    });
});

describe('B4a — getOverdueBacklog', () => {
    it('collects unhandled past items, most recent first, and excludes today and the future', () => {
        seed({
            scheduledItems: [
                new ScheduledItem({ title: 'older', date: '2026-08-10' }).toJSON(),
                new ScheduledItem({ title: 'newer', date: '2026-08-18' }).toJSON(),
                new ScheduledItem({ title: 'today', date: '2026-08-20' }).toJSON(),
                new ScheduledItem({ title: 'future', date: '2026-08-25' }).toJSON()
            ]
        });
        const { items, total } = CalendarService.getOverdueBacklog();
        expect(items.map(i => i.title)).toEqual(['newer', 'older']);
        expect(total).toBe(2);
    });

    it('excludes completed plans and logged interactions', () => {
        seed({
            visitors: [visitor()],
            scheduledItems: [new ScheduledItem({ title: 'done', date: '2026-08-18', status: 'done' }).toJSON()],
            interactions: [{ id: 'i_1', visitorId: 'visitor_x', interactionType: 'call', interactionDate: '2026-08-18T06:00:00.000Z', followUpDate: null }]
        });
        expect(CalendarService.getOverdueBacklog().total).toBe(0);
    });

    it('returns the full list and a total, so the UI can cap at 5 and say "+N more" (G17)', () => {
        seed({
            scheduledItems: Array.from({ length: 9 }, (_, n) =>
                new ScheduledItem({ title: `missed ${n}`, date: `2026-08-1${n}` }).toJSON())
        });
        const { items, total } = CalendarService.getOverdueBacklog();
        expect(total).toBe(9);
        expect(items).toHaveLength(9);
    });

    it('is empty when nothing was missed', () => {
        expect(CalendarService.getOverdueBacklog()).toEqual({ items: [], total: 0 });
    });
});
