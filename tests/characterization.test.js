/**
 * CHARACTERIZATION TESTS — Iteration 11, Phase 0.3 (Stability Contract S2)
 *
 * These pin the CURRENT, KNOWN-GOOD behaviour of every shared function that
 * Iteration 11 refactors, captured BEFORE the first refactor while the code is
 * still the version that is stable on laptop and mobile.
 *
 * Rules:
 *   - A refactor must keep every test below green WITHOUT editing it (S3).
 *     Editing one to accommodate a refactor is a behaviour change and requires
 *     a written reason in ITERATION_11_PLAN.md's progress log.
 *   - Tests tagged PINS-A-BUG deliberately record behaviour we intend to CHANGE
 *     (findings F5 / G4). They are replaced by the corrected expectation in the
 *     same commit as the fix, with the reason logged. They exist so the change
 *     is visible and deliberate rather than silent.
 *
 * Timezone: pinned to Asia/Kolkata. The suite exercises the IST 00:00-05:30
 * window where a UTC date and a local date disagree — the exact defect class
 * this iteration has to get right. Node >= 16 honours a runtime TZ change.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

// Mock localStorage (same harness as tests/sync.test.js and reminder-service.test.js)
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
        getMachineInfo: () => ({
            machineId: 'machine_test',
            machineName: 'Test Machine',
            machineRole: 'root'
        })
    }
}));

vi.mock('../src/core/events.js', () => ({
    default: { emit: vi.fn() },
    EVENTS: {
        STATE_LOADED: 'state:loaded',
        STATE_CHANGED: 'state:changed',
        STATE_SAVED: 'state:saved',
        IMPORT_COMPLETED: 'import:completed',
        REMINDERS_UPDATED: 'reminders:updated'
    }
}));

vi.mock('../src/utils/helpers.js', () => ({
    safeJSONParse: (data, fallback) => {
        try { return JSON.parse(data); } catch { return fallback; }
    },
    generateId: (prefix) => `${prefix}_fixed`,
    deepClone: (obj) => JSON.parse(JSON.stringify(obj)),
    simpleHash: (s) => {
        let h = 0;
        for (let i = 0; i < s.length; i++) {
            h = ((h << 5) - h) + s.charCodeAt(i);
            h |= 0;
        }
        return Math.abs(h).toString(36);
    }
}));

import fixture from './fixtures/state-v3.1.0.json';
import { STORAGE_KEYS, APP_VERSION } from '../src/utils/constants.js';
import { normalizeEventDate, getDaysUntil, getCurrentDate, getCurrentDateOnly } from '../src/utils/formatters.js';
import OccasionService from '../src/services/OccasionService.js';
import StorageManager from '../src/core/storage.js';
import StateManager from '../src/core/state.js';
import ReminderService from '../src/services/ReminderService.js';

const ORIGINAL_TZ = process.env.TZ;

/** 10 Aug 2026, 12:00 IST — a fixed "today" so every expectation below is exact. */
const NOW_IST_NOON = new Date('2026-08-10T06:30:00.000Z');

const seedPristineFixture = () => {
    localStorage.setItem(STORAGE_KEYS.APP_STATE, JSON.stringify(fixture));
};

beforeAll(async () => {
    process.env.TZ = 'Asia/Kolkata';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW_IST_NOON);
    seedPristineFixture();
    await StateManager.init();
});

afterAll(() => {
    vi.useRealTimers();
    process.env.TZ = ORIGINAL_TZ;
});

// ---------------------------------------------------------------------------

describe('CHARACTERIZATION: the timezone ground truth this iteration depends on', () => {
    it('the suite really is running in IST (+05:30)', () => {
        expect(new Date().getTimezoneOffset()).toBe(-330);
    });

    it('getCurrentDate() is UTC while getCurrentDateOnly() is LOCAL — they can disagree by a day', () => {
        // 02:30 IST on 12 Aug == 21:00 UTC on 11 Aug.
        vi.setSystemTime(new Date('2026-08-11T21:00:00.000Z'));

        expect(getCurrentDate()).toBe('2026-08-11T21:00:00.000Z');   // UTC calendar day = 11th
        expect(getCurrentDateOnly()).toBe('2026-08-12');             // LOCAL calendar day = 12th

        vi.setSystemTime(NOW_IST_NOON);
    });
});

