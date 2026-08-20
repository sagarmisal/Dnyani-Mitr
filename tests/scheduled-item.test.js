/**
 * Iteration 11, Phase A — ScheduledItem model, state CRUD, and the two
 * shared-service hardenings (A8 log guard, A9 optional interaction date).
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

vi.mock('../src/utils/helpers.js', () => {
    let counter = 0;
    return {
        safeJSONParse: (data, fallback) => {
            try { return JSON.parse(data); } catch { return fallback; }
        },
        generateId: (prefix) => `${prefix}_${++counter}`,
        deepClone: (obj) => JSON.parse(JSON.stringify(obj)),
        simpleHash: (s) => String(s.length)
    };
});

import { ScheduledItem } from '../src/models/ScheduledItem.js';
import { SCHEDULED_ITEM_TYPES, SCHEDULED_ITEM_STATUS, INTERACTION_TYPES } from '../src/utils/constants.js';
import StateManager from '../src/core/state.js';
import InteractionService from '../src/services/InteractionService.js';

const ORIGINAL_TZ = process.env.TZ;

beforeAll(async () => {
    process.env.TZ = 'Asia/Kolkata';
    await StateManager.init();
});

afterAll(() => {
    process.env.TZ = ORIGINAL_TZ;
});

describe('ScheduledItem model', () => {
    it('applies safe defaults', () => {
        const item = new ScheduledItem({ title: 'Ward-3 visits', date: '2026-08-18' });

        expect(item.id).toMatch(/^sched_/);
        expect(item.type).toBe(SCHEDULED_ITEM_TYPES.TASK);
        expect(item.status).toBe(SCHEDULED_ITEM_STATUS.PLANNED);
        expect(item.time).toBeNull();
        expect(item.visitorId).toBeNull();
        expect(item.completedAt).toBeNull();
        expect(item.interactionId).toBeNull();
    });

    it('trims the title and preserves Devanagari exactly', () => {
        const item = new ScheduledItem({ title: '  वॉर्ड ३ भेट  ', date: '2026-08-18' });
        expect(item.title).toBe('वॉर्ड ३ भेट');
    });

    it('falls back to a safe type and status when given rubbish', () => {
        const item = new ScheduledItem({
            title: 'x', date: '2026-08-18', type: 'teleport', status: 'quantum'
        });
        expect(item.type).toBe(SCHEDULED_ITEM_TYPES.TASK);
        expect(item.status).toBe(SCHEDULED_ITEM_STATUS.PLANNED);
    });

    it('maps each type to the interaction type its completion should log', () => {
        const mk = (type) => new ScheduledItem({ title: 't', date: '2026-08-18', type });
        expect(mk('visit').toInteractionType()).toBe(INTERACTION_TYPES.VISIT);
        expect(mk('call').toInteractionType()).toBe(INTERACTION_TYPES.CALL);
        expect(mk('meeting').toInteractionType()).toBe(INTERACTION_TYPES.MEETING);
        expect(mk('task').toInteractionType()).toBe(INTERACTION_TYPES.OTHER);
    });

    it('only logs an interaction when a visitor is linked (G3)', () => {
        const linked = new ScheduledItem({ title: 't', date: '2026-08-18', visitorId: 'visitor_1' });
        const unlinked = new ScheduledItem({ title: 'Ward meeting', date: '2026-08-18' });

        expect(linked.shouldLogInteraction()).toBe(true);
        expect(unlinked.shouldLogInteraction()).toBe(false);
    });

    it('round-trips through JSON without losing a field', () => {
        const item = new ScheduledItem({
            title: 'भेट', date: '2026-08-18', time: '11:00', type: 'visit',
            visitorId: 'visitor_1', notes: 'ward 3'
        });
        const revived = ScheduledItem.fromJSON(JSON.parse(JSON.stringify(item.toJSON())));
        expect(revived.toJSON()).toEqual(item.toJSON());
    });
});

describe('ScheduledItem.validate', () => {
    const valid = { title: 'Visit Sunita', date: '2026-08-18', time: '11:00', type: 'visit' };

    it('accepts a well-formed item', () => {
        expect(ScheduledItem.validate(valid)).toEqual([]);
    });

    it('requires a non-empty title', () => {
        expect(ScheduledItem.validate({ ...valid, title: '   ' })).toContain('Give this item a title.');
    });

    it('caps the title length', () => {
        const errors = ScheduledItem.validate({ ...valid, title: 'x'.repeat(121) });
        expect(errors.some(e => e.includes('120 characters'))).toBe(true);
    });

    it('accepts a 120-character title exactly at the boundary', () => {
        expect(ScheduledItem.validate({ ...valid, title: 'x'.repeat(120) })).toEqual([]);
    });

    it('rejects a malformed or impossible date', () => {
        expect(ScheduledItem.validate({ ...valid, date: '' })).toContain('Pick a valid date.');
        expect(ScheduledItem.validate({ ...valid, date: '18-08-2026' })).toContain('Pick a valid date.');
        expect(ScheduledItem.validate({ ...valid, date: '2026-02-30' })).toContain('Pick a valid date.');
        expect(ScheduledItem.validate({ ...valid, date: '2026-13-01' })).toContain('Pick a valid date.');
    });

    it('rejects 29 Feb in a non-leap year but allows it in a leap year', () => {
        expect(ScheduledItem.validate({ ...valid, date: '2026-02-29' })).toContain('Pick a valid date.');
        expect(ScheduledItem.validate({ ...valid, date: '2028-02-29' })).toEqual([]);
    });

    it('accepts an empty time but rejects a malformed one', () => {
        expect(ScheduledItem.validate({ ...valid, time: null })).toEqual([]);
        expect(ScheduledItem.validate({ ...valid, time: '' })).toEqual([]);
        expect(ScheduledItem.validate({ ...valid, time: '25:00' }).length).toBe(1);
        expect(ScheduledItem.validate({ ...valid, time: '9:00' }).length).toBe(1);
        expect(ScheduledItem.validate({ ...valid, time: 'noon' }).length).toBe(1);
    });

    it('rejects unknown type and status values', () => {
        expect(ScheduledItem.validate({ ...valid, type: 'teleport' })).toContain('Unknown item type.');
        expect(ScheduledItem.validate({ ...valid, status: 'quantum' })).toContain('Unknown item status.');
    });

    it('survives empty and adversarial input without throwing', () => {
        expect(() => ScheduledItem.validate()).not.toThrow();
        expect(() => ScheduledItem.validate({})).not.toThrow();
        expect(() => ScheduledItem.validate({ title: '<script>alert(1)</script>', date: '2026-08-18' })).not.toThrow();
    });
});

describe('StateManager scheduled-item CRUD', () => {
    beforeEach(() => {
        StateManager.getScheduledItems().forEach(i => StateManager.deleteScheduledItem(i.id));
    });

    it('starts empty and adds an item', () => {
        expect(StateManager.getScheduledItems()).toEqual([]);

        const item = new ScheduledItem({ title: 'Ward-3 visits', date: '2026-08-18' }).toJSON();
        expect(StateManager.addScheduledItem(item)).toBe(true);
        expect(StateManager.getScheduledItems()).toHaveLength(1);
    });

    it('returns a copy, so a caller cannot mutate state by reference', () => {
        StateManager.addScheduledItem(new ScheduledItem({ title: 'original', date: '2026-08-18' }).toJSON());

        const items = StateManager.getScheduledItems();
        items[0].title = 'tampered';

        expect(StateManager.getScheduledItems()[0].title).toBe('original');
    });

    it('updates an item and stamps updatedAt', () => {
        const item = new ScheduledItem({ title: 'plan', date: '2026-08-18' }).toJSON();
        StateManager.addScheduledItem(item);

        expect(StateManager.updateScheduledItem(item.id, { status: 'done', completedAt: '2026-08-18T06:00:00.000Z' })).toBe(true);

        const saved = StateManager.getScheduledItems()[0];
        expect(saved.status).toBe('done');
        expect(saved.completedAt).toBe('2026-08-18T06:00:00.000Z');
        expect(saved.updatedAt).toBeTruthy();
    });

    it('reports false when updating or deleting an unknown id', () => {
        expect(StateManager.updateScheduledItem('sched_nope', { status: 'done' })).toBe(false);
        expect(StateManager.deleteScheduledItem('sched_nope')).toBe(false);
    });

    it('deletes only the requested item', () => {
        const a = new ScheduledItem({ title: 'a', date: '2026-08-18' }).toJSON();
        const b = new ScheduledItem({ title: 'b', date: '2026-08-19' }).toJSON();
        StateManager.addScheduledItem(a);
        StateManager.addScheduledItem(b);

        expect(StateManager.deleteScheduledItem(a.id)).toBe(true);

        const left = StateManager.getScheduledItems();
        expect(left).toHaveLength(1);
        expect(left[0].title).toBe('b');
    });

    it('persists items to storage across a reload', () => {
        StateManager.addScheduledItem(new ScheduledItem({ title: 'वॉर्ड ३ भेट', date: '2026-08-18' }).toJSON());

        const raw = JSON.parse(localStorage.getItem('NGOApp_v2_State'));
        expect(raw.scheduledItems).toHaveLength(1);
        expect(raw.scheduledItems[0].title).toBe('वॉर्ड ३ भेट');
    });
});

describe('InteractionService.log — A8 guard', () => {
    it('refuses to create an orphan interaction with no visitorId', () => {
        expect(() => InteractionService.log({ visitorId: null, interactionType: 'call' }))
            .toThrow(/visitorId/);
        expect(() => InteractionService.log({ visitorId: '', interactionType: 'call' }))
            .toThrow(/visitorId/);
        expect(() => InteractionService.log({ interactionType: 'call' }))
            .toThrow(/visitorId/);
    });

    it('still accepts a normal call and honours an explicit interactionDate (A9)', () => {
        const backdated = InteractionService.log({
            visitorId: 'visitor_real',
            interactionType: 'visit',
            notes: 'backfilled from the calendar',
            interactionDate: '2026-08-15T05:30:00.000Z'
        });

        expect(backdated.visitorId).toBe('visitor_real');
        expect(backdated.interactionDate).toBe('2026-08-15T05:30:00.000Z');
    });
});
