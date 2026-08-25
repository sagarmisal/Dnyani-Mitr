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
        // filtering in a spreadsheet afterwards is not producing a report.
        //
        // The first version of this asserted `generateVisitorCSV.length > 0`.
        // That was wrong: Function.length counts parameters BEFORE the first
        // default, so a destructured `({from, to} = {})` signature reads as
        // zero arity — the proxy could not see the property. Assert the
        // behaviour instead: a range must actually narrow the result.
        const august = ReportService.generateVisitorCSV({ from: '2026-08-01', to: '2026-08-31' });
        const july = ReportService.generateVisitorCSV({ from: '2026-07-01', to: '2026-07-31' });

        // v1 visited in August, v2 in July. The visit counts must differ.
        const visitsFor = (csv, name) => {
            const row = csv.split(/\r?\n/).find(l => l.includes(name));
            return row ? row.split(',').map(c => c.replace(/^"|"$/g, '')) : [];
        };
        expect(visitsFor(august, 'सुनीता')[8], 'August range shows the August visit').toBe('1');
        expect(visitsFor(july, 'सुनीता')[8], 'July range must not count the August visit').toBe('0');
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
