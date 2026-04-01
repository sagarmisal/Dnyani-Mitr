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

    expect(migrated.version).toBe('3.0.0');

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
    expect(state.version).toBe('3.0.0');
    expect(state.visitors).toEqual([]);
    expect(state.knownMachines).toEqual({});
    expect(state.settings.messageTemplates).toBeDefined();
  });

  it('does not re-migrate v3 state', () => {
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
});
