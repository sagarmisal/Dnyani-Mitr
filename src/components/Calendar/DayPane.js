// DayPane (Iter 11, C2/C2a/C2b) — everything on one day, in the order that
// matches how these NGOs actually work (G10-R): inbound first.

import CalendarService, { CALENDAR_ITEM_KINDS } from '../../services/CalendarService.js';
import ThanksService, { MESSAGE_KINDS } from '../../services/ThanksService.js';
import { CONTRIBUTION_TYPES } from '../../utils/constants.js';
import { t, getLang } from '../../utils/i18n.js';
import StateManager from '../../core/state.js';
import InteractionService from '../../services/InteractionService.js';
import { Toast } from '../UI/Toast.js';
import { ConfirmDialog } from '../UI/ConfirmDialog.js';
import { escapeHTML } from '../../utils/helpers.js';
import { toLocalISODate } from '../../utils/formatters.js';
import {
    SCHEDULED_ITEM_DIRECTION, SCHEDULED_ITEM_STATUS, SCHEDULED_ITEM_OUTCOME
} from '../../utils/constants.js';
import ScheduledItemForm from './ScheduledItemForm.js';

const BACKLOG_VISIBLE = 5;   // G17: show 5, then "+N more" — never a wall of failure

export class DayPane {
    constructor({ date, backlog, onChange, onNavigate }) {
        this.date = date;
        this.backlog = backlog || { items: [], total: 0 };
        this.onChange = onChange || (() => {});
        this.onNavigate = onNavigate || (() => {});
        this.showAllBacklog = false;
        this.container = null;
    }

    render() {
        this.container = document.createElement('div');
        this.container.className = 'day-pane card';
        this.refresh();
        return this.container;
    }

    refresh() {
        const { days } = CalendarService.getItemsForRange(this.date, this.date);
        const items = days[this.date] || [];
        const todayKey = toLocalISODate(new Date());
        const isToday = this.date === todayKey;
        const isPast = this.date < todayKey;

        const inbound = items.filter(i => i.kind === CALENDAR_ITEM_KINDS.SCHEDULED
            && i.direction === SCHEDULED_ITEM_DIRECTION.INBOUND);
        const outbound = items.filter(i => i.kind === CALENDAR_ITEM_KINDS.SCHEDULED
            && i.direction !== SCHEDULED_ITEM_DIRECTION.INBOUND);
        const rest = items.filter(i => i.kind !== CALENDAR_ITEM_KINDS.SCHEDULED);

        this.container.innerHTML = `
            <div class="day-pane-header">
                <h3>${this.formatDate()}</h3>
                <div class="day-pane-nav">
                    <button class="btn btn-icon" data-shift="-1" aria-label="Previous day">‹</button>
                    <button class="btn btn-icon" data-shift="1" aria-label="Next day">›</button>
                </div>
            </div>

            ${this.section('Coming to us · आपल्याकडे येणार', inbound, 'inbound')}
            ${isToday ? this.renderBacklog() : ''}
            ${this.section('We are going · आपण जाणार', outbound, 'outbound')}
            ${this.renderRest(rest)}
            ${this.renderMemories()}
            ${isPast ? this.renderBackfill() : ''}

            <div class="day-pane-actions">
                <button class="btn btn-primary btn-sm" data-add="inbound">＋ Someone is coming</button>
                <button class="btn btn-sm" data-add="outbound">＋ Plan a visit</button>
            </div>
        `;
        this.attach();
    }

    formatDate() {
        const d = new Date(this.date + 'T00:00:00');
        return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }

    section(title, items, kind) {
        if (!items.length) {
            // An empty state says what you can do, not "No items" (plan U6).
            if (kind === 'inbound') {
                return `<div class="day-section">
                    <h4>${title}</h4>
                    <p class="day-empty">Nobody has told us they are coming this day.</p>
                </div>`;
            }
            return '';
        }
        return `
            <div class="day-section">
                <h4>${title}</h4>
                <ul class="day-list">${items.map(i => this.renderScheduled(i)).join('')}</ul>
            </div>
        `;
    }

