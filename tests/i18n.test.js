// @vitest-environment happy-dom
/**
 * INITIATIVE.md D-23 / D-10 — the language layer.
 *
 * The completeness test is the one that matters. A half-translated screen is
 * exactly the kind of "looks like somebody else's tool" the whole initiative
 * exists to fix, and it is invisible in review because you only ever look at
 * the language you speak.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { t, tBoth, getLang, setLang, initLang, onLangChange, LANGS, DEFAULT_LANG } from '../src/utils/i18n.js';
import { STRINGS } from '../src/utils/strings.js';

beforeEach(() => {
    localStorage.clear();
    setLang('en');            // force a change so listeners fire predictably
    setLang(DEFAULT_LANG);
});

describe('completeness — no string may ship half-done', () => {
    it('every key has both Marathi and English', () => {
        const incomplete = Object.entries(STRINGS)
            .filter(([, v]) => !v || !String(v.mr || '').trim() || !String(v.en || '').trim())
            .map(([k]) => k);
        expect(incomplete, 'keys missing a language').toEqual([]);
    });

    it('placeholders match across languages', () => {
        // "{name} added" in one language and "जोडले" in the other silently
        // drops the name for half the users.
        const vars = s => (String(s).match(/\{(\w+)\}/g) || []).sort().join(',');
        const mismatched = Object.entries(STRINGS)
            .filter(([, v]) => vars(v.mr) !== vars(v.en))
            .map(([k]) => k);
        expect(mismatched, 'keys whose placeholders differ between languages').toEqual([]);
    });

    it('no key still carries the administrator vocabulary (D-10)', () => {
        const banned = /machine role|satellite|overdue|never contacted|data quality|follow-ups due/i;
        const offenders = Object.entries(STRINGS)
            .filter(([, v]) => banned.test(v.en) || banned.test(v.mr))
            .map(([k]) => k);
        expect(offenders).toEqual([]);
    });

    it('no error string apologises or is vague', () => {
        const soggy = /sorry|oops|something went wrong|unexpected error/i;
        const offenders = Object.entries(STRINGS)
            .filter(([k]) => k.startsWith('error.'))
            .filter(([, v]) => soggy.test(v.en) || soggy.test(v.mr))
            .map(([k]) => k);
        expect(offenders).toEqual([]);
    });
});

describe('t()', () => {
    it('defaults to Marathi (D-23)', () => {
        expect(getLang()).toBe('mr');
        expect(t('nav.today')).toBe('आज');
    });

    it('switches to English and back', () => {
        setLang('en');
        expect(t('nav.today')).toBe('Today');
        setLang('mr');
        expect(t('nav.today')).toBe('आज');
    });

    it('substitutes placeholders', () => {
        setLang('en');
        expect(t('toast.added', { name: 'Sunita' })).toBe('Sunita added to your supporters.');
        setLang('mr');
        expect(t('toast.added', { name: 'सुनीता' })).toContain('सुनीता');
    });

    it('substitutes every occurrence, not just the first', () => {
        expect(t('status.lastVisit', { when: 'जुलै' })).toContain('जुलै');
    });

    it('returns the key itself when a string is missing — loudly, not blankly', () => {
        // A blank label reads as a CSS bug and sends you hunting in the wrong
        // place. The key on screen names exactly what is missing (PR-3).
        expect(t('nav.doesNotExist')).toBe('nav.doesNotExist');
    });

    it('treats a null variable as empty rather than printing "undefined"', () => {
        expect(t('toast.added', { name: null })).not.toContain('undefined');
    });
});

describe('tBoth — the bilingual pairs', () => {
    it('leads with the current language', () => {
        setLang('mr');
        expect(tBoth('action.save').startsWith('जतन करा')).toBe(true);
        setLang('en');
        expect(tBoth('action.save').startsWith('Save')).toBe(true);
    });
});

describe('language switching', () => {
    it('notifies listeners', () => {
        let seen = null;
        const off = onLangChange(code => { seen = code; });
        setLang('en');
        expect(seen).toBe('en');
        off();
    });

    it('does not notify when the language did not change', () => {
        setLang('mr');
        let calls = 0;
        const off = onLangChange(() => { calls++; });
        setLang('mr');
        expect(calls).toBe(0);
        off();
    });

    it('ignores a language we do not have', () => {
        setLang('mr');
        setLang('fr');
        expect(getLang()).toBe('mr');
    });

    it('sets the document language for the browser', () => {
        setLang('en');
        expect(document.documentElement.getAttribute('lang')).toBe('en');
    });

    it('one listener throwing does not stop the others', () => {
        const seen = [];
        const off1 = onLangChange(() => { throw new Error('boom'); });
        const off2 = onLangChange(() => seen.push('ok'));
        setLang('en');
        expect(seen).toEqual(['ok']);
        off1(); off2();
    });
});

describe('initLang — reading the saved choice', () => {
    it('falls back to Marathi when nothing is saved', () => {
        localStorage.clear();
        expect(initLang()).toBe('mr');
    });

    it('restores a saved choice', () => {
        localStorage.setItem('NGOApp_v2_State', JSON.stringify({ settings: { language: 'en' } }));
        expect(initLang()).toBe('en');
    });

    it('ignores a corrupt or unknown saved value rather than throwing', () => {
        localStorage.setItem('NGOApp_v2_State', 'not json');
        expect(initLang()).toBe('mr');
        localStorage.setItem('NGOApp_v2_State', JSON.stringify({ settings: { language: 'zz' } }));
        expect(initLang()).toBe('mr');
    });
});

describe('identity strings are fixed (D-22)', () => {
    it('the app is always Dnyani Mitr, in both languages', () => {
        expect(STRINGS['app.name'].mr).toBe('ज्ञानी मित्र');
        expect(STRINGS['app.name'].en).toBe('Dnyani Mitr');
    });

    it('Seva Sankalp is always the attribution', () => {
        expect(STRINGS['app.by'].en).toContain('Seva Sankalp');
    });
});

describe('the vocabulary sweep actually reached the screens (P2.8/P2.9)', () => {
    it('no component still hardcodes the administrator vocabulary', async () => {
        const { readdirSync, readFileSync, statSync } = await import('node:fs');
        const { join } = await import('node:path');

        const files = [];
        (function walk(dir) {
            readdirSync(dir).forEach(f => {
                const p = join(dir, f);
                if (statSync(p).isDirectory()) walk(p);
                else if (f.endsWith('.js')) files.push(p);
            });
        })('src/components');

        // Only what a USER can see. Class names like `is-overdue` and internal
        // methods like _getOverdueReminders are our vocabulary, not theirs, and
        // renaming them would be churn without benefit.
        const banned = /(>|["'`])\s*(Overdue|Never contacted|Follow-ups Due|Data Quality|Root Machine|Satellite Machine)\b/;
        // Line by line, NOT on the joined file: `\s*` spans newlines, so a `>`
        // ending one line would match a word beginning the next — which it did,
        // and reported two innocent files.
        const offenders = [];
        files.forEach(f => {
            readFileSync(f, 'utf8').split('\n').forEach((line, n) => {
                const trimmed = line.trim();
                if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
                if (banned.test(line)) offenders.push(`${f}:${n + 1}  ${trimmed.slice(0, 60)}`);
            });
        });
        expect(offenders, 'components still showing administrator vocabulary').toEqual([]);
    });
});
