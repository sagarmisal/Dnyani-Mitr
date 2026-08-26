// @vitest-environment happy-dom
/**
 * INITIATIVE.md P1.14 / D-14 — a backup from the old build still imports.
 *
 * The owner has said re-entry is acceptable in the worst case. This targets
 * zero re-entry anyway: we control both formats, so the importer is cheap, and
 * making volunteers retype two years of work reads to them as the app having
 * failed them even when it has not.
 *
 * The risky part of this rebuild for old data is D-07 and NFC. Records arriving
 * through merge do NOT pass through the model constructors, so an imported name
 * is never normalised on the way in. That is fine — and this proves why:
 * foldKey and compareNames normalise at the point of USE, so search and sort
 * work on un-normalised stored data. Normalising on write is an optimisation,
 * not the guarantee.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/core/activation.js', () => ({
    default: { getMachineInfo: () => ({ machineId: 'm_test', machineName: 'T', machineRole: 'root' }) }
}));

import StateManager from '../src/core/state.js';
import StorageManager from '../src/core/storage.js';
import SyncService from '../src/services/SyncService.js';
import VisitorService from '../src/services/VisitorService.js';
import { foldKey, compareNames } from '../src/utils/devanagari.js';
import { visitorDisplayName } from '../src/utils/formatters.js';

function wipe() {
    localStorage.clear();
    StateManager.init();
    StateManager.state = StorageManager.getDefaultState();
    StorageManager.saveState(StateManager.state);
}

/** A backup shaped the way v3.2.0 wrote them, before any of this phase. */
function legacyBackup() {
    return {
        metadata: {
            app: 'NGO_Visitor_Manager', version: '3.2.0', backupType: 'full',
            collections: ['visitors', 'interactions', 'reminderActions', 'occasions',
                          'campaigns', 'scheduledItems', 'settings', 'syncLog', 'knownMachines'],
            exportedAt: '2026-08-19T00:00:00.000Z', machineId: 'm_old', machineRole: 'root'
        },
        data: {
            visitors: [
                {
                    id: 'visitor_old_1', category: 'Regular', city: 'बारामती', tags: [],
                    isDeleted: false, createdAt: '2025-01-01T00:00:00.000Z',
                    updatedAt: '2025-01-01T00:00:00.000Z', status: 'active', contacts: [
                        { id: 'c1', relationType: 'SELF', name: 'सुनीता पाटील',
                          phones: ['9822012345'], emails: [], dob: '1978-03-14', customEvents: [] },
                        { id: 'c2', relationType: 'CHILD', name: 'अनन्या',
                          phones: [], emails: [], dob: '2015-08-18', customEvents: [] }
                    ]
                },
                {
                    id: 'visitor_old_2', category: '', city: '', tags: [], isDeleted: false,
                    createdAt: '2025-02-01T00:00:00.000Z', updatedAt: '2025-02-01T00:00:00.000Z',
                    status: 'active', contacts: [
                        { id: 'c3', relationType: 'SELF', name: 'Ramesh Jadhav',
                          phones: ['9822012346'], emails: [], customEvents: [] }
                    ]
                }
            ],
            interactions: [
                { id: 'interaction_old_1', visitorId: 'visitor_old_1', interactionType: 'visit',
                  interactionDate: '2025-08-18T12:00:00.000Z', notes: 'भेट दिली' }
            ],
            reminderActions: [],
            occasions: [{ id: 'occasion_diwali', name: 'Diwali', movable: true, dates: {}, builtin: true }],
            campaigns: [],
            scheduledItems: [],
            settings: { organizationName: 'भगवान बाबा बालिकाश्रम' },
            syncLog: [], knownMachines: {}
        }
    };
}

describe('a v3.2.0 backup restores into the rebuild (P1.14)', () => {
    beforeEach(wipe);

    it('brings every collection back, with nothing lost', () => {
        const pkg = legacyBackup();
        const result = SyncService.restoreFullBackup(pkg);
        expect(result).toBeTruthy();

        const state = StateManager.getState();
        expect(state.visitors).toHaveLength(2);
        expect(state.interactions).toHaveLength(1);
        expect(state.occasions).toHaveLength(1);
        expect(state.settings.organizationName).toBe('भगवान बाबा बालिकाश्रम');
    });

    it('keeps the family contact that carries next year’s reminder', () => {
        // DF-3: this is the flow that compounds. Losing the CHILD contact
        // would quietly cost the NGO every future birthday reminder for her.
        SyncService.restoreFullBackup(legacyBackup());
        const v = StateManager.getState().visitors.find(x => x.id === 'visitor_old_1');
        const child = v.contacts.find(c => c.relationType === 'CHILD');
        expect(child).toBeTruthy();
        expect(child.dob).toBe('2015-08-18');
    });

    it('finds restored Devanagari names from a Latin query', () => {
        // The point of the phase: old data becomes searchable the new way
        // without being rewritten.
        SyncService.restoreFullBackup(legacyBackup());
        const found = VisitorService.search('sunita');
        expect(found).toHaveLength(1);
        expect(found[0].id).toBe('visitor_old_1');
    });

    it('finds restored records by phone, including with spaces', () => {
        SyncService.restoreFullBackup(legacyBackup());
        expect(VisitorService.findByPhone('9822012345')).toBeTruthy();
        expect(VisitorService.search('98220 12346')).toHaveLength(1);
    });

    it('displays restored visitors without blanks', () => {
        SyncService.restoreFullBackup(legacyBackup());
        StateManager.getState().visitors.forEach(v => {
            expect(visitorDisplayName(v)).toBeTruthy();
            expect(visitorDisplayName(v)).not.toBe('');
        });
    });

    it('survives a restore twice — importing is idempotent, not additive', () => {
        SyncService.restoreFullBackup(legacyBackup());
        SyncService.restoreFullBackup(legacyBackup());
        expect(StateManager.getState().visitors).toHaveLength(2);
    });
});

describe('normalisation is applied at the point of use, not only on write', () => {
    it('folds a name that was never normalised on the way in', () => {
        // Merge does not run records through the model constructors, so stored
        // names can be in either Unicode form. Both must still match.
        // Built from code points, not literals: a literal pair can be silently
        // normalised by an editor or a shell, and the test then proves nothing.
        const precomposed = '\u0958\u093E\u0926\u093F\u0930';          // क़ादिर
        const decomposed  = '\u0915\u093C\u093E\u0926\u093F\u0930';   // क + nukta
        expect(decomposed).not.toBe(precomposed);
        expect(foldKey(decomposed)).toBe(foldKey(precomposed));
    });

    it('sorts un-normalised names correctly too', () => {
        expect(compareNames('\u0958\u093E', '\u0915\u093C\u093E')).toBe(0);
    });
});