describe('CHARACTERIZATION: formatters.normalizeEventDate', () => {
    it('keeps an event still ahead this year in the current year', () => {
        expect(normalizeEventDate('1985-08-15')).toBe('2026-08-15');
    });

    it('rolls an event that has already passed forward to next year', () => {
        expect(normalizeEventDate('1980-01-20')).toBe('2027-01-20');
    });

    it('collapses a month-only event onto day 1 of that month', () => {
        expect(normalizeEventDate('1990-03-15', true)).toBe('2027-03-01');
    });

    it('returns null for empty and invalid input', () => {
        expect(normalizeEventDate(null)).toBeNull();
        expect(normalizeEventDate('')).toBeNull();
        expect(normalizeEventDate('not-a-date')).toBeNull();
    });

    it('DIVERGENCE: a 29-Feb event overflows to 1 March in a non-leap year', () => {
        // new Date(2027, 1, 29) has no 29 Feb in 2027, so JS rolls it into March.
        // OccasionService.nextOccurrence CLAMPS the same date to 28 Feb instead
        // (asserted below). The two subsystems disagree today; Iteration 11's
        // shared resolveAnnualDate() must not silently change EITHER without
        // this test being updated deliberately.
        expect(normalizeEventDate('1996-02-29')).toBe('2027-03-01');
    });
});

describe('CHARACTERIZATION: formatters.getDaysUntil (compares at LOCAL midnight)', () => {
    it('returns 0 for today, 1 for tomorrow, -1 for yesterday', () => {
        expect(getDaysUntil('2026-08-10')).toBe(0);
        expect(getDaysUntil('2026-08-11')).toBe(1);
        expect(getDaysUntil('2026-08-09')).toBe(-1);
    });

    it('counts whole local days ahead', () => {
        expect(getDaysUntil('2026-08-15')).toBe(5);
    });

    it('returns NaN for unusable input', () => {
        expect(getDaysUntil(null)).toBeNaN();
        expect(getDaysUntil('rubbish')).toBeNaN();
    });
});

describe('CHARACTERIZATION: OccasionService.nextOccurrence', () => {
    it('returns this year when the date is still ahead', () => {
        const d = OccasionService.nextOccurrence({ month: 10, day: 2 }, NOW_IST_NOON);
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(9);
        expect(d.getDate()).toBe(2);
    });

    it('rolls to next year once the date has passed', () => {
        const d = OccasionService.nextOccurrence({ month: 1, day: 26 }, NOW_IST_NOON);
        expect(d.getFullYear()).toBe(2027);
        expect(d.getMonth()).toBe(0);
        expect(d.getDate()).toBe(26);
    });

    it('DIVERGENCE: CLAMPS 29 Feb to 28 Feb in a non-leap year (never rolls into March)', () => {
        const d = OccasionService.nextOccurrence({ month: 2, day: 29 }, NOW_IST_NOON);
        expect(d.getFullYear()).toBe(2027);
        expect(d.getMonth()).toBe(1);   // February — NOT March
        expect(d.getDate()).toBe(28);
    });

    it('returns null for an incomplete occasion', () => {
        expect(OccasionService.nextOccurrence(null)).toBeNull();
        expect(OccasionService.nextOccurrence({ month: 5 })).toBeNull();
    });
});

