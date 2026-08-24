// @vitest-environment happy-dom
//
// Render smoke test for the Iter 11 calendar (C6). The bundler proves the
// modules import; this proves render() actually executes against a DOM and
// produces the structure the plan specifies — including the day-pane ORDER,
// which is a decision (G10-R), not a detail.

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import StateManager from '../src/core/state.js';
import { CalendarView } from '../src/components/Calendar/CalendarView.js';
import { DayPane } from '../src/components/Calendar/DayPane.js';
import { ScheduledItemForm } from '../src/components/Calendar/ScheduledItemForm.js';
import { ScheduledItem } from '../src/models/ScheduledItem.js';
import CalendarService from '../src/services/CalendarService.js';
import { toLocalISODate } from '../src/utils/formatters.js';

const TODAY = toLocalISODate(new Date());

beforeAll(async () => {
    await StateManager.init();
    StateManager.addVisitor({
        id: 'v_cal', status: 'active', deletedAt: null, doNotContact: false,
        contacts: [{ relationType: 'SELF', id: 'c_cal', name: 'सुनीता पाटील', phones: ['9876543210'], dob: '1985-08-15' }]
    });
});

beforeEach(() => {
    StateManager.getScheduledItems().forEach(i => StateManager.deleteScheduledItem(i.id));
});

describe('CalendarView', () => {
    it('renders a 6x7 grid with weekday headers and a day pane', () => {
        const el = new CalendarView().render();
        expect(el.querySelectorAll('.calendar-cell')).toHaveLength(42);
        expect(el.querySelectorAll('.calendar-dow')).toHaveLength(7);
        expect(el.querySelector('.day-pane')).toBeTruthy();
    });

    it('shows the month in English and Marathi, and keeps a link back to My Day', () => {
        const el = new CalendarView({ date: '2026-08-20' }).render();
        expect(el.textContent).toContain('August 2026');
        expect(el.textContent).toContain('ऑगस्ट');
        expect(el.querySelector('a[href="#/dashboard"]')).toBeTruthy();
    });

    it('honours a deep-linked date and marks that cell selected', () => {
        const el = new CalendarView({ date: '2026-08-20' }).render();
        const selected = el.querySelector('.calendar-cell.is-selected');
        expect(selected.dataset.date).toBe('2026-08-20');
    });

    it('ignores a malformed deep link instead of throwing', () => {
        expect(() => new CalendarView({ date: 'yesterday' }).render()).not.toThrow();
    });

    it('moves to the next month when the forward control is used', () => {
        const view = new CalendarView({ date: '2026-08-20' });
        const el = view.render();
        el.querySelector('#cal-next').click();
        expect(view.container.textContent).toContain('September 2026');
    });

    it('renders a density dot for a day that has something on it', () => {
        StateManager.addScheduledItem(new ScheduledItem({ title: 'भेट', date: '2026-08-21' }).toJSON());
        const el = new CalendarView({ date: '2026-08-20' }).render();
        const cell = [...el.querySelectorAll('.calendar-cell')].find(c => c.dataset.date === '2026-08-21');
        expect(cell.querySelectorAll('.calendar-dot').length).toBeGreaterThan(0);
    });

    it('escapes user text rather than rendering it as markup (D3 bug class)', () => {
        StateManager.addScheduledItem(new ScheduledItem({
            title: '<img src=x onerror=alert(1)>', date: TODAY
        }).toJSON());
        const el = new CalendarView().render();
        expect(el.querySelector('img')).toBeNull();
        expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
    });
});

