// @vitest-environment happy-dom
/**
 * ReminderDashboard — characterization (protocol step 2, Stage B2).
 *
 * 709 lines, no tests, and it is the screen J2 depends on: who to reach out to
 * today. These pin what it does BEFORE it is translated and rebuilt, so any
 * change to behaviour is deliberate rather than discovered later by an NGO.
 *
 * Characterization, not specification: several of these describe behaviour I
 * would not choose. They are here because they are what the screen does today.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('../src/core/activation.js', () => ({
    default: { getMachineInfo: () => ({ machineId: 'm', machineName: 'T', machineRole: 'root' }) }
}));
import StateManager from '../src/core/state.js';
import StorageManager from '../src/core/storage.js';
import { ReminderDashboard } from '../src/components/Reminders/ReminderDashboard.js';

const DAY = 86400000;
const ago = d => new Date(Date.now() - d * DAY).toISOString();
/** A birthday N days from today, so it lands in a known bucket. */
function birthdayIn(days) {
    const d = new Date(Date.now() + days * DAY);
    return `1978-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function seed(visitors, interactions = []) {
    localStorage.clear();
    StateManager.init();
    const st = StorageManager.getDefaultState();
    st.visitors = visitors;
    st.interactions = interactions;
    StateManager.state = st;
    StorageManager.saveState(st);
}

const person = (id, name, dob, extra = {}) => ({
    id, isDeleted: false, status: 'active',
    contacts: [{ id: 'c_' + id, relationType: 'SELF', name, phones: ['98220' + id.slice(-5).padStart(5, '1')],
                 emails: [], dob, customEvents: [] }],
    ...extra
});

function mount() {
    const view = new ReminderDashboard();
    const el = view.render();
    document.body.appendChild(el);
    return { view, el };
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('it renders at all', () => {
    it('renders with an empty register without throwing', () => {
        seed([]);
        expect(() => mount()).not.toThrow();
    });

    it('renders with reminders present', () => {
        seed([person('v1', 'सुनीता पाटील', birthdayIn(3))]);
        const { el } = mount();
        expect(el.textContent).toContain('सुनीता पाटील');
    });

    it('survives a visitor with no date of birth', () => {
        seed([person('v2', 'रमेश', null)]);
        expect(() => mount()).not.toThrow();
    });

    it('survives a contact with no name', () => {
        seed([person('v3', '', birthdayIn(2))]);
        expect(() => mount()).not.toThrow();
    });
});

describe('who it shows and who it hides', () => {
    it('hides a do-not-contact visitor', () => {
        seed([person('v1', 'सुनीता', birthdayIn(3), { doNotContact: true })]);
        const { el } = mount();
        expect(el.textContent).not.toContain('सुनीता');
    });

    it('hides a deleted visitor', () => {
        seed([person('v1', 'सुनीता', birthdayIn(3), { isDeleted: true, status: 'deleted' })]);
        const { el } = mount();
        expect(el.textContent).not.toContain('सुनीता');
    });
});

describe('the screen has controls', () => {
    it('offers a search box', () => {
        seed([person('v1', 'सुनीता', birthdayIn(3))]);
        const { el } = mount();
        expect(el.querySelector('input[type="text"], input[type="search"], input:not([type])')).toBeTruthy();
    });

    it('offers filters', () => {
        seed([person('v1', 'सुनीता', birthdayIn(3))]);
        const { el } = mount();
        expect(el.querySelectorAll('select').length).toBeGreaterThan(0);
    });
});

describe('what it says', () => {
    // The characterization that used to live here asserted the screen STILL
    // carried English, so it would go red when the sweep reached it. It did
    // not: it passed on variable names — `upcoming`, `ReminderService` — long
    // after the last user-visible English was gone. A vacuous test, and the
    // same mistake as every other proxy in this project.
    //
    // Replaced with the property itself, which is what should have been
    // asserted from the start.
    it('carries no user-visible English', async () => {
        const { readFileSync } = await import('node:fs');
        const src = readFileSync('src/components/Reminders/ReminderDashboard.js', 'utf8');
        const pattern = /(?:>|placeholder="|title="|aria-label=")\s*([A-Z][A-Za-z][A-Za-z ()\/-]{2,40})\s*(?:<|")/g;
        const found = [...src.matchAll(pattern)].map(m => m[1].trim());
        expect(found, 'untranslated strings still on screen').toEqual([]);
    });

    it('never scolds — D-10', async () => {
        const { readFileSync } = await import('node:fs');
        const src = readFileSync('src/components/Reminders/ReminderDashboard.js', 'utf8');
        const banned = /(?:>|["'`])\s*(Overdue|Never contacted|Follow-ups Due)\b/;
        const bad = src.split('\n').filter(l =>
            !l.trim().startsWith('//') && !l.trim().startsWith('*') && banned.test(l));
        expect(bad).toEqual([]);
    });
});
