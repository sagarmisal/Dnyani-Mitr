// @vitest-environment happy-dom
/**
 * INITIATIVE.md D-24 / PR-7 — the pilot we cannot have.
 *
 * The three NGOs will not test. There is nobody downstream, so every defect we
 * miss reaches a volunteer as a broken app — and a SECOND failed adoption is
 * much harder to come back from than the first.
 *
 * This is not unit testing. It is one volunteer's week, in order, through the
 * real screens, with Marathi names typed the way a transliteration keyboard
 * actually produces them — including the same person entered twice with
 * different spellings, because that is what happens.
 *
 * Then it checks the register afterwards, the way the analyzer would.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';

vi.mock('../src/core/activation.js', () => ({
    default: { getMachineInfo: () => ({ machineId: 'm_pilot', machineName: 'Office', machineRole: 'root' }) }
}));

import StateManager from '../src/core/state.js';
import StorageManager from '../src/core/storage.js';
import VisitorService from '../src/services/VisitorService.js';
import InteractionService from '../src/services/InteractionService.js';
import SyncService from '../src/services/SyncService.js';
import { ScheduledItemForm } from '../src/components/Calendar/ScheduledItemForm.js';
import { visitorDisplayName, normalizePhone } from '../src/utils/formatters.js';
import { setLang } from '../src/utils/i18n.js';

/** Fill the capture sheet the way a person would: type, tap, save. */
function takeCall({ phone, name, title, date, occasion = null, headcount = null }) {
    const form = new ScheduledItemForm({ date, direction: 'inbound' });
    const el = form.render();
    document.body.appendChild(el);

    if (phone) {
        const p = el.querySelector('#si-phone');
        p.value = phone;
        p.dispatchEvent(new Event('input'));       // lookup runs on every keystroke
    }
    if (name) el.querySelector('#si-name').value = name;
    el.querySelector('#si-title').value = title;
    if (headcount) el.querySelector(`.lg-chip[data-value="${headcount}"]`)?.click();

    if (occasion) {
        el.querySelector(`.lg-chips--occasion .lg-chip[data-value="${occasion.type}"]`).click();
        el.querySelector('#si-occ-date').value = occasion.date;
        el.querySelector(`.si-occ-detail .lg-chip[data-value="${occasion.relation}"]`).click();
        if (occasion.whose) el.querySelector('#si-occ-whose').value = occasion.whose;
    }

    const matched = form.matchedVisitor;
    form.save();
    el.remove();
    return { form, matchedDuringTyping: matched };
}

let week = {};

beforeAll(() => {
    localStorage.clear();
    StateManager.init();
    StateManager.state = StorageManager.getDefaultState();
    StorageManager.saveState(StateManager.state);
    setLang('mr');

    /* ---- Monday: a supporter phones about her daughter's birthday -------- */
    week.mon = takeCall({
        phone: '98220 12345', name: 'सुनीता पाटील',
        title: 'सुनीता पाटील येणार', date: '2026-08-24', headcount: '3',
        occasion: { type: 'Birthday', date: '2015-08-18', relation: 'CHILD', whose: 'अनन्या' }
    });

    /* ---- Tuesday: a number, and the caller rings off ---------------------- */
    week.tue = takeCall({ phone: '9822012399', title: 'कुणीतरी येणार', date: '2026-08-25' });

    /* ---- Wednesday: the SAME woman rings again ---------------------------- */
    // She spells her name the other way this time. The IME offered both; she
    // is not going to notice, and neither is the volunteer.
    week.wed = takeCall({
        phone: '+91 98220 12345', name: 'सुनिता पाटिल',
        title: 'पुन्हा भेट', date: '2026-08-27'
    });

    /* ---- Thursday: her husband's number, for the same household ---------- */
    const sunita = VisitorService.findByPhone('9822012345').visitor;
    sunita.contacts.push({
        id: 'c_spouse', relationType: 'SPOUSE', name: 'रमेश पाटील',
        phones: ['9822077777'], emails: [], customEvents: []
    });
    StateManager.updateVisitor(sunita.id, sunita);
    week.thu = takeCall({ phone: '9822077777', title: 'रमेश येणार', date: '2026-08-28' });

    /* ---- Friday: an English-speaking donor, typed in Latin ---------------- */
    week.fri = takeCall({
        phone: '9822088888', name: 'Anil Sharma',
        title: 'Anil Sharma visiting', date: '2026-08-29'
    });

    /* ---- and one visit actually happens ----------------------------------- */
    InteractionService.log({
        visitorId: sunita.id, interactionType: 'visit',
        notes: 'मुलीच्या वाढदिवसानिमित्त भेट. जेवण दिलं.',
        interactionDate: '2026-08-24T12:00:00.000Z'
    });
});

