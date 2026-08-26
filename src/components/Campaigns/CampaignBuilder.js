// CampaignBuilder — compose and send a bulk occasion campaign.
// Flow: occasion/date → message type + language + template (live preview) →
// channel → recipient targeting (live counts) → confirm → send hand-off to the
// existing SmsBatchQueue (SMS) / GreetingQueue (WhatsApp), which dispatch AND
// log one Interaction per recipient. Status/stats are recorded back.

import Router, { ROUTES } from '../../core/router.js';
import { t } from '../../utils/i18n.js';
import StateManager from '../../core/state.js';
import OccasionService from '../../services/OccasionService.js';
import CampaignService from '../../services/CampaignService.js';
import { SmsBatchQueue } from '../UI/SmsBatchQueue.js';
import { GreetingQueue } from '../UI/GreetingQueue.js';
import { Toast } from '../UI/Toast.js';
import { CAMPAIGN_CHANNELS, DEFAULT_CAMPAIGN_TEMPLATES } from '../../utils/constants.js';

// Above this audience size we recommend SMS (one-tap bulk) over WhatsApp
// (which is one tap per contact and ban-sensitive in volume).
const SMS_RECOMMEND_THRESHOLD = 25;

export class CampaignBuilder {
    constructor(occasionId = null) {
        this.container = null;
        const settings = StateManager.getSettings() || {};
        this.state = {
            occasionId: occasionId || '',
            messageType: 'greeting',                       // 'greeting' | 'invitation'
            language: settings.defaultCampaignLanguage || 'mr',
            channel: CAMPAIGN_CHANNELS.SMS,
            templateText: '',
            date: '',
            filter: { scope: 'all', city: '', category: '', tag: '', consentedOnly: false }
        };
        this.userEditedTemplate = false;
    }

