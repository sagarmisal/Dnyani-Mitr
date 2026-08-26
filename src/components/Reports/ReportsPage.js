// Reports — ITERATION.md Stage B1, J4, UC-10.
//
// The screen behind the अहवाल tab, which until now went to My Day.
//
// WHO THIS IS FOR
// ---------------
// The coordinator, once a quarter, the evening before a trustee meeting. They
// need one sentence — "forty-two people came, eighteen brought a meal" — and a
// spreadsheet to attach. If assembling that takes an afternoon, the app has not
// done its job, and the coordinator goes back to counting a paper register.
//
// TWO RULES THIS SCREEN FOLLOWS
//
// 1. It opens with this month already showing. A report screen that opens empty
//    and waits for you to pick dates is a form, and forms get abandoned (PR-2).
// 2. Every number is a thing that happened, never a metric. "किती जण आले", not
//    "engagement score" — which is exactly the column §6 removed from the CSV.

import StateManager from '../../core/state.js';
import ReportService from '../../services/ReportService.js';
import { Section, Chips, Empty } from '../UI/kit.js';
import { Toast } from '../UI/Toast.js';
import { t, getLang } from '../../utils/i18n.js';
import { escapeHTML, downloadFile } from '../../utils/helpers.js';
import { toLocalISODate } from '../../utils/formatters.js';
import { CONTRIBUTION_TYPES } from '../../utils/constants.js';

/** Named periods, because "last month" is what a person asks for. */
function periodRange(key, today = new Date()) {
    const y = today.getFullYear();
    const m = today.getMonth();
    const day = (yy, mm, dd) => toLocalISODate(new Date(yy, mm, dd));
    switch (key) {
        case 'lastMonth':
            return { from: day(y, m - 1, 1), to: day(y, m, 0) };
        case 'thisYear':
            return { from: day(y, 0, 1), to: day(y, 11, 31) };
        case 'thisMonth':
        default:
            return { from: day(y, m, 1), to: day(y, m + 1, 0) };
    }
}

export class ReportsPage {
    constructor() {
        this.period = 'thisMonth';
        this.range = periodRange('thisMonth');
        this.container = null;
    }

    render() {
        this.container = document.createElement('div');
        this.container.className = 'reports-page';
        this.refresh();
        return this.container;
    }

    refresh() {
        const s = ReportService.summarise(this.range);

        this.container.innerHTML = `
            <div class="card">
                <h2 class="lg-page-title">${escapeHTML(t('report.title'))}</h2>
                <label class="si-label">${escapeHTML(t('report.period'))}</label>
                <div id="rp-period"></div>
                <div class="si-row" id="rp-dates">
                    <div>
                        <label class="si-label" for="rp-from">${escapeHTML(t('report.from'))}</label>
                        <input class="si-input" id="rp-from" type="date" value="${escapeHTML(this.range.from || '')}">
                    </div>
                    <div>
                        <label class="si-label" for="rp-to">${escapeHTML(t('report.to'))}</label>
                        <input class="si-input" id="rp-to" type="date" value="${escapeHTML(this.range.to || '')}">
                    </div>
                </div>
            </div>

            <div class="card" id="rp-body"></div>

            <div class="card">
                <div class="lg-more-text" style="margin-bottom:10px">
                    <b>${escapeHTML(t('report.copyText'))}</b>
                    <span>${escapeHTML(t('report.copyHint'))}</span>
                </div>
                <div class="si-row-actions">
                    <button class="lg-btn lg-btn--primary" id="rp-csv">${escapeHTML(t('report.download'))}</button>
                    <button class="lg-btn lg-btn--quiet" id="rp-copy">${escapeHTML(t('report.copyText'))}</button>
                </div>
            </div>
        `;

        const chips = new Chips({
            options: [
                { value: 'thisMonth', label: t('report.thisMonth') },
                { value: 'lastMonth', label: t('report.lastMonth') },
                { value: 'thisYear', label: t('report.thisYear') }
            ],
            selected: [this.period],
            onChange: (vals) => this.setPeriod(vals[0])
        });
        this.container.querySelector('#rp-period').appendChild(chips.render());

        this.renderBody(s);
        this.attach();
    }

