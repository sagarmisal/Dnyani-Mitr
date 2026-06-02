// Campaign Model — a bulk occasion message (greeting/invitation) sent to a set
// of beneficiaries over SMS and/or WhatsApp. Recipients are snapshotted at send
// time (recipientIds) so stats and audit stay accurate even if the roster changes.

import { generateId } from '../utils/helpers.js';
import { getCurrentDate } from '../utils/formatters.js';
import { CAMPAIGN_CHANNELS, CAMPAIGN_STATUS } from '../utils/constants.js';

export class Campaign {
    constructor(data = {}) {
        this.id = data.id || generateId('campaign');
        this.name = (data.name || '').trim();
        this.occasionId = data.occasionId || null;               // null = custom / no-occasion
        this.channel = data.channel || CAMPAIGN_CHANNELS.SMS;     // 'sms' | 'whatsapp' | 'both'
        this.language = data.language || 'mr';                    // 'mr' | 'en'
        this.messageTemplate = data.messageTemplate || '';        // raw template w/ {tokens}
        this.date = data.date || getCurrentDate();                // intended / occasion date (ISO)

        const f = data.recipientFilter || {};
        this.recipientFilter = {
            scope: f.scope || 'all',                              // 'all' | 'filtered'
            city: f.city || null,
            category: f.category || null,
            tag: f.tag || null,
            consentedOnly: f.consentedOnly === true
        };

        // Visitor-id snapshot taken when the campaign is dispatched.
        this.recipientIds = Array.isArray(data.recipientIds) ? data.recipientIds : [];

        this.status = data.status || CAMPAIGN_STATUS.DRAFT;       // draft|sending|sent|partial|cancelled

        const s = data.stats || {};
        this.stats = {
            total: Number(s.total) || 0,
            sent: Number(s.sent) || 0,
            failed: Number(s.failed) || 0,
            skipped: Number(s.skipped) || 0
        };

        this.createdAt = data.createdAt || getCurrentDate();
        this.sentAt = data.sentAt || null;
        this.createdBy = data.createdBy || null;                  // machine id
        this.updatedAt = data.updatedAt || getCurrentDate();
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            occasionId: this.occasionId,
            channel: this.channel,
            language: this.language,
            messageTemplate: this.messageTemplate,
            date: this.date,
            recipientFilter: this.recipientFilter,
            recipientIds: this.recipientIds,
            status: this.status,
            stats: this.stats,
            createdAt: this.createdAt,
            sentAt: this.sentAt,
            createdBy: this.createdBy,
            updatedAt: this.updatedAt
        };
    }

    static fromJSON(data) {
        return new Campaign(data);
    }
}

export default Campaign;
