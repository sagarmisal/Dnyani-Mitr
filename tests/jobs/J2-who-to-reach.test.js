// @vitest-environment happy-dom
/**
 * J2 — Who should we reach out to today? A short, correct list.
 *
 * EXPECTED TO FAIL when written. The calendar half of J2 is tested; the screen
 * a coordinator actually opens — ReminderDashboard, 709 lines — has no tests
 * and no translation. A red test here is the honest state, not a blocker.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/core/activation.js', () => ({
    default: { getMachineInfo: () => ({ machineId: 'm', machineName: 'T', machineRole: 'root' }) }
}));

import StateManager from '../../src/core/state.js';
import StorageManager from '../../src/core/storage.js';
import CalendarService from '../../src/services/CalendarService.js';
import ThanksService from '../../src/services/ThanksService.js';

const DAY = 86400000;
const ago = d => new Date(Date.now() - d * DAY).toISOString();

function seed({ visitors = [], interactions = [] }) {
    localStorage.clear();
    StateManager.init();
    const st = StorageManager.getDefaultState();
    st.visitors = visitors;
    st.interactions = interactions;
    StateManager.state = st;
    StorageManager.saveState(st);
}

const visitor = (id, name, phone, extra = {}) => ({
    id, isDeleted: false,
    contacts: [{ relationType: 'SELF', name, phones: [phone], emails: [], dob: '1978-03-14', customEvents: [] }],
    ...extra
});
const visit = (id, vid, date, extra = {}) =>
    ({ id, visitorId: vid, interactionType: 'visit', interactionDate: date, notes: '', thankedAt: null, contribution: [], ...extra });

describe('J2 · who to reach out to today', () => {
    beforeEach(() => seed({
        visitors: [visitor('v1', 'सुनीता', '9822012345'), visitor('v2', 'रमेश', '9822012346')],
        interactions: [visit('i1', 'v1', ago(2)), visit('i2', 'v2', '2025-08-25T12:00:00.000Z')]
    }));

    it('the day tells you who is coming and who is owed thanks', () => {
        expect(ThanksService.pending().length).toBeGreaterThan(0);
    });

    it('a memory surfaces someone from a year ago', () => {
        const { items } = CalendarService.getMemories('2026-08-25');
        expect(items.length).toBeGreaterThan(0);
    });

    it('the list never scolds — no accusatory string reaches a screen', async () => {
        const { readFileSync } = await import('node:fs');
        const src = readFileSync('src/components/Reminders/ReminderDashboard.js', 'utf8');
        const banned = /(?:>|["'`])\s*(Overdue|Never contacted|Follow-ups Due)\b/;
        const bad = src.split('\n').filter((l, i) =>
            !l.trim().startsWith('//') && !l.trim().startsWith('*') && banned.test(l));
        expect(bad, 'ReminderDashboard still scolds').toEqual([]);
    });

    it('THE SCREEN ITSELF has a test — it is 709 lines and has none', async () => {
        // The gap. J2's calendar half is covered; the screen a coordinator
        // actually opens is not, so nothing would tell us if it broke.
        const { readdirSync, readFileSync } = await import('node:fs');
        const named = readdirSync('tests')
            .filter(f => f.endsWith('.js'))
            .map(f => readFileSync('tests/' + f, 'utf8'))
            .join('\n');
        const refs = (named.match(/ReminderDashboard/g) || []).length;
        expect(refs, 'no test names ReminderDashboard').toBeGreaterThan(0);
    });

    it('the screen speaks Marathi', async () => {
        const { readFileSync } = await import('node:fs');
        const src = readFileSync('src/components/Reminders/ReminderDashboard.js', 'utf8');
        expect(/\bt\('/.test(src), 'ReminderDashboard has no translated strings').toBe(true);
    });
});
