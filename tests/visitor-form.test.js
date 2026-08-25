// @vitest-environment happy-dom
/**
 * VisitorForm — characterization (Stage C.2).
 *
 * 689 lines, no tests. It is the SECOND capture path: the calendar's sheet is
 * for someone arriving, this is for adding a person deliberately. Both must
 * obey the same rule about what is required, and today they do not.
 *
 * It is a three-step wizard — Primary / Family / Details — not the flat
 * fifteen-field form I described repeatedly in the planning documents. That was
 * wrong, and the correction matters: progressive disclosure is already here, so
 * the work is the RULES it enforces, not its shape.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
vi.mock('../src/core/activation.js', () => ({
    default: { getMachineInfo: () => ({ machineId: 'm', machineName: 'T', machineRole: 'root' }) }
}));
import StateManager from '../src/core/state.js';
import StorageManager from '../src/core/storage.js';
import { VisitorForm } from '../src/components/Visitors/VisitorForm.js';

function wipe() {
    localStorage.clear();
    StateManager.init();
    StateManager.state = StorageManager.getDefaultState();
    StorageManager.saveState(StateManager.state);
    document.body.innerHTML = '';
}
function mount(id = null) {
    const view = new VisitorForm(id);
    const el = view.render();
    document.body.appendChild(el);
    return { view, el };
}
beforeEach(wipe);

describe('it renders', () => {
    it('opens on step one for a new person', () => {
        const { el } = mount();
        expect(el.querySelector('#self-name')).toBeTruthy();
    });

    it('is a wizard, not one long form', () => {
        const { el } = mount();
        expect(el.querySelector('.progress-steps')).toBeTruthy();
        expect(el.querySelector('#form-step-content')).toBeTruthy();
    });

    it('does not show family or detail fields on step one', () => {
        // Progressive disclosure is already here. The planning docs said
        // otherwise; they were wrong.
        const { el } = mount();
        expect(el.querySelector('.family-name')).toBeNull();
    });

    it('survives being opened for a visitor that does not exist', () => {
        expect(() => mount('no_such_visitor')).not.toThrow();
    });
});

describe('what step one demands before it will move on', () => {
    it('accepts a person with a name', () => {
        const { view, el } = mount();
        el.querySelector('#self-name').value = 'सुनीता पाटील';
        const consent = el.querySelector('#consent-checkbox');
        if (consent) consent.checked = true;
        expect(view.validateCurrentStep()).toBe(true);
    });

    it('D-07/D-20: accepts a phone with NO name', () => {
        // The rule everywhere else in the app: a phone OR a name, never
        // neither. This path enforced name-only for a long time after the
        // decision landed elsewhere.
        const { view, el } = mount();
        el.querySelector('#self-name').value = '';
        const phone = el.querySelector('.self-phone, #self-phone-0, input[type="tel"]');
        if (phone) phone.value = '9822012345';
        const consent = el.querySelector('#consent-checkbox');
        if (consent) consent.checked = true;
        expect(view.validateCurrentStep()).toBe(true);
    });

    it('refuses a person with neither a name nor a number', () => {
        const { view, el } = mount();
        el.querySelector('#self-name').value = '';
        const consent = el.querySelector('#consent-checkbox');
        if (consent) consent.checked = true;
        expect(view.validateCurrentStep()).toBe(false);
    });
});
