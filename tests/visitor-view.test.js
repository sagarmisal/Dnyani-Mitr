// @vitest-environment happy-dom
/**
 * VisitorView — characterization (Stage C.3).
 *
 * 521 lines, no tests. This is where a volunteer looks before they call
 * someone: who they are, when they last came, what to say. It is also the
 * screen most likely to meet odd data, because it renders everything a visitor
 * record can hold — and records arrive through merge from other phones without
 * passing the models.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('../src/core/activation.js', () => ({
    default: { getMachineInfo: () => ({ machineId: 'm', machineName: 'T', machineRole: 'root' }) }
}));
import StateManager from '../src/core/state.js';
import StorageManager from '../src/core/storage.js';
import { VisitorView } from '../src/components/Visitors/VisitorView.js';

function seed(visitors, interactions = []) {
    localStorage.clear();
    StateManager.init();
    const st = StorageManager.getDefaultState();
    st.visitors = visitors;
    st.interactions = interactions;
    StateManager.state = st;
    StorageManager.saveState(st);
    document.body.innerHTML = '';
}
const mount = (id) => {
    const v = new VisitorView(id);
    const el = v.render();
    document.body.appendChild(el);
    return { v, el };
};

const person = (over = {}) => ({
    id: 'v1', isDeleted: false, status: 'active', city: 'बारामती', category: 'Regular', tags: [],
    contacts: [{ id: 'c1', relationType: 'SELF', name: 'सुनीता पाटील',
                 phones: ['9822012345'], emails: ['s@x.com'], dob: '1978-03-14', customEvents: [] }],
    ...over
});

describe('it renders the data it is given', () => {
    it('shows a person', () => {
        seed([person()]);
        expect(mount('v1').el.textContent).toContain('सुनीता पाटील');
    });

    it('shows a visit history', () => {
        seed([person()], [{ id: 'i1', visitorId: 'v1', interactionType: 'visit',
            interactionDate: '2026-08-10T12:00:00.000Z', notes: 'जेवण दिलं', contribution: ['meal'], thankedAt: null }]);
        expect(mount('v1').el.textContent).toContain('जेवण');
    });

    it('handles a visitor with no history at all', () => {
        seed([person()]);
        expect(() => mount('v1')).not.toThrow();
    });
});

describe('the odd data it will actually meet', () => {
    it('a visitor that does not exist does not blank the screen', () => {
        seed([]);
        expect(() => mount('missing')).not.toThrow();
    });

    it('a nameless visitor shows their number, never an empty heading (D-07)', () => {
        seed([person({ contacts: [{ id: 'c1', relationType: 'SELF', name: '',
                                    phones: ['9822012345'], emails: [], customEvents: [] }] })]);
        const text = mount('v1').el.textContent;
        expect(text).toMatch(/98220/);
        expect(text).not.toMatch(/Unknown|undefined|null/);
    });

    it('a visitor with no contacts array at all', () => {
        // Arrives through merge as a plain object; the models never see it.
        seed([person({ contacts: undefined })]);
        expect(() => mount('v1')).not.toThrow();
    });

    it('a contact with no phones or emails', () => {
        seed([person({ contacts: [{ id: 'c1', relationType: 'SELF', name: 'रमेश', customEvents: [] }] })]);
        expect(() => mount('v1')).not.toThrow();
    });

    it('an interaction with an unparseable date', () => {
        seed([person()], [{ id: 'i1', visitorId: 'v1', interactionType: 'visit',
            interactionDate: 'nonsense', notes: '', contribution: [], thankedAt: null }]);
        expect(() => mount('v1')).not.toThrow();
    });

    it('never prints "Invalid Date" to a person', () => {
        seed([person({ contacts: [{ id: 'c1', relationType: 'SELF', name: 'रमेश',
                                    phones: [], emails: [], dob: 'garbage', customEvents: [] }] })]);
        expect(mount('v1').el.textContent).not.toContain('Invalid Date');
    });
});

describe('what it must not say', () => {
    it('never scolds a brand-new supporter (D-10)', () => {
        seed([person()]);
        const text = mount('v1').el.textContent;
        expect(text).not.toMatch(/Never contacted|Overdue/);
    });
});
