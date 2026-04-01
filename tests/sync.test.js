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
    IMPORT_COMPLETED: 'import:completed'
  }
}));

// Mock helpers
vi.mock('../src/utils/helpers.js', () => ({
  safeJSONParse: (data, fallback) => {
    try { return JSON.parse(data); } catch { return fallback; }
  },
  generateId: (prefix) => `${prefix}_${Date.now()}`,
  deepClone: (obj) => JSON.parse(JSON.stringify(obj))
}));

describe('SyncService', () => {
  let SyncService, StateManager;

  beforeEach(async () => {
    localStorageMock.clear();
    vi.resetModules();

    // Initialize state first
    const stateMod = await import('../src/core/state.js');
    StateManager = stateMod.default;
    await StateManager.init();

    const syncMod = await import('../src/services/SyncService.js');
    SyncService = syncMod.default;
  });

  describe('prepareExport', () => {
    it('includes dataVersion in metadata', () => {
      const pkg = SyncService.prepareExport();
      expect(pkg.metadata.dataVersion).toBe('3.0.0');
    });

    it('includes version in metadata', () => {
      const pkg = SyncService.prepareExport();
      expect(pkg.metadata.version).toBe('3.0.0');
    });

    it('includes machine info in metadata', () => {
      const pkg = SyncService.prepareExport();
      expect(pkg.metadata.machineId).toBe('machine_test');
      expect(pkg.metadata.machineName).toBe('Test Machine');
      expect(pkg.metadata.machineRole).toBe('root');
    });

    it('includes exportedAt timestamp', () => {
      const pkg = SyncService.prepareExport();
      expect(pkg.metadata.exportedAt).toBeDefined();
      expect(new Date(pkg.metadata.exportedAt).getTime()).not.toBeNaN();
    });

    it('includes visitors in data', () => {
      const pkg = SyncService.prepareExport();
      expect(pkg.data.visitors).toBeDefined();
      expect(Array.isArray(pkg.data.visitors)).toBe(true);
    });

    it('includes interactions when option is true', () => {
      const pkg = SyncService.prepareExport({ includeInteractions: true });
      expect(pkg.data.interactions).toBeDefined();
    });

    it('excludes interactions when option is false', () => {
      const pkg = SyncService.prepareExport({ includeInteractions: false });
      expect(pkg.data.interactions).toBeUndefined();
    });
  });

  describe('merge version handling', () => {
    it('merges v2 export (no dataVersion) without error', () => {
      const v2Package = {
        visitors: [
          { id: 'v1', contacts: [{ relationType: 'SELF', name: 'Test', phones: [] }], status: 'active', updatedAt: '2026-01-01T00:00:00Z' }
        ],
        interactions: []
      };

      const result = SyncService.merge(v2Package);
      expect(result.visitorsAdded).toBe(1);
    });
  });
});
