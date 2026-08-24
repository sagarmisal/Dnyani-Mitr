// Language layer — INITIATIVE.md D-23, P2.9.
//
// Every user-facing string in this app was hardcoded English. That is not a
// translation problem, it is the reason the app reads as somebody else's tool:
// a volunteer in Baramati opened it and found "Machine Role", "Overdue" and
// "Data Quality" staring back.
//
// Marathi is the default and English is one tap away (D-23). Field volunteers
// read Marathi first; the coordinators on laptops get the toggle without being
// made the default.
//
// SHAPE: `{ key: { mr, en } }`, matching DEFAULT_OCCASIONS which already stores
// `templates.greeting.{en,mr}`. Following the convention that exists beats
// inventing a second one. Adding Hindi later is a third key on each entry and
// nothing else — Devanagari data handling (P1.1–P1.5) already covers it.

import { STRINGS } from './strings.js';

export const LANGS = {
    mr: { code: 'mr', label: 'मराठी', locale: 'mr-IN' },
    en: { code: 'en', label: 'English', locale: 'en-IN' }
};

export const DEFAULT_LANG = 'mr';

let current = DEFAULT_LANG;
const listeners = new Set();

/** Read the saved choice without importing StateManager — this loads early. */
function readSaved() {
    try {
        const raw = localStorage.getItem('NGOApp_v2_State');
        if (!raw) return null;
        const lang = JSON.parse(raw)?.settings?.language;
        return LANGS[lang] ? lang : null;
    } catch {
        return null;
    }
}

export function initLang() {
    current = readSaved() || DEFAULT_LANG;
    document.documentElement?.setAttribute?.('lang', current);
    return current;
}

export function getLang() { return current; }

export function getLocale() { return LANGS[current]?.locale || 'mr-IN'; }

/**
 * Switch language. Notifies listeners; the shell reloads on that signal.
 *
 * A reload rather than a live re-render: this app builds screens as DOM
 * strings with no binding, so a partial re-render would leave half the screen
 * in the old language. That looks broken in the exact way we are trying to fix.
 */
export function setLang(code) {
    if (!LANGS[code] || code === current) return current;
    current = code;
    document.documentElement?.setAttribute?.('lang', code);
    listeners.forEach(fn => { try { fn(code); } catch (e) { console.error(e); } });
    return current;
}

export function onLangChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/**
 * Look up a string.
 *
 * @param {string} key
 * @param {Object} [vars]  {name} placeholders
 * @returns {string}
 *
 * A missing key returns the key itself, loudly and visibly, rather than an
 * empty string. An empty label looks like a rendering bug and sends you hunting
 * through CSS; `nav.visitors` on screen tells you exactly what is missing
 * (PR-3 — never be silently wrong).
 */
export function t(key, vars = null) {
    const entry = STRINGS[key];
    if (!entry) {
        if (typeof console !== 'undefined') console.warn(`[i18n] missing string: ${key}`);
        return key;
    }
    // Fall back to the other language rather than showing a key, if one side
    // was somehow left blank. Tests forbid it, but a half-translated screen is
    // still better than a debug token in front of a volunteer.
    let out = entry[current] ?? entry.mr ?? entry.en ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            out = out.split(`{${k}}`).join(String(v ?? ''));
        }
    }
    return out;
}

/** Both languages at once, for the few places that show a bilingual pair. */
export function tBoth(key) {
    const e = STRINGS[key];
    if (!e) return key;
    return current === 'mr' ? `${e.mr} · ${e.en}` : `${e.en} · ${e.mr}`;
}

export default { t, tBoth, getLang, setLang, initLang, onLangChange, getLocale, LANGS, DEFAULT_LANG };
