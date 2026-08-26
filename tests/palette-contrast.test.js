/**
 * INITIATIVE.md P1.8b / D-11 / D-26 — the palette is readable.
 *
 * Repointing 189 hardcoded colours onto the ledger set is a mechanical change
 * with one non-mechanical risk: a pairing that used to contrast may stop
 * contrasting, and nothing in a build or a render test would notice. The users
 * are 40-60 and often outdoors on a cheap screen, so this is not a nicety.
 *
 * WCAG AA: 4.5:1 for body text, 3:1 for large text and UI boundaries.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Strip comments before checking: the file NAMES the Tailwind defaults in a
// comment explaining why they were replaced, and a substring match cannot tell
// a definition from an explanation.
const CSS = readFileSync('src/styles/variables.css', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');

/** Resolve a --lg-* token to its hex, following one level of var() aliasing. */
function token(name) {
    const m = new RegExp(`--${name}:\\s*([^;]+);`).exec(CSS);
    if (!m) throw new Error(`token --${name} not defined`);
    const val = m[1].trim();
    const alias = /var\(--([\w-]+)\)/.exec(val);
    return alias ? token(alias[1]) : val;
}

function rgb(hex) {
    let h = hex.replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}

function luminance(hex) {
    const [r, g, b] = rgb(hex).map(v => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
    const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
}

const AA_TEXT = 4.5;
const AA_LARGE = 3.0;

describe('body text is readable on every surface it lands on', () => {
    const surfaces = ['lg-paper', 'lg-page', 'lg-wash'];
    surfaces.forEach(bg => {
        it(`--lg-ink on --${bg}`, () => {
            expect(contrast(token('lg-ink'), token(bg))).toBeGreaterThanOrEqual(AA_TEXT);
        });
    });

    surfaces.forEach(bg => {
        it(`--lg-ink-soft on --${bg} — secondary text still has to be read`, () => {
            expect(contrast(token('lg-ink-soft'), token(bg))).toBeGreaterThanOrEqual(AA_TEXT);
        });
    });
});

describe('white text on the accent colours', () => {
    // Every primary button, and the chips in their selected state.
    it('white on --lg-bind', () => {
        expect(contrast('#ffffff', token('lg-bind'))).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it('white on --lg-bind-dark (the pressed state)', () => {
        expect(contrast('#ffffff', token('lg-bind-dark'))).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it('white on --lg-danger', () => {
        expect(contrast('#ffffff', token('lg-danger'))).toBeGreaterThanOrEqual(AA_TEXT);
    });
});

describe('the semantic washes and their ink', () => {
    // These pairs travel together: a wash is never used without its ink.
    const pairs = [
        ['lg-marigold-i', 'lg-marigold-w', 'occasions'],
        ['lg-danger', 'lg-danger-w', 'errors'],
        ['lg-leaf', 'lg-leaf-w', 'confirmations']
    ];
    pairs.forEach(([ink, wash, what]) => {
        it(`--${ink} on --${wash} (${what})`, () => {
            expect(contrast(token(ink), token(wash))).toBeGreaterThanOrEqual(AA_TEXT);
        });
    });
});

describe('marigold is an accent, not a text colour', () => {
    it('the LINE value reads as a boundary against the page', () => {
        // Focus rings and dots must be seen, not read. 3:1 is the WCAG
        // non-text threshold, and the bright fill value does not reach it —
        // which is exactly why there are two.
        expect(contrast(token('lg-marigold-l'), token('lg-page'))).toBeGreaterThanOrEqual(AA_LARGE);
    });

    it('the FILL value carries dark text as a chip background', () => {
        expect(contrast('#3d2a06', token('lg-marigold'))).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it('the two are actually different — one token cannot do both jobs', () => {
        expect(token('lg-marigold')).not.toBe(token('lg-marigold-l'));
    });


});

describe('structure is visible without being loud', () => {
    it('the ledger rule is distinguishable from the page', () => {
        expect(contrast(token('lg-rule'), token('lg-page'))).toBeGreaterThan(1.2);
    });

    it('placeholder ink is dimmer than body ink but still above the UI floor', () => {
        const faint = contrast(token('lg-ink-faint'), token('lg-page'));
        const body = contrast(token('lg-ink'), token('lg-page'));
        expect(faint).toBeLessThan(body);
        expect(faint).toBeGreaterThanOrEqual(AA_LARGE);
    });
});

describe('no Tailwind default survives in the token set', () => {
    it('the palette that made this read as a developer tool is gone', () => {
        const tailwind = ['#2563eb', '#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#1d4ed8'];
        const defined = CSS.toLowerCase();
        const survivors = tailwind.filter(h => defined.includes(h));
        expect(survivors, 'Tailwind defaults still defined').toEqual([]);
    });
});

describe('the LEGACY --color-* tokens, which most of the app still uses', () => {
    // Found in review: P1.8b repointed the semantic tokens (primary, success,
    // error, warning) and missed the NEUTRALS — bg, surface, border, and all
    // three text levels. Those carry more of the app's surface than every
    // accent combined, so the result was warm accents floating on a cool-grey
    // Tailwind ground, which is most of what D-11 set out to change.
    //
    // The original test only looked at --lg-* tokens. That blind spot is why
    // it passed, so the fix is this block, not just the values.

    it('the load-bearing tokens alias the ledger set rather than holding a hex', () => {
        // Only these are required to alias. The -light/-dark tints hold explicit
        // ledger-family values because there is no named token for a tint, and
        // demanding an alias for its own sake would be ceremony, not safety.
        const mustAlias = [
            'bg', 'surface', 'surface-hover', 'border',
            'text-primary', 'text-secondary', 'text-tertiary',
            'primary', 'success', 'warning', 'error', 'info', 'saffron'
        ];
        const notAliased = mustAlias.filter(name => {
            const m = new RegExp(`--color-${name}:\\s*([^;]+);`).exec(CSS);
            return !m || !m[1].includes('var(--lg-');
        });
        expect(notAliased, '--color-* tokens that should follow the ledger set').toEqual([]);
    });

    it('no --color-* token holds a Tailwind value, aliased or not', () => {
        // This is the assertion that would have caught the review finding:
        // --color-bg was still #f9fafb (slate-50), so the page ground stayed
        // cool grey while every accent went warm.
        const tailwind = new Set(['#f9fafb', '#f3f4f6', '#e5e7eb', '#111827', '#4b5563',
                                  '#6b7280', '#2563eb', '#10b981', '#ef4444', '#f59e0b',
                                  '#1d4ed8', '#3b82f6', '#9ca3af', '#d1d5db']);
        const offenders = [...CSS.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)]
            .filter(m => tailwind.has(m[2].toLowerCase()))
            .map(m => `--color-${m[1]} = ${m[2]}`);
        expect(offenders, 'Tailwind values still in the token set').toEqual([]);
    });

    it('text is readable on the surfaces the app actually paints', () => {
        const pairs = [
            ['color-text-primary', 'color-bg'],
            ['color-text-primary', 'color-surface'],
            ['color-text-secondary', 'color-bg'],
            ['color-text-secondary', 'color-surface']
        ];
        pairs.forEach(([ink, bg]) => {
            expect(contrast(token(ink), token(bg)), `--${ink} on --${bg}`)
                .toBeGreaterThanOrEqual(AA_TEXT);
        });
    });

    it('the page ground is the warm paper, not a cool grey', () => {
        // The specific regression: #f9fafb is Tailwind slate-50 and reads blue.
        expect(token('color-bg')).toBe(token('lg-paper'));
        expect(token('color-surface')).toBe(token('lg-page'));
    });

    it('borders are visible without being loud', () => {
        expect(contrast(token('color-border'), token('color-surface'))).toBeGreaterThan(1.1);
    });

    it('white text still works on the primary action colour', () => {
        expect(contrast('#ffffff', token('color-primary'))).toBeGreaterThanOrEqual(AA_TEXT);
    });
});
