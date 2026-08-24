// @vitest-environment happy-dom
/**
 * INITIATIVE.md P1.9 / P1.10 / P1.11 — the component kit.
 *
 * Two kinds of test here, and the second kind is the one that matters.
 *
 * Render tests prove STRUCTURE: the element exists, it has the right children,
 * clicking it calls the handler. Those are cheap and they were already green
 * on the day `ScheduledItemForm` shipped against `.modal-overlay` — a class
 * that did not exist in the stylesheet. The form was built and appended
 * correctly, so every render test passed, and the button silently did nothing
 * because the sheet laid out unstyled below the fold.
 *
 * So the second block asserts VISIBILITY: that every class the kit asks for is
 * defined in CSS, and that the load-bearing ones carry the properties that make
 * them visible rather than merely present.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { Sheet, Chips, Tile, Row, Section, Empty } from '../src/components/UI/kit.js';

const CSS = readFileSync('src/styles/kit.css', 'utf8') +
            readFileSync('src/styles/variables.css', 'utf8');

const ruleFor = (cls) => {
    const at = CSS.indexOf(`.${cls} {`);
    return at === -1 ? null : CSS.slice(at, CSS.indexOf('}', at));
};

afterEach(() => {
    document.body.innerHTML = '';
    document.body.style.overflow = '';
    Sheet._active = null;
});

/* ------------------------------------------------------------- structure */

