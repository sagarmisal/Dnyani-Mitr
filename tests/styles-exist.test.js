/**
 * Iteration 11 — regression guard for a defect the render tests could not catch.
 *
 * `ScheduledItemForm` was written against `.modal-overlay` / `.modal`, which did
 * not exist in the stylesheet: this codebase names them per-component
 * (`.interaction-logger-overlay`). The form was created and appended correctly,
 * so every happy-dom render test passed — but with no styling it laid out
 * unstyled below the fold, and clicking "Someone is coming" appeared to do
 * nothing at all.
 *
 * The lesson worth encoding: a render test proves STRUCTURE, not VISIBILITY.
 * This closes that gap cheaply by checking every class the components actually
 * ask for is defined somewhere in the CSS.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const CSS = ['src/styles/main.css', 'src/styles/variables.css']
    .map(p => readFileSync(p, 'utf8'))
    .join('\n');

const COMPONENT_FILES = [
    ...readdirSync('src/components/Calendar').map(f => join('src/components/Calendar', f)),
    'src/components/UI/WhatsNew.js'
];

/** Class tokens from static `class="..."` attributes, ignoring interpolated ones. */
function classesUsedIn(file) {
    const src = readFileSync(file, 'utf8');
    const found = new Set();
    for (const m of src.matchAll(/class="([^"$]*)"/g)) {
        m[1].split(/\s+/).filter(Boolean).forEach(c => found.add(c));
    }
    // Classes built by joining an array, e.g. the calendar cell's state classes.
    for (const m of src.matchAll(/classes\.push\('([a-z0-9-]+)'\)/g)) {
        found.add(m[1]);
    }
    return found;
}

function isDefined(cls) {
    return new RegExp(`\\.${cls.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?![\\w-])`).test(CSS);
}

describe('every class the Calendar UI uses exists in the stylesheet', () => {
    COMPONENT_FILES.forEach(file => {
        it(`${file}`, () => {
            const missing = [...classesUsedIn(file)].filter(c => !isDefined(c)).sort();
            expect(missing, `undefined CSS classes in ${file}`).toEqual([]);
        });
    });
});

describe('the modal shell specifically', () => {
    // These four are load-bearing: without them a modal is invisible rather
    // than merely unstyled, which reads to a user as "the button is broken".
    ['modal-overlay', 'modal', 'modal-body', 'modal-footer'].forEach(cls => {
        it(`.${cls} is defined`, () => {
            expect(isDefined(cls)).toBe(true);
        });
    });

    it('.modal-overlay actually covers the viewport', () => {
        // Match the RULE, not the first mention — the class name also appears in
        // the comment above it explaining why this guard exists.
        const at = CSS.indexOf('.modal-overlay {');
        expect(at, '.modal-overlay rule not found').toBeGreaterThan(-1);
        const block = CSS.slice(at, at + 400);
        expect(block).toMatch(/position:\s*fixed/);
        expect(block).toMatch(/z-index:\s*\d{3,}/);
    });
});
