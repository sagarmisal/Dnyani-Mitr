// CalendarView (Iter 11, Phase C) — the landing screen.
//
// Month grid + a day pane. The pane's order is decided, not arbitrary (G10-R):
//   1. Coming to us      — inbound visits, the primary flow
//   2. Needs catching up — the pinned overdue group, capped at 5 (G1/G17)
//   3. We are going      — the volunteer's own outbound plans
//   4. On this day       — birthdays, occasions, follow-ups, campaigns, logged visits
//
// Renders through CalendarService only; it derives nothing itself.

import CalendarService, { CALENDAR_ITEM_KINDS } from '../../services/CalendarService.js';
import { ROUTES } from '../../core/router.js';
import { Toast } from '../UI/Toast.js';
import { toLocalISODate } from '../../utils/formatters.js';
import { escapeHTML } from '../../utils/helpers.js';
import { SCHEDULED_ITEM_DIRECTION } from '../../utils/constants.js';
import ScheduledItemForm from './ScheduledItemForm.js';
import DayPane from './DayPane.js';

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_MR = ['जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जून',
    'जुलै', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर'];
const DOW_SUN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DOW_MON = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export class CalendarView {
    constructor(params = {}) {
        const today = new Date();
        const requested = typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
            ? params.date
            : null;

        this.selectedDate = requested || toLocalISODate(today);
        const anchor = new Date(this.selectedDate + 'T00:00:00');
        this.year = anchor.getFullYear();
        this.month = anchor.getMonth() + 1;
        this.container = null;
    }

    render() {
        this.container = document.createElement('div');
        this.container.className = 'calendar-view';
        this.refresh();
        return this.container;
    }

    refresh() {
        const matrix = CalendarService.getMonthMatrix(this.year, this.month);
        const backlog = CalendarService.getOverdueBacklog();
        const dow = matrix.weekStart === 1 ? DOW_MON : DOW_SUN;

        this.container.innerHTML = `
            <div class="card calendar-card">
                <div class="calendar-header">
                    <button class="btn btn-icon" id="cal-prev" aria-label="Previous month">‹</button>
                    <div class="calendar-title">
                        <h2>${MONTHS_EN[this.month - 1]} ${this.year}</h2>
                        <span class="calendar-title-mr">${MONTHS_MR[this.month - 1]}</span>
                    </div>
                    <button class="btn btn-icon" id="cal-next" aria-label="Next month">›</button>
                </div>

                <div class="calendar-actions">
                    <button class="btn btn-sm" id="cal-today">Today · आज</button>
                    <button class="btn btn-sm btn-primary" id="cal-inbound">＋ Someone is coming</button>
                    <a class="btn btn-sm btn-link" href="#${ROUTES.DASHBOARD}">📋 Today's summary</a>
                </div>

                ${matrix.monthWide.length ? this.renderMonthWide(matrix.monthWide) : ''}

                <div class="calendar-grid" role="grid">
                    ${dow.map(d => `<div class="calendar-dow" role="columnheader">${d}</div>`).join('')}
                    ${matrix.cells.map(cell => this.renderCell(cell)).join('')}
                </div>
            </div>

            <div id="calendar-day-pane"></div>
        `;

        const pane = new DayPane({
            date: this.selectedDate,
            backlog,
            onChange: () => this.refresh(),
            onNavigate: (date) => this.selectDate(date)
        });
        this.container.querySelector('#calendar-day-pane').appendChild(pane.render());

        this.attach();
    }

    renderMonthWide(items) {
        return `
            <div class="calendar-monthwide">
                <span class="calendar-monthwide-label">This month (no exact date)</span>
                ${items.map(i => `<span class="chip">${escapeHTML(i.contactName)} — ${escapeHTML(i.eventType)}</span>`).join('')}
            </div>
        `;
    }

    renderCell(cell) {
        const classes = ['calendar-cell'];
        if (!cell.inMonth) classes.push('is-outside');
        if (cell.isToday) classes.push('is-today');
        if (cell.date === this.selectedDate) classes.push('is-selected');
        // Overdue is signalled by a SHAPE and a count, not by colour alone —
        // colour-blind volunteers must be able to read it too (plan U5).
        if (cell.hasUnhandledPast) classes.push('has-overdue');

        const inbound = (cell.counts[CALENDAR_ITEM_KINDS.SCHEDULED] || 0);
        const dots = Math.min(cell.count, 3);

        return `
            <button class="${classes.join(' ')}" data-date="${cell.date}" role="gridcell"
                    aria-label="${cell.date}, ${cell.count} item${cell.count === 1 ? '' : 's'}">
                <span class="calendar-day-num">${cell.day}</span>
                ${cell.count ? `
                    <span class="calendar-dots">
                        ${Array.from({ length: dots }, () => '<i class="calendar-dot"></i>').join('')}
                        ${cell.count > 3 ? `<span class="calendar-more">+${cell.count - 3}</span>` : ''}
                    </span>` : ''}
                ${cell.hasUnhandledPast ? '<span class="calendar-flag" aria-hidden="true">!</span>' : ''}
                ${inbound ? '<span class="sr-only">has visits</span>' : ''}
            </button>
        `;
    }

    attach() {
        this.container.querySelector('#cal-prev').addEventListener('click', () => this.shiftMonth(-1));
        this.container.querySelector('#cal-next').addEventListener('click', () => this.shiftMonth(1));
        this.container.querySelector('#cal-today').addEventListener('click', () => {
            const today = toLocalISODate(new Date());
            const d = new Date();
            this.year = d.getFullYear();
            this.month = d.getMonth() + 1;
            this.selectedDate = today;
            this.refresh();
        });
        this.container.querySelector('#cal-inbound').addEventListener('click', () => this.openIntake());

        this.container.querySelectorAll('.calendar-cell').forEach(btn => {
            btn.addEventListener('click', () => this.selectDate(btn.dataset.date));
        });
    }

    shiftMonth(delta) {
        const d = new Date(this.year, this.month - 1 + delta, 1);
        this.year = d.getFullYear();
        this.month = d.getMonth() + 1;
        this.refresh();
    }

    selectDate(date) {
        this.selectedDate = date;
        const d = new Date(date + 'T00:00:00');
        // Selecting a leading/trailing cell should move the grid to that month,
        // otherwise the selection is invisible.
        if (d.getFullYear() !== this.year || d.getMonth() + 1 !== this.month) {
            this.year = d.getFullYear();
            this.month = d.getMonth() + 1;
        }
        this.refresh();
    }

    openIntake() {
        const form = new ScheduledItemForm({
            date: this.selectedDate,
            direction: SCHEDULED_ITEM_DIRECTION.INBOUND,
            onSaved: () => { this.refresh(); Toast.show('Visit added to the calendar.', 'success'); }
        });
        document.body.appendChild(form.render());
    }
}

export default CalendarView;
