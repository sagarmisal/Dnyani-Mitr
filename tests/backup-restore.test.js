/**
 * Iteration 11, R0 — the licence to ship.
 *
 * Nothing reaches a device until this file is green, because the rollout's own
 * fallback is: back up -> uninstall -> install -> restore. Before R0 that path
 * lost every occasion, campaign and scheduled item, and a backup FILE could not
 * be restored at all.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => { store[key] = value; },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; },
        _dump: () => store
    };
})();
vi.stubGlobal('localStorage', localStorageMock);

vi.mock('../src/core/activation.js', () => ({
    default: {
        getMachineInfo: () => ({ machineId: 'machine_root', machineName: 'Office', machineRole: 'root' })
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

import StateManager from '../src/core/state.js';
import StorageManager from '../src/core/storage.js';
import SyncService from '../src/services/SyncService.js';
import { ScheduledItem } from '../src/models/ScheduledItem.js';

const ORIGINAL_TZ = process.env.TZ;

/** Something in every single collection, with Devanagari and a leap-day date. */
function populate() {
    StateManager.state.visitors = [{
        id: 'visitor_1', status: 'active', doNotContact: false, contactFrequencyDays: 45,
        address: 'वॉर्ड ३, सेवा नगर', notes: 'नियमित संपर्क',
        createdAt: '2025-04-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
        contacts: [{
            id: 'contact_1', relationType: 'SELF', name: 'सुनीता पाटील', phones: ['9876543210'],
            emails: [], dob: '1996-02-29', dobMonthOnly: false, marriageDate: null,
            deathDate: null, customEvents: []
        }]
    }];
    StateManager.state.interactions = [{
        id: 'int_1', visitorId: 'visitor_1', interactionType: 'visit', notes: 'भेट घेतली',
        interactionDate: '2026-08-01T05:30:00.000Z', followUpDate: '2026-08-25',
        followUpCompletedAt: null, createdBy: 'machine_root'
    }];
    StateManager.state.reminderActions = [
        { id: 'act_1', reminderId: 'reminder_abc', action: 'snoozed', snoozeUntil: '2026-09-01T00:00:00.000Z', actionAt: '2026-08-10T00:00:00.000Z' }
    ];
    StateManager.state.occasions = [
        { id: 'occasion_foundation', name: 'Foundation Day', nameMr: 'स्थापना दिन', month: 3, day: 12, builtin: false, templates: { greeting: { en: 'x', mr: 'य' }, invitation: { en: '', mr: '' } }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: null }
    ];
    StateManager.state.campaigns = [
        { id: 'campaign_1', name: 'Diwali 2026', occasionId: null, channel: 'whatsapp', language: 'mr', date: '2026-11-08T00:00:00.000Z', status: 'draft', recipientIds: [], stats: { total: 0, sent: 0, failed: 0, skipped: 0 } }
    ];
    StateManager.state.scheduledItems = [
        new ScheduledItem({ title: 'वॉर्ड ३ भेट', date: '2026-08-21', direction: 'inbound', visitorId: 'visitor_1' }).toJSON()
    ];
    StateManager.state.knownMachines = { machine_sat1: 'Assistant-1' };
    StateManager.state.syncLog = [{ timestamp: '2026-08-01T00:00:00.000Z', direction: 'export', machineName: 'Office' }];
    StateManager.state.settings = { ...StateManager.state.settings, calendarStartsOn: 'mon', landingScreen: 'dashboard' };
    StorageManager.saveState(StateManager.state);
}

/** Everything a fresh install would have — i.e. an uninstall/reinstall. */
function wipe() {
    localStorageMock.clear();
    StateManager.state = StorageManager.getDefaultState();
    StorageManager.saveState(StateManager.state);
}

beforeAll(async () => {
    process.env.TZ = 'Asia/Kolkata';
    await StateManager.init();
});
afterAll(() => { process.env.TZ = ORIGINAL_TZ; });
beforeEach(() => { wipe(); });