    renderScheduled(item) {
        const done = item.status === SCHEDULED_ITEM_STATUS.DONE;
        const cancelled = item.status === SCHEDULED_ITEM_STATUS.CANCELLED;
        const who = item.visitorName ? ` · ${escapeHTML(item.visitorName)}` : '';
        return `
            <li class="day-item ${done ? 'is-done' : ''} ${cancelled ? 'is-cancelled' : ''}"
                data-sched="${escapeHTML(item.scheduledItemId)}">
                <div class="day-item-main">
                    <span class="day-item-title">${escapeHTML(item.title)}</span>
                    <span class="day-item-meta">${item.time ? escapeHTML(item.time) + ' · ' : ''}${escapeHTML(item.type)}${who}</span>
                    ${item.notes ? `<span class="day-item-notes">${escapeHTML(item.notes)}</span>` : ''}
                </div>
                ${done || cancelled ? `<span class="day-item-state">${done ? '✓ done' : 'cancelled'}</span>` : `
                    <div class="day-item-actions">
                        <button class="btn btn-xs btn-primary" data-done="${escapeHTML(item.scheduledItemId)}">Done</button>
                        <button class="btn btn-xs" data-edit="${escapeHTML(item.scheduledItemId)}">Edit</button>
                    </div>`}
            </li>
        `;
    }

    renderBacklog() {
        const { items, total } = this.backlog;
        if (!total) return '';
        const shown = this.showAllBacklog ? items : items.slice(0, BACKLOG_VISIBLE);
        return `
            <div class="day-section day-backlog">
                <h4>Needs catching up · राहून गेलेले <span class="badge">${total}</span></h4>
                <ul class="day-list">
                    ${shown.map(i => `
                        <li class="day-item is-overdue">
                            <div class="day-item-main">
                                <span class="day-item-title">${escapeHTML(i.title)}</span>
                                <span class="day-item-meta">${escapeHTML(i.date)}</span>
                            </div>
                            <button class="btn btn-xs" data-goto="${escapeHTML(i.date)}">Open</button>
                        </li>`).join('')}
                </ul>
                ${!this.showAllBacklog && total > BACKLOG_VISIBLE
                    ? `<button class="btn btn-sm btn-link" id="backlog-more">+${total - BACKLOG_VISIBLE} more</button>`
                    : ''}
            </div>
        `;
    }

    renderRest(items) {
        if (!items.length) return '';
        return `
            <div class="day-section">
                <h4>On this day · या दिवशी</h4>
                <ul class="day-list">
                    ${items.map(i => `
                        <li class="day-item ${i.handled ? 'is-done' : ''}">
                            <div class="day-item-main">
                                <span class="day-item-title">${escapeHTML(i.title)}</span>
                                <span class="day-item-meta">${escapeHTML(this.kindLabel(i))}</span>
                            </div>
                            ${i.visitorId ? `<button class="btn btn-xs" data-visitor="${escapeHTML(i.visitorId)}">Open</button>` : ''}
                        </li>`).join('')}
                </ul>
            </div>
        `;
    }


    /**
     * "A year ago today" (UC-06, P2.6/P2.7) — the section the NGO asked for.
     *
     * Renders LAST in the day pane, always. A memory is pleasant; it is not
     * more important than someone arriving today, and Iteration 11 deliberately
     * put "coming to us" first.
     *
     * The three guards from getMemories() surface here as three rules:
     *   - the section is not rendered at all when there is nothing (guard 1)
     *   - "we miss you" appears only when it is honest (guard 2)
     *   - the gift is named only when one was actually recorded (guard 3)
     */
    /**
     * Say what actually happened, never what we hope happened (PR-3).
     *
     * We opened WhatsApp. We do not know whether the person pressed send, and
     * the message says so — "WhatsApp उघडलं", not "पाठवलं".
     */
    reportSend(res) {
        if (res.ok) {
            Toast.show(getLang() === 'mr'
                ? 'WhatsApp उघडलं. पाठवा आणि परत या.'
                : 'WhatsApp opened. Send it, then come back.', 'success');
            this.onChange?.();
            return;
        }
        Toast.show(
            res.reason === 'no-phone'
                ? (getLang() === 'mr' ? 'त्यांचा नंबर नाही, त्यामुळे पाठवता येत नाही.' : 'No number saved, so this cannot be sent.')
                : (getLang() === 'mr' ? 'हा संदेश पाठवता येत नाही.' : 'This message cannot be sent.'),
            'warning', 4000);
    }

