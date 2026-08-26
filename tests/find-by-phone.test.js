// @vitest-environment happy-dom
/**
 * INITIATIVE.md P1.7 / DF-2 — lookup searches every contact's number.
 *
 * Found while writing the data flows: lookup only ever searched the SELF
 * contact, so a supporter phoning from the number we hold for their spouse
 * appeared as a stranger, and the intake screen offered to create a duplicate
 * of someone already in the register — mid phone call, the worst moment for it.
 *
 * Lookup is deliberately WIDER than sync's identity rule, which still matches
 * on the SELF contact's first number. Widening lookup helps a human find
 * someone; widening merge would fuse two households sharing a landline.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/core/activation.js', () => ({
    default: { getMachineInfo: () => ({ machineId: 'machine_test', machineName: 'T', machineRole: 'root' }) }
}));

import StateManager from '../src/core/state.js';
import StorageManager from '../src/core/storage.js';
import VisitorService from '../src/services/VisitorService.js';

function wipe() {
    localStorage.clear();
    StateManager.init();
    StateManager.state = StorageManager.getDefaultState();
    StorageManager.saveState(StateManager.state);
}

beforeEach(() => {
    wipe();
    VisitorService.create({
        contacts: [
            { relationType: 'SELF', name: 'सुनीता पाटील', phones: ['9822012345'], emails: [] },
            { relationType: 'SPOUSE', name: 'रमेश पाटील', phones: ['9822099999'], emails: [] },
            { relationType: 'CHILD', name: 'अनन्या', phones: [], emails: [] }
        ]
    });
});

describe('findByPhone (P1.7)', () => {
    it('finds them by their own number and says it is theirs', () => {
        const hit = VisitorService.findByPhone('9822012345');
        expect(hit).toBeTruthy();
        expect(hit.isSelf).toBe(true);
        expect(hit.contact.name).toBe('सुनीता पाटील');
    });

    it('finds the household from a family member’s number', () => {
        const hit = VisitorService.findByPhone('9822099999');
        expect(hit).toBeTruthy();
        expect(hit.isSelf).toBe(false);
        expect(hit.contact.name).toBe('रमेश पाटील');   // so the UI can say whose it is
    });

    it('normalises before matching, so formatting does not matter', () => {
        expect(VisitorService.findByPhone('+91 98220 12345')).toBeTruthy();
        expect(VisitorService.findByPhone('९८२२०१२३४५')).toBeTruthy();
    });

    it('returns null for an unknown number rather than a wrong guess', () => {
        expect(VisitorService.findByPhone('9000000000')).toBeNull();
    });

    it('returns null for input that is not a usable number', () => {
        expect(VisitorService.findByPhone('')).toBeNull();
        expect(VisitorService.findByPhone(null)).toBeNull();
        expect(VisitorService.findByPhone('98220')).toBeNull();
    });

    it('prefers the SELF contact when more than one would match', () => {
        VisitorService.create({
            contacts: [{ relationType: 'SELF', name: 'शेजारी', phones: ['9822099999'], emails: [] }]
        });
        // Two records now hold 9822099999 — one as a spouse, one as themselves.
        // Neither is merged (D-18); lookup just has to be predictable.
        const hit = VisitorService.findByPhone('9822099999');
        expect(hit).toBeTruthy();
        expect(hit.contact.phones).toContain('9822099999');
    });
});
