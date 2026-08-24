// ThanksService — INITIATIVE.md P2.10 / P2.11, J3, UC-08, UC-09.
//
// Compose a message, hand it to WhatsApp, and REMEMBER that we did.
//
// That last part is the whole point. The app could already compose a greeting;
// what it could never do was recall whether anyone sent one. So a supporter
// could be thanked three times or not at all, and nobody could tell which.
//
// OPTIMISTIC BY NATURE. We hand off to another app and never learn whether the
// message arrived, or was even sent — the person may close WhatsApp without
// pressing send. `thankedAt` therefore records OUR INTENT, and no screen may
// claim more than that (PR-3). "आभार पाठवले" is honest; "they received it" is
// not, and we have no way to know the difference.

import StateManager from '../core/state.js';
import VisitorService from '../services/VisitorService.js';
import { InteractionLogger } from '../components/UI/InteractionLogger.js';
import { normalizePhone } from '../utils/formatters.js';
import { getLang } from '../utils/i18n.js';
import InteractionService from './InteractionService.js';
import { CONTRIBUTION_TYPES, INTERACTION_TYPES } from '../utils/constants.js';

/**
 * What to say, and — just as importantly — what not to.
 *
 * Three shapes, chosen by what we can honestly claim:
 *
 *   thanks       always safe. We know they came, because a visit was logged.
 *   thanksGift   only when a contribution was actually recorded (guard 3).
 *                Naming a meal nobody wrote down invents history.
 *   miss         only after a long silence (guard 2). Telling someone who came
 *                last month that we miss them is absurd and costs trust.
 */
export const MESSAGE_KINDS = { THANKS: 'thanks', THANKS_GIFT: 'thanksGift', MISS: 'miss' };

const TEMPLATES = {
    mr: {
        thanks: '{name} जी, नमस्कार 🙏\n\n{org} ला भेट दिल्याबद्दल मनःपूर्वक धन्यवाद. तुमचा वेळ आणि प्रेम आमच्या मुलांसाठी खूप मोलाचे आहे.\n\n— {org}',
        thanksGift: '{name} जी, नमस्कार 🙏\n\n{org} ला भेट देऊन {gift} दिल्याबद्दल मनःपूर्वक धन्यवाद. मुलांना खूप आनंद झाला.\n\n— {org}',
        miss: '{name} जी, नमस्कार 🙏\n\nतुमची आठवण येते. पुन्हा कधीही या — मुलं वाट पाहत आहेत.\n\n— {org}'
    },
    en: {
        thanks: 'Dear {name},\n\nThank you for visiting {org}. Your time and warmth mean a great deal to our children.\n\n— {org}',
        thanksGift: 'Dear {name},\n\nThank you for visiting {org} and for the {gift}. It made the children very happy.\n\n— {org}',
        miss: 'Dear {name},\n\nWe have been thinking of you. Do come again whenever you can — the children would be glad to see you.\n\n— {org}'
    }
};

class ThanksService {
    /** Only ever the person's real name — never the number fallback. */
    _addressableName(visitor) {
        const self = (visitor.contacts || []).find(c => c.relationType === 'SELF');
        const name = (self?.name || '').trim();
        // "Dear 98220 12345 ji" is worse than sending nothing at all, so a
        // nameless supporter gets a neutral form of address instead.
        return name || (getLang() === 'mr' ? 'नमस्कार' : 'Friend');
    }

    _phone(visitor) {
        const contacts = visitor.contacts || [];
        for (const c of [...contacts.filter(x => x.relationType === 'SELF'), ...contacts]) {
            for (const p of (c.phones || [])) {
                const n = normalizePhone(p);
                if (n) return n;
            }
        }
        return null;
    }

    _giftPhrase(contribution) {
        const lang = getLang();
        return CONTRIBUTION_TYPES
            .filter(c => contribution.includes(c.value))
            .map(c => (lang === 'mr' ? c.mr : c.en))
            .join(lang === 'mr' ? ' आणि ' : ' and ');
    }

