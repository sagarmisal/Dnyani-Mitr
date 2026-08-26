// @vitest-environment happy-dom
/**
 * J5 — Never lose the register.
 *
 * The one that decides whether any of the rest matters. A dead phone must cost
 * nothing, and the way back must be reachable without being told where it is.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
vi.mock('../../src/core/activation.js', () => ({
    default: { getMachineInfo: () => ({ machineId: 'm', machineName: 'Office', machineRole: 'root' }) }
}));
import StateManager from '../../src/core/state.js';
import StorageManager from '../../src/core/storage.js';
import SyncService from '../../src/services/SyncService.js';

function seed() {
    localStorage.clear(); StateManager.init();
    const st = StorageManager.getDefaultState();
    st.visitors = [{ id: 'v1', isDeleted: false, status: 'active',
        contacts: [
            { relationType: 'SELF', name: 'सुनीता पाटील', phones: ['9822012345'], emails: [] },
            { relationType: 'CHILD', name: 'अनन्या', phones: [], emails: [], dob: '2015-08-18' }
        ] }];
    st.interactions = [{ id: 'i1', visitorId: 'v1', interactionType: 'visit',
        interactionDate: '2025-08-24T12:00:00.000Z', contribution: ['meal'], thankedAt: null }];
    st.occasions = [{ id: 'o1', name: 'Diwali', movable: true, dates: {}, builtin: true }];
    st.campaigns = [{ id: 'c1', sentCount: 5 }];
    st.settings = { ...st.settings, organizationName: 'भगवान बाबा बालिकाश्रम' };
    StateManager.state = st; StorageManager.saveState(st);
}
beforeEach(seed);

describe('J5 · never lose the register', () => {
    it('a dead phone costs nothing — backup, wipe, restore', () => {
        const pkg = SyncService.prepareFullBackup();
        StateManager.state = StorageManager.getDefaultState();
        StorageManager.saveState(StateManager.state);
        SyncService.restoreFullBackup(JSON.parse(JSON.stringify(pkg)));

        const s = StateManager.getState();
        expect(s.visitors).toHaveLength(1);
        expect(s.occasions).toHaveLength(1);
        expect(s.campaigns).toHaveLength(1);
        expect(s.settings.organizationName).toBe('भगवान बाबा बालिकाश्रम');
        expect(s.visitors[0].contacts.find(c => c.relationType === 'CHILD').dob).toBe('2015-08-18');
    });

    it('every collection is declared, so a missing one is detectable', () => {
        const pkg = SyncService.prepareFullBackup();
        ['visitors','interactions','reminderActions','occasions','campaigns',
         'scheduledItems','settings','syncLog','knownMachines'].forEach(k =>
            expect(pkg.metadata.collections).toContain(k));
    });

    it('the way back is REACHABLE without being told where it is', () => {
        // The defect that would have cost a register: the nav lost the Sync tab
        // and no replacement door was added.
        const settings = readFileSync('src/components/Settings/SettingsPage.js', 'utf8');
        expect(settings, 'Settings does not link to Sync').toContain('ROUTES.SYNC');
    });

    it('an accidental restore is recoverable', () => {
        SyncService.merge(JSON.parse(JSON.stringify(SyncService.prepareFullBackup())));
        expect(localStorage.getItem('NGOApp_v2_PreSyncBackup')).toBeTruthy();
    });
});