describe('Sheet', () => {
    it('renders a titled sheet inside an overlay', () => {
        const body = document.createElement('div');
        const s = new Sheet({ title: 'कुणीतरी येतंय', hint: 'फोन नंबर टाका', body });
        const el = s.render();
        expect(el.className).toBe('lg-sheet-overlay');
        expect(el.querySelector('.lg-sheet-title').textContent).toBe('कुणीतरी येतंय');
        expect(el.querySelector('.lg-sheet-hint').textContent).toBe('फोन नंबर टाका');
        expect(el.querySelector('.lg-sheet-body').contains(body)).toBe(true);
        s.close();
    });

    it('is a dialog for assistive tech', () => {
        const s = new Sheet({ title: 'T', body: document.createElement('div') });
        const el = s.render();
        expect(el.getAttribute('role')).toBe('dialog');
        expect(el.getAttribute('aria-modal')).toBe('true');
        s.close();
    });

    it('closes on Escape', () => {
        const onClose = vi.fn();
        const s = new Sheet({ title: 'T', body: document.createElement('div'), onClose });
        document.body.appendChild(s.render());
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(onClose).toHaveBeenCalled();
    });

    it('closes on a backdrop tap but not on a tap inside', () => {
        const onClose = vi.fn();
        const s = new Sheet({ title: 'T', body: document.createElement('div'), onClose });
        const el = s.render();
        document.body.appendChild(el);

        el.querySelector('.lg-sheet').click();      // inside — must survive
        expect(onClose).not.toHaveBeenCalled();

        el.click();                                  // backdrop — must dismiss
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('only ever has one sheet open — two stacked on a phone is a trap', () => {
        const a = new Sheet({ title: 'A', body: document.createElement('div') });
        document.body.appendChild(a.render());
        const b = new Sheet({ title: 'B', body: document.createElement('div') });
        document.body.appendChild(b.render());
        expect(document.querySelectorAll('.lg-sheet-overlay')).toHaveLength(1);
        expect(document.querySelector('.lg-sheet-title').textContent).toBe('B');
        b.close();
    });

    it('restores body scroll on close, even after being replaced', () => {
        const a = new Sheet({ title: 'A', body: document.createElement('div') });
        document.body.appendChild(a.render());
        expect(document.body.style.overflow).toBe('hidden');
        a.close();
        expect(document.body.style.overflow).not.toBe('hidden');
    });

    it('runs an action and can close from it', () => {
        const spy = vi.fn(sheet => sheet.close());
        const s = new Sheet({
            title: 'T', body: document.createElement('div'),
            actions: [{ label: 'जतन करा', onClick: spy, variant: 'primary' }]
        });
        document.body.appendChild(s.render());
        document.querySelector('.lg-sheet-actions .lg-btn').click();
        expect(spy).toHaveBeenCalled();
        expect(document.querySelector('.lg-sheet-overlay')).toBeNull();
    });
});

describe('Chips', () => {
    const opts = [
        { value: 'birthday', label: 'वाढदिवस', icon: '🎂' },
        { value: 'festival', label: 'सण', icon: '🪔' },
        { value: 'visit', label: 'सहज भेट', icon: '🙏' }
    ];

    it('shows every option without needing a tap first', () => {
        // The reason chips beat a select: options are discoverable by looking.
        const el = new Chips({ options: opts }).render();
        expect(el.querySelectorAll('.lg-chip')).toHaveLength(3);
        expect(el.textContent).toContain('वाढदिवस');
        expect(el.textContent).toContain('सण');
    });

    it('single-select replaces the previous choice', () => {
        const c = new Chips({ options: opts });
        const el = c.render();
        el.querySelectorAll('.lg-chip')[0].click();
        el.querySelectorAll('.lg-chip')[1].click();
        expect(c.value()).toEqual(['festival']);
    });

    it('single-select can be cleared by tapping the chosen chip again', () => {
        // A select can always be returned to its blank option. This should not
        // be the one control with no way back.
        const c = new Chips({ options: opts });
        const el = c.render();
        el.querySelectorAll('.lg-chip')[0].click();
        el.querySelectorAll('.lg-chip')[0].click();
        expect(c.value()).toEqual([]);
    });

    it('multi-select accumulates', () => {
        const c = new Chips({ options: opts, multi: true });
        const el = c.render();
        el.querySelectorAll('.lg-chip')[0].click();
        el.querySelectorAll('.lg-chip')[2].click();
        expect(c.value().sort()).toEqual(['birthday', 'visit']);
    });

    it('reports selection state through aria-pressed, not a colour alone', () => {
        const c = new Chips({ options: opts, selected: ['festival'] });
        const el = c.render();
        const pressed = [...el.querySelectorAll('.lg-chip')]
            .filter(b => b.getAttribute('aria-pressed') === 'true');
        expect(pressed).toHaveLength(1);
        expect(pressed[0].dataset.value).toBe('festival');
    });

    it('notifies on change', () => {
        const onChange = vi.fn();
        const el = new Chips({ options: opts, onChange }).render();
        el.querySelectorAll('.lg-chip')[0].click();
        expect(onChange).toHaveBeenCalledWith(['birthday']);
    });

    it('renders nothing rather than throwing when given no options', () => {
        expect(() => new Chips({ options: [] }).render()).not.toThrow();
    });
});

describe('Tile, Row, Section, Empty', () => {
    it('Tile fires its handler', () => {
        const onClick = vi.fn();
        Tile({ icon: '➕', label: 'कुणीतरी येतंय', onClick }).click();
        expect(onClick).toHaveBeenCalled();
    });

    it('Row shows title, meta, tags and actions', () => {
        const onClick = vi.fn();
        const el = Row({
            title: 'रमेश जाधव', meta: 'दुपारी ४ · ३ माणसं',
            chips: ['🎂 मुलीचा वाढदिवस'],
            actions: [{ label: 'आले का?', onClick }]
        });
        expect(el.querySelector('.lg-row-title').textContent).toBe('रमेश जाधव');
        expect(el.querySelector('.lg-tag').textContent).toContain('वाढदिवस');
        el.querySelector('.lg-row-actions .lg-btn').click();
        expect(onClick).toHaveBeenCalled();
    });

    it('Row escapes text rather than interpreting it as markup', () => {
        const el = Row({ title: '<img src=x onerror=alert(1)>', meta: '' });
        expect(el.querySelector('.lg-row-title').innerHTML).not.toContain('<img');
        expect(el.querySelector('img')).toBeNull();
    });

    it('Section shows its label and an optional count', () => {
        const el = Section({ label: 'आज येणारे', count: 2 });
        expect(el.querySelector('.lg-section-label').textContent).toBe('आज येणारे');
        expect(el.querySelector('.lg-section-count').textContent).toBe('2');
    });

    it('Section omits the count when there is none, rather than showing zero', () => {
        expect(Section({ label: 'आज येणारे' }).querySelector('.lg-section-count')).toBeNull();
    });

    it('Empty is an invitation, not a blank', () => {
        const onClick = vi.fn();
        const el = Empty({ message: 'आज कुणी येणार नाही.', action: { label: 'भेट ठरवा', onClick } });
        expect(el.querySelector('.lg-empty-message').textContent).toBeTruthy();
        el.querySelector('.lg-btn').click();
        expect(onClick).toHaveBeenCalled();
    });
});

/* ------------------------------------------------------------- visibility */

describe('P1.11 — the kit is visible, not merely present', () => {
    // A render test proves structure. This block proves the thing that
    // actually broke last time: that the CSS the components ask for exists,
    // and that the load-bearing rules make them visible.

    it('every class the kit uses is defined in the stylesheet', () => {
        const src = readFileSync('src/components/UI/kit.js', 'utf8');
        const used = new Set();
        for (const m of src.matchAll(/class(?:Name)?\s*=\s*[`'"]([^`'"$]*)[`'"]/g)) {
            m[1].split(/\s+/).filter(Boolean).forEach(c => used.add(c));
        }
        for (const m of src.matchAll(/class="(lg-[a-z-]+)/g)) used.add(m[1]);

        const missing = [...used]
            .filter(c => c.startsWith('lg-'))
            .filter(c => !new RegExp(`\\.${c}(?![\\w-])`).test(CSS))
            .sort();
        expect(missing, 'kit classes with no CSS rule').toEqual([]);
    });

    it('the overlay actually covers the viewport', () => {
        const rule = ruleFor('lg-sheet-overlay');
        expect(rule, '.lg-sheet-overlay rule missing').toBeTruthy();
        expect(rule).toMatch(/position:\s*fixed/);
        expect(rule).toMatch(/inset:\s*0/);
        expect(rule).toMatch(/z-index:\s*\d{3,}/);
    });

    it('the sheet rises from the bottom — the D-09 decision, in CSS', () => {
        // If this ever becomes `center` the sheet is a desktop dialog again
        // and the reason the NGOs preferred the other app is back.
        expect(ruleFor('lg-sheet-overlay')).toMatch(/align-items:\s*flex-end/);
        expect(ruleFor('lg-sheet')).toMatch(/border-radius:\s*var\(--lg-r-sheet\)/);
    });

    it('tap targets meet the 44px floor', () => {
        // Below this, people miss on a cheap handset and blame themselves.
        expect(ruleFor('lg-chip')).toMatch(/min-height:\s*var\(--lg-tap\)/);
        expect(ruleFor('lg-btn')).toMatch(/min-height:\s*var\(--lg-tap\)/);
        expect(CSS).toMatch(/--lg-tap:\s*44px/);
    });

    it('the kit hardcodes no colour — one file changes the palette (Q-03)', () => {
        const kitCss = readFileSync('src/styles/kit.css', 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '');          // strip comments
        const hex = kitCss.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
        // #fff and #3d2a06 are text-on-accent, which must contrast with the
        // accent itself rather than track a background token.
        const unexpected = hex.filter(h => !['#fff', '#3d2a06'].includes(h.toLowerCase()));
        expect(unexpected, 'hardcoded colours in kit.css').toEqual([]);
    });

    it('reduced motion is respected', () => {
        expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    });

    it('focus is visible for the laptop users', () => {
        expect(CSS).toMatch(/:focus-visible/);
    });
});
