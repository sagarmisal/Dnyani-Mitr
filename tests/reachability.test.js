/**
 * Every screen must be reachable.
 *
 * Written after the nav went from eight tabs to five and I removed the tabs
 * without adding the replacement entry points. Backup and Sync — the screens
 * that keep an NGO's register alive when a phone dies — became UNREACHABLE.
 * Nothing failed: the routes were registered, the components rendered fine in
 * their own tests, and the build was clean. There was simply no way to get
 * there, and the NGOs would have found that out the hard way.
 *
 * A registered route with no link is not dead code. It is a missing door.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MAIN = readFileSync('src/main.js', 'utf8');

const COMPONENTS = (() => {
    const out = [];
    (function walk(dir) {
        readdirSync(dir).forEach(f => {
            const p = join(dir, f);
            if (statSync(p).isDirectory()) walk(p);
            else if (f.endsWith('.js')) out.push([p, readFileSync(p, 'utf8')]);
        });
    })('src/components');
    return out;
})();

const REGISTERED = [...MAIN.matchAll(/Router\.register\(ROUTES\.(\w+)/g)].map(m => m[1]);

// Routes that exist only to redirect somewhere else, so an old bookmark or a
// deep link does not dead-end. They are not destinations and need no door.
const ALIASES = new Set(['ACTIVATION', 'BACKUP']);

const inNav = (r) => MAIN.includes(`href="#\${ROUTES.${r}}" class="nav-link"`);
const linkedFrom = (r) =>
    COMPONENTS.filter(([, src]) => new RegExp(`ROUTES\\.${r}\\b`).test(src)).map(([f]) => f);

describe('reachability', () => {
    it('found the routes and the components', () => {
        expect(REGISTERED.length).toBeGreaterThan(8);
        expect(COMPONENTS.length).toBeGreaterThan(10);
    });

    REGISTERED.filter(r => !ALIASES.has(r)).forEach(route => {
        it(`${route} has a way in`, () => {
            const reachable = inNav(route) || linkedFrom(route).length > 0;
            expect(reachable, `ROUTES.${route} is registered but nothing links to it`).toBe(true);
        });
    });

    it('every alias actually redirects rather than rendering nothing', () => {
        ALIASES.forEach(a => {
            const at = MAIN.indexOf(`Router.register(ROUTES.${a}`);
            expect(at, `ROUTES.${a} is not registered`).toBeGreaterThan(-1);
            expect(MAIN.slice(at, at + 260)).toMatch(/Router\.navigate/);
        });
    });

    it('backup and sync are reachable — the register depends on it', () => {
        // Called out separately because this is the one that would have cost
        // an NGO their data, not merely inconvenienced them.
        expect(inNav('SYNC') || linkedFrom('SYNC').length > 0).toBe(true);
    });
});
