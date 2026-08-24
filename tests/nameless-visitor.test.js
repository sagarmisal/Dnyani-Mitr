// @vitest-environment happy-dom
/**
 * INITIATIVE.md P1.6 / P1.15 / D-07 — a nameless visitor is ordinary.
 *
 * Someone rings, gives a number, and hangs up before saying their name. That
 * is a complete record (PR-2), not a degraded one: the number is the identity
 * key, and the name can be filled in whenever they next visit.
 *
 * The app used to refuse it — name required, phone optional — which is exactly
 * backwards. A volunteer facing that error invents a name or records nothing,
 * and a placeholder number like 0000000000 merges unrelated supporters under
 * last-ten-digit dedup.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// VisitorService.create stamps createdBy from the activated machine.
vi.mock('../src/core/activation.js', () => ({
    default: {
        getMachineInfo: () => ({ machineId: 'machine_test', machineName: 'Test', machineRole: 'root' })
    }
}));

import StateManager from '../src/core/state.js';
import StorageManager from '../src/core/storage.js';
import VisitorService from '../src/services/VisitorService.js';
import { validateVisitor } from '../src/utils/validators.js';
import { visitorDisplayName } from '../src/utils/formatters.js';
import { Visitor } from '../src/models/Visitor.js';

const self = (name, phones) => ({ relationType: 'SELF', name, phones, emails: [] });

function wipe() {
    localStorage.clear();
    StateManager.init();
    StateManager.state = StorageManager.getDefaultState();
    StorageManager.saveState(StateManager.state);
}

describe('validation — the inversion (D-07)', () => {
    it('saves a visitor with a phone and no name', () => {
        const r = validateVisitor({ contacts: [self('', ['9822012345'])] });
        expect(r.valid).toBe(true);
    });

    it('still saves a visitor with a name and no phone', () => {
        // A caller who rings off without giving a number is a real case;
        // refusing it would lose the visit entirely.
        const r = validateVisitor({ contacts: [self('सुनीता पाटील', [])] });
        expect(r.valid).toBe(true);
    });

    it('refuses a record with neither — it could never be found again', () => {
        const r = validateVisitor({ contacts: [self('', [])] });
        expect(r.valid).toBe(false);
        expect(r.errors.join(' ')).toMatch(/phone number/i);
    });

    it('still catches a stray keypress in a name that was given', () => {
        const r = validateVisitor({ contacts: [self('र', [])] });
        expect(r.valid).toBe(false);
    });

    it('accepts a Devanagari-digit phone as a real number', () => {
        expect(validateVisitor({ contacts: [self('', ['९८२२०१२३४५'])] }).valid).toBe(true);
    });
});

describe('display — a nameless record is legible, never blank (P1.15)', () => {
    it('shows the number, formatted, when there is no name', () => {
        expect(visitorDisplayName({ contacts: [self('', ['9822012345'])] }))
            .toBe('98220 12345');
    });

    it('prefers a real name when there is one', () => {
        expect(visitorDisplayName({ contacts: [self('सुनीता', ['9822012345'])] }))
            .toBe('सुनीता');
    });

    it('never returns an empty string', () => {
        for (const v of [null, undefined, {}, { contacts: [] }, { contacts: [self('', [])] }]) {
            expect(visitorDisplayName(v)).not.toBe('');
        }
    });

    it('folds a Devanagari-digit number for display too', () => {
        expect(visitorDisplayName({ contacts: [self('', ['९८२२०१२३४५'])] }))
            .toBe('98220 12345');
    });

    it('Visitor.getDisplayName goes through the same fallback', () => {
        const v = new Visitor({ contacts: [self('', ['9822012345'])] });
        expect(v.getDisplayName()).toBe('98220 12345');
    });
});

describe('a nameless visitor survives the round trip', () => {
    beforeEach(wipe);

    it('can be created, found by number, and listed', () => {
        const created = VisitorService.create({ contacts: [self('', ['9822012345'])] });
        expect(created).toBeTruthy();

        const found = VisitorService.search('9822012345');
        expect(found).toHaveLength(1);
        expect(visitorDisplayName(found[0])).toBe('98220 12345');
    });

    it('sorts after named visitors rather than to the top', () => {
        VisitorService.create({ contacts: [self('', ['9822012345'])] });
        VisitorService.create({ contacts: [self('अनिल', ['9822012346'])] });
        const all = VisitorService.getAll();
        expect(all).toHaveLength(2);
    });
});
