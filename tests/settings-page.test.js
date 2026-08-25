// @vitest-environment happy-dom
/**
 * SettingsPage — characterization (Stage C.4).
 *
 * 571 lines, no tests, and it now holds the door to Backup — the screen that
 * gets a register back after a dead phone. Losing that link is the defect that
 * nearly shipped, so its presence is pinned here rather than assumed.
 *
 * It also carries the diagnostics (SMS permission, test sends). Those are ours,
 * not theirs, and a volunteer meeting them by accident is a different problem
 * from a missing translation.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('../src/core/activation.js', () => ({
    default: {
        getMachineInfo: () => ({ machineId: 'm', machineName: 'Office', machineRole: 'root' }),
        isActivated: () => true
    }
}));
import StateManager from '../src/core/state.js';
import StorageManager from '../src/core/storage.js';
import { SettingsPage } from '../src/components/Settings/SettingsPage.js';

function seed(settings = {}) {
    localStorage.clear();
    StateManager.init();
    const st = StorageManager.getDefaultState();
    st.settings = { ...st.settings, ...settings };
    StateManager.state = st;
    StorageManager.saveState(st);
    document.body.innerHTML = '';
}
function mount() {
    const v = new SettingsPage();
    const el = v.render();
    document.body.appendChild(el);
    return { v, el };
}

describe('it renders', () => {
    it('with default settings', () => {
        seed();
        expect(() => mount()).not.toThrow();
    });

    it('with an organisation name set', () => {
        seed({ organizationName: 'भगवान बाबा बालिकाश्रम' });
        expect(mount().el.querySelector('input')).toBeTruthy();
    });

    it('with settings entirely missing — an old record, or one from merge', () => {
        localStorage.clear();
        StateManager.init();
        const st = StorageManager.getDefaultState();
        delete st.settings;
        StateManager.state = st;
        expect(() => mount()).not.toThrow();
    });
});

describe('the doors it holds open', () => {
    beforeEach(() => seed());

    it('links to Backup — the defect that nearly shipped', () => {
        // When the nav went from eight tabs to five, Sync lost its tab and no
        // replacement door was added. An NGO could not have backed up at all.
        expect(mount().el.querySelector('a[href*="sync"]')).toBeTruthy();
    });

    it('links to the history and the campaigns that also lost their tabs', () => {
        const el = mount().el;
        expect(el.querySelector('a[href*="interactions"], a[href*="history"]')).toBeTruthy();
        expect(el.querySelector('a[href*="campaigns"]')).toBeTruthy();
    });

    it('puts backup first among them', () => {
        // PR-5: it is the one behaviour we ask for. It leads, or it is just
        // another row in a list of settings.
        const links = [...mount().el.querySelectorAll('.lg-more-item')];
        expect(links.length).toBeGreaterThan(0);
        expect(links[0].getAttribute('href')).toContain('sync');
    });
});

describe('what it lets a person change', () => {
    beforeEach(() => seed());

    it('offers the organisation name — the thing that makes the app theirs', () => {
        const el = mount().el;
        const input = el.querySelector('#org-name, [id*="org"]');
        expect(input, 'no organisation name field').toBeTruthy();
    });

    it('offers the opening screen', () => {
        expect(mount().el.querySelector('#landing-screen')).toBeTruthy();
    });

    it('offers message templates', () => {
        expect(mount().el.querySelector('[id^="tpl-"]')).toBeTruthy();
    });
});