    renderMemories() {
        const { items, widened, windowDays } = CalendarService.getMemories(this.date);
        if (!items.length) return '';          // guard 1 — never an empty section

        const label = (n) => n === 1
            ? (getLang() === 'mr' ? 'गेल्या वर्षी' : 'a year ago')
            : (getLang() === 'mr' ? `${n} वर्षांपूर्वी` : `${n} years ago`);

        return `
            <div class="day-section lg-memories">
                <div class="lg-section">
                    <span class="lg-section-label">${escapeHTML(t('today.yearAgo'))}</span>
                    <span class="lg-section-count">${items.length}</span>
                </div>
                ${widened ? `<p class="si-hint">${escapeHTML(getLang() === 'mr'
                    ? `याच सुमारास (±${windowDays} दिवस)`
                    : `around this time (±${windowDays} days)`)}</p>` : ''}
                ${items.map(m => this.renderMemory(m, label(m.yearsAgo))).join('')}
            </div>`;
    }

    renderMemory(m, when) {
        const gift = m.contribution.length
            ? CONTRIBUTION_TYPES
                .filter(c => m.contribution.includes(c.value))
                .map(c => `${c.icon} ${getLang() === 'mr' ? c.mr : c.en}`)
                .join(' · ')
            : '';

        return `
            <div class="lg-memory">
                <div class="lg-memory-when">${escapeHTML(m.date)} · ${escapeHTML(when)}</div>
                <b>${escapeHTML(m.visitorName)}</b>
                ${gift ? `<span class="lg-tag">${escapeHTML(gift)}</span>` : ''}
                ${m.notes ? `<span class="lg-memory-note">${escapeHTML(m.notes)}</span>` : ''}
                <div class="lg-memory-actions">
                    <button class="lg-btn lg-btn--sm lg-btn--primary"
                            data-thank="${escapeHTML(m.visitorId)}"
                            data-gift="${escapeHTML(m.contribution.join(','))}">
                        💐 ${escapeHTML(t('action.sendThanks'))}
                    </button>
                    ${m.canSayMissYou ? `
                        <button class="lg-btn lg-btn--sm" data-miss="${escapeHTML(m.visitorId)}">
                            ${escapeHTML(getLang() === 'mr' ? 'तुमची आठवण येते' : 'We miss you')}
                        </button>` : ''}
                </div>
            </div>`;
    }

    kindLabel(item) {
        switch (item.kind) {
            case CALENDAR_ITEM_KINDS.EVENT: return item.eventType;
            case CALENDAR_ITEM_KINDS.CONTACT_DUE: return 'contact due';
            case CALENDAR_ITEM_KINDS.OCCASION: return item.movable ? 'festival' : 'occasion';
            case CALENDAR_ITEM_KINDS.CAMPAIGN: return 'campaign';
            case CALENDAR_ITEM_KINDS.FOLLOW_UP: return 'follow-up';
            case CALENDAR_ITEM_KINDS.INTERACTION: return 'logged';
            default: return item.kind;
        }
    }

    /** C2b — the strongest reason a calendar beats a to-do list in the field. */
    renderBackfill() {
        return `
            <div class="day-section day-backfill">
                <button class="btn btn-sm" id="backfill">Log what happened that day</button>
            </div>
        `;
    }