describe('DayPane ordering (G10-R)', () => {
    function pane(date = TODAY) {
        return new DayPane({ date, backlog: CalendarService.getOverdueBacklog() }).render();
    }

    it('puts "Coming to us" above "We are going"', () => {
        StateManager.addScheduledItem(new ScheduledItem({ title: 'we go', date: TODAY, direction: 'outbound' }).toJSON());
        StateManager.addScheduledItem(new ScheduledItem({ title: 'they come', date: TODAY, direction: 'inbound' }).toJSON());

        const headings = [...pane().querySelectorAll('.day-section h4')].map(h => h.textContent);
        const inboundAt = headings.findIndex(h => h.includes('Coming to us'));
        const outboundAt = headings.findIndex(h => h.includes('We are going'));
        expect(inboundAt).toBeGreaterThanOrEqual(0);
        expect(inboundAt).toBeLessThan(outboundAt);
    });

    it('says what you can do when nobody is coming, rather than "no items"', () => {
        expect(pane().textContent).toContain('Nobody has told us they are coming');
    });

    it('offers both creation entry points', () => {
        const el = pane();
        expect(el.querySelector('[data-add="inbound"]')).toBeTruthy();
        expect(el.querySelector('[data-add="outbound"]')).toBeTruthy();
    });

    it('offers backfill on a past day only', () => {
        expect(pane('2026-01-05').querySelector('#backfill')).toBeTruthy();
        expect(pane(TODAY).querySelector('#backfill')).toBeNull();
    });

    it('caps the catch-up list at 5 and offers the rest behind "+N more" (G17)', () => {
        const base = new Date();
        for (let n = 1; n <= 9; n++) {
            const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - n);
            StateManager.addScheduledItem(new ScheduledItem({ title: `missed ${n}`, date: toLocalISODate(d) }).toJSON());
        }
        // Derive the expectation rather than hardcoding it: other tests in this
        // file create supporters whose birthdays legitimately fall inside the
        // 30-day lookback, so a fixed count would make this order-dependent.
        const { total } = CalendarService.getOverdueBacklog();
        expect(total).toBeGreaterThanOrEqual(9);

        const el = pane();
        const backlog = el.querySelector('.day-backlog');
        expect(backlog.querySelectorAll('.day-item')).toHaveLength(5);
        expect(backlog.querySelector('#backlog-more').textContent).toContain(`+${total - 5} more`);
    });
});

