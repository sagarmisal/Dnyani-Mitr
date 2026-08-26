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
import StateManager from '../../core/state.js';
import { t } from '../../utils/i18n.js';
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
            ${this.renderBackupNudge()}
            ${this.renderTodayBar()}
            ${this.renderTiles()}
            <div class="card calendar-card">
                <div class="calendar-header">
                    <button class="btn btn-icon" id="cal-prev" aria-label="${t('nav.prevMonth')}">‹</button>
                    <div class="calendar-title">
                        <h2>${MONTHS_EN[this.month - 1]} ${this.year}</h2>
                        <span class="calendar-title-mr">${MONTHS_MR[this.month - 1]}</span>
                    </div>
                    <button class="btn btn-icon" id="cal-next" aria-label="${t('nav.nextMonth')}">›</button>
                </div>

                <div class="calendar-actions">
                    <button class="btn btn-sm" id="cal-today">${escapeHTML(t('action.today'))}</button>
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
        this.container.querySelector('#nudge-later')?.addEventListener('click', () => {
            // A week, not forever. The risk does not go away because they are busy.
            StateManager.updateSettings({ backupNudgeSnoozedUntil: Date.now() + 7 * 86400000 });
            this.refresh();
        });
        this.container.querySelector('#tile-inbound')?.addEventListener('click', () => this.openIntake(SCHEDULED_ITEM_DIRECTION.INBOUND));
        this.container.querySelector('#tile-outbound')?.addEventListener('click', () => this.openIntake(SCHEDULED_ITEM_DIRECTION.OUTBOUND));
        this.container.querySelector('#tile-thanks')?.addEventListener('click', () => {
            window.location.hash = ROUTES.REMINDERS;
        });
    }


    /**
     * The row that answers "how is today?" (P2.2, UC-05).
     *
     * The app used to open on a month grid, which answers "what date is it?" —
     * a question nobody had. These four counts are what a coordinator actually
     * wants to know before they have touched anything.
     *
     * Only ever facts. No count here is framed as a failing (D-10): "आभार बाकी"
     * is work outstanding, not a reproach.
     */
    /**
     * The one behaviour we ask for (PR-5, Stage B3).
     *
     * On Today rather than inside Sync, which is two taps away behind Settings.
     * A nudge nobody walks past is not a nudge — and Stage 0 found that nothing
     * in the app asked for this at all, while the whole design rests on them
     * doing it.
     *
     * States a fact and offers the action. It does not scold (D-10), and it can
     * be dismissed for a week: a nag that cannot be silenced gets the app closed
     * rather than the backup taken.
     */
    renderBackupNudge() {
        const settings = StateManager.getSettings() || {};
        const snoozeUntil = settings.backupNudgeSnoozedUntil || 0;
        if (Date.now() < snoozeUntil) return '';

        const log = StateManager.getState().syncLog || [];
        const last = log
            .map(e => new Date(e.at || e.date || e.exportedAt || 0).getTime())
            .filter(t => !isNaN(t) && t > 0)
            .sort((a, b) => b - a)[0];

        const DAYS = 14;
        const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
        if (last && days < DAYS) return '';

        const message = last ? t('nudge.stale', { days }) : t('nudge.never');
        return `
            <div class="lg-nudge" role="status">
                <span class="lg-nudge-icon">💾</span>
                <div class="lg-nudge-text">
                    <b>${escapeHTML(message)}</b>
                    <span>${escapeHTML(t('nudge.why'))}</span>
                </div>
                <div class="lg-nudge-actions">
                    <a class="lg-btn lg-btn--sm lg-btn--primary" href="#${ROUTES.SYNC}">${escapeHTML(t('nudge.action'))}</a>
                    <button class="lg-btn lg-btn--sm lg-btn--quiet" id="nudge-later">${escapeHTML(t('nudge.dismiss'))}</button>
                </div>
            </div>`;
    }

    renderTodayBar() {
        const c = CalendarService.getTodayCounts
            ? CalendarService.getTodayCounts()
            : this.computeTodayCounts();
        const stat = (n, key, emphasise = false) => `
            <div class="lg-stat${emphasise && n > 0 ? ' lg-stat--now' : ''}">
                <b>${n}</b><span>${escapeHTML(t(key))}</span>
            </div>`;
        return `
            <div class="lg-stats">
                ${stat(c.comingToday, 'stat.comingToday', true)}
                ${stat(c.occasions, 'stat.occasions')}
                ${stat(c.thanksDue, 'stat.thanksDue', true)}
                ${stat(c.notSeen, 'stat.notSeen')}
            </div>`;
    }

    /** Four large targets, easier to hit and — more to the point — to see. */
    renderTiles() {
        return `
            <div class="lg-tiles">
                <button class="lg-tile lg-tile--primary" id="tile-inbound">
                    <span class="lg-tile-icon">➕</span>
                    <span class="lg-tile-label">${escapeHTML(t('action.someoneComing'))}</span>
                </button>
                <button class="lg-tile" id="tile-thanks">
                    <span class="lg-tile-icon">💐</span>
                    <span class="lg-tile-label">${escapeHTML(t('action.sendThanks'))}</span>
                </button>
                <button class="lg-tile" id="tile-outbound">
                    <span class="lg-tile-icon">🗓️</span>
                    <span class="lg-tile-label">${escapeHTML(t('action.planVisit'))}</span>
                </button>
                <a class="lg-tile" href="#${ROUTES.DASHBOARD}">
                    <span class="lg-tile-icon">📄</span>
                    <span class="lg-tile-label">${escapeHTML(t('action.report'))}</span>
                </a>
            </div>`;
    }

    /** Derived on the spot — nothing here is stored, so nothing can go stale. */
    computeTodayCounts() {
        const today = toLocalISODate(new Date());
        const items = CalendarService.getItemsForRange(today, today).days[today] || [];
        const scheduled = items.filter(i => i.kind === 'scheduled');
        const interactions = StateManager.getInteractions() || [];

        // Thanks outstanding: a visit that happened, is not yet thanked, and is
        // recent enough to still be worth thanking. Unbounded, this becomes an
        // ever-growing accusation, which is the thing D-10 exists to prevent.
        const cutoff = Date.now() - 30 * 86400000;
        const thanksDue = interactions.filter(i =>
            !i.thankedAt &&
            i.interactionType === 'visit' &&
            new Date(i.interactionDate).getTime() >= cutoff
        ).length;

        const lastSeen = new Map();
        interactions.forEach(i => {
            const tms = new Date(i.interactionDate).getTime();
            if (!isNaN(tms) && (!lastSeen.has(i.visitorId) || tms > lastSeen.get(i.visitorId))) {
                lastSeen.set(i.visitorId, tms);
            }
        });
        const stale = Date.now() - 180 * 86400000;
        const notSeen = (StateManager.getVisitors() || [])
            .filter(v => !v.isDeleted && !v.doNotContact)
            .filter(v => (lastSeen.get(v.id) || 0) < stale).length;

        return {
            comingToday: scheduled.filter(i => i.direction !== 'outbound').length,
            occasions: items.filter(i => i.kind === 'event' || i.kind === 'occasion').length,
            thanksDue,
            notSeen
        };
    }

    renderMonthWide(items) {
        return `
            <div class="calendar-monthwide">
                <span class="calendar-monthwide-label">${t('cal.monthWide')}</span>
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

    openIntake(direction = SCHEDULED_ITEM_DIRECTION.INBOUND) {
        const form = new ScheduledItemForm({
            date: this.selectedDate,
            direction,
            onSaved: () => { this.refresh(); Toast.show(t('toast.saved'), 'success'); }
        });
        document.body.appendChild(form.render());
    }
}

export default CalendarView;
