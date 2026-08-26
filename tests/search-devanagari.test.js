// @vitest-environment happy-dom
/**
 * INITIATIVE.md P1.2 — search across the two scripts one NGO actually holds.
 *
 * Volunteers type with a transliteration keyboard, so records arrive in
 * Devanagari, in Latin, and in both spellings of the same Devanagari name.
 * Search has to reach all of them from whatever the person types now.
 *
 * The additive property is the safety guarantee: fold matching can only widen
 * a result set, never narrow it, so no search that worked before stops working.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import StateManager from '../src/core/state.js';
import StorageManager from '../src/core/storage.js';
import VisitorService from '../src/services/VisitorService.js';
import { Visitor } from '../src/models/Visitor.js';
import { Contact } from '../src/models/Contact.js';

function makeVisitor(name, phone, extra = {}) {
    const self = new Contact({ relationType: 'SELF', name, phones: phone ? [phone] : [] });
    const v = new Visitor({ contacts: [JSON.parse(JSON.stringify(self))], ...extra });
    return JSON.parse(JSON.stringify(v));
}

// localStorage.clear() alone does not reset StateManager — it holds state in
// memory and only reads storage on init. Reset both, as the other suites do.
function wipe() {
    localStorage.clear();
    StateManager.init();                    // sets the `initialized` flag
    StateManager.state = StorageManager.getDefaultState();
    StorageManager.saveState(StateManager.state);
}

const names = (results) =>
    results.map(v => v.contacts.find(c => c.relationType === 'SELF')?.name).sort();

describe('search across scripts (P1.2)', () => {
    beforeEach(() => {
        wipe();
        [
            makeVisitor('सुनीता पाटील', '9822012345'),
            makeVisitor('Ramesh Jadhav', '9822012346'),
            makeVisitor('ज्ञानेश्वर शिंदे', '9822012347'),
            makeVisitor('मंगल कुलकर्णी', '9822012348'),
            makeVisitor('सुजाता देशमुख', '9822012349')
        ].forEach(v => StateManager.addVisitor(v));
    });

    it('finds a Devanagari record from a Latin query — the point of the fold', () => {
        expect(names(VisitorService.search('sunita'))).toContain('सुनीता पाटील');
    });

    it('finds it from a different Latin spelling', () => {
        expect(names(VisitorService.search('suneeta'))).toContain('सुनीता पाटील');
    });

    it('finds a Devanagari record typed with the other matra', () => {
        // The IME offers both; whichever the searcher picks must still find it.
        expect(names(VisitorService.search('सुनिता'))).toContain('सुनीता पाटील');
    });

    it('finds a Latin record from a Devanagari query', () => {
        expect(names(VisitorService.search('रमेश'))).toContain('Ramesh Jadhav');
    });

    it('resolves ज्ञ from either language reading', () => {
        expect(names(VisitorService.search('dnyaneshwar'))).toContain('ज्ञानेश्वर शिंदे');
        expect(names(VisitorService.search('gyaneshwar'))).toContain('ज्ञानेश्वर शिंदे');
    });

    it('does not drag in a different person', () => {
        const found = names(VisitorService.search('sunita'));
        expect(found).not.toContain('सुजाता देशमुख');
        expect(found).not.toContain('मंगल कुलकर्णी');
    });

    it('matches a surname, not only the first name', () => {
        expect(names(VisitorService.search('patil'))).toContain('सुनीता पाटील');
    });
});

describe('search is additive — nothing that worked before breaks (P1.2)', () => {
    beforeEach(() => {
        wipe();
        [
            makeVisitor('Ramesh Jadhav', '9822012346', { city: 'Baramati', notes: 'brings books' }),
            makeVisitor('सुनीता पाटील', '9822012345', { category: 'Donor' })
        ].forEach(v => StateManager.addVisitor(v));
    });

    it('still matches plain Latin substrings', () => {
        expect(VisitorService.search('Ramesh')).toHaveLength(1);
    });

    it('still matches city, category and notes', () => {
        expect(VisitorService.search('Baramati')).toHaveLength(1);
        expect(VisitorService.search('Donor')).toHaveLength(1);
        expect(VisitorService.search('books')).toHaveLength(1);
    });

    it('still matches an exact phone number', () => {
        expect(VisitorService.search('9822012345')).toHaveLength(1);
    });

    it('matches a phone typed with a space, which it could not before', () => {
        expect(VisitorService.search('98220 12345')).toHaveLength(1);
    });

    it('returns everything for an empty query', () => {
        expect(VisitorService.search('')).toHaveLength(2);
        expect(VisitorService.search('   ')).toHaveLength(2);
    });

    it('finds nothing for a query that matches nothing', () => {
        expect(VisitorService.search('zzzzz')).toHaveLength(0);
    });
});

describe('NFC on write (P1.2)', () => {
    it('stores one normalised form whatever the keyboard produced', () => {
        const precomposed = new Contact({ name: 'क़ादिर' });
        const decomposed = new Contact({ name: 'क़ादिर' });   // क + nukta
        expect(precomposed.name).toBe(decomposed.name);
    });

    it('leaves a plain Latin name untouched', () => {
        expect(new Contact({ name: 'Ramesh Jadhav' }).name).toBe('Ramesh Jadhav');
    });

    it('is safe when no name is given — D-07 makes that normal', () => {
        expect(new Contact({}).name).toBe('');
        expect(new Contact({ name: null }).name).toBe('');
    });
});
