// @vitest-environment happy-dom
/**
 * J4 — Prove the work. Numbers for trustees and donors.
 *
 * EXPECTED TO FAIL when written. The tab labelled अहवाल routes to My Day,
 * ReportService has no test of any kind, and the Reports screen was never
 * built. A coordinator cannot produce a trustee report today.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/core/activation.js', () => ({
    default: { getMachineInfo: () => ({ machineId: 'm', machineName: 'T', machineRole: 'root' }) }
}));

import StateManager from '../../src/core/state.js';
import StorageManager from '../../src/core/storage.js';
import ReportService from '../../src/services/ReportService.js';

function seed() {
    localStorage.clear();
    StateManager.init();
    const st = StorageManager.getDefaultState();
    st.visitors = [
        { id: 'v1', isDeleted: false, status: 'active', city: 'बारामती', category: 'Regular',
          contacts: [{ relationType: 'SELF', name: 'सुनीता पाटील', phones: ['9822012345'], emails: [] }] },
        { id: 'v2', isDeleted: false, status: 'active', city: '', category: '',
          contacts: [{ relationType: 'SELF', name: 'Ramesh Jadhav', phones: ['9822012346'], emails: [] }] }
    ];
    st.interactions = [
        { id: 'i1', visitorId: 'v1', interactionType: 'visit',
          interactionDate: '2026-08-10T12:00:00.000Z', contribution: ['meal'], thankedAt: null },
        { id: 'i2', visitorId: 'v2', interactionType: 'visit',
          interactionDate: '2026-07-02T12:00:00.000Z', contribution: [], thankedAt: null }
    ];
    StateManager.state = st;
    StorageManager.saveState(st);
}

beforeEach(seed);

describe('J4 · prove the work', () => {
    it('a CSV can be produced at all', () => {
        const csv = ReportService.generateVisitorCSV();
        expect(typeof csv).toBe('string');
        expect(csv.split('\n').length).toBeGreaterThan(1);
    });

    it('Marathi names survive into the CSV', () => {
        expect(ReportService.generateVisitorCSV()).toContain('सुनीता पाटील');
    });

    it('a monthly report can be produced', () => {
        expect(typeof ReportService.generateMonthlyTextReport()).toBe('string');
    });

    it('the coordinator can ask for ONE MONTH, not all of history', () => {
        // A trustee meeting asks about a period. Exporting everything and
        // filtering in a spreadsheet is not producing a report.
        expect(typeof ReportService.generateVisitorCSV,
            'generateVisitorCSV takes no arguments — no date range is possible').toBe('function');
        expect(ReportService.generateVisitorCSV.length,
            'generateVisitorCSV accepts no range parameter').toBeGreaterThan(0);
    });

    it('what was BROUGHT can be counted — the number a trustee asks for', () => {
        // "42 visits, 18 brought a meal" is the sentence this exists to produce.
        const csv = ReportService.generateVisitorCSV();
        expect(csv.toLowerCase(), 'contributions do not appear in the report').toMatch(/meal|जेवण|contribution/);
    });

    it('there IS a reports screen behind the अहवाल tab', async () => {
        const { existsSync } = await import('node:fs');
        expect(existsSync('src/components/Reports/ReportsPage.js'),
            'the अहवाल tab routes to My Day; no Reports screen exists').toBe(true);
    });
});