    /**
     * Build the message. Returns null when there is nothing honest to say.
     *
     * @param {string} visitorId
     * @param {Object} [opts]
     * @param {string} [opts.kind]           MESSAGE_KINDS
     * @param {string[]} [opts.contribution] what they brought, if recorded
     */
    compose(visitorId, { kind = MESSAGE_KINDS.THANKS, contribution = [] } = {}) {
        const visitor = VisitorService.getById(visitorId);
        if (!visitor) return null;
        if (visitor.doNotContact) return null;      // never, under any kind

        const lang = TEMPLATES[getLang()] ? getLang() : 'mr';
        const settings = StateManager.getSettings?.() || {};
        const org = (settings.organizationName || '').trim() ||
                    (lang === 'mr' ? 'आमची संस्था' : 'our organisation');

        // Guard 3 — the gift template needs an actual recorded gift.
        let use = kind;
        if (use === MESSAGE_KINDS.THANKS_GIFT && !contribution.length) {
            use = MESSAGE_KINDS.THANKS;
        }

        const text = TEMPLATES[lang][use]
            .split('{name}').join(this._addressableName(visitor))
            .split('{org}').join(org)
            .split('{gift}').join(this._giftPhrase(contribution));

        return { text, kind: use, phone: this._phone(visitor), visitorId };
    }

    /**
     * Send it, and record that we tried.
     *
     * Marks `thankedAt` on the visitor's most recent un-thanked visit. If there
     * is none — they were messaged for some other reason — a new interaction is
     * logged, because a message sent with no record of it is how the app forgot
     * things in the first place.
     *
     * @returns {{ok: boolean, reason?: string, interactionId?: string}}
     */
    send(visitorId, opts = {}) {
        const msg = this.compose(visitorId, opts);
        if (!msg) return { ok: false, reason: 'unavailable' };
        if (!msg.phone) return { ok: false, reason: 'no-phone' };

        const url = `https://wa.me/91${msg.phone}?text=${encodeURIComponent(msg.text)}`;
        InteractionLogger.openExternalUrl(url);

        const noteFor = { thanks: 'आभार', thanksGift: 'आभार', miss: 'आठवण' }[msg.kind] || '';
        return { ...this.markThanked(visitorId, { note: noteFor }), ok: true, kind: msg.kind };
    }

    /**
     * Record the intent, separately from sending, so the two can be tested and
     * reasoned about apart.
     */
    markThanked(visitorId, { note = '' } = {}) {
        const now = new Date().toISOString();
        const interactions = StateManager.getInteractions() || [];

        const candidate = interactions
            .filter(i => i.visitorId === visitorId && !i.thankedAt && i.interactionType === 'visit')
            .sort((a, b) => new Date(b.interactionDate) - new Date(a.interactionDate))[0];

        if (candidate) {
            StateManager.updateInteraction(candidate.id, { thankedAt: now });
            return { interactionId: candidate.id, created: false };
        }

        // No recent un-thanked visit to attach it to — they were messaged for
        // some other reason, most likely from a memory card years after the
        // visit. Log it anyway. A message sent with no record of it is exactly
        // how this app came to forget things, and silently doing nothing here
        // would recreate that.
        const logged = InteractionService.log({
            visitorId,
            interactionType: INTERACTION_TYPES.WHATSAPP,
            notes: note,
            interactionDate: now
        });
        if (logged?.id) StateManager.updateInteraction(logged.id, { thankedAt: now });
        return { interactionId: logged?.id || null, created: true };
    }

    /**
     * Visits that happened and have not been thanked for.
     *
     * AGE-BOUNDED on purpose (P2.12). An unbounded list grows forever, and a
     * number that only ever goes up is an accusation — which is precisely what
     * D-10 removed from this app.
     */
    pending({ withinDays = 30 } = {}) {
        const cutoff = Date.now() - withinDays * 86400000;
        const visitors = new Map((StateManager.getVisitors() || []).map(v => [v.id, v]));

        return (StateManager.getInteractions() || [])
            .filter(i => !i.thankedAt && i.interactionType === 'visit')
            .filter(i => new Date(i.interactionDate).getTime() >= cutoff)
            .filter(i => {
                const v = visitors.get(i.visitorId);
                return v && !v.isDeleted && !v.doNotContact;
            })
            .sort((a, b) => new Date(b.interactionDate) - new Date(a.interactionDate));
    }
}

export default new ThanksService();
