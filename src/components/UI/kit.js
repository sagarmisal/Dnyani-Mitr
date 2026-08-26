// Component kit — INITIATIVE.md D-05, P1.9.
//
// WHY THIS EXISTS
// ---------------
// The app they preferred carried its whole visual language in eight CSS
// variables applied to every control. Ours had 7,700 lines of components with
// ad-hoc per-component CSS and no shared vocabulary. The problem was never the
// absence of a framework (D-04 keeps vanilla) — it was the absence of a
// convention. Their app feels coherent because it IS coherent.
//
// Six pieces, and every screen composes from them:
//
//   Sheet    a bottom sheet, not a centred dialog — it rises from the thumb,
//            the way every Android app these volunteers already use behaves
//   Chips    tappable options replacing <select>, because a chip is one tap
//            and a select is tap → read → scroll → tap in an OEM picker
//   Tile     a large, left-aligned action target — easier to hit, and more
//            importantly easier to SEE
//   Row      one list line: title, meta, chips, actions
//   Section  a heading that hangs from a rule, the way a ledger heads a column
//   Empty    an invitation to act, never a blank
//
// Each returns a DOM element, matching the convention already in this codebase.
// Styling lives in kit.css and reads the --lg-* tokens (D-11, provisional).

import { escapeHTML } from '../../utils/helpers.js';

/* ------------------------------------------------------------------ Sheet */

/**
 * A bottom sheet.
 *
 * Centred dialogs are a desktop idiom: on a phone they float in the middle of
 * the screen and need a reach. A sheet rises from the bottom edge where the
 * thumb already is. That one difference is much of why their app felt native
 * and ours felt like a website.
 *
 * Keep the content SHORT. Their own sheet reaches 92% of the screen height
 * because it holds 22 checkboxes, which throws away the entire benefit.
 */
export class Sheet {
    static _active = null;

    /**
     * @param {Object} opts
     * @param {string} opts.title
     * @param {string} [opts.hint]        one line under the title, at the point of confusion
     * @param {HTMLElement} opts.body
     * @param {Array<{label:string, onClick:Function, variant?:'primary'|'quiet'|'danger'}>} [opts.actions]
     * @param {Function} [opts.onClose]
     */
    constructor({ title, hint = '', body, actions = [], onClose = null }) {
        this.title = title;
        this.hint = hint;
        this.body = body;
        this.actions = actions;
        this.onClose = onClose;
        this.el = null;
        this._prevFocus = null;
        this._prevOverflow = '';
    }

    render() {
        // One sheet at a time. Two stacked sheets on a 360px screen is a trap
        // with no visible way out.
        if (Sheet._active) Sheet._active.close();
        Sheet._active = this;

        this._prevFocus = document.activeElement;
        this._prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const overlay = document.createElement('div');
        overlay.className = 'lg-sheet-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', this.title || 'Dialog');

        const sheet = document.createElement('div');
        sheet.className = 'lg-sheet';

        const grab = document.createElement('div');
        grab.className = 'lg-sheet-grab';
        sheet.appendChild(grab);

        if (this.title) {
            const h = document.createElement('h2');
            h.className = 'lg-sheet-title';
            h.textContent = this.title;
            sheet.appendChild(h);
        }
        if (this.hint) {
            const p = document.createElement('p');
            p.className = 'lg-sheet-hint';
            p.textContent = this.hint;
            sheet.appendChild(p);
        }

        const bodyWrap = document.createElement('div');
        bodyWrap.className = 'lg-sheet-body';
        if (this.body) bodyWrap.appendChild(this.body);
        sheet.appendChild(bodyWrap);

        if (this.actions.length) {
            const foot = document.createElement('div');
            foot.className = 'lg-sheet-actions';
            this.actions.forEach(a => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = `lg-btn lg-btn--${a.variant || 'quiet'}`;
                b.textContent = a.label;
                b.addEventListener('click', () => a.onClick?.(this));
                foot.appendChild(b);
            });
            sheet.appendChild(foot);
        }

        overlay.appendChild(sheet);

        // Tap the backdrop, not the sheet, to dismiss.
        overlay.addEventListener('click', e => { if (e.target === overlay) this.close(); });
        this._onKey = e => { if (e.key === 'Escape') this.close(); };
        document.addEventListener('keydown', this._onKey);

        this.el = overlay;
        // Next frame, so the transform transition has a start state to animate
        // from — without this the sheet appears rather than rises.
        requestAnimationFrame(() => overlay.classList.add('is-open'));
        return overlay;
    }

    close() {
        if (!this.el) return;
        document.removeEventListener('keydown', this._onKey);
        document.body.style.overflow = this._prevOverflow;
        this.el.remove();
        this.el = null;
        if (Sheet._active === this) Sheet._active = null;
        this._prevFocus?.focus?.();
        this.onClose?.();
    }
}

/* ------------------------------------------------------------------ Chips */

/**
 * Tappable options in place of a dropdown.
 *
 * Every option is visible without touching anything, so people discover
 * choices they would never have found inside a select — which matters more
 * than the saved tap.
 */
