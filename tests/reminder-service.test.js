import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localStorage
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

// Mock ActivationManager
vi.mock('../src/core/activation.js', () => ({
    default: {
        getMachineInfo: () => ({
            machineId: 'machine_test',
            machineName: 'Test Machine',
            machineRole: 'root'
        })
    }
}));

// Mock EventBus
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

// Mock helpers
vi.mock('../src/utils/helpers.js', () => ({
    safeJSONParse: (data, fallback) => {
        try { return JSON.parse(data); } catch { return fallback; }
    },
    generateId: (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`,
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

describe('ReminderService.getRemindersForMonth — handled annotation (Iter 9.3)', () => {
    // The default reminders view hides items the user has snoozed or marked
    // contacted this cycle. Without these annotations, the explicit "Show <month>"
    // view re-surfaces those items with no indication that they were already
    // handled — the user concludes the default view is buggy when it's actually
    // doing what it was asked. These tests pin the annotation contract so the
    // UI can dim handled tiles without re-deriving the state.

    let ReminderService, StateManager;

    beforeEach(async () => {
        localStorageMock.clear();
        vi.resetModules();

        const stateMod = await import('../src/core/state.js');
        StateManager = stateMod.default;
        await StateManager.init();

        const svcMod = await import('../src/services/ReminderService.js');
        ReminderService = svcMod.default;
    });

    // Build a visitor whose SELF contact has a May 19 birthday.
    function seedVisitor(extra = {}) {
        const visitor = {
            id: 'v_sagar',
            status: 'active',
            doNotContact: false,
            contacts: [
                {
                    id: 'c_sagar',
                    relationType: 'SELF',
                    name: 'Sagar Misal',
                    phones: ['9999990001'],
                    dob: '1991-05-19'
                }
            ],
            ...extra
        };
        StateManager.setState({ visitors: [visitor] });
        return visitor;
    }

    it('marks reminders without any action as handled=false', () => {
        seedVisitor();
        const reminders = ReminderService.getRemindersForMonth(4); // May (0-indexed)
        expect(reminders).toHaveLength(1);
        expect(reminders[0].handled).toBe(false);
        expect(reminders[0].handledReason).toBeUndefined();
    });

    it('marks reminders with a recent contacted action as handled=true / contacted', () => {
        seedVisitor();
        const r = ReminderService.getRemindersForMonth(4)[0];
        // Re-fetch reminderId — use the actual reminder's id so the action matches
        StateManager.addReminderAction({
            id: 'action_test_1',
            reminderId: r.id,
            action: 'contacted',
            note: 'sms: Happy early birthday',
            actionAt: new Date().toISOString(),
            snoozeUntil: null
        });

        const fresh = ReminderService.getRemindersForMonth(4)[0];
        expect(fresh.handled).toBe(true);
        expect(fresh.handledReason).toBe('contacted');
        expect(fresh.handledAt).toBeTruthy();
    });

    it('marks reminders with an active snooze as handled=true / snoozed', () => {
        seedVisitor();
        const r = ReminderService.getRemindersForMonth(4)[0];
        const future = new Date();
        future.setDate(future.getDate() + 5);
        StateManager.addReminderAction({
            id: 'action_test_2',
            reminderId: r.id,
            action: 'snoozed',
            note: '',
            actionAt: new Date().toISOString(),
            snoozeUntil: future.toISOString()
        });

        const fresh = ReminderService.getRemindersForMonth(4)[0];
        expect(fresh.handled).toBe(true);
        expect(fresh.handledReason).toBe('snoozed');
        expect(fresh.handledUntil).toBeTruthy();
    });

    it('ignores a snooze that has already expired', () => {
        seedVisitor();
        const r = ReminderService.getRemindersForMonth(4)[0];
        const past = new Date();
        past.setDate(past.getDate() - 5);
        StateManager.addReminderAction({
            id: 'action_test_3',
            reminderId: r.id,
            action: 'snoozed',
            note: '',
            actionAt: past.toISOString(),
            snoozeUntil: past.toISOString()
        });

        const fresh = ReminderService.getRemindersForMonth(4)[0];
        expect(fresh.handled).toBe(false);
    });

    it('sorts unhandled reminders before handled ones, day order within each', () => {
        // Two May visitors: day 5 (handled) and day 19 (unhandled).
        // Unhandled May 19 should come first, then handled May 5.
        StateManager.setState({
            visitors: [
                {
                    id: 'v_a',
                    status: 'active',
                    doNotContact: false,
                    contacts: [{ id: 'c_a', relationType: 'SELF', name: 'A', phones: ['9000000005'], dob: '1990-05-05' }]
                },
                {
                    id: 'v_b',
                    status: 'active',
                    doNotContact: false,
                    contacts: [{ id: 'c_b', relationType: 'SELF', name: 'B', phones: ['9000000019'], dob: '1990-05-19' }]
                }
            ]
        });
        // Mark v_a's reminder contacted
        const reminders = ReminderService.getRemindersForMonth(4);
        const a = reminders.find(r => r.visitorId === 'v_a');
        StateManager.addReminderAction({
            id: 'action_test_4',
            reminderId: a.id,
            action: 'contacted',
            note: '',
            actionAt: new Date().toISOString(),
            snoozeUntil: null
        });

        const sorted = ReminderService.getRemindersForMonth(4);
        expect(sorted).toHaveLength(2);
        expect(sorted[0].visitorId).toBe('v_b'); // unhandled, May 19
        expect(sorted[0].handled).toBe(false);
        expect(sorted[1].visitorId).toBe('v_a'); // handled, May 5
        expect(sorted[1].handled).toBe(true);
    });

    it('excludes visitors with doNotContact=true entirely', () => {
        seedVisitor({ doNotContact: true });
        const reminders = ReminderService.getRemindersForMonth(4);
        expect(reminders).toHaveLength(0);
    });
});
