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

// The count on the day the ratchet was introduced, after translating the
// Visitors screen. LOWER THIS as screens are converted. Never raise it: if a
// change needs it raised, that change is adding an English string to a
// Marathi-first app (D-23).
const CEILING = 160;

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