export class Chips {
    /**
     * @param {Object} opts
     * @param {Array<{value:string, label:string, icon?:string}>} opts.options
     * @param {string[]} [opts.selected]
     * @param {boolean} [opts.multi=false]
     * @param {string} [opts.tone='default']   'default' | 'occasion'
     * @param {Function} [opts.onChange]       receives the array of selected values
     */
    constructor({ options, selected = [], multi = false, tone = 'default', onChange = null }) {
        this.options = options || [];
        this.selected = new Set(selected);
        this.multi = multi;
        this.tone = tone;
        this.onChange = onChange;
    }

    render() {
        const wrap = document.createElement('div');
        wrap.className = `lg-chips lg-chips--${this.tone}`;
        wrap.setAttribute('role', 'group');

        this.options.forEach(opt => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'lg-chip';
            b.dataset.value = opt.value;
            b.setAttribute('aria-pressed', String(this.selected.has(opt.value)));
            b.textContent = opt.icon ? `${opt.icon} ${opt.label}` : opt.label;
            b.addEventListener('click', () => this._toggle(opt.value, wrap));
            wrap.appendChild(b);
        });

        this.el = wrap;
        return wrap;
    }

    _toggle(value, wrap) {
        if (this.multi) {
            this.selected.has(value) ? this.selected.delete(value) : this.selected.add(value);
        } else {
            // Single-select stays togglable: tapping the chosen chip clears it.
            // A select can always be returned to its blank option and this
            // should not be the one control you cannot undo.
            this.selected.has(value) ? this.selected.clear() : (this.selected = new Set([value]));
        }
        wrap.querySelectorAll('.lg-chip').forEach(c =>
            c.setAttribute('aria-pressed', String(this.selected.has(c.dataset.value))));
        this.onChange?.(this.value());
    }

    /** @returns {string[]} */
    value() { return [...this.selected]; }
}

/* ------------------------------------------------------------------- Tile */

/** A large action target. Big enough to hit without looking, and to see. */
export function Tile({ icon = '', label, sub = '', variant = 'quiet', onClick = null }) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `lg-tile lg-tile--${variant}`;
    b.innerHTML =
        (icon ? `<span class="lg-tile-icon">${escapeHTML(icon)}</span>` : '') +
        `<span class="lg-tile-label">${escapeHTML(label)}</span>` +
        (sub ? `<span class="lg-tile-sub">${escapeHTML(sub)}</span>` : '');
    if (onClick) b.addEventListener('click', onClick);
    return b;
}

/* -------------------------------------------------------------------- Row */

/** One line in a list: who, when, what, and what you can do about it. */
export function Row({ title, meta = '', chips = [], actions = [] }) {
    const el = document.createElement('div');
    el.className = 'lg-row';

    const main = document.createElement('div');
    main.className = 'lg-row-main';
    main.innerHTML =
        `<b class="lg-row-title">${escapeHTML(title)}</b>` +
        (meta ? `<span class="lg-row-meta">${escapeHTML(meta)}</span>` : '');

    if (chips.length) {
        const c = document.createElement('div');
        c.className = 'lg-row-chips';
        chips.forEach(t => {
            const s = document.createElement('span');
            s.className = 'lg-tag';
            s.textContent = t;
            c.appendChild(s);
        });
        main.appendChild(c);
    }
    el.appendChild(main);

    if (actions.length) {
        const a = document.createElement('div');
        a.className = 'lg-row-actions';
        actions.forEach(act => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = `lg-btn lg-btn--sm lg-btn--${act.variant || 'quiet'}`;
            b.textContent = act.label;
            b.addEventListener('click', act.onClick);
            a.appendChild(b);
        });
        el.appendChild(a);
    }
    return el;
}

/* ---------------------------------------------------------------- Section */

/**
 * A heading that hangs from a rule.
 *
 * The signature device: the label sits ON a horizontal line with its content
 * beneath — the way a ledger rules a column heading, and the way Devanagari
 * hangs from the शिरोरेखा. One device, meaning "a new column starts here".
 */
export function Section({ label, count = null }) {
    const el = document.createElement('div');
    el.className = 'lg-section';
    el.innerHTML =
        `<span class="lg-section-label">${escapeHTML(label)}</span>` +
        (count !== null ? `<span class="lg-section-count">${escapeHTML(String(count))}</span>` : '');
    return el;
}

/* ------------------------------------------------------------------ Empty */

/**
 * An empty state is an invitation, not a blank.
 *
 * Most days have nothing scheduled, so this is a screen people see often. It
 * says what would appear here and offers the one action that would fill it.
 */
export function Empty({ message, action = null }) {
    const el = document.createElement('div');
    el.className = 'lg-empty';
    const p = document.createElement('p');
    p.className = 'lg-empty-message';
    p.textContent = message;
    el.appendChild(p);
    if (action) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'lg-btn lg-btn--primary';
        b.textContent = action.label;
        b.addEventListener('click', action.onClick);
        el.appendChild(b);
    }
    return el;
}

export default { Sheet, Chips, Tile, Row, Section, Empty };
