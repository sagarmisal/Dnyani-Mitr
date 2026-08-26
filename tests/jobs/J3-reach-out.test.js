// @vitest-environment happy-dom
/**
 * J3 — Reach out: compose, send, and REMEMBER that we sent.
 *
 * The remembering is the job. The app could always compose a greeting; what it
 * could not do was recall whether anyone sent one, so a supporter might be
 * thanked three times or not at all and nobody could tell which.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('../../src/core/activation.js', () => ({
    default: { getMachineInfo: () => ({ machineId: 'm', machineName: 'T', machineRole: 'root' }) }
}));
const opened = [];
vi.mock('../../src/components/UI/InteractionLogger.js', () => ({
    InteractionLogger: { openExternalUrl: (u) => opened.push(u) }
}));
import StateManager from '../../src/core/state.js';
import StorageManager from '../../src/core/storage.js';
import ThanksService, { MESSAGE_KINDS } from '../../src/services/ThanksService.js';
import { setLang } from '../../src/utils/i18n.js';

beforeEach(() => {
    localStorage.clear(); StateManager.init();
    const st = StorageManager.getDefaultState();
    st.visitors = [
        { id: 'v1', isDeleted: false, status: 'active',
          contacts: [{ relationType: 'SELF', name: 'सुनीता पाटील', phones: ['9822012345'], emails: [] }] },
        { id: 'v2', isDeleted: false, status: 'active', doNotContact: true,
          contacts: [{ relationType: 'SELF', name: 'रमेश', phones: ['9822012346'], emails: [] }] }
    ];
    st.interactions = [{ id: 'i1', visitorId: 'v1', interactionType: 'visit',
        interactionDate: new Date(Date.now() - 2 * 86400000).toISOString(), thankedAt: null, contribution: [] }];
    st.settings = { ...st.settings, organizationName: 'भगवान बाबा बालिकाश्रम' };
    StateManager.state = st; StorageManager.saveState(st);
    opened.length = 0; setLang('mr');
});

describe('J3 · reach out and remember', () => {
    it('a thank-you goes out and is recorded', () => {
        const res = ThanksService.send('v1');
        expect(res.ok).toBe(true);
        expect(opened[0]).toContain('wa.me');
        expect(StateManager.getInteractions().find(i => i.id === 'i1').thankedAt).toBeTruthy();
    });

    it('the same visit is not thanked for twice', () => {
        ThanksService.send('v1');
        const before = ThanksService.pending().length;
        expect(before).toBe(0);
    });

    it('a do-not-contact supporter is never messaged', () => {
        expect(ThanksService.send('v2').ok).toBe(false);
        expect(opened).toHaveLength(0);
    });

    it('nothing is claimed that cannot be known', () => {
        // No gift recorded, so no gift may be mentioned.
        const msg = ThanksService.compose('v1', { kind: MESSAGE_KINDS.THANKS_GIFT, contribution: [] });
        expect(msg.kind).toBe('thanks');
        expect(msg.text).not.toMatch(/\{\w+\}/);
    });

    it('the pending list is bounded, so it can never become an accusation', () => {
        const st = StateManager.getState();
        st.interactions.push({ id: 'i_old', visitorId: 'v1', interactionType: 'visit',
            interactionDate: new Date(Date.now() - 300 * 86400000).toISOString(), thankedAt: null, contribution: [] });
        StateManager.state = st;
        expect(ThanksService.pending().every(i => i.id !== 'i_old')).toBe(true);
    });
});