    attach() {
        const q = (sel) => this.container.querySelectorAll(sel);

        q('[data-shift]').forEach(b => b.addEventListener('click', () => {
            const d = new Date(this.date + 'T00:00:00');
            d.setDate(d.getDate() + parseInt(b.dataset.shift, 10));
            this.onNavigate(toLocalISODate(d));
        }));

        q('[data-goto]').forEach(b => b.addEventListener('click', () => this.onNavigate(b.dataset.goto)));
        q('[data-visitor]').forEach(b => b.addEventListener('click', () => {
            window.location.hash = `#/visitor/view?id=${encodeURIComponent(b.dataset.visitor)}`;
        }));

        const more = this.container.querySelector('#backlog-more');
        if (more) more.addEventListener('click', () => { this.showAllBacklog = true; this.refresh(); });

        q('[data-add]').forEach(b => b.addEventListener('click', () => {
            const form = new ScheduledItemForm({
                date: this.date,
                direction: b.dataset.add,
                onSaved: () => this.onChange()
            });
            document.body.appendChild(form.render());
        }));

        q('[data-edit]').forEach(b => b.addEventListener('click', () => {
            const existing = StateManager.getScheduledItems().find(i => i.id === b.dataset.edit);
            if (!existing) return;
            const form = new ScheduledItemForm({ item: existing, onSaved: () => this.onChange() });
            document.body.appendChild(form.render());
        }));

        q('[data-done]').forEach(b => b.addEventListener('click', () => this.markDone(b.dataset.done)));

        // The memory card's two buttons (P2.10). Thanks is always offered;
        // "we miss you" only appears when getMemories judged it honest.
        q('[data-thank]').forEach(b => b.addEventListener('click', () => {
            const gift = (b.dataset.gift || '').split(',').filter(Boolean);
            const res = ThanksService.send(b.dataset.thank, {
                kind: gift.length ? MESSAGE_KINDS.THANKS_GIFT : MESSAGE_KINDS.THANKS,
                contribution: gift
            });
            this.reportSend(res);
        }));
        q('[data-miss]').forEach(b => b.addEventListener('click', () => {
            const res = ThanksService.send(b.dataset.miss, { kind: MESSAGE_KINDS.MISS });
            this.reportSend(res);
        }));

        const backfill = this.container.querySelector('#backfill');
        if (backfill) backfill.addEventListener('click', () => this.openBackfill());
    }

    /**
     * C4 + G14 — completion is ONE TAP and cannot fail. The item is closed and
     * the Interaction written immediately; the note field appears afterwards and
     * saves on blur. Nothing here can block a volunteer from marking a visit done.
     *
     * V7: an inbound visit is asked whether it actually happened first, because
     * thanking someone for a visit they never made is worse than staying silent.
     */
    async markDone(itemId) {
        const item = StateManager.getScheduledItems().find(i => i.id === itemId);
        if (!item) return;

        let outcome = SCHEDULED_ITEM_OUTCOME.HAPPENED;
        if (item.direction === SCHEDULED_ITEM_DIRECTION.INBOUND) {
            const came = await ConfirmDialog.show({
                title: 'Did they come?',
                message: `${item.visitorName || item.title} was expected on ${item.date}.`,
                confirmText: 'Yes, they came',
                cancelText: 'No, they did not',
                type: 'info'
            });
            outcome = came ? SCHEDULED_ITEM_OUTCOME.HAPPENED : SCHEDULED_ITEM_OUTCOME.NO_SHOW;
        }

        const updates = {
            status: SCHEDULED_ITEM_STATUS.DONE,
            completedAt: new Date().toISOString(),
            outcome
        };

        // Only a visit that HAPPENED and is linked to a known visitor writes an
        // Interaction — the data-flow rule, minus the two cases that would create
        // a false record (a no-show, and an unlinked item with no visitorId (G3)).
        if (outcome === SCHEDULED_ITEM_OUTCOME.HAPPENED && item.visitorId) {
            try {
                const interaction = InteractionService.log({
                    visitorId: item.visitorId,
                    interactionType: mapType(item.type),
                    notes: item.purpose || item.title,
                    interactionDate: new Date(item.date + 'T12:00:00').toISOString()
                });
                updates.interactionId = interaction?.id || null;
            } catch (err) {
                // Never let logging failure block completion.
                console.error('Could not log interaction for scheduled item:', err);
            }
        }

        StateManager.updateScheduledItem(itemId, updates);
        Toast.show(outcome === SCHEDULED_ITEM_OUTCOME.NO_SHOW ? 'Marked as did not come.' : 'Done.', 'success');
        this.onChange();
    }

    openBackfill() {
        const form = new ScheduledItemForm({
            date: this.date,
            direction: SCHEDULED_ITEM_DIRECTION.INBOUND,
            backfill: true,
            onSaved: () => this.onChange()
        });
        document.body.appendChild(form.render());
    }
}

function mapType(type) {
    switch (type) {
        case 'visit': return 'visit';
        case 'call': return 'call';
        case 'meeting': return 'meeting';
        default: return 'other';
    }
}

export default DayPane;
