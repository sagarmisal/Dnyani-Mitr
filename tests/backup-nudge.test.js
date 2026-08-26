// @vitest-environment happy-dom
/**
 * The backup nudge — ITERATION.md Stage B3, PR-5.
 *
 * PR-5 says we ask these NGOs for exactly one behaviour: take a backup before
 * you upgrade. Stage 0 found that NOTHING in the app asked for it, while the
 * entire recovery story rests on them doing it.
 *
 * It lives on Today, not inside Sync, which is two taps away behind Settings.
 * A nudge nobody walks past is not a nudge.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('../src/core/activation.js', () => ({
    default: { getMachineInfo: () => ({ machineId: 'm', machineName: 'T', machineRole: 'root' }) }
}));
import StateManager from '../src/core/state.js';
import StorageManager from '../src/core/storage.js';
import { CalendarView } from '../src/components/Calendar/CalendarView.js';

const DAY = 86400000;

function seed({ syncLog = [], settings = {} } = {}) {
    localStorage.clear();
    StateManager.init();
    const st = StorageManager.getDefaultState();
    st.syncLog = syncLog;
    st.settings = { ...st.settings, ...settings };
    StateManager.state = st;
    StorageManager.saveState(st);
}
const mount = () => new CalendarView({ date: '2026-08-25' }).render();

describe('when it appears', () => {
    it('appears when no backup has ever been taken', () => {
        seed({ syncLog: [] });
        expect(mount().querySelector('.lg-nudge')).toBeTruthy();
    });

    it('appears when the last backup is old', () => {
        seed({ syncLog: [{ at: new Date(Date.now() - 40 * DAY).toISOString() }] });
        const el = mount();
        expect(el.querySelector('.lg-nudge')).toBeTruthy();
        expect(el.textContent).toMatch(/40/);
    });

    it('stays away when a backup was taken recently', () => {
        seed({ syncLog: [{ at: new Date(Date.now() - 2 * DAY).toISOString() }] });
        expect(mount().querySelector('.lg-nudge')).toBeNull();
    });

    it('reads the most recent entry, not the first', () => {
        seed({ syncLog: [
            { at: new Date(Date.now() - 200 * DAY).toISOString() },
            { at: new Date(Date.now() - 1 * DAY).toISOString() }
        ] });
        expect(mount().querySelector('.lg-nudge')).toBeNull();
    });

    it('ignores unparseable entries rather than throwing', () => {
        seed({ syncLog: [{ at: 'not a date' }, { }] });
        expect(() => mount()).not.toThrow();
        expect(mount().querySelector('.lg-nudge')).toBeTruthy();
    });
});

describe('what it does and does not do', () => {
    it('offers the action, and the action goes to Sync', () => {
        seed({ syncLog: [] });
        const link = mount().querySelector('.lg-nudge-actions a');
        expect(link.getAttribute('href')).toContain('sync');
    });

    it('can be dismissed', () => {
        seed({ syncLog: [] });
        const el = mount();
        document.body.appendChild(el);
        el.querySelector('#nudge-later').click();
        expect(StateManager.getSettings().backupNudgeSnoozedUntil).toBeGreaterThan(Date.now());
    });

    it('comes back — a week, not forever', () => {
        // The risk does not go away because someone was busy on Tuesday.
        seed({ syncLog: [], settings: { backupNudgeSnoozedUntil: Date.now() + 7 * DAY } });
        expect(mount().querySelector('.lg-nudge')).toBeNull();

        seed({ syncLog: [], settings: { backupNudgeSnoozedUntil: Date.now() - DAY } });
        expect(mount().querySelector('.lg-nudge')).toBeTruthy();
    });

    it('does not scold — it states a fact and offers a way out (D-10)', () => {
        seed({ syncLog: [] });
        const text = mount().querySelector('.lg-nudge').textContent;
        expect(text).not.toMatch(/should have|failed|must|warning|error/i);
    });
});
