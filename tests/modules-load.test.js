// @vitest-environment happy-dom
/**
 * Every module must at least parse and load.
 *
 * Written after a syntax error shipped past a green suite of 596 tests. A blind
 * find-replace put `${t('...')}` inside a SINGLE-quoted string in
 * VisitorList.js, so the quotes terminated early and the file no longer parsed.
 * Nothing caught it, because no test imports VisitorList — the build did, and
 * only because I happened to run it.
 *
 * This is the cheapest possible test and it covers the whole tree: a bad import
 * path, a stray quote, a missing brace, a module-level throw. It does not check
 * behaviour and is not meant to. It checks that the file is a file.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

function allModules(root) {
    const out = [];
    (function walk(dir) {
        readdirSync(dir).forEach(f => {
            const p = join(dir, f);
            if (statSync(p).isDirectory()) walk(p);
            else if (f.endsWith('.js')) out.push(p);
        });
    })(root);
    return out;
}

const MODULES = [
    ...allModules('src/components'),
    ...allModules('src/services'),
    ...allModules('src/models'),
    ...allModules('src/utils'),
    ...allModules('src/core')
];

describe('every module parses and loads', () => {
    it('finds the whole tree', () => {
        // If this ever drops sharply, the walk is broken and the suite below is
        // quietly testing nothing.
        expect(MODULES.length).toBeGreaterThan(30);
    });

    MODULES.forEach(path => {
        it(relative('src', path), async () => {
            await expect(import('../' + path)).resolves.toBeDefined();
        });
    });
});
