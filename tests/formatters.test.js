import { describe, it, expect } from 'vitest';
import { normalizePhone, namesSimilar, isValidDate, getDaysUntil } from '../src/utils/formatters.js';

describe('normalizePhone', () => {
  it('strips non-digits and takes last 10', () => {
    expect(normalizePhone('+91 98765-43210')).toBe('9876543210');
  });

  it('handles plain 10-digit number', () => {
    expect(normalizePhone('9876543210')).toBe('9876543210');
  });

  it('strips leading zero and country code', () => {
    expect(normalizePhone('098765 43210')).toBe('9876543210');
    expect(normalizePhone('919876543210')).toBe('9876543210');
  });

  it('returns null for less than 10 digits', () => {
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('98765')).toBeNull();
  });

  it('returns null for empty/null/undefined', () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });

  it('handles phone with parentheses and spaces', () => {
    expect(normalizePhone('(091) 9876-543210')).toBe('9876543210');
  });
});

describe('namesSimilar', () => {
  it('matches exact names', () => {
    expect(namesSimilar('Suresh Patil', 'Suresh Patil')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(namesSimilar('suresh', 'SURESH')).toBe(true);
  });

  it('matches when one contains the other', () => {
    expect(namesSimilar('Suresh', 'Suresh Patil')).toBe(true);
    expect(namesSimilar('Suresh Patil', 'Suresh')).toBe(true);
  });

  it('matches when first word matches', () => {
    expect(namesSimilar('Suresh R.', 'Suresh Kumar')).toBe(true);
  });

  it('does not match different names', () => {
    expect(namesSimilar('Suresh', 'Ramesh')).toBe(false);
    expect(namesSimilar('Amit Patil', 'Suresh Patil')).toBe(false);
  });

  it('returns false for empty/null names', () => {
    expect(namesSimilar('', 'Suresh')).toBe(false);
    expect(namesSimilar(null, 'Suresh')).toBe(false);
    expect(namesSimilar('Suresh', null)).toBe(false);
  });

  it('handles whitespace-only names', () => {
    expect(namesSimilar('  ', 'Suresh')).toBe(false);
  });
});

describe('isValidDate', () => {
  it('returns true for valid ISO date', () => {
    expect(isValidDate('2026-03-15')).toBe(true);
  });

  it('returns false for garbage string', () => {
    expect(isValidDate('not-a-date')).toBe(false);
  });

  it('returns false for empty/null', () => {
    expect(isValidDate('')).toBe(false);
    expect(isValidDate(null)).toBe(false);
  });
});

describe('getDaysUntil', () => {
  it('returns 0 for today', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(getDaysUntil(today)).toBe(0);
  });

  it('returns NaN for null', () => {
    expect(getDaysUntil(null)).toBeNaN();
  });

  it('returns NaN for invalid date', () => {
    expect(getDaysUntil('garbage')).toBeNaN();
  });
});
