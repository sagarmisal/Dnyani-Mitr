// @vitest-environment happy-dom
/**
 * SyncManager — characterization (Stage C.1, protocol step 2).
 *
 * 906 lines, no test, and the only screen whose failure is unrecoverable: it is
 * how a register survives a dead phone. It is being translated and rebuilt, so
 * these pin what it does FIRST.
 *
 * Characterization, not specification. Some of this describes behaviour I would
 * not choose. It is here because it is what the screen does today, and the
 * point is that a rebuild cannot change it by accident.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/core/activation.js', () => ({
    default: {
        getMachineInfo: () => ({ machineId: 'm_root', machineName: 'Office', machineRole: 'root' }),
        isActivated: () => true
    }
}));

import StateManager from '../src/core/state.js';
import StorageManager from '../src/core/storage.js';
import { SyncManager } from '../src/components/Sync/SyncManager.js';

function seed({ visitors = 2, syncLog = [], machines = {} } = {}) {
    localStorage.clear();
    StateManager.init();
    const st = StorageManager.getDefaultState();
    st.visitors = Array.from({ length: visitors }, (_, i) => ({
        id: 'v' + i, isDeleted: false, status: 'active',
        contacts: [{ relationType: 'SELF', name: i % 2 ? 'सुनीता पाटील' : 'Ramesh',
                     phones: ['98220' + (10000 + i)], emails: [] }]
    }));
    st.interactions = [{ id: 'i1', visitorId: 'v0', interactionType: 'visit',
        interactionDate: '2026-08-10T12:00:00.000Z', contribution: ['meal'], thankedAt: null }];
    st.syncLog = syncLog;
    st.knownMachines = machines;
    StateManager.state = st;
    StorageManager.saveState(st);
}

function mount() {
    const view = new SyncManager();
    const el = view.render();
    document.body.appendChild(el);
    return { view, el };
}

beforeEach(() => { document.body.innerHTML = ''; });

describe('it renders in every state it can be in', () => {
    it('renders with a populated register', () => {
        seed();
        expect(() => mount()).not.toThrow();
    });

    it('renders with an empty register — a new device syncs before it has data', () => {
        seed({ visitors: 0 });
        expect(() => mount()).not.toThrow();
    });

    it('renders with a sync history', () => {
        seed({ syncLog: [{ at: '2026-08-01T00:00:00.000Z', machineId: 'm_other', direction: 'import' }] });
        expect(() => mount()).not.toThrow();
    });

    it('renders with known machines', () => {
        seed({ machines: { m_other: { name: 'Field phone', lastSeen: '2026-08-01' } } });
        expect(() => mount()).not.toThrow();
    });

    it('survives a corrupt syncLog entry rather than blanking the screen', () => {
        // If this screen throws, the way back from a dead phone is gone.
        seed({ syncLog: [{}, { at: 'nonsense' }, null] });
        expect(() => mount()).not.toThrow();
    });
});

describe('the controls a person needs are present', () => {
    beforeEach(() => seed());

    it('offers somewhere to paste a message that arrived', () => {
        const { el } = mount();
        expect(el.querySelector('textarea')).toBeTruthy();
    });

    it('offers buttons to act on', () => {
        const { el } = mount();
        expect(el.querySelectorAll('button').length).toBeGreaterThan(2);
    });

    it('shows how much space the register uses', () => {
        const { el } = mount();
        expect(el.textContent).toMatch(/KB|MB|बाइट|kB/i);
    });
});

describe('what it will not do', () => {
    it('does not claim a backup it has not produced', () => {
        // The class of defect that cost these NGOs their file backups before
        // v3.2.0: saveFile() reported success on three broken paths.
        seed();
        const { el } = mount();
        expect(el.textContent).not.toMatch(/backup saved|saved successfully|बॅकअप झाला/i);
    });

    it('warns that restoring replaces everything', () => {
        seed();
        const { el } = mount();
        expect(el.textContent).toMatch(/replace|बदल|सर्व/i);
    });
});

describe('the screen is reachable and self-consistent', () => {
    it('every class it uses is defined somewhere in the stylesheets', async () => {
        const { readFileSync } = await import('node:fs');
        const css = ['src/styles/main.css', 'src/styles/kit.css', 'src/styles/variables.css']
            .map(f => readFileSync(f, 'utf8')).join('\n');
        const src = readFileSync('src/components/Sync/SyncManager.js', 'utf8');
        const used = new Set();
        for (const m of src.matchAll(/class="([^"$]*)"/g)) {
            m[1].split(/\s+/).filter(Boolean).forEach(c => used.add(c));
        }
        const missing = [...used].filter(c => !new RegExp(`\\.${c.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?![\\w-])`).test(css));
        expect(missing, 'SyncManager uses undefined CSS classes').toEqual([]);
    });
});