    render() {
        this.container = document.createElement('div');
        this.container.className = 'campaign-builder-page';

        const occasions = OccasionService.list();
        const { cities, categories, tags } = this._distincts();

        // Seed template + date from the (optionally preselected) occasion.
        this.state.templateText = this._defaultTemplate();
        this.state.date = this._defaultDate();

        this.container.innerHTML = `
            <div class="dashboard-header" style="display:flex; align-items:center; gap:0.5rem;">
                <button id="camp-back" class="btn btn-secondary btn-sm">← Back</button>
                <h2 style="margin:0;">${t('camp.new')}</h2>
            </div>

            <div class="card" style="margin-top:1rem;">
                <div class="card-body">
                    <div class="setting-item">
                        <label for="cb-occasion">${t('camp.occasion')}</label>
                        <select id="cb-occasion" class="form-select">
                            <option value="">— Custom (no occasion) —</option>
                            ${occasions.map(o => `<option value="${o.id}" ${o.id === this.state.occasionId ? 'selected' : ''}>${this._esc(o.nameMr || o.name)}</option>`).join('')}
                        </select>
                    </div>

                    <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
                        <div class="setting-item" style="flex:1; min-width:150px;">
                            <label for="cb-date">${t('common.date')}</label>
                            <input id="cb-date" type="date" class="form-input" value="${this._esc(this.state.date)}" />
                        </div>
                        <div class="setting-item" style="flex:1; min-width:150px;">
                            <label for="cb-type">${t('camp.messageType')}</label>
                            <select id="cb-type" class="form-select">
                                <option value="greeting">${t('camp.greeting')}</option>
                                <option value="invitation">${t('camp.invitation')}</option>
                            </select>
                        </div>
                        <div class="setting-item" style="flex:1; min-width:150px;">
                            <label for="cb-lang">${t('common.language')}</label>
                            <select id="cb-lang" class="form-select">
                                <option value="mr" ${this.state.language === 'mr' ? 'selected' : ''}>मराठी (Marathi)</option>
                                <option value="en" ${this.state.language === 'en' ? 'selected' : ''}>${t('set.english')}</option>
                            </select>
                        </div>
                    </div>

                    <div class="setting-item">
                        <label for="cb-template">${t('common.message')}</label>
                        <textarea id="cb-template" class="form-textarea" rows="4">${this._esc(this.state.templateText)}</textarea>
                        <div class="setting-help">Tokens: {name} {org} {occasion} {tagline}</div>
                    </div>

                    <div class="setting-item">
                        <label>${t('common.preview')}</label>
                        <div id="cb-preview" style="white-space:pre-wrap; padding:0.75rem; background:var(--color-surface); border:1px solid var(--color-border); border-radius:0.5rem; font-size:0.9rem;"></div>
                    </div>
                </div>
            </div>

            <div class="card" style="margin-top:1.5rem;">
                <div class="card-header"><h3 class="card-title">${t('camp.channel')}</h3></div>
                <div class="card-body">
                    <div style="display:flex; gap:1rem; flex-wrap:wrap;">
                        <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer;">
                            <input type="radio" name="cb-channel" value="sms" ${this.state.channel === 'sms' ? 'checked' : ''}/> 📱 SMS (one-tap bulk, from your SIM)
                        </label>
                        <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer;">
                            <input type="radio" name="cb-channel" value="whatsapp" ${this.state.channel === 'whatsapp' ? 'checked' : ''}/> 💬 WhatsApp (one chat at a time)
                        </label>
                    </div>
                    <div id="cb-channel-hint" class="setting-help"></div>
                </div>
            </div>

            <div class="card" style="margin-top:1.5rem;">
                <div class="card-header"><h3 class="card-title">${t('camp.recipients')}</h3></div>
                <div class="card-body">
                    <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
                        <div class="setting-item" style="flex:1; min-width:150px;">
                            <label for="cb-city">${t('common.city')}</label>
                            <select id="cb-city" class="form-select"><option value="">${t('common.allCities')}</option>${cities.map(c => `<option value="${this._esc(c)}">${this._esc(c)}</option>`).join('')}</select>
                        </div>
                        <div class="setting-item" style="flex:1; min-width:150px;">
                            <label for="cb-category">${t('common.category')}</label>
                            <select id="cb-category" class="form-select"><option value="">${t('common.allCategories')}</option>${categories.map(c => `<option value="${this._esc(c)}">${this._esc(c)}</option>`).join('')}</select>
                        </div>
                        <div class="setting-item" style="flex:1; min-width:150px;">
                            <label for="cb-tag">Tag</label>
                            <select id="cb-tag" class="form-select"><option value="">${t('common.anyTag')}</option>${tags.map(c => `<option value="${this._esc(c)}">${this._esc(c)}</option>`).join('')}</select>
                        </div>
                    </div>
                    <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer; margin-top:0.25rem;">
                        <input type="checkbox" id="cb-consented" /> ${t('camp.consentOnly')}
                    </label>
                    <div id="cb-count" style="margin-top:0.75rem; font-weight:600;"></div>
                    <div id="cb-excluded" class="setting-help"></div>
                </div>
            </div>

            <div style="display:flex; gap:0.5rem; margin-top:1.5rem;">
                <button id="cb-send" class="btn btn-primary">Review & Send</button>
                <button id="cb-cancel" class="btn btn-secondary">${t('action.cancel')}</button>
            </div>
        `;

        // Set initial selects that depend on state
        this.container.querySelector('#cb-type').value = this.state.messageType;

        this._wire();
        this._refreshPreview();
        this._refreshCounts();
        return this.container;
    }

