// @vitest-environment happy-dom
/**
 * INITIATIVE.md D-22 — the branding hierarchy.
 *
 * Found during review: this is a headline decision with no test at all. The
 * NGO's own name in the header is the cheapest answer we have to "it felt like
 * somebody else's app", and it was resting on nothing.
 *
 * Three layers, and only the middle one is editable:
 *   the Seva Sankalp mark   fixed, always present
 *   the NGO's own name      configurable, and the LARGEST thing on screen
 *   ज्ञानी मित्र             fixed, always present, quietly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { t, setLang } from '../src/utils/i18n.js';
import { STRINGS } from '../src/utils/strings.js';

const MAIN = readFileSync('src/main.js', 'utf8');
const CSS = readFileSync('src/styles/kit.css', 'utf8');

const rule = (cls) => {
    const at = CSS.indexOf(`.${cls} {`);
    return at === -1 ? null : CSS.slice(at, CSS.indexOf('}', at));
};
const px = (r, prop) => {
    const m = new RegExp(prop + ':\\s*([^;]+);').exec(r || '');
    if (!m) return null;
    const c = /clamp\(\s*([\d.]+)px/.exec(m[1]);
    return c ? parseFloat(c[1]) : parseFloat(m[1]);
};

beforeEach(() => setLang('mr'));

describe('the NGO name is the largest thing on screen', () => {
    it('the org name is bigger than the app name', () => {
        // The hierarchy IS the decision. If these ever invert, the app has
        // quietly gone back to being about itself.
        const org = px(rule('lg-brand-org'), 'font-size');
        const app = px(rule('lg-brand-app'), 'font-size');
        expect(org, '.lg-brand-org font-size').toBeGreaterThan(0);
        expect(app, '.lg-brand-app font-size').toBeGreaterThan(0);
        expect(org).toBeGreaterThan(app);
    });

    it('a long Marathi name wraps rather than truncating', () => {
        // Half a name is worse than two lines. No ellipsis, no overflow:hidden.
        const r = rule('lg-brand-org');
        expect(r).toMatch(/overflow-wrap:\s*anywhere/);
        expect(r).not.toMatch(/text-overflow:\s*ellipsis/);
        expect(r).not.toMatch(/white-space:\s*nowrap/);
    });
});

describe('what can and cannot be configured', () => {
    it('the org name comes from settings', () => {
        expect(MAIN).toMatch(/settings\.organizationName/);
    });

    it('the app name and the mark are NOT read from settings', () => {
        // They are literals from the string table and a bundled asset. If either
        // ever became configurable, provenance would be editable — and D-28
        // removed the activation key on the grounds that the mark carries it.
        expect(MAIN).toMatch(/t\('app\.name'\)/);
        expect(MAIN).toMatch(/logoSrc/);
        expect(MAIN).not.toMatch(/settings\.appName|settings\.logo|settings\.brand/);
    });

    it('falls back to the app name when no org is set, never to a blank bar', () => {
        expect(MAIN).toMatch(/orgName\s*\n?\s*\?/);      // ternary on orgName
        expect(MAIN).toMatch(/t\('app\.by'\)/);          // and the attribution beneath
    });

    it('the org name is escaped — it is user input on every screen', () => {
        expect(MAIN).toMatch(/escapeHTML\(orgName\)/);
    });
});

describe('the language toggle is visible, not buried (D-23)', () => {
    it('lives in the header', () => {
        expect(MAIN).toMatch(/lg-lang/);
        expect(MAIN).toMatch(/data-lang="mr"/);
        expect(MAIN).toMatch(/data-lang="en"/);
    });

    it('reports its state to assistive tech, not by colour alone', () => {
        expect(MAIN).toMatch(/aria-pressed="\$\{lang === 'mr'\}"/);
    });

    it('persists the choice before reloading', () => {
        // A toggle that does not survive the reload it triggers is worse than
        // no toggle: it looks broken rather than absent.
        expect(MAIN).toMatch(/updateSettings\(\{ language: code \}\)/);
        expect(MAIN).toMatch(/window\.location\.reload\(\)/);
    });
});

describe('identity strings are fixed in both languages', () => {
    it('the app is Dnyani Mitr either way', () => {
        setLang('mr'); expect(t('app.name')).toBe('ज्ञानी मित्र');
        setLang('en'); expect(t('app.name')).toBe('Dnyani Mitr');
    });

    it('Seva Sankalp is the attribution in both', () => {
        expect(STRINGS['app.by'].en).toContain('Seva Sankalp');
        expect(STRINGS['app.by'].mr).toContain('सेवा संकल्प');
    });
});

describe('the five destinations', () => {
    it('are exactly five, and none of them names our architecture', () => {
        const nav = MAIN.slice(MAIN.indexOf('<nav class="app-nav">'), MAIN.indexOf('</nav>'));
        const links = nav.match(/class="nav-link"/g) || [];
        expect(links).toHaveLength(5);
        expect(nav).not.toMatch(/Machine|Root|Satellite|Sync|Campaigns/);
    });
});
