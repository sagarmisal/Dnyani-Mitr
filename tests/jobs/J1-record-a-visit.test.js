// @vitest-environment happy-dom
/**
 * J1 — Someone is coming, or someone came. Record it in seconds.
 *
 * An acceptance test, not a unit test: it walks the screens a volunteer
 * actually touches and asserts the outcome they actually need. If this is
 * green, a person can record a visit; if it is red, they cannot, whatever the
 * unit tests say.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/core/activation.js', () => ({
    default: { getMachineInfo: () => ({ machineId: 'm', machineName: 'T', machineRole: 'root' }) }
}));

import StateManager from '../../src/core/state.js';
import StorageManager from '../../src/core/storage.js';
import VisitorService from '../../src/services/VisitorService.js';
import { ScheduledItemForm } from '../../src/components/Calendar/ScheduledItemForm.js';
import { normalizePhone, visitorDisplayName } from '../../src/utils/formatters.js';

function wipe() {
    localStorage.clear();
    StateManager.init();
    StateManager.state = StorageManager.getDefaultState();
    StorageManager.saveState(StateManager.state);
}

function capture({ phone, name, title = 'भेट', date = '2026-08-25', occasion = null }) {
    const form = new ScheduledItemForm({ date, direction: 'inbound' });
    const el = form.render();
    document.body.appendChild(el);
    if (phone) {
        const p = el.querySelector('#si-phone');
        p.value = phone;
        p.dispatchEvent(new Event('input'));
    }
    if (name) el.querySelector('#si-name').value = name;
    el.querySelector('#si-title').value = title;
    if (occasion) {
        el.querySelector(`.lg-chips--occasion .lg-chip[data-value="${occasion.type}"]`).click();
        el.querySelector('#si-occ-date').value = occasion.date;
        el.querySelector(`.si-occ-detail .lg-chip[data-value="${occasion.relation}"]`).click();
        if (occasion.whose) el.querySelector('#si-occ-whose').value = occasion.whose;
    }
    form.save();
    el.remove();
    return form;
}

beforeEach(wipe);

describe('J1 · record a visit', () => {
    it('a call becomes a supporter and a planned visit', () => {
        capture({ phone: '98220 12345', name: 'सुनीता पाटील' });
        expect(VisitorService.findByPhone('9822012345')).toBeTruthy();
        expect(StateManager.getScheduledItems()).toHaveLength(1);
    });

    it('the occasion becomes a reminder that returns every year', () => {
        // The flow that compounds. Without this the app is a log, not a memory.
        capture({
            phone: '9822012345', name: 'सुनीता पाटील',
            occasion: { type: 'Birthday', date: '2015-08-18', relation: 'CHILD', whose: 'अनन्या' }
        });
        const v = VisitorService.findByPhone('9822012345').visitor;
        const child = v.contacts.find(c => c.relationType === 'CHILD');
        expect(child.name).toBe('अनन्या');
        expect(child.dob).toBe('2015-08-18');
    });

    it('a caller who gives only a number is still recorded', () => {
        capture({ phone: '9822012399', name: '' });
        const item = StateManager.getScheduledItems()[0];
        expect(normalizePhone(item.phone)).toBe('9822012399');
        expect(item.phone).not.toMatch(/^0+$/);
    });

    it('the same person, typed differently, is not duplicated', () => {
        capture({ phone: '9822012345', name: 'सुनीता पाटील' });
        capture({ phone: '+91 98220 12345', name: 'सुनिता पाटिल' });
        const all = VisitorService.getAll().filter(v =>
            v.contacts.some(c => (c.phones || []).some(p => normalizePhone(p) === '9822012345')));
        expect(all).toHaveLength(1);
    });

    it('nobody in the register ever renders as a blank row', () => {
        capture({ phone: '9822012399', name: '' });
        VisitorService.getAll().forEach(v => expect(visitorDisplayName(v).trim()).not.toBe(''));
    });
});