describe('CHARACTERIZATION: StorageManager round-trip on a real v3.1.0 state', () => {
    it('loads the fixture without losing or reseeding anything', () => {
        seedPristineFixture();
        const state = StorageManager.loadState();

        expect(state.visitors).toHaveLength(3);
        expect(state.interactions).toHaveLength(3);
        expect(state.reminderActions).toHaveLength(2);
        expect(state.occasions).toHaveLength(5);      // seeded built-ins preserved, not re-seeded
        expect(state.campaigns).toEqual([]);
        expect(state.version).toBe(APP_VERSION);
    });

    it('preserves Devanagari names byte-for-byte through save and load', () => {
        seedPristineFixture();
        const loaded = StorageManager.loadState();
        StorageManager.saveState(loaded);
        const reloaded = StorageManager.loadState();

        expect(reloaded.visitors[0].contacts[0].name).toBe('सुनीता पाटील');
        expect(reloaded.visitors[1].contacts[1].name).toBe('मीना जाधव');
    });

    it('ensureForwardFields is idempotent — a second run reports no change', () => {
        seedPristineFixture();
        const state = StorageManager.loadState();
        expect(StorageManager.ensureForwardFields(state)).toBe(false);
    });

    /**
     * S3 EXCEPTION #2 — reason recorded in ITERATION_11_PLAN.md's progress log.
     *
     * These two started life as BASELINE GAP tests asserting that a v3.1.0 state
     * has neither `scheduledItems` nor `followUpCompletedAt`. Tasks A6/A7 close
     * exactly that gap, so they failed the moment the migration landed — which is
     * the gate doing its job, not a nuisance.
     *
     * Rather than delete them, each now asserts BOTH halves: the raw fixture is
     * still genuinely pre-migration (so it keeps testing an upgrade rather than
     * quietly becoming a v3.2.0 fixture), AND loadState upgrades it in place
     * without disturbing the surrounding data. Strictly stronger than before.
     */
    it('MIGRATION: adds scheduledItems to a v3.1.0 state that lacks it', () => {
        expect(fixture.scheduledItems).toBeUndefined();      // fixture is genuinely pre-migration

        seedPristineFixture();
        const state = StorageManager.loadState();

        expect(state.scheduledItems).toEqual([]);
        expect(state.visitors).toHaveLength(3);              // nothing else disturbed
        expect(state.occasions).toHaveLength(5);
    });

    it('MIGRATION: back-fills followUpCompletedAt as null without touching the follow-up itself', () => {
        const rawFollowUp = fixture.interactions.find(i => i.followUpDate);
        expect(rawFollowUp.followUpCompletedAt).toBeUndefined();

        seedPristineFixture();
        const state = StorageManager.loadState();
        const withFollowUp = state.interactions.find(i => i.followUpDate);

        expect(withFollowUp.followUpDate).toBe('2026-06-05');
        expect(withFollowUp.followUpNotes).toBe('Deliver receipt');
        expect(withFollowUp.followUpCompletedAt).toBeNull();
    });

    it('MIGRATION: new calendar settings land without clobbering existing ones', () => {
        seedPristineFixture();
        const state = StorageManager.loadState();

        expect(state.settings.calendarStartsOn).toBe('sun');
        expect(state.settings.landingScreen).toBe('calendar');
        // Iter 10 settings survive untouched
        expect(state.settings.notificationDigestTime).toBe('09:00');
        expect(state.settings.defaultCampaignLanguage).toBe('mr');
    });

    it('MIGRATION: is idempotent — re-running over an already-migrated state changes nothing', () => {
        seedPristineFixture();
        const first = StorageManager.loadState();
        expect(StorageManager.ensureForwardFields(first)).toBe(false);

        const second = StorageManager.loadState();
        expect(second.scheduledItems).toEqual([]);
        expect(second.interactions).toHaveLength(3);
        expect(second.visitors).toHaveLength(3);
    });

    it('MIGRATION: preserves scheduled items that already exist (never resets them)', () => {
        const withItems = {
            ...fixture,
            scheduledItems: [{ id: 'sched_existing', date: '2026-08-18', title: 'Ward-3 visit', status: 'planned' }]
        };
        localStorage.setItem(STORAGE_KEYS.APP_STATE, JSON.stringify(withItems));

        const state = StorageManager.loadState();
        expect(state.scheduledItems).toHaveLength(1);
        expect(state.scheduledItems[0].title).toBe('Ward-3 visit');
    });
});

describe('CHARACTERIZATION: ReminderService.generateReminders windowing', () => {
    it('includes an upcoming birthday, includes an overdue contact-due, excludes doNotContact', () => {
        const reminders = ReminderService.generateReminders();
        const types = reminders.map(r => `${r.eventType}:${r.visitorId}`).sort();

        // Sunita's birthday is 5 days ahead (inside the 7-day lookahead).
        // Ramesh is contact-due and 29 days overdue (inside the 30-day lookback).
        // Anjali is doNotContact and must not appear at all.
        expect(types).toEqual([
            'Birthday:visitor_fixture_001',
            'ContactDue:visitor_fixture_002'
        ]);
        expect(reminders.some(r => r.visitorId === 'visitor_fixture_003')).toBe(false);
    });

    it('reports the overdue contact-due with a negative daysUntil', () => {
        const due = ReminderService.generateReminders()
            .find(r => r.eventType === 'ContactDue');
        expect(due.daysUntil).toBeLessThan(0);
        expect(due.isOverdue()).toBe(true);
    });
});

