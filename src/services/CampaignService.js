// CampaignService — recipient targeting, message composition, and campaign
// lifecycle for bulk occasion messaging (Iter 10).
//
// Division of responsibility:
//   - This service: build the recipient list (honoring consent / doNotContact),
//     compose per-recipient messages (token substitution), persist the Campaign
//     record, and roll up final stats/status.
//   - The send engines (SmsService.sendBulkNative / GreetingQueue): actually
//     dispatch AND log one Interaction per recipient (interactionType sms/whatsapp).
//     We deliberately do NOT log here too — that would double-count. Campaign
//     items omit `reminderId`, so the engines also skip reminder-marking.

import StateManager from '../core/state.js';
import { Campaign } from '../models/Campaign.js';
import { CAMPAIGN_STATUS } from '../utils/constants.js';
import { normalizePhone } from '../utils/formatters.js';

class CampaignService {

    // ─── Recipient helpers (work on plain state objects, not model instances) ──
    static _selfContact(visitor) {
        const contacts = (visitor && visitor.contacts) || [];
        return contacts.find(c => c && c.relationType === 'SELF') || contacts[0] || null;
    }

    static _recipientName(visitor) {
        const self = this._selfContact(visitor);
        return (self && self.name) ? String(self.name).trim() : '';
    }

    static _recipientPhone(visitor) {
        const self = this._selfContact(visitor);
        const phones = (self && self.phones) || [];
        for (const p of phones) {
            if (normalizePhone(p)) return p;
        }
        return null;
    }

    static _isActive(visitor) {
        return !!visitor && !visitor.deletedAt && visitor.status !== 'deleted';
    }

    /**
     * Build the sendable recipient list for a filter.
     * `doNotContact` is ALWAYS excluded. `consentedOnly` is optional.
     * Visitors without a valid phone are excluded (counted, not silently dropped).
     *
     * @param {Object} filter - { city?, category?, tag?, consentedOnly? }
     * @param {Array} [visitors] - injectable for testing; defaults to live state
     * @returns {{recipients: Array, counts: {matched, excludedDnc, excludedNoConsent, excludedNoPhone}}}
     */
    static buildRecipients(filter = {}, visitors = null) {
        const all = Array.isArray(visitors) ? visitors : StateManager.getVisitors();
        const counts = { matched: 0, excludedDnc: 0, excludedNoConsent: 0, excludedNoPhone: 0 };
        const recipients = [];

        for (const v of all) {
            if (!this._isActive(v)) continue;
            if (filter.city && v.city !== filter.city) continue;
            if (filter.category && v.category !== filter.category) continue;
            if (filter.tag && !((v.tags || []).includes(filter.tag))) continue;

            // Matched the audience filter — now apply gating.
            counts.matched++;
            if (v.doNotContact) { counts.excludedDnc++; continue; }
            if (filter.consentedOnly && !v.consentGiven) { counts.excludedNoConsent++; continue; }

            const phone = this._recipientPhone(v);
            if (!phone) { counts.excludedNoPhone++; continue; }

            recipients.push({
                visitorId: v.id,
                contactId: (this._selfContact(v) || {}).id || null,
                name: this._recipientName(v),
                phone
            });
        }
        return { recipients, counts };
    }

