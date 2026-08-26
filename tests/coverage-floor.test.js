/**
 * Untested surface is invisible surface (INITIATIVE §14, RC-4).
 *
 * A syntax error once lived in an untested file through 655 green tests, and
 * the screens carrying the most untranslated English are exactly the ones with
 * no coverage. Both track one thing: whether the file has been touched.
 *
 * A ratchet, like the i18n one. The number of large untested components may
 * fall and never rise.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BIG = 200;   // lines. Below this a component is small enough to read whole.

function untestedBigComponents() {
    const comps = [];
    (function walk(dir) {
        readdirSync(dir).forEach(f => {
            const p = join(dir, f);
            if (statSync(p).isDirectory()) walk(p);
            else if (f.endsWith('.js')) comps.push(p);
        });
    })('src/components');

    // "Tested" means a test file IMPORTS the module. The first version of this
    // counted name mentions, and was satisfied by its own critical list below
    // plus a comment in another test — a guard that passed itself. A mention is
    // not a test; an import is the weakest thing that cannot be faked.
    const suite = readdirSync('tests', { recursive: true })
        .filter(f => String(f).endsWith('.js'))
        .filter(f => !String(f).includes('modules-load'))   // imports everything by path
        .filter(f => !String(f).includes('coverage-floor'))  // would count itself
        .map(f => readFileSync(join('tests', String(f)), 'utf8'))
        .join('\n');

    return comps
        .map(p => ({ p, name: p.split('/').pop().replace('.js', ''),
                     loc: readFileSync(p, 'utf8').split('\n').length }))
        .filter(c => c.loc >= BIG)
        .filter(c => !new RegExp(`import[^;]*from\\s*['"][^'"]*${c.name}\\.js['"]`).test(suite))
        .map(c => `${c.p} (${c.loc} lines)`);
}

// The count when the floor was introduced — and the honest one. The first
// version of this counted name mentions rather than imports and reported 6;
// replacing the proxy with an import check revealed 11. LOWER IT as screens get
// covered. Never raise it: raising it means shipping another large untested screen.
const CEILING = 11;

describe('large components must be tested', () => {
    it(`at most ${CEILING} components over ${BIG} lines lack a test`, () => {
        const untested = untestedBigComponents();
        if (untested.length > CEILING) {
            expect.fail(`${untested.length} large components have no test (ceiling ${CEILING}):\n    ` +
                untested.join('\n    '));
        }
        expect(untested.length).toBeLessThanOrEqual(CEILING);
    });

    // EXPECTED RED until Stage C covers SyncManager. Losing that screen loses
    // the register, and it is 906 lines with no test — the single largest
    // untested risk in the codebase. Left failing deliberately rather than
    // softened, so it cannot be forgotten.
    it('the screens that cannot be allowed to fail are covered', () => {
        // Losing these loses the register or the day's work. They are named
        // rather than counted, so the ratchet cannot be satisfied by covering
        // something easy instead.
        const critical = ['SyncManager', 'ScheduledItemForm', 'DayPane', 'CalendarView'];
        const untested = untestedBigComponents().join(' ');
        const missing = critical.filter(c => untested.includes(c + '.js'));
        expect(missing, 'critical screens with no test').toEqual([]);
    });
});
