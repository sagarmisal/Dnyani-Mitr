/**
 * Iteration 11, Phase S — shareable plans over the WhatsApp channel.
 *
 * The behaviours here are the ones a naive last-write-wins merge gets wrong,
 * and each maps to a real thing these NGOs do: forwarding the same message
 * twice, pasting an old one after a new one, and two people planning the same
 * visit when there is no root machine to arbitrate.
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
    default: { getMachineInfo: () => ({ machineId: 'machine_root', machineName: 'Office', machineRole: 'root' }) }
}));
vi.mock('../src/core/events.js', () => ({
    default: { emit: vi.fn() },
    EVENTS: {
        STATE_LOADED: 's:l', STATE_CHANGED: 's:c', STATE_SAVED: 's:s',
        VISITOR_ADDED: 'v:a', VISITOR_UPDATED: 'v:u', VISITOR_DELETED: 'v:d',
        INTERACTION_ADDED: 'i:a', REMINDER_ACTION_CREATED: 'r:a',
        IMPORT_COMPLETED: 'import:completed', REMINDERS_UPDATED: 'r:u'
    }
}));

import StateManager from '../src/core/state.js';
import SyncService from '../src/services/SyncService.js';
import TextSyncService from '../src/services/TextSyncService.js';
import { ScheduledItem } from '../src/models/ScheduledItem.js';

const ORIGINAL_TZ = process.env.TZ;
const TODAY = '2026-08-20';

function plan(over = {}) {
    return new ScheduledItem({
        title: 'भेट', date: TODAY, type: 'visit', direction: 'inbound',
        updatedAt: '2026-08-20T06:00:00.000Z', ...over
    }).toJSON();
}

beforeAll(async () => {
    process.env.TZ = 'Asia/Kolkata';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-20T06:30:00.000Z'));
    await StateManager.init();
});
afterAll(() => { vi.useRealTimers(); process.env.TZ = ORIGINAL_TZ; });

beforeEach(() => {
    StateManager.state.scheduledItems = [];
    StateManager.state.visitors = [];
    StateManager.state.syncLog = [];
});

describe('S1 — the plans payload', () => {
    it('carries plans from today forward and leaves the past behind', () => {
        StateManager.state.scheduledItems = [
            plan({ id: 'sched_past', date: '2026-08-01' }),
            plan({ id: 'sched_today', date: TODAY }),
            plan({ id: 'sched_future', date: '2026-08-25' })
        ];
        const ids = SyncService.preparePlansExport().data.scheduledItems.map(i => i.id);
        expect(ids.sort()).toEqual(['sched_future', 'sched_today']);
    });

    it('still carries a RECENT cancellation, so the other device stops expecting it (S4)', () => {
        StateManager.state.scheduledItems = [
            plan({ id: 'sched_cancelled', date: '2026-08-05', status: 'cancelled' }),
            plan({ id: 'sched_ancient', date: '2026-01-05', status: 'cancelled' })
        ];
        const ids = SyncService.preparePlansExport().data.scheduledItems.map(i => i.id);
        expect(ids).toEqual(['sched_cancelled']);   // 30-day tombstone window
    });

    it('exports a single day when asked', () => {
        StateManager.state.scheduledItems = [
            plan({ id: 'sched_a', date: '2026-08-25' }),
            plan({ id: 'sched_b', date: '2026-08-26' })
        ];
        const pkg = SyncService.preparePlansExport({ onlyDate: '2026-08-25' });
        expect(pkg.data.scheduledItems.map(i => i.id)).toEqual(['sched_a']);
    });

    it('carries a stub for each referenced person, never the full record (S3)', () => {
        StateManager.state.visitors = [{
            id: 'v1', status: 'active', notes: 'private notes stay home',
            contacts: [{ relationType: 'SELF', id: 'c1', name: 'सुनीता पाटील', phones: ['9876543210'] }]
        }];
        StateManager.state.scheduledItems = [plan({ id: 'sched_1', visitorId: 'v1' })];

        const refs = SyncService.preparePlansExport().data.visitorRefs;
        expect(refs).toEqual([{ id: 'v1', name: 'सुनीता पाटील', phone: '9876543210' }]);
        expect(JSON.stringify(refs)).not.toContain('private notes');
    });

    it('fits a realistic week of plans into ONE WhatsApp message', async () => {
        StateManager.state.scheduledItems = Array.from({ length: 15 }, (_, n) =>
            plan({ id: `sched_${n}`, date: '2026-08-2' + (n % 9), title: `सुनीता पाटील यांची भेट ${n}` }));
        const { chunkCount } = await TextSyncService.encode(SyncService.preparePlansExport());
        expect(chunkCount).toBe(1);
    });

    it('puts a human-readable header above the data block (S10)', () => {
        StateManager.state.scheduledItems = [plan({ id: 'sched_1' })];
        const header = SyncService.plansMessageHeader(SyncService.preparePlansExport());
        expect(header).toContain('Dnyani Mitr');
        expect(header).toContain('1 plan');
        expect(header).toMatch(/Needs app version/);
    });
});

describe('S5/S6/S7 — the merge rules', () => {
    const incoming = (items) => ({
        metadata: { app: 'NGO_Visitor_Manager', backupType: 'plans', machineName: 'Office', count: items.length },
        data: { scheduledItems: items, visitorRefs: [] }
    });

    it('adds plans that are new to this device', () => {
        const res = SyncService.mergePlans(incoming([plan({ id: 'sched_new' })]));
        expect(res.added).toBe(1);
        expect(StateManager.getScheduledItems()).toHaveLength(1);
    });

    it('is a no-op when the same message is imported twice (S6)', () => {
        const pkg = incoming([plan({ id: 'sched_x' })]);
        SyncService.mergePlans(pkg);
        const second = SyncService.mergePlans(pkg);

        expect(second.added).toBe(0);
        expect(second.updated).toBe(0);
        expect(StateManager.getScheduledItems()).toHaveLength(1);
    });

    it('does not revert when an OLDER message arrives after a newer one (S6)', () => {
        SyncService.mergePlans(incoming([plan({ id: 'sched_y', title: 'newer', updatedAt: '2026-08-20T10:00:00.000Z' })]));
        SyncService.mergePlans(incoming([plan({ id: 'sched_y', title: 'older', updatedAt: '2026-08-19T10:00:00.000Z' })]));

        expect(StateManager.getScheduledItems()[0].title).toBe('newer');
    });

    it('applies a genuinely newer edit', () => {
        SyncService.mergePlans(incoming([plan({ id: 'sched_z', title: 'first', updatedAt: '2026-08-20T06:00:00.000Z' })]));
        SyncService.mergePlans(incoming([plan({ id: 'sched_z', title: 'corrected', updatedAt: '2026-08-20T11:00:00.000Z' })]));

        expect(StateManager.getScheduledItems()[0].title).toBe('corrected');
    });

    it('NEVER un-completes work already recorded here (S5)', () => {
        StateManager.addScheduledItem(plan({
            id: 'sched_done', status: 'done', completedAt: '2026-08-20T07:00:00.000Z',
            updatedAt: '2026-08-20T07:00:00.000Z'
        }));
        const res = SyncService.mergePlans(incoming([plan({
            id: 'sched_done', status: 'planned', title: 'sender edited later',
            updatedAt: '2026-08-20T23:00:00.000Z'
        })]));

        expect(res.skipped).toBe(1);
        const kept = StateManager.getScheduledItems()[0];
        expect(kept.status).toBe('done');
        expect(kept.title).not.toBe('sender edited later');
    });

    it('propagates a cancellation so nobody makes a cancelled trip (S4)', () => {
        SyncService.mergePlans(incoming([plan({ id: 'sched_c', updatedAt: '2026-08-20T06:00:00.000Z' })]));
        const res = SyncService.mergePlans(incoming([plan({
            id: 'sched_c', status: 'cancelled', updatedAt: '2026-08-20T09:00:00.000Z'
        })]));

        expect(res.cancelled).toBe(1);
        expect(StateManager.getScheduledItems()[0].status).toBe('cancelled');
    });

    it('flags a same-person same-day duplicate instead of adding it twice (S7)', () => {
        StateManager.addScheduledItem(plan({ id: 'sched_mine', visitorId: 'v1', date: '2026-08-25', type: 'visit' }));
        const res = SyncService.mergePlans(incoming([
            plan({ id: 'sched_theirs', visitorId: 'v1', date: '2026-08-25', type: 'visit', title: 'same visit' })
        ]));

        expect(res.duplicates).toHaveLength(1);
        expect(res.added).toBe(0);
        expect(StateManager.getScheduledItems()).toHaveLength(1);
    });

    it('denormalises a name from the stub so the item never renders as Unknown', () => {
        const pkg = {
            metadata: { backupType: 'plans', machineName: 'Office', count: 1 },
            data: {
                scheduledItems: [plan({ id: 'sched_ref', visitorId: 'v_far', visitorName: '' })],
                visitorRefs: [{ id: 'v_far', name: 'रमेश जाधव', phone: '9000000000' }]
            }
        };
        SyncService.mergePlans(pkg);
        expect(StateManager.getScheduledItems()[0].visitorName).toBe('रमेश जाधव');
    });

    it('does NOT create a visitor from a stub — half-records must not enter the list', () => {
        SyncService.mergePlans({
            metadata: { backupType: 'plans', machineName: 'Office', count: 1 },
            data: {
                scheduledItems: [plan({ id: 'sched_ref2', visitorId: 'v_far' })],
                visitorRefs: [{ id: 'v_far', name: 'रमेश', phone: '9000000000' }]
            }
        });
        expect(StateManager.getVisitors()).toHaveLength(0);
    });

    it('refuses a full backup or a sync package', () => {
        expect(() => SyncService.mergePlans({ metadata: { backupType: 'full' }, data: {} })).toThrow(/not a plans message/i);
        expect(SyncService.isPlansPackage({ metadata: {}, data: {} })).toBe(false);
    });

    it('survives malformed items without throwing away the good ones', () => {
        const res = SyncService.mergePlans(incoming([null, { id: 'no_date' }, plan({ id: 'sched_ok' })]));
        expect(res.added).toBe(1);
        expect(res.skipped).toBe(2);
    });
});

describe('Round trip over the text channel', () => {
    it('encodes, decodes and merges back to the same plans', async () => {
        StateManager.state.scheduledItems = [
            plan({ id: 'sched_r1', date: '2026-08-25', title: 'वॉर्ड ३ भेट' }),
            plan({ id: 'sched_r2', date: '2026-08-26', status: 'cancelled' })
        ];
        const pkg = SyncService.preparePlansExport();
        const { text } = await TextSyncService.encode(pkg);
        const message = SyncService.plansMessageHeader(pkg) + '\n\n' + text;

        StateManager.state.scheduledItems = [];
        const { pkg: decoded } = await TextSyncService.decode(message);
        const res = SyncService.mergePlans(decoded);

        expect(res.added).toBe(2);
        expect(StateManager.getScheduledItems().find(i => i.id === 'sched_r1').title).toBe('वॉर्ड ३ भेट');
    });
});

describe('Adversarial review findings (E4)', () => {
    const incoming = (items) => ({
        metadata: { app: 'NGO_Visitor_Manager', backupType: 'plans', machineName: 'Office', count: items.length },
        data: { scheduledItems: items, visitorRefs: [] }
    });

    it('E4-1: preserves the SENDER\'s updatedAt, not the moment of import', () => {
        SyncService.mergePlans(incoming([plan({ id: 'sched_ts', updatedAt: '2026-08-20T06:00:00.000Z' })]));
        SyncService.mergePlans(incoming([plan({
            id: 'sched_ts', title: 'edited by sender', updatedAt: '2026-08-20T06:15:00.000Z'
        })]));

        // Losing this breaks last-write-wins across three machines: A edits,
        // B imports and re-stamps with its own clock, B forwards to C — and C
        // now sees B's import time instead of A's edit time, so a genuinely
        // later edit from A can lose to an earlier one that was merely relayed.
        expect(StateManager.getScheduledItems()[0].updatedAt).toBe('2026-08-20T06:15:00.000Z');
    });

    it('E4-1b: re-importing the same UPDATE stays a no-op even with sender clock skew', () => {
        SyncService.mergePlans(incoming([plan({ id: 'sched_skew', updatedAt: '2026-08-20T06:00:00.000Z' })]));
        // Cheap Android phones run without NTP; a sender's clock being ahead of
        // the receiver's is ordinary, not exotic.
        const skewed = incoming([plan({ id: 'sched_skew', title: 'from a fast clock', updatedAt: '2026-08-20T23:00:00.000Z' })]);
        SyncService.mergePlans(skewed);
        const second = SyncService.mergePlans(skewed);

        expect(second.updated).toBe(0);
        expect(second.skipped).toBe(1);
    });
});

describe('Security hardening (E4)', () => {
    const incoming = (items) => ({
        metadata: { app: 'NGO_Visitor_Manager', backupType: 'plans', machineName: 'Office', count: items.length },
        data: { scheduledItems: items, visitorRefs: [] }
    });

    it('E4-2: normalises hostile enum values instead of storing them', () => {
        SyncService.mergePlans(incoming([{
            id: 'sched_evil', date: TODAY, title: 'x',
            type: 'teleport', status: 'quantum', direction: 'sideways',
            updatedAt: '2026-08-20T06:00:00.000Z'
        }]));

        const saved = StateManager.getScheduledItems()[0];
        expect(saved.type).toBe('task');
        expect(saved.status).toBe('planned');
        expect(saved.direction).toBe('outbound');
    });

    it('E4-2b: drops unknown fields rather than storing and re-exporting them', () => {
        SyncService.mergePlans(incoming([{
            id: 'sched_extra', date: TODAY, title: 'x', updatedAt: '2026-08-20T06:00:00.000Z',
            __proto__hack: 'x', arbitraryPayload: 'should not persist'
        }]));
        expect(StateManager.getScheduledItems()[0].arbitraryPayload).toBeUndefined();
    });

    it('E4-2c: rejects a malformed date instead of writing an item the calendar cannot place', () => {
        const res = SyncService.mergePlans(incoming([
            { id: 'sched_bad', date: '18-08-2026', title: 'x' },
            { id: 'sched_bad2', date: 'someday', title: 'x' }
        ]));
        expect(res.skipped).toBe(2);
        expect(StateManager.getScheduledItems()).toHaveLength(0);
    });

    it('E4-2d: still preserves the legitimate fields it should', () => {
        SyncService.mergePlans(incoming([plan({
            id: 'sched_good', phone: '9876543210', visitorName: 'सुनीता',
            occasion: { type: 'Birthday', whose: 'मुलगी', relation: 'CHILD', date: '2020-08-18' }
        })]));
        const saved = StateManager.getScheduledItems()[0];
        expect(saved.phone).toBe('9876543210');
        expect(saved.occasion.date).toBe('2020-08-18');
        expect(saved.updatedAt).toBe('2026-08-20T06:00:00.000Z');
    });
});