    renderBody(s) {
        const body = this.container.querySelector('#rp-body');

        // An empty period is an invitation to pick another, not a blank card.
        if (!s.interactions) {
            body.appendChild(Empty({
                message: `${t('report.empty')} ${t('report.emptyHint')}`
            }));
            return;
        }

        const stat = (n, key) =>
            `<div class="lg-stat"><b>${n}</b><span>${escapeHTML(t(key))}</span></div>`;

        const brought = Object.entries(s.brought)
            .sort((a, b) => b[1] - a[1])
            .map(([k, n]) => {
                const c = CONTRIBUTION_TYPES.find(x => x.value === k);
                const label = c ? (getLang() === 'mr' ? c.mr : c.en) : k;
                const icon = c ? c.icon : '';
                return `<div class="lg-row">
                    <div class="lg-row-main"><b class="lg-row-title">${escapeHTML(icon + ' ' + label)}</b></div>
                    <div class="lg-row-actions"><b>${n}</b></div>
                </div>`;
            }).join('');

        body.innerHTML = `
            <div class="lg-stats">
                ${stat(s.visits, 'report.visits')}
                ${stat(s.people, 'report.people')}
                ${stat(s.withContribution, 'report.brought')}
                ${stat(s.thanked, 'report.thanked')}
            </div>
            ${brought ? `<div class="lg-section"><span class="lg-section-label">${escapeHTML(t('report.whatBrought'))}</span></div>${brought}` : ''}
        `;
    }

    setPeriod(key) {
        // Clearing the chip leaves the dates as they are rather than blanking
        // the screen — the numbers on show stay the numbers you were reading.
        if (!key) return;
        this.period = key;
        this.range = periodRange(key);
        this.refresh();
    }

    attach() {
        const q = (sel) => this.container.querySelector(sel);

        const apply = () => {
            this.range = { from: q('#rp-from').value || null, to: q('#rp-to').value || null };
            this.period = null;
            this.refresh();
        };
        q('#rp-from').addEventListener('change', apply);
        q('#rp-to').addEventListener('change', apply);

        q('#rp-csv').addEventListener('click', () => {
            const csv = ReportService.generateVisitorCSV(this.range);
            const name = `report_${this.range.from || 'all'}_${this.range.to || 'all'}.csv`;
            // saveFile adds the UTF-8 BOM, without which Excel on Windows shows
            // every Marathi name as mojibake — and Excel is where this lands.
            downloadFile(csv, name, 'text/csv;charset=utf-8;');
        });

        q('#rp-copy').addEventListener('click', async () => {
            const text = this.asText(ReportService.summarise(this.range));
            try {
                await navigator.clipboard.writeText(text);
                Toast.show(t('report.copied'), 'success');
            } catch {
                // Clipboard is blocked in some WebViews. Say what happened and
                // give them the text rather than failing silently.
                Toast.show(text, 'info', 8000);
            }
        });
    }

    /** The sentence a coordinator reads out, not a data dump. */
    asText(s) {
        const org = (StateManager.getSettings()?.organizationName || '').trim();
        const mr = getLang() === 'mr';
        const lines = [
            org ? `${org} — ${t('report.title')}` : t('report.title'),
            `${s.from || ''} → ${s.to || ''}`,
            '',
            `${t('report.visits')}: ${s.visits}`,
            `${t('report.people')}: ${s.people}`,
            `${t('report.brought')}: ${s.withContribution}`,
            `${t('report.thanked')}: ${s.thanked}`
        ];
        const brought = Object.entries(s.brought).sort((a, b) => b[1] - a[1]);
        if (brought.length) {
            lines.push('', t('report.whatBrought'));
            brought.forEach(([k, n]) => {
                const c = CONTRIBUTION_TYPES.find(x => x.value === k);
                lines.push(`  ${c ? (mr ? c.mr : c.en) : k}: ${n}`);
            });
        }
        return lines.join('\n');
    }
}

export default ReportsPage;