describe('R0.4 — the round trip', () => {
    it('carries every collection through backup -> wipe -> restore, byte for byte', () => {
        populate();
        const before = StateManager.getState();
        const pkg = SyncService.prepareFullBackup();
        const wire = JSON.parse(JSON.stringify(pkg));   // as it would travel

        wipe();
        expect(StateManager.getVisitors()).toHaveLength(0);

        SyncService.restoreFullBackup(wire);
        const after = StateManager.getState();

        expect(after.visitors).toEqual(before.visitors);
        expect(after.interactions).toEqual(before.interactions);
        expect(after.reminderActions).toEqual(before.reminderActions);
        expect(after.occasions).toEqual(before.occasions);
        expect(after.campaigns).toEqual(before.campaigns);
        expect(after.scheduledItems).toEqual(before.scheduledItems);
        expect(after.knownMachines).toEqual(before.knownMachines);
        expect(after.settings.calendarStartsOn).toBe('mon');
        expect(after.settings.landingScreen).toBe('dashboard');
    });

    it('preserves Devanagari and the collections a pre-R0 backup silently dropped', () => {
        populate();
        const pkg = JSON.parse(JSON.stringify(SyncService.prepareFullBackup()));
        wipe();
        SyncService.restoreFullBackup(pkg);

        expect(StateManager.getVisitors()[0].contacts[0].name).toBe('सुनीता पाटील');
        expect(StateManager.getOccasions().find(o => o.id === 'occasion_foundation')).toBeTruthy();
        expect(StateManager.getCampaigns()).toHaveLength(1);
        expect(StateManager.getScheduledItems()[0].title).toBe('वॉर्ड ३ भेट');
        expect(StateManager.getScheduledItems()[0].direction).toBe('inbound');
    });

    it('survives a reload after restore, because it was persisted not just held', () => {
        populate();
        const pkg = JSON.parse(JSON.stringify(SyncService.prepareFullBackup()));
        wipe();
        SyncService.restoreFullBackup(pkg);

        const reloaded = StorageManager.loadState();
        expect(reloaded.campaigns).toHaveLength(1);
        expect(reloaded.scheduledItems).toHaveLength(1);
    });

    it('takes a pre-restore snapshot, so an accidental restore is recoverable', () => {
        populate();
        const pkg = JSON.parse(JSON.stringify(SyncService.prepareFullBackup()));
        const result = SyncService.restoreFullBackup(pkg);
        expect(result.backupCreated).toBe(true);
        expect(localStorage.getItem('NGOApp_v2_PreSyncBackup')).toBeTruthy();
    });

    it('reports what came back', () => {
        populate();
        const pkg = JSON.parse(JSON.stringify(SyncService.prepareFullBackup()));
        wipe();
        const { counts } = SyncService.restoreFullBackup(pkg);
        expect(counts).toMatchObject({ visitors: 1, interactions: 1, occasions: 1, campaigns: 1, scheduledItems: 1 });
    });
});

describe('R0.2 — version tolerance and refusal', () => {
    it('restores a v3.1.0 backup that predates scheduledItems and followUpCompletedAt', () => {
        const old = {
            metadata: { app: 'NGO_Visitor_Manager', version: '3.1.0', dataVersion: '3.1.0', backupType: 'full', exportedAt: '2026-06-01T00:00:00.000Z', machineName: 'Old Laptop' },
            data: {
                visitors: [{ id: 'v_old', status: 'active', contacts: [{ id: 'c_old', relationType: 'SELF', name: 'रमेश', phones: ['9999999999'] }] }],
                interactions: [{ id: 'i_old', visitorId: 'v_old', interactionType: 'call', interactionDate: '2026-05-01T00:00:00.000Z', followUpDate: '2026-05-20' }],
                reminderActions: [], settings: { theme: 'light' }, syncLog: [], knownMachines: {}
            }
        };
        SyncService.restoreFullBackup(old);

        expect(StateManager.getVisitors()).toHaveLength(1);
        expect(StateManager.getScheduledItems()).toEqual([]);
        expect(StateManager.getInteractions()[0].followUpCompletedAt).toBeNull();
        expect(StateManager.getOccasions().length).toBeGreaterThan(0);   // seeded, not left absent
        expect(StateManager.getSettings().landingScreen).toBe('calendar');
    });

    it('refuses a sync package and says what to do instead', () => {
        const syncPkg = { metadata: { app: 'NGO_Visitor_Manager', version: '3.2.0' }, data: { visitors: [] } };
        expect(() => SyncService.restoreFullBackup(syncPkg)).toThrow(/not a full backup/i);
        expect(SyncService.isFullBackup(syncPkg)).toBe(false);
    });

    it('refuses a damaged backup rather than wiping the device', () => {
        populate();
        const damaged = { metadata: { backupType: 'full' }, data: { interactions: [] } };
        expect(() => SyncService.restoreFullBackup(damaged)).toThrow(/damaged|visitor/i);
        expect(StateManager.getVisitors()).toHaveLength(1);   // untouched
    });

    it('recognises its own package as restorable', () => {
        populate();
        expect(SyncService.isFullBackup(SyncService.prepareFullBackup())).toBe(true);
    });
});

describe('R0.5 — the guard that stops this recurring', () => {
    // Anything in state that a backup deliberately does NOT carry, with a reason.
    const EXCLUDED = [
        'version',        // stamped by the restoring build, not the sending one
        'activated',      // activation is per-device and lives in its own storage key
        'machineId',      // identity of THIS device; a restore must not steal the sender's
        'machineRole',
        'machineName'
    ];

    it('backs up every collection in the default state except a documented exclusion list', () => {
        const stateKeys = Object.keys(StorageManager.getDefaultState());
        const backedUp = Object.keys(SyncService.prepareFullBackup().data);
        const missing = stateKeys.filter(k => !backedUp.includes(k) && !EXCLUDED.includes(k));

        // If this fails, someone added a collection to state and did not add it to
        // the backup — exactly how occasions and campaigns went missing before R0.
        expect(missing).toEqual([]);
    });

    it('declares its contents in metadata, so a missing collection is detectable', () => {
        const pkg = SyncService.prepareFullBackup();
        expect(pkg.metadata.collections).toEqual(Object.keys(pkg.data));
        expect(pkg.metadata.collections).toContain('occasions');
        expect(pkg.metadata.collections).toContain('campaigns');
        expect(pkg.metadata.collections).toContain('scheduledItems');
    });
});