describe('ScheduledItemForm', () => {
    it('leads with the phone field for an inbound visit', () => {
        const el = new ScheduledItemForm({ date: TODAY, direction: 'inbound' }).render();
        expect(el.querySelector('#si-phone')).toBeTruthy();
        expect(el.querySelector('#si-nophone')).toBeTruthy();
        expect(el.textContent).toContain('Someone is coming');
    });

    it('omits the phone and occasion fields for an outbound plan', () => {
        const el = new ScheduledItemForm({ date: TODAY, direction: 'outbound' }).render();
        expect(el.querySelector('#si-phone')).toBeNull();
        expect(el.querySelector('#si-occ-type')).toBeNull();
    });

    it('offers occasion capture with its own separate date', () => {
        // The controls are chips now (D-08), but the contract is unchanged:
        // an occasion type, a relation, and a date of its OWN — because people
        // come on the nearest Sunday, not on the birthday itself.
        const form = new ScheduledItemForm({ date: TODAY, direction: 'inbound' });
        const el = form.render();
        expect(el.querySelectorAll('.lg-chips--occasion .lg-chip').length).toBeGreaterThan(0);
        expect(el.querySelector('#si-occ-date')).toBeTruthy();
        expect(form.occRel.options.map(o => o.value)).toContain('CHILD');
    });

    it('keeps the occasion detail hidden until an occasion is chosen', () => {
        // Nothing to fill in until there is something to fill it in about.
        const form = new ScheduledItemForm({ date: TODAY, direction: 'inbound' });
        const el = form.render();
        expect(el.querySelector('.si-occ-detail').className).toContain('hidden');
        el.querySelector('.lg-chips--occasion .lg-chip').click();
        expect(el.querySelector('.si-occ-detail').className).not.toContain('hidden');
    });

    it('recognises a known supporter from their phone number', () => {
        const form = new ScheduledItemForm({ date: TODAY, direction: 'inbound' });
        const el = form.render();
        const phone = el.querySelector('#si-phone');
        phone.value = '9876543210';
        phone.dispatchEvent(new Event('input'));

        expect(form.matchedVisitor?.id).toBe('v_cal');
        expect(el.querySelector('#si-match').textContent).toContain('सुनीता पाटील');
    });

    it('offers to create a new supporter for an unknown number', () => {
        const form = new ScheduledItemForm({ date: TODAY, direction: 'inbound' });
        const el = form.render();
        const phone = el.querySelector('#si-phone');
        phone.value = '9000000001';
        phone.dispatchEvent(new Event('input'));

        expect(form.matchedVisitor).toBeNull();
        expect(el.querySelector('#si-match').textContent).toContain('नवीन');
    });

    it('refuses an inbound visit with neither phone nor name (D-20)', () => {
        // Previously this refused whenever the NAME was missing, which is the
        // inversion D-07 corrects. Now it refuses only when there is nothing
        // at all to find them by.
        const form = new ScheduledItemForm({ date: TODAY, direction: 'inbound' });
        const el = form.render();
        el.querySelector('#si-title').value = 'x';
        expect(() => form.save()).not.toThrow();
        expect(el.querySelector('.si-errors').className).not.toContain('hidden');
        expect(StateManager.getScheduledItems()).toHaveLength(0);
    });

    it('saves an inbound visit with a phone and NO name (D-07/PR-2)', () => {
        // The caller rang off before saying their name. That is a complete
        // record, not a degraded one — the number is what finds them later.
        const form = new ScheduledItemForm({ date: TODAY, direction: 'inbound' });
        const el = form.render();
        document.body.appendChild(el);
        el.querySelector('#si-phone').value = '9000000123';
        el.querySelector('#si-phone').dispatchEvent(new Event('input'));
        el.querySelector('#si-title').value = 'कुणीतरी येणार';
        form.save();

        const items = StateManager.getScheduledItems();
        expect(items).toHaveLength(1);
        expect(items[0].phone).toBe('9000000123');
    });

    it('saves an inbound visit and creates the supporter from the call (V4)', () => {
        const before = StateManager.getVisitors().length;
        const form = new ScheduledItemForm({ date: TODAY, direction: 'inbound' });
        const el = form.render();
        document.body.appendChild(el);

        el.querySelector('#si-phone').value = '9123456780';
        el.querySelector('#si-phone').dispatchEvent(new Event('input'));
        el.querySelector('#si-name').value = 'रमेश जाधव';
        el.querySelector('#si-title').value = 'रमेश जाधव यांची भेट';
        // Chips instead of dropdowns — same data, one tap each.
        el.querySelector('.lg-chips--occasion .lg-chip[data-value="Birthday"]').click();
        el.querySelector('#si-occ-date').value = '2020-08-18';
        el.querySelector('.si-occ-detail .lg-chip[data-value="CHILD"]').click();
        el.querySelector('#si-occ-whose').value = 'मुलगी';
        form.save();

        const items = StateManager.getScheduledItems();
        expect(items).toHaveLength(1);
        expect(items[0].direction).toBe('inbound');
        expect(items[0].phone).toBe('9123456780');
        expect(items[0].occasion.date).toBe('2020-08-18');

        // A new supporter, plus the daughter as a CHILD contact carrying the birthday
        // the reminder engine will surface every year from now on.
        const visitors = StateManager.getVisitors();
        expect(visitors).toHaveLength(before + 1);
        const created = visitors[visitors.length - 1];
        const child = created.contacts.find(c => c.relationType === 'CHILD');
        expect(child.dob).toBe('2020-08-18');
    });

    it('stores null — never a placeholder — when the caller gives no number', () => {
        const form = new ScheduledItemForm({ date: TODAY, direction: 'inbound' });
        const el = form.render();
        document.body.appendChild(el);

        el.querySelector('#si-nophone').checked = true;
        el.querySelector('#si-nophone').dispatchEvent(new Event('change'));
        el.querySelector('#si-name').value = 'No Number';
        el.querySelector('#si-title').value = 'walk-in';
        form.save();

        const saved = StateManager.getScheduledItems().slice(-1)[0];
        expect(saved.phone).toBeNull();
        expect(saved.visitorId).toBeNull();   // unlinkable, and honestly so
    });
});
