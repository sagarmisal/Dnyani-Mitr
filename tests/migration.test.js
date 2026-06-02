import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APP_VERSION } from '../src/utils/constants.js';

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

// Mock helpers
vi.mock('../src/utils/helpers.js', () => ({
  safeJSONParse: (data, fallback) => {
    try { return JSON.parse(data); } catch { return fallback; }
  },
  generateId: (prefix) => `${prefix}_test123`
}));

describe('StorageManager migration', () => {
  let StorageManager;

  beforeEach(async () => {
    localStorageMock.clear();
    // Re-import to get fresh singleton
    vi.resetModules();
    const mod = await import('../src/core/storage.js');
    StorageManager = mod.default;
  });

  it('migrates v2 interactions with new fields', () => {
    const v2State = {
      version: '2.0.0',
      activated: true,
      machineId: 'machine_abc',
      machineRole: 'satellite',
      machineName: 'Test Phone',
      visitors: [],
      interactions: [
        { id: 'i1', visitorId: 'v1', interactionType: 'call', notes: 'Called' },
        { id: 'i2', visitorId: 'v2', interactionType: 'visit', notes: 'Visited', duration: 30 }
      ],
      reminderActions: [],
      settings: { reminderLookahead: 14 }
    };

    localStorageMock.setItem('NGOApp_v2_State', JSON.stringify(v2State));
    const migrated = StorageManager.loadState();

    expect(migrated.version).toBe(APP_VERSION);

    // Interaction without duration should get null
    const i1 = migrated.interactions.find(i => i.id === 'i1');
    expect(i1.outcome).toBeNull();
    expect(i1.duration).toBeNull();
    expect(i1.followUpDate).toBeNull();
    expect(i1.followUpNotes).toBe('');

    // Interaction with duration: 30 should preserve it
    const i2 = migrated.interactions.find(i => i.id === 'i2');
    expect(i2.duration).toBe(30);
  });

  it('migrates v2 visitors with new fields', () => {
    const v2State = {
      version: '2.0.0',
      activated: true,
      machineId: 'machine_abc',
      machineRole: 'root',
      machineName: 'Office PC',
      visitors: [
        { id: 'v1', contacts: [], status: 'active', tags: [] }
      ],
      interactions: [],
      reminderActions: [],
      settings: {}
    };

    localStorageMock.setItem('NGOApp_v2_State', JSON.stringify(v2State));
    const migrated = StorageManager.loadState();

    const v1 = migrated.visitors[0];
    expect(v1.consentGiven).toBe(false);
    expect(v1.consentDate).toBeNull();
    expect(v1.doNotContact).toBe(false);
    expect(v1.contactFrequencyDays).toBeNull();
    expect(v1.engagementScore).toBe(0);
    expect(v1.engagementUpdatedAt).toBeNull();
  });

  it('preserves activation state during migration', () => {
    const v2State = {
      version: '2.0.0',
      activated: true,
      machineId: 'machine_xyz',
      machineRole: 'satellite',
      machineName: 'Field Phone',
      visitors: [],
      interactions: [],
      reminderActions: [],
      settings: {}
    };

    localStorageMock.setItem('NGOApp_v2_State', JSON.stringify(v2State));
    const migrated = StorageManager.loadState();

    expect(migrated.activated).toBe(true);
    expect(migrated.machineId).toBe('machine_xyz');
    expect(migrated.machineRole).toBe('satellite');
    expect(migrated.machineName).toBe('Field Phone');
  });

  it('initializes v3 settings fields', () => {
    const v2State = {
      version: '2.0.0',
      activated: false,
      visitors: [],
      interactions: [],
      reminderActions: [],
      settings: { reminderLookahead: 30 }
    };

    localStorageMock.setItem('NGOApp_v2_State', JSON.stringify(v2State));
    const migrated = StorageManager.loadState();

    expect(migrated.settings.lapseThresholdDays).toBe(60);
    expect(migrated.settings.organizationName).toBe('Sewa Sankalp Pratishthan');
    expect(migrated.settings.messageTemplates).toBeDefined();
    expect(migrated.settings.messageTemplates.birthday).toContain('{name}');
    expect(migrated.settings.messageTemplates.birthday).toContain('{org}');
    // Preserved original setting
    expect(migrated.settings.reminderLookahead).toBe(30);
  });

  it('initializes v3 state-level fields', () => {
    const v2State = {
      version: '2.0.0',
      activated: false,
      visitors: [],
      interactions: [],
      reminderActions: [],
      settings: {}
    };

    localStorageMock.setItem('NGOApp_v2_State', JSON.stringify(v2State));
    const migrated = StorageManager.loadState();

    expect(migrated.knownMachines).toEqual({});
    expect(migrated.syncLog).toEqual([]);
  });

  it('returns default state for empty localStorage', () => {
    const state = StorageManager.loadState();
    expect(state.version).toBe(APP_VERSION);
    expect(state.visitors).toEqual([]);
    expect(state.knownMachines).toEqual({});
    expect(state.settings.messageTemplates).toBeDefined();
  });

  // Migration runs whenever state.version !== APP_VERSION (storage.js:26). With
  // APP_VERSION now '3.0.2', a stored '3.0.0' state DOES re-run migration —
  // but the migration is idempotent (uses `||` defaults) so all user data is
  // preserved. This test guarantees that idempotency property, regardless of
  // whether migration runs or not.
  it('preserves user data when reloading a v3 state (idempotency check)', () => {
    const v3State = {
      version: '3.0.0',
      activated: true,
      machineId: 'm1',
      machineRole: 'root',
      machineName: 'Root',
      visitors: [{ id: 'v1', consentGiven: true, doNotContact: true }],
      interactions: [{ id: 'i1', outcome: 'successful', duration: 10 }],
      reminderActions: [],
      settings: { organizationName: 'My NGO', messageTemplates: { birthday: 'Custom!' } },
      knownMachines: { m2: 'Phone' },
      syncLog: [{ ts: '2026-04-01' }]
    };

    localStorageMock.setItem('NGOApp_v2_State', JSON.stringify(v3State));
    const loaded = StorageManager.loadState();

    // Should NOT have been migrated — returned as-is
    expect(loaded.visitors[0].consentGiven).toBe(true);
    expect(loaded.visitors[0].doNotContact).toBe(true);
    expect(loaded.interactions[0].outcome).toBe('successful');
    expect(loaded.interactions[0].duration).toBe(10);
    expect(loaded.settings.organizationName).toBe('My NGO');
    expect(loaded.settings.messageTemplates.birthday).toBe('Custom!');
    expect(loaded.knownMachines.m2).toBe('Phone');
  });

  // ─── Iteration 10: forward-migration of occasions/campaigns/settings ───
  it('back-fills Iter 10 occasions/campaigns/settings onto a v3.0.7 state', () => {
    const v307 = {
      version: '3.0.7', activated: true, machineId: 'm1', machineRole: 'root', machineName: 'Root',
      visitors: [{ id: 'v1', consentGiven: true }],
      interactions: [{ id: 'i1', interactionType: 'sms' }],
      reminderActions: [], settings: { organizationName: 'My NGO' }, knownMachines: {}, syncLog: []
    };
    localStorageMock.setItem('NGOApp_v2_State', JSON.stringify(v307));
    const loaded = StorageManager.loadState();

    // New collections present
    expect(Array.isArray(loaded.occasions)).toBe(true);
    expect(loaded.occasions.length).toBeGreaterThanOrEqual(5);
    expect(loaded.occasions.some(o => o.id === 'occasion_republic_day')).toBe(true);
    expect(loaded.campaigns).toEqual([]);
    // New settings with defaults
    expect(loaded.settings.taglineMr).toBe('चला जरा वेगळे जगुया ...');
    expect(loaded.settings.notificationsEnabled).toBe(false);
    expect(loaded.settings.defaultCampaignLanguage).toBe('mr');
    // Existing data untouched
    expect(loaded.visitors[0].consentGiven).toBe(true);
    expect(loaded.interactions[0].interactionType).toBe('sms');
    expect(loaded.settings.organizationName).toBe('My NGO');
  });

  it('ensureForwardFields is idempotent and respects user-cleared occasions + user settings', () => {
    const state = {
      version: '3.0.7', visitors: [], interactions: [], reminderActions: [],
      occasions: [], campaigns: [{ id: 'c1' }],
      settings: { taglineMr: 'Custom tag', notificationsEnabled: true },
      knownMachines: {}, syncLog: []
    };
    StorageManager.ensureForwardFields(state);
    // Empty occasions array left as-is (user cleared) — NOT reseeded
    expect(state.occasions).toEqual([]);
    // Existing campaign + user settings preserved
    expect(state.campaigns).toEqual([{ id: 'c1' }]);
    expect(state.settings.taglineMr).toBe('Custom tag');
    expect(state.settings.notificationsEnabled).toBe(true);
    // Missing fields filled
    expect(state.settings.defaultCampaignLanguage).toBe('mr');
    // Second run is a no-op
    expect(StorageManager.ensureForwardFields(state)).toBe(false);
  });

  it('default state includes seeded occasions and empty campaigns', () => {
    const def = StorageManager.getDefaultState();
    expect(def.occasions.length).toBeGreaterThanOrEqual(5);
    expect(def.campaigns).toEqual([]);
    expect(def.settings.taglineMr).toContain('जगुया');
  });
});
