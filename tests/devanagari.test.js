/**
 * INITIATIVE.md P1.1 / P1.2 / D-18 — the fold key.
 *
 * These NGOs type Marathi with a transliteration keyboard: Latin in, Devanagari
 * out. The IME offers several candidates for the same keystrokes, so the same
 * name typed twice rarely comes back byte-identical, and a volunteer in a hurry
 * may accept the plain Latin candidate instead. Both halves of that problem are
 * pinned here.
 *
 * The must-NOT-match block is the important one. A fold that collapses
 * everything would score 100% on the positive cases and be useless — worse
 * than useless, since D-18 lets this drive duplicate suggestions.
 */

import { describe, it, expect } from 'vitest';
import { foldKey, namesLikelySame, normalizeText, scriptOf } from '../src/utils/devanagari.js';

describe('foldKey — the same person, typed differently', () => {
    const same = [
        ['सुनीता', 'सुनिता', 'long vs short i — the commonest IME variance'],
        ['नितीन', 'नीतिन', 'both matras swapped'],
        ['अनुजा', 'अनूजा', 'short vs long u'],
        ['रमेश', 'रमेष', 'श vs ष'],

        // across scripts — guaranteed to occur, because the IME offers both
        ['सुनीता', 'Sunita', 'Devanagari record vs Latin record'],
        ['सुनीता', 'Suneeta', 'Latin spelling variant'],
        ['रमेश', 'Ramesh', 'script mix'],
        ['विजय', 'Vijay', 'inherent schwa — vijy would be wrong'],
        ['मंगल', 'Mangal', 'anusvara must not suppress the schwa'],
        ['भाऊ पाटील', 'Bhau Patil', 'aspirate across two words'],
        ['ठाकूर', 'Thakur', 'aspirated th'],
        ['क़ादिर', 'कादिर', 'nukta present vs absent'],

        // irregular conjuncts, which are romanised inconsistently
        ['ज्ञानेश्वर', 'Dnyaneshwar', 'ज्ञ read the Marathi way'],
        ['ज्ञानेश्वर', 'Gyaneshwar', 'ज्ञ read the Hindi way — same key'],
        ['लक्ष्मी', 'Lakshmi', 'क्ष with a virama after it: no schwa'],
        ['क्षमा', 'Kshama', 'क्ष with a vowel after it: schwa present'],
        ['मित्रा', 'Mitra', 'त्र'],
        ['श्रीकांत', 'Shrikant', 'श्र']
    ];

    same.forEach(([a, b, why]) => {
        it(`${a} ≡ ${b} — ${why}`, () => {
            expect(foldKey(a)).toBe(foldKey(b));
        });
    });
});

describe('foldKey — different people must stay different', () => {
    // If this block ever goes green by collapsing, the fold is too aggressive to
    // drive duplicate suggestions and D-18's safety margin is gone.
    const different = [
        ['सुनीता', 'सुजाता'],
        ['रमेश', 'राजेश'],
        ['विजय', 'विनय'],
        ['मंगल', 'मंगेश'],
        ['अनिल', 'अनिता'],
        ['सुनीता पाटील', 'सुनीता जाधव'],
        ['Ramesh', 'Rajesh'],
        ['ज्ञानेश्वर', 'ज्ञानदेव']
    ];

    different.forEach(([a, b]) => {
        it(`${a} ≠ ${b}`, () => {
            expect(foldKey(a)).not.toBe(foldKey(b));
        });
    });
});

describe('normalizeText — NFC (P1.2)', () => {
    it('makes precomposed and decomposed nukta forms equal', () => {
        const precomposed = 'क़';            // क़
        const decomposed = 'क़';       // क + nukta
        expect(precomposed).not.toBe(decomposed);
        expect(normalizeText(precomposed)).toBe(normalizeText(decomposed));
    });

    it('is null-safe', () => {
        expect(normalizeText(null)).toBe('');
        expect(normalizeText(undefined)).toBe('');
        expect(normalizeText('')).toBe('');
    });
});

describe('namesLikelySame — a suggestion, not a merge (D-18)', () => {
    it('matches names that differ only by IME choice', () => {
        expect(namesLikelySame('सुनीता पाटील', 'Sunita Patil')).toBe(true);
    });

    it('does NOT treat two blanks as the same person', () => {
        // Under D-07 a nameless visitor is normal. Answering "yes" here would
        // suggest merging every unnamed record into one, which destroys data.
        expect(namesLikelySame('', '')).toBe(false);
        expect(namesLikelySame(null, null)).toBe(false);
        expect(namesLikelySame('', 'सुनीता')).toBe(false);
    });
});

describe('foldKey — edge cases that must not throw', () => {
    it('handles empty and nullish input', () => {
        expect(foldKey('')).toBe('');
        expect(foldKey(null)).toBe('');
        expect(foldKey(undefined)).toBe('');
    });

    it('drops punctuation and collapses whitespace', () => {
        expect(foldKey('  सुनीता,  पाटील  ')).toBe(foldKey('सुनीता पाटील'));
    });

    it('survives digits, emoji and mixed scripts without throwing', () => {
        expect(() => foldKey('सुनीता 9822012345 🙏 Patil')).not.toThrow();
        expect(foldKey('सुनीता 🙏')).toBe(foldKey('Sunita'));
    });

    it('never emits a control character', () => {
        // Regression: the first cut used delimiter markers that survived into
        // the output, so every key silently carried U+0001 and cross-script
        // comparison failed while looking correct in a terminal.
        for (const name of ['ज्ञानेश्वर', 'लक्ष्मी', 'सुनीता', 'श्रीकांत']) {
            // eslint-disable-next-line no-control-regex
            expect(foldKey(name)).not.toMatch(/[\u0000-\u001F]/);
        }
    });
});

describe('scriptOf', () => {
    it('classifies what it is given', () => {
        expect(scriptOf('सुनीता')).toBe('devanagari');
        expect(scriptOf('Sunita')).toBe('latin');
        expect(scriptOf('सुनीता Patil')).toBe('mixed');
        expect(scriptOf('')).toBe('empty');
        expect(scriptOf('12345')).toBe('other');
    });
});
