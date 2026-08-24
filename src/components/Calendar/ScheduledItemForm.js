// ScheduledItemForm (Iter 11, C3 + Phase V) — the screen a staffer fills in
// while the caller is still on the phone.
//
// PHONE FIRST, deliberately. Phone is already the identity key in this app
// (normalised to the last 10 digits; the visitor natural key is the SELF
// contact's first phone). Typing it either finds the existing supporter — name
// and history appear at once — or starts a new one. That inverts the usual cost
// of a required field: it is the fastest path, not an obstacle.
//
// It is required but NEVER blocking. A caller may honestly refuse a number, and
// a form that blocks makes a staffer type 0000000000 — which under last-10-digit
// dedup collides with every other placeholder and MERGES unrelated supporters,
// then propagates that merge through sync. A null phone costs one untrackable
// visit; a fake phone eats other people's records.

import StateManager from '../../core/state.js';
import VisitorService from '../../services/VisitorService.js';
import { ScheduledItem } from '../../models/ScheduledItem.js';
import { Visitor } from '../../models/Visitor.js';
import { Contact } from '../../models/Contact.js';
import { Toast } from '../UI/Toast.js';
import { escapeHTML } from '../../utils/helpers.js';
import { normalizePhone, visitorDisplayName } from '../../utils/formatters.js';
import {
    SCHEDULED_ITEM_TYPES, SCHEDULED_ITEM_DIRECTION, SCHEDULED_ITEM_STATUS,
    RELATIONSHIP_TYPES, EVENT_TYPES
} from '../../utils/constants.js';

export class ScheduledItemForm {
    constructor({ item = null, date = null, direction = null, backfill = false, onSaved = null } = {}) {
        this.item = item;
        this.isEdit = !!item;
        this.direction = item?.direction || direction || SCHEDULED_ITEM_DIRECTION.OUTBOUND;
        this.date = item?.date || date;
        this.backfill = backfill;
        this.onSaved = onSaved || (() => {});
        this.matchedVisitor = null;
        this.root = null;
    }

    get isInbound() { return this.direction === SCHEDULED_ITEM_DIRECTION.INBOUND; }

