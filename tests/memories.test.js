// @vitest-environment happy-dom
/**
 * INITIATIVE.md P2.6 / P2.7 / UC-06 — "a year ago today".
 *
 * The only feature on the list the NGO asked for themselves, and it needs no
 * new data: every visit is already recorded, shown once, then discarded.
 *
 * The three guard blocks below are the feature. Without them it is a nice idea
 * that occasionally insults a supporter — telling someone who visited last
 * month that we miss them, or thanking them for a gift nobody recorded.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/core/activation.js', () => ({
    default: { getMachineInfo: () => ({ machineId: 'm', machineName: 'T', machineRole: 'root' }) }
}));

import StateManager from '../src/core/state.js';
import StorageManager from '../src/core/storage.js';
import CalendarService from '../src/services/CalendarService.js';

const DAY = 86400000;
const ago = (days) => new Date(Date.now() - days * DAY).toISOString();

function seed({ visitors = [], interactions = [] }) {
    localStorage.clear();
    StateManager.init();
    const st = StorageManager.getDefaultState();
    st.visitors = visitors;
    st.interactions = interactions;
    StateManager.state = st;
    StorageManager.saveState(st);
}

const visitor = (id, name, extra = {}) => ({
    id, isDeleted: false, contacts: [{ relationType: 'SELF', name, phones: ['982201' + id.slice(-4)] }], ...extra
});
const visit = (id, visitorId, date, extra = {}) =>
    ({ id, visitorId, interactionType: 'visit', interactionDate: date, notes: '', ...extra });

describe('finding the same date in previous years', () => {
    beforeEach(() => seed({
        visitors: [visitor('v1', 'सुनीता पाटील'), visitor('v2', 'रमेश जाधव')],
        interactions: [
            visit('i1', 'v1', '2025-08-24T12:00:00.000Z'),   // one year before
            visit('i2', 'v2', '2024-08-24T12:00:00.000Z'),   // two years before
            visit('i3', 'v1', '2026-08-24T12:00:00.000Z'),   // the same day THIS year
            visit('i4', 'v2', '2025-09-11T12:00:00.000Z')    // unrelated date
        ]
    }));

    it('returns visits from previous years on the same month and day', () => {
        const { items } = CalendarService.getMemories('2026-08-24');
        expect(items.map(i => i.interactionId).sort()).toEqual(['i1', 'i2']);
    });

    it('excludes the current year — that is today, not a memory', () => {
        const { items } = CalendarService.getMemories('2026-08-24');
        expect(items.find(i => i.interactionId === 'i3')).toBeUndefined();
    });

    it('says how long ago, so the card can label itself', () => {
        const { items } = CalendarService.getMemories('2026-08-24');
        expect(items.find(i => i.interactionId === 'i1').yearsAgo).toBe(1);
        expect(items.find(i => i.interactionId === 'i2').yearsAgo).toBe(2);
    });

    it('puts the most recent year first', () => {
        const { items } = CalendarService.getMemories('2026-08-24');
        expect(items[0].yearsAgo).toBe(1);
    });

    it('carries the name, so the card needs no second lookup', () => {
        const { items } = CalendarService.getMemories('2026-08-24');
        expect(items[0].visitorName).toBe('सुनीता पाटील');
    });
});

describe('GUARD 1 — never render an empty section', () => {
    it('widens to nearby days when the exact date has nothing, and says it did', () => {
        // Fewer than one visit per calendar date is normal. A blank section
        // reads as broken, so it widens rather than showing nothing.
        seed({
            visitors: [visitor('v1', 'सुनीता')],
            interactions: [visit('i1', 'v1', '2025-08-22T12:00:00.000Z')]   // two days off
        });
        const res = CalendarService.getMemories('2026-08-24');
        expect(res.items).toHaveLength(1);
        expect(res.widened).toBe(true);          // so the UI can say "around this time"
        expect(res.items[0].dayOffset).toBe(-2);
    });

    it('does not widen when the exact day already has something', () => {
        seed({
            visitors: [visitor('v1', 'सुनीता')],
            interactions: [
                visit('i1', 'v1', '2025-08-24T12:00:00.000Z'),
                visit('i2', 'v1', '2025-08-22T12:00:00.000Z')
            ]
        });
        const res = CalendarService.getMemories('2026-08-24');
        expect(res.widened).toBe(false);
        expect(res.items).toHaveLength(1);        // only the exact match
    });

    it('returns nothing, honestly, when there is genuinely nothing nearby', () => {
        seed({ visitors: [visitor('v1', 'सुनीता')], interactions: [visit('i1', 'v1', '2025-01-05T12:00:00.000Z')] });
        const res = CalendarService.getMemories('2026-08-24');
        expect(res.items).toEqual([]);
        expect(res.widened).toBe(false);          // the UI renders no section at all
    });
});

describe('GUARD 2 — never say "we miss you" to someone seen recently', () => {
    it('withholds it when they visited last month', () => {
        seed({
            visitors: [visitor('v1', 'सुनीता')],
            interactions: [
                visit('i1', 'v1', '2025-08-24T12:00:00.000Z'),   // the memory
                visit('i2', 'v1', ago(30))                        // but they came last month
            ]
        });
        const { items } = CalendarService.getMemories('2026-08-24');
        const mem = items.find(i => i.interactionId === 'i1');
        expect(mem.canSayMissYou).toBe(false);
        expect(mem.monthsSinceLastSeen).toBeLessThan(2);
    });

    it('allows it after a long silence', () => {
        seed({
            visitors: [visitor('v1', 'सुनीता')],
            interactions: [visit('i1', 'v1', '2025-08-24T12:00:00.000Z')]
        });
        const { items } = CalendarService.getMemories('2026-08-24');
        expect(items[0].canSayMissYou).toBe(true);
    });

    it('respects a caller-supplied threshold', () => {
        seed({
            visitors: [visitor('v1', 'सुनीता')],
            interactions: [visit('i1', 'v1', '2025-08-24T12:00:00.000Z'), visit('i2', 'v1', ago(200))]
        });
        expect(CalendarService.getMemories('2026-08-24', { missMonths: 12 })[ 'items' ][0].canSayMissYou).toBe(false);
        expect(CalendarService.getMemories('2026-08-24', { missMonths: 3 })['items'][0].canSayMissYou).toBe(true);
    });
});

describe('GUARD 3 — never claim thanks for a gift that was not recorded', () => {
    it('reports no contribution for a visit predating the field', () => {
        // Nobody recorded what past visitors brought. "Thank you for the meal"
        // would be inventing history in the NGO's name.
        seed({
            visitors: [visitor('v1', 'सुनीता')],
            interactions: [visit('i1', 'v1', '2025-08-24T12:00:00.000Z')]   // no contribution key at all
        });
        expect(CalendarService.getMemories('2026-08-24').items[0].contribution).toEqual([]);
    });

    it('reports one that WAS recorded, so the message may mention it', () => {
        seed({
            visitors: [visitor('v1', 'सुनीता')],
            interactions: [visit('i1', 'v1', '2025-08-24T12:00:00.000Z', { contribution: ['meal', 'books'] })]
        });
        expect(CalendarService.getMemories('2026-08-24').items[0].contribution).toEqual(['meal', 'books']);
    });
});

describe('people who must never appear', () => {
    it('skips a visitor marked do-not-contact', () => {
        seed({
            visitors: [visitor('v1', 'सुनीता', { doNotContact: true })],
            interactions: [visit('i1', 'v1', '2025-08-24T12:00:00.000Z')]
        });
        expect(CalendarService.getMemories('2026-08-24').items).toEqual([]);
    });

    it('skips a deleted visitor', () => {
        seed({
            visitors: [visitor('v1', 'सुनीता', { isDeleted: true })],
            interactions: [visit('i1', 'v1', '2025-08-24T12:00:00.000Z')]
        });
        expect(CalendarService.getMemories('2026-08-24').items).toEqual([]);
    });

    it('skips an interaction whose visitor no longer exists', () => {
        seed({ visitors: [], interactions: [visit('i1', 'ghost', '2025-08-24T12:00:00.000Z')] });
        expect(CalendarService.getMemories('2026-08-24').items).toEqual([]);
    });
});

describe('bad input does not throw', () => {
    beforeEach(() => seed({ visitors: [], interactions: [] }));
    it('handles a malformed or missing day key', () => {
        ['', null, undefined, 'not-a-date', '2026-13-45'].forEach(k => {
            expect(() => CalendarService.getMemories(k)).not.toThrow();
            expect(CalendarService.getMemories(k).items).toEqual([]);
        });
    });

    it('ignores an interaction with an unparseable date', () => {
        seed({
            visitors: [visitor('v1', 'सुनीता')],
            interactions: [visit('i1', 'v1', 'garbage')]
        });
        expect(() => CalendarService.getMemories('2026-08-24')).not.toThrow();
        expect(CalendarService.getMemories('2026-08-24').items).toEqual([]);
    });
});

describe('the day pane renders it — and renders it LAST', () => {
    it('shows a memory card when there is one', async () => {
        seed({
            visitors: [visitor('v1', 'सुनीता पाटील')],
            interactions: [visit('i1', 'v1', '2025-08-24T12:00:00.000Z', { contribution: ['meal'] })]
        });
        const { default: DayPane } = await import('../src/components/Calendar/DayPane.js');
        const el = new DayPane({ date: '2026-08-24', backlog: { items: [], total: 0 } }).render();

        expect(el.querySelector('.lg-memory')).toBeTruthy();
        expect(el.textContent).toContain('सुनीता पाटील');
        expect(el.textContent).toContain('जेवण');      // guard 3: the gift WAS recorded
    });

    it('renders no section at all when there is nothing (guard 1)', async () => {
        seed({ visitors: [], interactions: [] });
        const { default: DayPane } = await import('../src/components/Calendar/DayPane.js');
        const el = new DayPane({ date: '2026-08-24', backlog: { items: [], total: 0 } }).render();
        expect(el.querySelector('.lg-memories')).toBeNull();
    });

    it('offers thanks always, and "we miss you" only when honest (guard 2)', async () => {
        seed({
            visitors: [visitor('v1', 'सुनीता')],
            interactions: [visit('i1', 'v1', '2025-08-24T12:00:00.000Z'), visit('i2', 'v1', ago(20))]
        });
        const { default: DayPane } = await import('../src/components/Calendar/DayPane.js');
        const el = new DayPane({ date: '2026-08-24', backlog: { items: [], total: 0 } }).render();
        expect(el.querySelector('[data-thank]')).toBeTruthy();
        expect(el.querySelector('[data-miss]'), 'must not offer to miss someone seen 20 days ago').toBeNull();
    });

    it('comes after the sections a person still has to act on', async () => {
        // Iteration 11 decided "coming to us" leads the day. A memory is
        // pleasant; it is not more important than someone arriving today.
        seed({
            visitors: [visitor('v1', 'सुनीता')],
            interactions: [visit('i1', 'v1', '2025-08-24T12:00:00.000Z')]
        });
        const { default: DayPane } = await import('../src/components/Calendar/DayPane.js');
        const el = new DayPane({ date: '2026-08-24', backlog: { items: [], total: 0 } }).render();
        const html = el.innerHTML;
        const memoriesAt = html.indexOf('lg-memories');
        expect(memoriesAt).toBeGreaterThan(-1);
        // nothing that needs acting on may appear after it
        expect(html.slice(memoriesAt)).not.toContain('data-done');
    });
});