describe('the week, as the volunteer experienced it', () => {
    it('Monday: one call created one supporter', () => {
        expect(VisitorService.findByPhone('9822012345')).toBeTruthy();
    });

    it('Monday: and the daughter, carrying next year’s birthday (DF-3)', () => {
        // The flow that compounds. If this breaks, the app is a log again.
        const v = VisitorService.findByPhone('9822012345').visitor;
        const child = v.contacts.find(c => c.relationType === 'CHILD');
        expect(child).toBeTruthy();
        expect(child.name).toBe('अनन्या');
        expect(child.dob).toBe('2015-08-18');
    });

    it('Tuesday: a number with no name still saved, and reads as the number', () => {
        const hit = VisitorService.findByPhone('9822012399');
        // No visitor is created without a name today — the plan is what matters,
        // and the number is on it either way.
        const items = StateManager.getScheduledItems();
        const tue = items.find(i => i.date === '2026-08-25');
        expect(tue).toBeTruthy();
        expect(normalizePhone(tue.phone)).toBe('9822012399');
        expect(tue.phone).not.toMatch(/^0+$/);      // never a placeholder
        if (hit) expect(visitorDisplayName(hit.visitor)).toBeTruthy();
    });

    it('Wednesday: the same woman was RECOGNISED, not duplicated', () => {
        // She typed her name differently and formatted the number differently.
        // The phone is the identity key, so neither mattered.
        expect(week.wed.matchedDuringTyping).toBeTruthy();
        const all = VisitorService.getAll()
            .filter(v => v.contacts.some(c => (c.phones || []).some(p => normalizePhone(p) === '9822012345')));
        expect(all).toHaveLength(1);
    });

    it('Thursday: her husband’s number found the household, not a stranger', () => {
        expect(week.thu.matchedDuringTyping).toBeTruthy();
        expect(week.thu.matchedDuringTyping.id).toBe(VisitorService.findByPhone('9822012345').visitor.id);
    });

    it('Friday: the English-typed donor is there too', () => {
        expect(VisitorService.findByPhone('9822088888')).toBeTruthy();
    });
});

describe('the register afterwards — what the analyzer would see', () => {
    it('holds no duplicate of anyone', () => {
        const phones = new Map();
        VisitorService.getAll().forEach(v => {
            const self = v.contacts.find(c => c.relationType === 'SELF');
            const p = normalizePhone((self?.phones || [])[0]);
            if (p) phones.set(p, (phones.get(p) || 0) + 1);
        });
        const dupes = [...phones.entries()].filter(([, n]) => n > 1);
        expect(dupes, 'the same number on more than one visitor').toEqual([]);
    });

    it('has no visitor that renders as a blank row', () => {
        VisitorService.getAll().forEach(v => {
            const shown = visitorDisplayName(v);
            expect(shown).toBeTruthy();
            expect(shown.trim()).not.toBe('');
        });
    });

    it('never stored a placeholder phone number', () => {
        // 0000000000 under last-ten-digit dedup merges unrelated supporters and
        // propagates the merge through sync. Worse than storing nothing.
        StateManager.getScheduledItems().forEach(i => {
            if (i.phone) expect(normalizePhone(i.phone)).not.toBe('0000000000');
        });
    });

    it('finds every supporter from a Latin query, whatever script they are in', () => {
        expect(VisitorService.search('sunita').length).toBeGreaterThan(0);
        expect(VisitorService.search('anil').length).toBeGreaterThan(0);
    });

    it('finds them from Devanagari too', () => {
        expect(VisitorService.search('सुनीता').length).toBeGreaterThan(0);
    });
});

describe('the week survives a backup and a restore (J5)', () => {
    it('everything comes back, and is still searchable', () => {
        const pkg = SyncService.prepareFullBackup();
        const visitorsBefore = StateManager.getState().visitors.length;
        const itemsBefore = StateManager.getScheduledItems().length;

        // A phone breaks; a new one restores from the WhatsApp message.
        StateManager.state = StorageManager.getDefaultState();
        StorageManager.saveState(StateManager.state);
        expect(StateManager.getState().visitors).toHaveLength(0);

        SyncService.restoreFullBackup(pkg);

        expect(StateManager.getState().visitors).toHaveLength(visitorsBefore);
        expect(StateManager.getScheduledItems()).toHaveLength(itemsBefore);
        expect(VisitorService.search('sunita').length).toBeGreaterThan(0);

        const v = VisitorService.findByPhone('9822012345').visitor;
        expect(v.contacts.find(c => c.relationType === 'CHILD').dob).toBe('2015-08-18');
    });
});
