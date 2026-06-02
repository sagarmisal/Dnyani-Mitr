import { describe, it, expect } from 'vitest';
import OccasionService from '../src/services/OccasionService.js';

const occ = (month, day, id = 'o') => ({ id, month, day });

describe('OccasionService.nextOccurrence', () => {
    it('returns this year when the date is still ahead', () => {
        const d = OccasionService.nextOccurrence(occ(1, 26), new Date(2026, 0, 10));
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(0);
        expect(d.getDate()).toBe(26);
    });

    it('rolls to next year when the date has passed', () => {
        const d = OccasionService.nextOccurrence(occ(1, 26), new Date(2026, 1, 1));
        expect(d.getFullYear()).toBe(2027);
    });

    it('treats today as the occurrence (not next year)', () => {
        const d = OccasionService.nextOccurrence(occ(1, 26), new Date(2026, 0, 26));
        expect(d.getFullYear()).toBe(2026);
        expect(d.getDate()).toBe(26);
    });

    it('clamps Feb 29 to Feb 28 in a non-leap year', () => {
        const d = OccasionService.nextOccurrence(occ(2, 29), new Date(2027, 0, 1));
        expect(d.getMonth()).toBe(1);
        expect(d.getDate()).toBe(28);
    });

    it('keeps Feb 29 in a leap year', () => {
        const d = OccasionService.nextOccurrence(occ(2, 29), new Date(2028, 0, 1));
        expect(d.getMonth()).toBe(1);
        expect(d.getDate()).toBe(29);
    });

    it('returns null for a malformed occasion', () => {
        expect(OccasionService.nextOccurrence({}, new Date())).toBeNull();
        expect(OccasionService.nextOccurrence(null, new Date())).toBeNull();
    });
});

describe('OccasionService.upcomingWithin', () => {
    const occasions = [occ(1, 1, 'jan1'), occ(1, 26, 'rep'), occ(8, 15, 'ind'), occ(12, 31, 'nye')];

    it('filters to the window and sorts soonest-first', () => {
        const up = OccasionService.upcomingWithin(30, new Date(2026, 0, 5), occasions);
        expect(up.map(u => u.occasion.id)).toEqual(['rep']);
        expect(up[0].daysUntil).toBe(21);
        expect(up[0].isoDate).toBe('2026-01-26');
    });

    it('includes today (daysUntil 0)', () => {
        const up = OccasionService.upcomingWithin(7, new Date(2026, 0, 26), occasions);
        expect(up[0].occasion.id).toBe('rep');
        expect(up[0].daysUntil).toBe(0);
    });

    it('returns multiple in soonest order', () => {
        const up = OccasionService.upcomingWithin(400, new Date(2026, 7, 1), occasions);
        // From Aug 1 2026: Aug15 (14d), Dec31 (152d), Jan1'27, Jan26'27
        expect(up.map(u => u.occasion.id)).toEqual(['ind', 'nye', 'jan1', 'rep']);
    });
});