    render() {
        this.root = document.createElement('div');
        this.root.className = 'modal-overlay';
        this.root.innerHTML = `
            <div class="modal" role="dialog" aria-modal="true" aria-label="${this.isInbound ? 'Someone is coming' : 'Plan a visit'}">
                <div class="modal-header">
                    <h3>${this.isEdit ? 'Edit' : (this.isInbound ? 'Someone is coming' : 'Plan a visit')}</h3>
                    <button class="btn btn-icon" data-close aria-label="Close">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-errors hidden" id="si-errors"></div>

                    ${this.isInbound ? this.renderPhoneFirst() : ''}

                    <label class="form-label" for="si-title">What is it? *</label>
                    <input class="form-input" id="si-title" maxlength="120"
                           value="${escapeHTML(this.item?.title || '')}"
                           placeholder="${this.isInbound ? 'e.g. XYZ family visiting' : 'e.g. Ward 3 visits'}">

                    <div class="form-row">
                        <div>
                            <label class="form-label" for="si-date">Date *</label>
                            <input class="form-input" id="si-date" type="date" value="${escapeHTML(this.date || '')}">
                        </div>
                        <div>
                            <label class="form-label" for="si-time">Time</label>
                            <input class="form-input" id="si-time" type="time" value="${escapeHTML(this.item?.time || '')}">
                        </div>
                    </div>

                    <label class="form-label" for="si-type">Type</label>
                    <select class="form-input" id="si-type">
                        ${Object.values(SCHEDULED_ITEM_TYPES).map(t =>
                            `<option value="${t}" ${((this.item?.type) || (this.isInbound ? 'visit' : 'task')) === t ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>

                    ${this.isInbound ? this.renderOccasion() : ''}

                    <label class="form-label" for="si-notes">Notes</label>
                    <textarea class="form-input" id="si-notes" rows="2">${escapeHTML(this.item?.notes || '')}</textarea>

                    ${!this.isInbound ? '' : `
                    <p class="form-hint">These plans stay on this phone. What actually happens is shared when you sync.</p>`}
                </div>
                <div class="modal-footer">
                    ${this.isEdit ? '<button class="btn btn-danger btn-sm" data-delete>Delete</button>' : ''}
                    <button class="btn" data-close>Cancel</button>
                    <button class="btn btn-primary" data-save>${this.isEdit ? 'Save' : 'Add'}</button>
                </div>
            </div>
        `;
        this.attach();
        return this.root;
    }

    renderPhoneFirst() {
        return `
            <label class="form-label" for="si-phone">Phone number *</label>
            <input class="form-input" id="si-phone" type="tel" inputmode="numeric"
                   value="${escapeHTML(this.item?.phone || '')}"
                   placeholder="10-digit number">
            <div id="si-match" class="form-match"></div>
            <label class="form-check">
                <input type="checkbox" id="si-nophone" ${this.item && this.item.phone === null && this.isEdit ? 'checked' : ''}>
                Caller did not give a number
            </label>
            <p class="form-hint" id="si-nophone-warn" class="hidden"></p>

            <label class="form-label" for="si-name">Their name *</label>
            <input class="form-input" id="si-name" value="${escapeHTML(this.item?.visitorName || '')}">

            <label class="form-label" for="si-headcount">How many people</label>
            <input class="form-input" id="si-headcount" type="number" min="1" max="999"
                   value="${this.item?.headcount ?? ''}" placeholder="optional">
        `;
    }

    renderOccasion() {
        const occ = this.item?.occasion || {};
        return `
            <fieldset class="form-fieldset">
                <legend>Is it for an occasion?</legend>
                <div class="form-row">
                    <div>
                        <label class="form-label" for="si-occ-type">Occasion</label>
                        <select class="form-input" id="si-occ-type">
                            <option value="">— none —</option>
                            ${Object.values(EVENT_TYPES).map(t =>
                                `<option value="${escapeHTML(t)}" ${occ.type === t ? 'selected' : ''}>${escapeHTML(t)}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="form-label" for="si-occ-date">Occasion date</label>
                        <input class="form-input" id="si-occ-date" type="date" value="${escapeHTML(occ.date || '')}">
                    </div>
                </div>
                <div class="form-row">
                    <div>
                        <label class="form-label" for="si-occ-whose">Whose?</label>
                        <input class="form-input" id="si-occ-whose" value="${escapeHTML(occ.whose || '')}" placeholder="e.g. daughter's name">
                    </div>
                    <div>
                        <label class="form-label" for="si-occ-rel">Relation</label>
                        <select class="form-input" id="si-occ-rel">
                            <option value="">—</option>
                            ${Object.values(RELATIONSHIP_TYPES).map(r =>
                                `<option value="${escapeHTML(r)}" ${occ.relation === r ? 'selected' : ''}>${escapeHTML(r)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <p class="form-hint">The occasion's own date can differ from the visit date — people often come on the nearest Sunday.</p>
            </fieldset>
        `;
    }

    attach() {
        const $ = (sel) => this.root.querySelector(sel);
        this.root.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => this.close()));
        this.root.addEventListener('click', (e) => { if (e.target === this.root) this.close(); });
        $('[data-save]').addEventListener('click', () => this.save());

        const del = $('[data-delete]');
        if (del) del.addEventListener('click', () => this.remove());

        const phone = $('#si-phone');
        if (phone) {
            phone.addEventListener('input', () => this.lookup(phone.value));
            this.lookup(phone.value);
        }
        const noPhone = $('#si-nophone');
        if (noPhone) {
            noPhone.addEventListener('change', () => {
                phone.disabled = noPhone.checked;
                const warn = $('#si-nophone-warn');
                warn.textContent = noPhone.checked
                    ? 'Without a number this visit cannot be linked to them next year.'
                    : '';
                warn.className = noPhone.checked ? 'form-hint form-hint-warn' : 'form-hint';
            });
        }
    }

    /** Phone-first identity resolution: the required field that saves you work. */
    lookup(raw) {
        const box = this.root.querySelector('#si-match');
        if (!box) return;
        const digits = normalizePhone(raw || '');
        if (!digits || digits.length < 10) {
            box.innerHTML = '';
            this.matchedVisitor = null;
            return;
        }
        // P1.7 — search every contact's number, not just the SELF one. A
        // supporter who gives their spouse's or son's number is the same
        // household we already know, and offering to create a duplicate mid
        // phone call is the worst possible moment to get this wrong.
        const hit = VisitorService.findByPhone(digits);
        const match = hit ? hit.visitor : null;
        this.matchedVisitor = match || null;

        if (match) {
            const visits = StateManager.getInteractions().filter(i => i.visitorId === match.id).length;
            // Say WHOSE number it is when it is not the supporter's own, so the
            // staffer can see why this person came up and correct it if wrong.
            const via = hit && !hit.isSelf && hit.contact?.name
                ? ` <span>(${escapeHTML(hit.contact.name)}'s number)</span>`
                : '';
            box.innerHTML = `<div class="form-match-hit">✓ ${escapeHTML(visitorDisplayName(match))}${via}
                <span>${visits} previous interaction${visits === 1 ? '' : 's'}</span></div>`;
            const name = this.root.querySelector('#si-name');
            const self = match.contacts.find(c => c.relationType === RELATIONSHIP_TYPES.SELF);
            if (name && !name.value) name.value = self?.name || '';
        } else {
            box.innerHTML = '<div class="form-match-new">New supporter — they will be added to your list.</div>';
        }
    }

    collect() {
        const $ = (sel) => this.root.querySelector(sel);
        const noPhone = $('#si-nophone')?.checked;
        const occType = $('#si-occ-type')?.value || '';

        return {
            id: this.item?.id,
            direction: this.direction,
            date: $('#si-date').value,
            time: $('#si-time').value || null,
            type: $('#si-type').value,
            title: $('#si-title').value,
            notes: $('#si-notes').value,
            status: this.item?.status || SCHEDULED_ITEM_STATUS.PLANNED,
            // Explicit null, never a placeholder — see the header comment.
            phone: this.isInbound ? (noPhone ? null : ($('#si-phone').value || null)) : null,
            visitorName: this.isInbound ? ($('#si-name')?.value || '') : (this.item?.visitorName || ''),
            headcount: this.isInbound && $('#si-headcount')?.value ? parseInt($('#si-headcount').value, 10) : null,
            visitorId: this.matchedVisitor?.id || this.item?.visitorId || null,
            occasion: occType ? {
                type: occType,
                whose: $('#si-occ-whose')?.value || '',
                relation: $('#si-occ-rel')?.value || null,
                date: $('#si-occ-date')?.value || null
            } : null
        };
    }

    save() {
        const data = this.collect();

        if (this.isInbound && !data.visitorName.trim()) {
            return this.showErrors(['Enter their name.']);
        }
        const errors = ScheduledItem.validate(data);
        if (errors.length) return this.showErrors(errors);

        // V2/V4: a new supporter is created from the call, because this is the
        // only moment the NGO learns they exist. Only ever with a real number.
        if (this.isInbound && !data.visitorId && data.phone) {
            data.visitorId = this.createVisitorFromCall(data);
        }

        const item = new ScheduledItem(data).toJSON();
        const ok = this.isEdit
            ? StateManager.updateScheduledItem(this.item.id, item)
            : StateManager.addScheduledItem(item);

        if (!ok) return this.showErrors(['Could not save. Your storage may be full.']);
        this.onSaved(item);
        this.close();
    }

    /**
     * V4 — the graph grows from the phone call. A third-party occasion becomes a
     * Contact with an event, which the existing reminder engine then carries
     * forward every year with no further effort from anybody.
     */
    createVisitorFromCall(data) {
        const self = new Contact({
            relationType: RELATIONSHIP_TYPES.SELF,
            name: data.visitorName.trim(),
            phones: [data.phone]
        });
        if (data.occasion && data.occasion.relation === RELATIONSHIP_TYPES.SELF && data.occasion.date) {
            applyEvent(self, data.occasion);
        }

        const contacts = [self];
        if (data.occasion && data.occasion.relation && data.occasion.relation !== RELATIONSHIP_TYPES.SELF) {
            const other = new Contact({
                relationType: data.occasion.relation,
                name: (data.occasion.whose || '').trim() || 'Family member'
            });
            if (data.occasion.date) applyEvent(other, data.occasion);
            contacts.push(other);
        }

        const visitor = new Visitor({
            contacts: contacts.map(c => ({ ...c })),
            notes: `Added from a phone call on ${new Date().toLocaleDateString('en-IN')}.`,
            source: 'phone-intake'
        });
        StateManager.addVisitor(JSON.parse(JSON.stringify(visitor)));
        Toast.show(`${data.visitorName} added to your supporters.`, 'success');
        return visitor.id;
    }

    showErrors(errors) {
        const box = this.root.querySelector('#si-errors');
        box.className = 'form-errors';
        box.innerHTML = errors.map(e => `<div>${escapeHTML(e)}</div>`).join('');
    }

    async remove() {
        StateManager.deleteScheduledItem(this.item.id);
        Toast.show('Removed.', 'success');
        this.onSaved(null);
        this.close();
    }

    close() {
        if (this.root?.parentNode) this.root.parentNode.removeChild(this.root);
    }
}

/** Write the occasion onto the contact in whichever field the reminder engine reads. */
function applyEvent(contact, occasion) {
    const type = String(occasion.type || '').toLowerCase();
    if (type.includes('birth')) {
        contact.dob = occasion.date;
    } else if (type.includes('anniv')) {
        contact.marriageDate = occasion.date;
    } else if (type.includes('death')) {
        contact.deathDate = occasion.date;
    } else {
        contact.customEvents = [...(contact.customEvents || []), {
            eventType: occasion.type, eventDate: occasion.date, monthOnly: false, reminderEnabled: true
        }];
    }
}

export default ScheduledItemForm;