    _wire() {
        const $ = (s) => this.container.querySelector(s);

        $('#camp-back').addEventListener('click', () => Router.navigate(ROUTES.CAMPAIGNS));
        $('#cb-cancel').addEventListener('click', () => Router.navigate(ROUTES.CAMPAIGNS));

        // Changing occasion/type/language resets the template to the new default
        // (unless the user has hand-edited — then we ask before overwriting).
        const resetTemplate = () => {
            if (this.userEditedTemplate) {
                if (!confirm('Replace your edited message with this occasion/type/language template?')) return;
            }
            this.state.templateText = this._defaultTemplate();
            $('#cb-template').value = this.state.templateText;
            this.userEditedTemplate = false;
            this._refreshPreview();
        };

        $('#cb-occasion').addEventListener('change', (e) => {
            this.state.occasionId = e.target.value;
            this.state.date = this._defaultDate();
            $('#cb-date').value = this.state.date;
            resetTemplate();
        });
        $('#cb-type').addEventListener('change', (e) => { this.state.messageType = e.target.value; resetTemplate(); });
        $('#cb-lang').addEventListener('change', (e) => { this.state.language = e.target.value; resetTemplate(); });
        $('#cb-date').addEventListener('change', (e) => { this.state.date = e.target.value; });

        $('#cb-template').addEventListener('input', (e) => {
            this.state.templateText = e.target.value;
            this.userEditedTemplate = true;
            this._refreshPreview();
        });

        this.container.querySelectorAll('input[name="cb-channel"]').forEach(r => {
            r.addEventListener('change', (e) => { this.state.channel = e.target.value; this._refreshChannelHint(); });
        });

        ['#cb-city', '#cb-category', '#cb-tag'].forEach(sel => {
            $(sel).addEventListener('change', () => this._refreshCounts());
        });
        $('#cb-consented').addEventListener('change', () => this._refreshCounts());

        $('#cb-send').addEventListener('click', () => this._send());
    }

    // ─── live preview + counts ─────────────────────────────────────────────
    _refreshPreview() {
        const occasion = this._selectedOccasion();
        const occasionName = occasion ? (this.state.language === 'mr' ? (occasion.nameMr || occasion.name) : (occasion.name || occasion.nameMr)) : '';
        const sample = this._sampleName();
        const items = CampaignService.prepareItems(
            [{ visitorId: null, name: sample, phone: '0000000000' }],
            { templateText: this.state.templateText, language: this.state.language, occasionName, campaignName: '' }
        );
        const el = this.container.querySelector('#cb-preview');
        if (el) el.textContent = items[0] ? items[0].message : '';
    }

    _refreshCounts() {
        const filter = this._currentFilter();
        const { recipients, counts } = CampaignService.buildRecipients(filter);
        const countEl = this.container.querySelector('#cb-count');
        const exEl = this.container.querySelector('#cb-excluded');
        if (countEl) countEl.textContent = `${recipients.length} recipient${recipients.length === 1 ? '' : 's'} will receive this message`;
        if (exEl) {
            const parts = [];
            if (counts.excludedDnc) parts.push(`${counts.excludedDnc} Do-Not-Contact`);
            if (counts.excludedNoConsent) parts.push(`${counts.excludedNoConsent} no consent`);
            if (counts.excludedNoPhone) parts.push(`${counts.excludedNoPhone} no phone`);
            exEl.textContent = parts.length ? `Excluded: ${parts.join(', ')}` : '';
        }
        this._refreshChannelHint(recipients.length);
    }

    _refreshChannelHint(count = null) {
        const el = this.container.querySelector('#cb-channel-hint');
        if (!el) return;
        const n = count != null ? count : CampaignService.buildRecipients(this._currentFilter()).recipients.length;
        if (this.state.channel === 'whatsapp' && n > SMS_RECOMMEND_THRESHOLD) {
            el.innerHTML = `⚠️ ${n} recipients via WhatsApp is one chat at a time. <strong>${t('camp.smsRecommended')}</strong> for large lists.`;
        } else if (this.state.channel === 'sms') {
            el.textContent = 'SMS sends from your phone\'s SIM. Standard carrier charges apply; needs the Android app + SMS permission.';
        } else {
            el.textContent = 'WhatsApp opens one chat at a time; you tap send for each. Good for small / priority lists.';
        }
    }

