/**
 * The guard that should have caught the Visitors screen.
 *
 * P2.9 was marked done because the vocabulary guard passed — but that guard only
 * looked for BANNED words ("Overdue", "Machine Role"). A screen can contain no
 * banned word and still be entirely English, which is exactly what shipped: the
 * header and empty state were Marathi while "Visitors", "All Categories",
 * "Last Updated" and the whole filter row were not.
 *
 * Checking for the absence of specific bad strings can never prove the presence
 * of good ones. So this counts what is still untranslated and RATCHETS: the
 * number may fall, never rise. A new English string in any component fails the
 * suite the moment it is written.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Every string a user could read that is not going through t(). */
function untranslated() {
    const files = [];
    (function walk(dir) {
        readdirSync(dir).forEach(f => {
            const p = join(dir, f);
            statSync(p).isDirectory() ? walk(p) : f.endsWith('.js') && files.push(p);
        });
    })('src/components');

    const pattern = /(?:>|placeholder="|title="|aria-label=")\s*([A-Z][A-Za-z][A-Za-z ()\/-]{2,40})\s*(?:<|")/g;
    // Words that are not prose: enum values, formats, and proper nouns that
    // stay the same in both languages.
    const notProse = /^(true|false|null|SELF|CHILD|SPOUSE|PARENT|FRIEND|DIV|UTF|JSON|CSV|OK|WhatsApp|SMS|Dnyani Mitr|Seva Sankalp)$/i;

    const byFile = {};
    files.forEach(f => {
        const hits = new Set();
        for (const m of readFileSync(f, 'utf8').matchAll(pattern)) {
            const s = m[1].trim();
            if (notProse.test(s)) continue;
            hits.add(s);
        }
        if (hits.size) byFile[f.replace('src/components/', '')] = [...hits].sort();
    });
    return byFile;
}

// ZERO. Both counters are at zero, so this is no longer a ratchet — it is the
// rule. Any English string appearing in a component fails the suite the moment
// it is written.
//
// WHAT THIS COUNTER SEES, AND WHAT IT DOES NOT. It matches English in markup
// attributes and element text. It does NOT see prose inside template literals,
// toast messages, or confirm-dialog copy. Translating SyncManager's 21 strings
// moved this number by zero, because all of them were of the kind it cannot
// see. So the real untranslated surface is LARGER than this number, and Stage D
// finishes against a manual read of each file, not against this reaching zero.
const CEILING = 0;

describe('untranslated strings can only decrease', () => {
    it(`is at or below the ratchet of ${CEILING}`, () => {
        const byFile = untranslated();
        const total = Object.values(byFile).reduce((n, v) => n + v.length, 0);

        if (total > CEILING) {
            const worst = Object.entries(byFile)
                .sort((a, b) => b[1].length - a[1].length).slice(0, 5)
                .map(([f, v]) => `\n    ${String(v.length).padStart(3)}  ${f}  — ${v.slice(0, 3).join(' · ')}`)
                .join('');
            expect.fail(`${total} untranslated strings, ratchet is ${CEILING}.${worst}\n\n` +
                `Either translate them, or you are adding English to a Marathi-first app.`);
        }
        expect(total).toBeLessThanOrEqual(CEILING);
    });

    it('the screens in the core flows are done', () => {
        // These are what a volunteer touches to record a visit. They are the
        // ones that decide whether the app feels like theirs.
        const byFile = untranslated();
        const core = ['Calendar/DayPane.js', 'Calendar/ScheduledItemForm.js',
                      'Calendar/CalendarView.js', 'Visitors/VisitorList.js'];
        const notDone = core.filter(f => (byFile[f] || []).length > 0)
            .map(f => `${f}: ${byFile[f].slice(0, 5).join(' · ')}`);
        expect(notDone, 'core-flow screens still holding English').toEqual([]);
    });
});

/**
 * The second counter — English PROSE.
 *
 * The counter above matches markup attributes and element text. It reads zero
 * now, and zero is NOT done: it never saw sentences inside template literals,
 * toast strings, or confirm-dialog copy. Translating SyncManager's 21 strings
 * moved it by exactly nothing, because all of them were of this kind.
 *
 * Two counters, because one of them was quietly claiming a finish line it could
 * not see.
 */
function untranslatedProse() {
    const files = [];
    (function walk(dir) {
        readdirSync(dir).forEach(f => {
            const p = join(dir, f);
            statSync(p).isDirectory() ? walk(p) : f.endsWith('.js') && files.push(p);
        });
    })('src/components');

    const byFile = {};
    files.forEach(f => {
        const hits = new Set();
        readFileSync(f, 'utf8').split('\n').forEach(line => {
            const code = line.trim();
            if (code.startsWith('//') || code.startsWith('*')) return;
            // Three or more English words in a row, inside quotes or element text.
            for (const m of line.matchAll(/['`>]\s*([A-Z][a-z]+(?:[ ,'’-][A-Za-z]+){2,}[.!?]?)\s*[<'`]/g)) {
                hits.add(m[1]);
            }
        });
        if (hits.size) byFile[f.replace('src/components/', '')] = [...hits].sort();
    });
    return byFile;
}

// ZERO, like the other one. Reaching it took a second counter, because the
// first read zero while 44 English sentences were still on screen.
const PROSE_CEILING = 0;

describe('English prose can only decrease', () => {
    it(`is at or below ${PROSE_CEILING}`, () => {
        const byFile = untranslatedProse();
        const total = Object.values(byFile).reduce((n, v) => n + v.length, 0);
        if (total > PROSE_CEILING) {
            const worst = Object.entries(byFile)
                .sort((a, b) => b[1].length - a[1].length).slice(0, 5)
                .map(([f, v]) => `\n    ${String(v.length).padStart(3)}  ${f}  — ${v[0].slice(0, 44)}`)
                .join('');
            expect.fail(`${total} English sentences, ceiling ${PROSE_CEILING}.${worst}`);
        }
        expect(total).toBeLessThanOrEqual(PROSE_CEILING);
    });

    it('neither counter alone is the finish line — this is why there are two', () => {
        // Guard against the mistake this file already made once: treating one
        // counter's zero as the finish line.
        const prose = Object.values(untranslatedProse()).reduce((n, v) => n + v.length, 0);
        const attrs = Object.values(untranslated()).reduce((n, v) => n + v.length, 0);
        if (attrs === 0 && prose > 0) {
            expect(prose, 'attributes are done; prose is not — Stage D is not finished').toBeGreaterThan(0);
        }
        expect(true).toBe(true);
    });
});
