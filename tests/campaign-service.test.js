import { describe, it, expect, beforeAll, vi } from 'vitest';

// localStorage mock so StateManager.init() can load default state.
const store = {};
vi.stubGlobal('localStorage', {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; }
});

import CampaignService from '../src/services/CampaignService.js';
import StateManager from '../src/core/state.js';
import { CAMPAIGN_STATUS } from '../src/utils/constants.js';

const visitor = (over = {}) => ({
    id: over.id || 'v',
    status: over.status || 'active',
    deletedAt: over.deletedAt || null,
    city: over.city,
    category: over.category,
    tags: over.tags || [],
    doNotContact: over.doNotContact || false,
    consentGiven: over.consentGiven || false,
    contacts: over.contacts || [{ relationType: 'SELF', id: 'c', name: over.name || 'Asha', phones: over.phones || ['9876543210'] }]
});

describe('CampaignService.buildRecipients', () => {
    it('always excludes doNotContact', () => {
        const vs = [visitor({ id: 'a' }), visitor({ id: 'b', doNotContact: true })];
        const { recipients, counts } = CampaignService.buildRecipients({}, vs);
        expect(recipients.map(r => r.visitorId)).toEqual(['a']);
        expect(counts.excludedDnc).toBe(1);
    });

    it('consentedOnly excludes non-consented', () => {
        const vs = [visitor({ id: 'a', consentGiven: true }), visitor({ id: 'b', consentGiven: false })];
        const { recipients, counts } = CampaignService.buildRecipients({ consentedOnly: true }, vs);
        expect(recipients.map(r => r.visitorId)).toEqual(['a']);
        expect(counts.excludedNoConsent).toBe(1);
    });

    it('filters by city', () => {
        const vs = [visitor({ id: 'a', city: 'Pune' }), visitor({ id: 'b', city: 'Mumbai' })];
        const { recipients } = CampaignService.buildRecipients({ city: 'Pune' }, vs);
        expect(recipients.map(r => r.visitorId)).toEqual(['a']);
    });

    it('excludes no-phone (counted) and deleted (not counted)', () => {
        const vs = [
            visitor({ id: 'a' }),
            visitor({ id: 'b', phones: [] }),
            { id: 'c', status: 'deleted', deletedAt: 'x', contacts: [{ relationType: 'SELF', name: 'X', phones: ['9999999999'] }] }
        ];
        const { recipients, counts } = CampaignService.buildRecipients({}, vs);
        expect(recipients.map(r => r.visitorId)).toEqual(['a']);
        expect(counts.excludedNoPhone).toBe(1);
        expect(counts.matched).toBe(2); // a + b; c is inactive
    });
});

describe('CampaignService.composeFor', () => {
    it('substitutes all known tokens including tagline', () => {
        const out = CampaignService.composeFor('{name} जी — {org}\n{tagline}', { name: 'Asha', org: 'SSP', tagline: 'चला' });
        expect(out).toBe('Asha जी — SSP\nचला');
    });

    it('clears leftover/unknown placeholders', () => {
        expect(CampaignService.composeFor('Hi {name} {unknown}', { name: 'A' })).toBe('Hi A');
    });

    it('handles empty name without leaving raw tokens', () => {
        expect(CampaignService.composeFor('{name}: hello', { name: '' })).toBe(': hello');
    });
});

describe('CampaignService.finalStatus', () => {
    it('all delivered -> sent', () => expect(CampaignService.finalStatus({ total: 3, sent: 3 })).toBe(CAMPAIGN_STATUS.SENT));
    it('some delivered -> partial', () => expect(CampaignService.finalStatus({ total: 3, sent: 1 })).toBe(CAMPAIGN_STATUS.PARTIAL));
    it('none delivered -> cancelled', () => expect(CampaignService.finalStatus({ total: 3, sent: 0 })).toBe(CAMPAIGN_STATUS.CANCELLED));
    it('sent + deliberate skips covering all -> sent (skips are a decision, not failure)', () =>
        expect(CampaignService.finalStatus({ total: 3, sent: 1, skipped: 2 })).toBe(CAMPAIGN_STATUS.SENT));
    it('all skipped, none sent -> cancelled', () =>
        expect(CampaignService.finalStatus({ total: 3, sent: 0, skipped: 3 })).toBe(CAMPAIGN_STATUS.CANCELLED));
});

describe('CampaignService.prepareItems', () => {
    beforeAll(async () => { await StateManager.init(); });

    it('composes per-recipient message with org + tagline from settings, omits reminderId', () => {
        const recipients = [{ visitorId: 'v', contactId: 'c', name: 'Asha', phone: '9876543210' }];
        const items = CampaignService.prepareItems(recipients, {
            templateText: '{name} — {org}\n{tagline}', language: 'mr', occasionName: 'प्रजासत्ताक दिन', campaignName: 'RD'
        });
        expect(items).toHaveLength(1);
        expect(items[0].message).toContain('Asha');
        expect(items[0].message).toContain('Sewa Sankalp');          // default org
        expect(items[0].message).toContain('चला जरा वेगळे जगुया');     // default taglineMr
        expect(items[0].reminderId).toBeUndefined();                 // campaigns omit reminderId
        expect(items[0].notes).toContain('RD');
    });

    it('uses a language-appropriate fallback when name is missing', () => {
        const items = CampaignService.prepareItems([{ visitorId: 'v', phone: '9876543210', name: '' }], {
            templateText: '{name}', language: 'mr'
        });
        expect(items[0].message).toBe('मित्र');
    });
});
