// @vitest-environment happy-dom
/**
 * ReportService — characterization first (protocol step 2).
 *
 * This service had no test of any kind, and J4 is being built on top of it. So
 * these pin what it does TODAY before anything changes. If a later edit alters
 * one of these, that is a behaviour change and must be deliberate.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('../src/core/activation.js', () => ({
    default: { getMachineInfo: () => ({ machineId: 'm', machineName: 'T', machineRole: 'root' }) }
}));
import StateManager from '../src/core/state.js';
import StorageManager from '../src/core/storage.js';
import ReportService from '../src/services/ReportService.js';

const iso = (y, m, d) => new Date(Date.UTC(y, m - 1, d, 12)).toISOString();

function seed() {
    localStorage.clear(); StateManager.init();
    const st = StorageManager.getDefaultState();
    st.visitors = [
        { id: 'v1', isDeleted: false, status: 'active', city: 'बारामती', category: 'Regular', tags: ['donor'],
          contacts: [{ relationType: 'SELF', name: 'सुनीता पाटील', phones: ['9822012345'], emails: ['s@x.com'] }] },
        { id: 'v2', isDeleted: false, status: 'active', city: '', category: '', tags: [],
          contacts: [{ relationType: 'SELF', name: 'Ramesh Jadhav', phones: ['9822012346'], emails: [] }] },
        { id: 'v3', isDeleted: true, status: 'deleted', city: '', category: '', tags: [],
          contacts: [{ relationType: 'SELF', name: 'Deleted Person', phones: ['9822012347'], emails: [] }] }
    ];
    st.interactions = [
        { id: 'i1', visitorId: 'v1', interactionType: 'visit', interactionDate: iso(2026, 8, 10),
          contribution: ['meal', 'books'], thankedAt: null, notes: 'जेवण' },
        { id: 'i2', visitorId: 'v2', interactionType: 'visit', interactionDate: iso(2026, 7, 2),
          contribution: [], thankedAt: null, notes: '' },
        { id: 'i3', visitorId: 'v1', interactionType: 'call', interactionDate: iso(2026, 8, 20),
          contribution: [], thankedAt: null, notes: '' }
    ];
    StateManager.state = st; StorageManager.saveState(st);
}
beforeEach(seed);

describe('generateVisitorCSV — as it behaves today', () => {
    it('emits a header row and one row per live visitor', () => {
        const rows = ReportService.generateVisitorCSV().split(/\r?\n/).filter(Boolean);
        expect(rows.length).toBe(3);          // header + v1 + v2, not the deleted one
    });

    it('carries Marathi through', () => {
        expect(ReportService.generateVisitorCSV()).toContain('सुनीता पाटील');
    });

    it('quotes fields and escapes embedded quotes', () => {
        const st = StateManager.getState();
        st.visitors[0].contacts[0].name = 'सुनीता "ताई" पाटील';
        StateManager.state = st;
        expect(ReportService.generateVisitorCSV()).toContain('""ताई""');
    });

    it('excludes deleted visitors', () => {
        expect(ReportService.generateVisitorCSV()).not.toContain('Deleted Person');
    });
});

describe('generateMonthlyTextReport — as it behaves today', () => {
    it('produces text naming the month', () => {
        const txt = ReportService.generateMonthlyTextReport(new Date(Date.UTC(2026, 7, 15)));
        expect(typeof txt).toBe('string');
        expect(txt.length).toBeGreaterThan(20);
    });

    it('does not throw on an empty register', () => {
        const st = StorageManager.getDefaultState();
        StateManager.state = st;
        expect(() => ReportService.generateMonthlyTextReport()).not.toThrow();
    });
});
