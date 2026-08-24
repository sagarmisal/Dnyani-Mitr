/**
 * INITIATIVE.md P1.5 / PR-1 — the phone number is the identity key.
 *
 * It is the one field we ask people to get right, the natural key for a
 * visitor, and the secondary match in sync merge. Anything that silently
 * turns a real number into null costs a person their identity: dedup misses
 * them, sync will not match them, and next year's reminder never finds them.
 */

import { describe, it, expect } from 'vitest';
import { normalizePhone } from '../src/utils/formatters.js';
import { VALIDATION } from '../src/utils/constants.js';

describe('normalizePhone — digits from any layout (P1.5)', () => {
    const ten = '9822012345';

    it('accepts ASCII digits', () => {
        expect(normalizePhone('9822012345')).toBe(ten);
    });

    it('accepts Devanagari digits, which used to yield null', () => {
        expect(normalizePhone('९८२२०१२३४५')).toBe(ten);
    });

    it('accepts Arabic-Indic digits', () => {
        expect(normalizePhone('٩٨٢٢٠١٢٣٤٥')).toBe(ten);
    });

    it('accepts a number half-typed in each script', () => {
        expect(normalizePhone('९८२२० 12345')).toBe(ten);
    });

    it('still strips country codes, spaces and punctuation', () => {
        expect(normalizePhone('+91 98220 12345')).toBe(ten);
        expect(normalizePhone('(98220) 12345')).toBe(ten);
        expect(normalizePhone('98220-12345')).toBe(ten);
    });

    it('still refuses anything shorter than ten digits', () => {
        // Better to hold no number than a wrong one: under last-ten-digit
        // dedup a partial number can merge two unrelated supporters.
        expect(normalizePhone('98220')).toBeNull();
        expect(normalizePhone('९८२२०')).toBeNull();
    });

    it('is null-safe', () => {
        expect(normalizePhone(null)).toBeNull();
        expect(normalizePhone(undefined)).toBeNull();
        expect(normalizePhone('')).toBeNull();
        expect(normalizePhone('   ')).toBeNull();
    });

    it('never throws on rubbish', () => {
        expect(() => normalizePhone('सुनीता')).not.toThrow();
        expect(() => normalizePhone('🙏')).not.toThrow();
    });
});

describe('PHONE_PATTERN — validation must not reject a valid number (P1.5)', () => {
    it('accepts a number typed on a Devanagari layout', () => {
        // It used to fail with "invalid phone" on a number that looked
        // perfectly valid to the person who typed it — an error they could
        // not act on, so they would invent a number or record nothing.
        expect(VALIDATION.PHONE_PATTERN.test('९८२२०१२३४५')).toBe(true);
    });

    it('still accepts ordinary formats', () => {
        ['9822012345', '+91 98220 12345', '(98220) 12345'].forEach(p =>
            expect(VALIDATION.PHONE_PATTERN.test(p)).toBe(true));
    });

    it('still rejects letters', () => {
        expect(VALIDATION.PHONE_PATTERN.test('call me')).toBe(false);
        expect(VALIDATION.PHONE_PATTERN.test('सुनीता')).toBe(false);
    });
});