    // ─── send ──────────────────────────────────────────────────────────────
    _send() {
        const filter = this._currentFilter();
        const { recipients } = CampaignService.buildRecipients(filter);
        if (!recipients.length) { Toast.show(`${t('p.noRecipients')}`, 'warning'); return; }
        if (!this.state.templateText.trim()) { Toast.show(`${t('p.messageEmpty')}`, 'warning'); return; }

        const occasion = this._selectedOccasion();
        const occasionName = occasion ? (this.state.language === 'mr' ? (occasion.nameMr || occasion.name) : (occasion.name || occasion.nameMr)) : '';
        const channelLabel = this.state.channel === 'whatsapp' ? 'WhatsApp' : 'SMS';

        if (!confirm(`Send this ${this.state.messageType} to ${recipients.length} recipient(s) via ${channelLabel}?`)) return;

        const name = occasionName
            ? `${occasionName} ${this.state.messageType}`
            : `${this.state.messageType[0].toUpperCase()}${this.state.messageType.slice(1)} — ${this.state.date}`;

        const campaign = CampaignService.createCampaign({
            name,
            occasionId: this.state.occasionId || null,
            channel: this.state.channel,
            language: this.state.language,
            messageTemplate: this.state.templateText,
            date: this.state.date,
            recipientFilter: filter
        });

        const items = CampaignService.prepareItems(recipients, {
            templateText: this.state.templateText,
            language: this.state.language,
            occasionName,
            campaignName: campaign.name
        });

        CampaignService.markSending(campaign.id, recipients.map(r => r.visitorId));

        const finish = ({ sent = 0, failed = 0, skipped = 0 }) => {
            CampaignService.recordResult(campaign.id, { sent, failed, skipped, total: recipients.length });
            Toast.show(`Campaign "${campaign.name}": ${sent}/${recipients.length} sent.`, sent > 0 ? 'success' : 'warning', 5000);
            Router.navigate(ROUTES.CAMPAIGNS);
        };

        if (this.state.channel === CAMPAIGN_CHANNELS.WHATSAPP) {
            GreetingQueue.start(items, (fs) => finish({
                sent: (fs.sent || []).length,
                skipped: (fs.skipped || []).length
            }));
        } else {
            SmsBatchQueue.start(items, (st) => finish({
                sent: st.sent || 0,
                failed: st.failed || 0
            }));
        }
    }

    // ─── helpers ───────────────────────────────────────────────────────────
    _selectedOccasion() {
        if (!this.state.occasionId) return null;
        return OccasionService.list().find(o => o.id === this.state.occasionId) || null;
    }

    _defaultTemplate() {
        const occasion = this._selectedOccasion();
        const lang = this.state.language;
        const type = this.state.messageType;
        if (occasion && occasion.templates && occasion.templates[type] && occasion.templates[type][lang]) {
            return occasion.templates[type][lang];
        }
        return (DEFAULT_CAMPAIGN_TEMPLATES[type] && DEFAULT_CAMPAIGN_TEMPLATES[type][lang]) || '';
    }

    _defaultDate() {
        const occasion = this._selectedOccasion();
        if (occasion) {
            const d = OccasionService.nextOccurrence(occasion);
            if (d) {
                const pad = (n) => String(n).padStart(2, '0');
                return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            }
        }
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    }

    _currentFilter() {
        const $ = (s) => this.container.querySelector(s);
        const city = $('#cb-city')?.value || '';
        const category = $('#cb-category')?.value || '';
        const tag = $('#cb-tag')?.value || '';
        const consentedOnly = !!$('#cb-consented')?.checked;
        const scope = (city || category || tag) ? 'filtered' : 'all';
        return { scope, city, category, tag, consentedOnly };
    }

    _sampleName() {
        const r = CampaignService.buildRecipients(this._currentFilter ? this._currentFilter() : {}).recipients[0];
        if (r && r.name) return r.name;
        return this.state.language === 'mr' ? 'नमुना' : 'Sample';
    }

    _distincts() {
        const visitors = StateManager.getVisitors().filter(v => !v.deletedAt && v.status !== 'deleted');
        const cities = new Set(), categories = new Set(), tags = new Set();
        visitors.forEach(v => {
            if (v.city) cities.add(v.city);
            if (v.category) categories.add(v.category);
            (v.tags || []).forEach(t => t && tags.add(t));
        });
        const sort = (s) => Array.from(s).sort((a, b) => a.localeCompare(b));
        return { cities: sort(cities), categories: sort(categories), tags: sort(tags) };
    }

    _esc(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}
