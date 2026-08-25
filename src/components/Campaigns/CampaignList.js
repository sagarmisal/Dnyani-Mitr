// CampaignList — campaigns home: upcoming-occasion suggestion cards + history
// of past campaigns. Entry point to the CampaignBuilder.

import Router from '../../core/router.js';
import { t } from '../../utils/i18n.js';
import StateManager from '../../core/state.js';
import OccasionService from '../../services/OccasionService.js';
import CampaignService from '../../services/CampaignService.js';
import { formatDateShort } from '../../utils/formatters.js';
import { CAMPAIGN_STATUS } from '../../utils/constants.js';

const STATUS_BADGE = {
    [CAMPAIGN_STATUS.DRAFT]: { label: 'Draft', color: '#64748b' },
    [CAMPAIGN_STATUS.SENDING]: { label: 'Sending…', color: '#0ea5e9' },
    [CAMPAIGN_STATUS.SENT]: { label: 'Sent', color: '#16a34a' },
    [CAMPAIGN_STATUS.PARTIAL]: { label: 'Partial', color: '#d97706' },
    [CAMPAIGN_STATUS.CANCELLED]: { label: 'Not sent', color: '#dc2626' }
};

export class CampaignList {
    constructor() {
        this.container = null;
    }

    render() {
        this.container = document.createElement('div');
        this.container.className = 'campaign-list-page';

        const upcoming = OccasionService.upcomingWithin(30);
        const audience = CampaignService.buildRecipients({}); // all active, DND excluded
        const campaigns = StateManager.getCampaigns()
            .slice()
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

        this.container.innerHTML = `
            <div class="dashboard-header" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.75rem;">
                <div>
                    <h2>${t('camp.list')}</h2>
                    <p class="text-secondary">Send festival / occasion greetings & invitations in bulk.</p>
                </div>
                <button id="camp-new-btn" class="btn btn-primary">+ New Campaign</button>
            </div>

            <div class="card" style="margin-top:1rem;">
                <div class="card-header"><h3 class="card-title">${t('camp.upcoming')}</h3></div>
                <div class="card-body">
                    ${upcoming.length ? `
                        <div style="display:flex; flex-direction:column; gap:0.6rem;">
                            ${upcoming.map(u => this._occasionCard(u, audience.recipients.length)).join('')}
                        </div>
                    ` : `<p class="text-secondary">No occasions in the next 30 days. Add one in Settings → Occasions, or start a campaign for any date.</p>`}
                </div>
            </div>

            <div class="card" style="margin-top:1.5rem;">
                <div class="card-header"><h3 class="card-title">${t('camp.past')}</h3></div>
                <div class="card-body">
                    ${campaigns.length ? campaigns.map(c => this._campaignRow(c)).join('') : '<p class="text-secondary">No campaigns yet.</p>'}
                </div>
            </div>
        `;

        this._wire();
        return this.container;
    }

    _occasionCard(u, audienceCount) {
        const o = u.occasion;
        const when = u.daysUntil === 0 ? 'Today' : (u.daysUntil === 1 ? 'Tomorrow' : `in ${u.daysUntil} days`);
        return `
            <div style="display:flex; align-items:center; gap:0.75rem; padding:0.75rem; border:1px solid var(--color-border); border-radius:0.5rem;">
                <div style="flex:1; min-width:0;">
                    <strong>${this._esc(o.nameMr || o.name)}</strong>
                    <div class="text-secondary" style="font-size:0.85rem;">${when} · ${formatDateShort(u.isoDate)} · ≈ ${audienceCount} beneficiaries</div>
                </div>
                <button class="btn btn-primary btn-sm camp-from-occasion" data-id="${o.id}">${t('camp.create')}</button>
            </div>
        `;
    }

    _campaignRow(c) {
        const badge = STATUS_BADGE[c.status] || STATUS_BADGE[CAMPAIGN_STATUS.DRAFT];
        const channel = c.channel === 'whatsapp' ? '💬 WhatsApp' : '📱 SMS';
        const stats = c.stats || {};
        const sentLine = (c.status === CAMPAIGN_STATUS.SENT || c.status === CAMPAIGN_STATUS.PARTIAL)
            ? ` · ${stats.sent || 0}/${stats.total || 0} sent${stats.failed ? `, ${stats.failed} failed` : ''}`
            : '';
        return `
            <div style="display:flex; align-items:center; gap:0.5rem; padding:0.6rem 0; border-bottom:1px solid var(--color-border);">
                <div style="flex:1; min-width:0;">
                    <strong>${this._esc(c.name || 'Campaign')}</strong>
                    <div class="text-secondary" style="font-size:0.85rem;">
                        ${channel} · ${formatDateShort(c.date || c.createdAt)}${sentLine}
                    </div>
                </div>
                <span style="font-size:0.75rem; font-weight:600; color:${badge.color};">${badge.label}</span>
            </div>
        `;
    }

    _wire() {
        this.container.querySelector('#camp-new-btn')?.addEventListener('click', () => {
            Router.navigate('/campaigns/new');
        });
        this.container.querySelectorAll('.camp-from-occasion').forEach(btn => {
            btn.addEventListener('click', () => {
                Router.navigate(`/campaigns/new?occasionId=${encodeURIComponent(btn.dataset.id)}`);
            });
        });
    }

    _esc(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}