    /**
     * Substitute tokens in a template. Pure. Unknown tokens are left as-is is NOT
     * desired — we replace the known set and any leftover {token} is cleared to ''
     * so recipients never see raw placeholders.
     * Tokens: {name} {org} {volunteer} {occasion} {tagline}
     */
    static composeFor(templateText, ctx = {}) {
        let out = String(templateText || '');
        const map = {
            '{name}': ctx.name || '',
            '{org}': ctx.org || '',
            '{volunteer}': ctx.volunteer || '',
            '{occasion}': ctx.occasion || '',
            '{tagline}': ctx.tagline || ''
        };
        for (const token in map) {
            out = out.split(token).join(map[token]);
        }
        // Clear leftover unknown placeholders (ASCII or Devanagari token names), then
        // tidy whitespace: trailing spaces, blank lines left by an emptied interior
        // token, and doubled spaces.
        out = out.replace(/\{[A-Za-zऀ-ॿ]+\}/g, '');
        return out
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/[ \t]{2,}/g, ' ')
            .trim();
    }

    /**
     * Resolve org / volunteer / tagline context from settings + machine, by language.
     */
    static _resolveContext(language) {
        const settings = StateManager.getSettings() || {};
        const machine = StateManager.getMachineInfo() || {};
        const tagline = language === 'mr'
            ? (settings.taglineMr || '')
            : (settings.taglineEn || settings.taglineMr || '');
        return {
            org: settings.organizationName || '',
            volunteer: machine.machineName || '',
            tagline
        };
    }

    /**
     * Turn recipients into send-engine items with a per-recipient composed message.
     * @returns {Array} [{visitorId, contactId, contactName, phone, message, notes, occasionLabel}]
     */
    static prepareItems(recipients, { templateText, language = 'mr', occasionName = '', campaignName = '' }) {
        const ctx = this._resolveContext(language);
        const fallbackName = language === 'mr' ? 'मित्र' : 'Friend';
        const notes = `Campaign: ${campaignName || occasionName || 'message'}`;
        return (recipients || []).map(r => ({
            visitorId: r.visitorId,
            contactId: r.contactId,
            contactName: r.name || fallbackName,
            phone: r.phone,
            // reminderId intentionally omitted → engines skip reminder-marking
            message: this.composeFor(templateText, {
                name: r.name || fallbackName,
                org: ctx.org,
                volunteer: ctx.volunteer,
                occasion: occasionName,
                tagline: ctx.tagline
            }),
            notes,
            occasionLabel: occasionName || null
        }));
    }

    // ─── Lifecycle ─────────────────────────────────────────────────────────
    /**
     * Persist a new campaign (status 'draft' unless overridden). Returns the Campaign.
     */
    static createCampaign(data = {}) {
        const machine = StateManager.getMachineInfo() || {};
        const campaign = new Campaign({ ...data, createdBy: data.createdBy || machine.machineId || null });
        StateManager.addCampaign(campaign.toJSON());
        return campaign;
    }

    /**
     * Mark a campaign as in-flight, snapshotting the recipient ids BEFORE dispatch
     * so an interrupted send leaves a recoverable record.
     */
    static markSending(campaignId, recipientIds) {
        StateManager.updateCampaign(campaignId, {
            status: CAMPAIGN_STATUS.SENDING,
            recipientIds: Array.isArray(recipientIds) ? recipientIds : [],
            stats: { total: (recipientIds || []).length, sent: 0, failed: 0, skipped: 0 }
        });
    }

    /**
     * Record the result of a dispatch and compute the terminal status.
     */
    static recordResult(campaignId, { sent = 0, failed = 0, skipped = 0, total = null } = {}) {
        const resolvedTotal = total != null ? total : (sent + failed + skipped);
        const stats = { total: resolvedTotal, sent, failed, skipped };
        StateManager.updateCampaign(campaignId, {
            status: this.finalStatus(stats),
            stats,
            sentAt: new Date().toISOString()
        });
        return stats;
    }

    /**
     * Terminal status from stats. Pure (testable).
     *   all delivered → sent · some delivered → partial · none delivered → cancelled
     */
    static finalStatus(stats = {}) {
        const total = Number(stats.total) || 0;
        const sent = Number(stats.sent) || 0;
        const skipped = Number(stats.skipped) || 0;
        // Deliberate skips (the WhatsApp "didn't send" choice) are a decision, not a
        // failure: a campaign where every recipient was either sent or knowingly
        // skipped — with at least one actually sent — is complete.
        if (total > 0 && sent > 0 && (sent + skipped) >= total) return CAMPAIGN_STATUS.SENT;
        if (sent > 0) return CAMPAIGN_STATUS.PARTIAL;
        return CAMPAIGN_STATUS.CANCELLED;
    }
}

export default CampaignService;
