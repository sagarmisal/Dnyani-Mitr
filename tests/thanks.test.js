// @vitest-environment happy-dom
/**
 * INITIATIVE.md P2.10 / P2.11 / P2.12, J3, UC-08, UC-09.
 *
 * The app could always COMPOSE a greeting. What it could never do was recall
 * whether anyone sent one — so a supporter might be thanked three times or not
 * at all, and nobody could tell which.
 *
 * Two things these tests protect above all: that we never say something we
 * cannot honestly claim, and that sending is always recorded.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/core/activation.js', () => ({
    default: { getMachineInfo: () => ({ machineId: 'm', machineName: 'T', machineRole: 'root' }) }
}));

const opened = [];
vi.mock('../src/components/UI/InteractionLogger.js', () => ({
    InteractionLogger: { openExternalUrl: (url) => opened.push(url) }
}));

import StateManager from '../src/core/state.js';
import StorageManager from '../src/core/storage.js';
import ThanksService, { MESSAGE_KINDS } from '../src/services/ThanksService.js';
import { setLang } from '../src/utils/i18n.js';

const DAY = 86400000;
const ago = d => new Date(Date.now() - d * DAY).toISOString();

function seed({ visitors, interactions = [], org = 'भगवान बाबा बालिकाश्रम' }) {
    localStorage.clear();
    StateManager.init();
    const st = StorageManager.getDefaultState();
    st.visitors = visitors;
    st.interactions = interactions;
    st.settings = { ...st.settings, organizationName: org };
    StateManager.state = st;
    StorageManager.saveState(st);
    opened.length = 0;
}

const visitor = (id, name, phone, extra = {}) => ({
    id, isDeleted: false,
    contacts: [{ relationType: 'SELF', name, phones: phone ? [phone] : [], emails: [] }],
    ...extra
});
const visit = (id, visitorId, date, extra = {}) =>
    ({ id, visitorId, interactionType: 'visit', interactionDate: date, notes: '', thankedAt: null, contribution: [], ...extra });

beforeEach(() => setLang('mr'));

describe('compose — never claim what we cannot know', () => {
    it('addresses them by their real name', () => {
        seed({ visitors: [visitor('v1', 'सुनीता पाटील', '9822012345')] });
        expect(ThanksService.compose('v1').text).toContain('सुनीता पाटील');
    });

    it('never addresses a nameless supporter by their phone number', () => {
        // "Dear 98220 12345 ji" is worse than sending nothing at all.
        seed({ visitors: [visitor('v1', '', '9822012345')] });
        const msg = ThanksService.compose('v1');
        expect(msg.text).not.toContain('98220');
        expect(msg.text).not.toContain('9822012345');
    });

    it('names the gift only when one was recorded (guard 3)', () => {
        seed({ visitors: [visitor('v1', 'सुनीता', '9822012345')] });
        const withGift = ThanksService.compose('v1',
            { kind: MESSAGE_KINDS.THANKS_GIFT, contribution: ['meal'] });
        expect(withGift.text).toContain('जेवण');
        expect(withGift.kind).toBe('thanksGift');
    });

    it('falls back to plain thanks when the gift template has no gift', () => {
        // Asking for the gift message with nothing recorded must not produce
        // "thank you for the " — it silently becomes the honest message.
        seed({ visitors: [visitor('v1', 'सुनीता', '9822012345')] });
        const msg = ThanksService.compose('v1', { kind: MESSAGE_KINDS.THANKS_GIFT, contribution: [] });
        expect(msg.kind).toBe('thanks');
        expect(msg.text).not.toContain('{gift}');
        expect(msg.text).not.toMatch(/\s{2,}दिल्याबद्दल/);
    });

    it('leaves no placeholder unreplaced in either language', () => {
        seed({ visitors: [visitor('v1', 'सुनीता', '9822012345')] });
        for (const lang of ['mr', 'en']) {
            setLang(lang);
            for (const kind of Object.values(MESSAGE_KINDS)) {
                const msg = ThanksService.compose('v1', { kind, contribution: ['meal'] });
                expect(msg.text, `${lang}/${kind}`).not.toMatch(/\{\w+\}/);
            }
        }
        setLang('mr');
    });

    it('uses the NGO’s own name, and a neutral word when none is set', () => {
        seed({ visitors: [visitor('v1', 'सुनीता', '9822012345')] });
        expect(ThanksService.compose('v1').text).toContain('भगवान बाबा बालिकाश्रम');
        seed({ visitors: [visitor('v1', 'सुनीता', '9822012345')], org: '' });
        expect(ThanksService.compose('v1').text).not.toContain('{org}');
    });

    it('refuses entirely for a do-not-contact visitor', () => {
        seed({ visitors: [visitor('v1', 'सुनीता', '9822012345', { doNotContact: true })] });
        expect(ThanksService.compose('v1')).toBeNull();
        Object.values(MESSAGE_KINDS).forEach(kind =>
            expect(ThanksService.compose('v1', { kind })).toBeNull());
    });
});

describe('send — and remember that we did', () => {
    it('opens WhatsApp with the message', () => {
        seed({ visitors: [visitor('v1', 'सुनीता', '9822012345')], interactions: [visit('i1', 'v1', ago(3))] });
        const res = ThanksService.send('v1');
        expect(res.ok).toBe(true);
        expect(opened[0]).toContain('wa.me/919822012345');
        expect(decodeURIComponent(opened[0])).toContain('सुनीता');
    });

    it('marks the most recent un-thanked visit', () => {
        seed({
            visitors: [visitor('v1', 'सुनीता', '9822012345')],
            interactions: [visit('i_old', 'v1', ago(40)), visit('i_new', 'v1', ago(2))]
        });
        const res = ThanksService.send('v1');
        expect(res.interactionId).toBe('i_new');
        const marked = StateManager.getInteractions().find(i => i.id === 'i_new');
        expect(marked.thankedAt).toBeTruthy();
    });

    it('does not re-mark a visit already thanked for', () => {
        seed({
            visitors: [visitor('v1', 'सुनीता', '9822012345')],
            interactions: [visit('i1', 'v1', ago(2), { thankedAt: ago(1) })]
        });
        const res = ThanksService.send('v1');
        expect(res.created).toBe(true);          // a new record instead
        expect(res.interactionId).not.toBe('i1');
    });

    it('logs a record when there is no visit to attach to', () => {
        // Sending from a memory card years later. A message sent with no record
        // is exactly how this app came to forget things.
        seed({ visitors: [visitor('v1', 'सुनीता', '9822012345')], interactions: [] });
        const before = StateManager.getInteractions().length;
        const res = ThanksService.send('v1', { kind: MESSAGE_KINDS.MISS });
        expect(res.created).toBe(true);
        expect(StateManager.getInteractions()).toHaveLength(before + 1);
        expect(StateManager.getInteractions().at(-1).thankedAt).toBeTruthy();
    });

    it('refuses honestly when there is no number, and sends nothing', () => {
        seed({ visitors: [visitor('v1', 'सुनीता', null)] });
        const res = ThanksService.send('v1');
        expect(res).toMatchObject({ ok: false, reason: 'no-phone' });
        expect(opened).toHaveLength(0);
    });

    it('refuses for do-not-contact, and opens nothing', () => {
        seed({ visitors: [visitor('v1', 'सुनीता', '9822012345', { doNotContact: true })] });
        expect(ThanksService.send('v1').ok).toBe(false);
        expect(opened).toHaveLength(0);
    });
});

describe('pending — bounded, so it can never become an accusation (P2.12)', () => {
    it('lists recent un-thanked visits', () => {
        seed({
            visitors: [visitor('v1', 'सुनीता', '9822012345')],
            interactions: [visit('i1', 'v1', ago(3))]
        });
        expect(ThanksService.pending()).toHaveLength(1);
    });

    it('drops visits older than the window rather than accumulating forever', () => {
        seed({
            visitors: [visitor('v1', 'सुनीता', '9822012345')],
            interactions: [visit('i_old', 'v1', ago(200)), visit('i_new', 'v1', ago(3))]
        });
        const pending = ThanksService.pending();
        expect(pending).toHaveLength(1);
        expect(pending[0].id).toBe('i_new');
    });

    it('excludes anyone already thanked, deleted, or do-not-contact', () => {
        seed({
            visitors: [
                visitor('v1', 'अ', '9822012341'),
                visitor('v2', 'ब', '9822012342', { isDeleted: true }),
                visitor('v3', 'क', '9822012343', { doNotContact: true })
            ],
            interactions: [
                visit('i1', 'v1', ago(2), { thankedAt: ago(1) }),
                visit('i2', 'v2', ago(2)),
                visit('i3', 'v3', ago(2))
            ]
        });
        expect(ThanksService.pending()).toEqual([]);
    });
});
