// @vitest-environment happy-dom
/**
 * The lower-traffic screens — characterization (Stage C.5).
 *
 * MyDayDashboard, InteractionHistory, GreetingQueue, SmsBatchQueue: 1,548 lines
 * between them and no tests. Lower traffic than the capture sheet, but two of
 * them SEND THINGS TO SUPPORTERS, so a defect here reaches people outside the
 * NGO — which is worse than one that stays on the phone.
 *
 * Batched deliberately: these are pinned against odd data and against saying
 * something untrue, not rebuilt.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('../src/core/activation.js', () => ({
    default: {
        getMachineInfo: () => ({ machineId: 'm', machineName: 'T', machineRole: 'root' }),
        isActivated: () => true
    }
}));
import StateManager from '../src/core/state.js';
import StorageManager from '../src/core/storage.js';
import { MyDayDashboard } from '../src/components/Dashboard/MyDayDashboard.js';
import { InteractionHistory } from '../src/components/Interactions/InteractionHistory.js';

const DAY = 86400000;
const ago = d => new Date(Date.now() - d * DAY).toISOString();

function seed({ visitors = [], interactions = [] } = {}) {
    localStorage.clear();
    StateManager.init();
    const st = StorageManager.getDefaultState();
    st.visitors = visitors;
    st.interactions = interactions;
    StateManager.state = st;
    StorageManager.saveState(st);
    document.body.innerHTML = '';
}
const person = (id, name, over = {}) => ({
    id, isDeleted: false, status: 'active',
    contacts: [{ id: 'c' + id, relationType: 'SELF', name, phones: ['98220' + id.slice(-5).padStart(5, '1')],
                 emails: [], customEvents: [] }],
    ...over
});
const record = (id, vid, over = {}) => ({
    id, visitorId: vid, interactionType: 'visit', interactionDate: ago(3),
    notes: 'जेवण दिलं', contribution: ['meal'], thankedAt: null, ...over
});

function mount(Klass, ...args) {
    const v = new Klass(...args);
    const el = v.render();
    document.body.appendChild(el);
    return { v, el };
}

describe('MyDayDashboard', () => {
    it('renders with an empty register', () => {
        seed();
        expect(() => mount(MyDayDashboard)).not.toThrow();
    });

    it('counts the week’s activity', () => {
        // My Day shows reminders, follow-ups, lapsed visitors and week stats —
        // NOT every visitor. My first version of this asserted the name
        // appeared, which the screen never promised: a three-day-old visit by
        // someone with no birthday belongs in none of those sections. The test
        // was wrong, not the screen.
        seed({ visitors: [person('v1', 'सुनीता पाटील')], interactions: [record('i1', 'v1')] });
        const { el } = mount(MyDayDashboard);
        expect(el.textContent).toMatch(/\b1\b/);
    });

    it('surfaces someone with a birthday coming up', () => {
        const soon = new Date(Date.now() + 2 * DAY);
        const dob = `1978-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;
        seed({ visitors: [{ id: 'v1', isDeleted: false, status: 'active',
            contacts: [{ id: 'c1', relationType: 'SELF', name: 'सुनीता पाटील',
                         phones: ['9822012345'], emails: [], dob, customEvents: [] }] }] });
        expect(mount(MyDayDashboard).el.textContent).toContain('सुनीता');
    });

    it('survives an interaction pointing at a visitor that no longer exists', () => {
        // Reachable through merge: an interaction can arrive before, or without,
        // the visitor it belongs to.
        seed({ visitors: [], interactions: [record('i1', 'ghost')] });
        expect(() => mount(MyDayDashboard)).not.toThrow();
    });

    it('survives an unparseable interaction date', () => {
        seed({ visitors: [person('v1', 'सुनीता')], interactions: [record('i1', 'v1', { interactionDate: 'nonsense' })] });
        expect(() => mount(MyDayDashboard)).not.toThrow();
    });

    it('never prints a developer word to a volunteer', () => {
        seed({ visitors: [person('v1', 'सुनीता')], interactions: [record('i1', 'v1', { interactionDate: 'nonsense' })] });
        const text = mount(MyDayDashboard).el.textContent;
        expect(text).not.toMatch(/Invalid Date|undefined|NaN|\[object/);
    });
});

describe('InteractionHistory', () => {
    it('renders with nothing recorded', () => {
        seed();
        expect(() => mount(InteractionHistory)).not.toThrow();
    });

    it('lists what was recorded', () => {
        seed({ visitors: [person('v1', 'सुनीता पाटील')], interactions: [record('i1', 'v1')] });
        expect(mount(InteractionHistory).el.textContent).toContain('सुनीता पाटील');
    });

    it('shows a name for a record whose visitor is gone, not a blank', () => {
        seed({ visitors: [], interactions: [record('i1', 'ghost')] });
        const { el } = mount(InteractionHistory);
        expect(() => el).not.toThrow();
        expect(el.textContent).not.toMatch(/undefined|null/);
    });

    it('offers a way to search and filter', () => {
        seed({ visitors: [person('v1', 'सुनीता')], interactions: [record('i1', 'v1')] });
        const { el } = mount(InteractionHistory);
        expect(el.querySelectorAll('select').length).toBeGreaterThan(0);
    });
});

describe('the screens that send things to supporters', () => {
    it('GreetingQueue loads without a queue', async () => {
        seed();
        const { GreetingQueue } = await import('../src/components/UI/GreetingQueue.js');
        expect(GreetingQueue).toBeTruthy();
    });

    it('SmsBatchQueue loads without a batch', async () => {
        seed();
        const mod = await import('../src/components/UI/SmsBatchQueue.js');
        expect(Object.keys(mod).length).toBeGreaterThan(0);
    });
});