describe('CHARACTERIZATION: ReminderService.getRemindersForMonth + handled annotation (Iter 9.3)', () => {
    it('filters by MONTH INDEX ONLY — it is year-blind, so it cannot back a calendar grid', () => {
        const august = ReminderService.getRemindersForMonth(7);
        expect(august.map(r => r.contactName)).toContain('सुनीता पाटील');

        // Nothing in the call distinguishes August 2026 from August 2027.
        // This is finding F2 and the reason CalendarService exists.
        const march = ReminderService.getRemindersForMonth(2);
        expect(march.map(r => r.contactName)).toContain('रमेश जाधव');
    });

    it('annotates every returned reminder with a handled flag', () => {
        const august = ReminderService.getRemindersForMonth(7);
        august.forEach(r => expect(typeof r.handled).toBe('boolean'));
    });

    it('excludes doNotContact visitors from the month view too', () => {
        const february = ReminderService.getRemindersForMonth(1);
        expect(february.some(r => r.visitorId === 'visitor_fixture_003')).toBe(false);
    });
});

/**
 * S3 EXCEPTION, PRE-AUTHORIZED IN THE PLAN AND EXERCISED HERE.
 *
 * This block previously pinned the BUG: `_generateFrequencyReminder` reported
 * `eventDate: '2026-06-11'` (the UTC calendar day) while deriving `daysUntil`
 * from the local midnight of the 12th — internally inconsistent by one day, so
 * a contact-due reminder surfaced a day early for any visitor whose due instant
 * fell in the IST 00:00-05:30 window.
 *
 * Task A3 fixed it (`toLocalISODate(dueDate)`). The expectation below is the
 * CORRECTED one, and it now also asserts the invariant that was missing all
 * along: eventDate and daysUntil must describe the SAME day.
 *
 * Known consequence, deliberate: `rawDate` feeds the reminder id hash, so for
 * the affected visitors the ContactDue reminder id changes once. Any prior
 * 'contacted' action recorded against the old id no longer suppresses it, so
 * such a reminder can reappear a single time before the next action re-records
 * it. Self-healing, affects only the mis-dated cases, and is the correct
 * trade for reminders that fire on the right day.
 */
describe('REGRESSION (A3): _generateFrequencyReminder keys off the LOCAL day', () => {
    it('uses the local calendar day of the due instant, not the UTC one', () => {
        // Baseline interaction at 21:00 UTC == 02:30 IST the NEXT local day.
        StateManager.addInteraction({
            id: 'interaction_probe_freq',
            visitorId: 'visitor_probe_freq',
            interactionType: 'call',
            notes: 'probe',
            interactionDate: '2026-06-01T21:00:00.000Z',
            createdAt: '2026-06-01T21:00:00.000Z',
            createdBy: 'machine_test'
        });

        const visitor = {
            id: 'visitor_probe_freq',
            contactFrequencyDays: 10,
            createdAt: '2026-01-01T00:00:00.000Z',
            contacts: [{ id: 'contact_probe', relationType: 'SELF', name: 'Probe', phones: ['9000000000'] }]
        };

        const reminder = ReminderService._generateFrequencyReminder(visitor);

        // Due instant is 2026-06-11T21:00Z, which is 2026-06-12 02:30 in IST.
        // The LOCAL due day is the 12th, and that is now what is reported.
        expect(reminder.eventDate).toBe('2026-06-12');

        // The invariant that was silently broken before A3: eventDate and
        // daysUntil must describe the SAME day.
        const localDueMidnight = new Date(2026, 5, 12);
        const todayMidnight = new Date(2026, 7, 10);
        expect(reminder.daysUntil).toBe(Math.round((localDueMidnight - todayMidnight) / 86400000));

        const [y, m, d] = reminder.eventDate.split('-').map(Number);
        const fromEventDate = Math.round((new Date(y, m - 1, d) - todayMidnight) / 86400000);
        expect(fromEventDate).toBe(reminder.daysUntil);
    });

    it('leaves a due instant that is unambiguous in both zones untouched', () => {
        StateManager.addInteraction({
            id: 'interaction_probe_freq_noon',
            visitorId: 'visitor_probe_freq_noon',
            interactionType: 'call',
            notes: 'probe',
            interactionDate: '2026-06-01T06:30:00.000Z',   // 12:00 IST — same day either way
            createdAt: '2026-06-01T06:30:00.000Z',
            createdBy: 'machine_test'
        });

        const reminder = ReminderService._generateFrequencyReminder({
            id: 'visitor_probe_freq_noon',
            contactFrequencyDays: 10,
            createdAt: '2026-01-01T00:00:00.000Z',
            contacts: [{ id: 'c_noon', relationType: 'SELF', name: 'Probe Noon', phones: ['9000000001'] }]
        });

        expect(reminder.eventDate).toBe('2026-06-11');
    });
});
