// ScheduledItemForm — the screen a staffer fills in while the caller is still
// on the phone. Rebuilt on the component kit (INITIATIVE.md P1.12, D-05/D-09).
//
// PHONE FIRST, deliberately. Phone is the identity key (PR-1): normalised to
// the last ten digits, no spelling variants, typed on a numeric keypad. Typing
// it either finds the existing supporter — name and history appear at once — or
// starts a new one. That inverts the usual cost of a required field: it is the
// fastest path through the form, not an obstacle.
//
// It is required but NEVER blocking (D-20). A caller may honestly ring off
// without giving one, and a form that blocks makes a staffer type 0000000000 —
// which under last-ten-digit dedup collides with every other placeholder and
// MERGES unrelated supporters, then propagates that merge through sync. A null
// phone costs one untrackable visit; a fake phone eats other people's records.
//
// WHAT CHANGED IN THE REBUILD: the logic is the same — lookup, occasion
// capture, visitor creation, validation, save. The markup is not. Four
// <select> dropdowns became chips (D-08), and the centred dialog became a
// bottom sheet (D-09). A chip is one tap and shows its options without being
// touched; a select is tap → read → scroll → tap inside an OEM picker, and
// hides what is possible until you open it.

import StateManager from '../../core/state.js';
import VisitorService from '../../services/VisitorService.js';
import { ScheduledItem } from '../../models/ScheduledItem.js';
import { Visitor } from '../../models/Visitor.js';
import { Contact } from '../../models/Contact.js';
import { Toast } from '../UI/Toast.js';
import { Sheet, Chips } from '../UI/kit.js';
import { escapeHTML } from '../../utils/helpers.js';
import { normalizePhone, visitorDisplayName } from '../../utils/formatters.js';
import {
    SCHEDULED_ITEM_TYPES, SCHEDULED_ITEM_DIRECTION, SCHEDULED_ITEM_STATUS,
    RELATIONSHIP_TYPES, EVENT_TYPES
} from '../../utils/constants.js';

const TYPE_CHIPS = [
    { value: 'visit',   label: 'भेट · Visit',      icon: '🏠' },
    { value: 'call',    label: 'फोन · Call',       icon: '📞' },
    { value: 'meeting', label: 'बैठक · Meeting',   icon: '👥' },
    { value: 'task',    label: 'काम · Task',       icon: '📋' }
];

const OCCASION_CHIPS = [
    { value: 'Birthday',    label: 'वाढदिवस',        icon: '🎂' },
    { value: 'Anniversary', label: 'लग्नाचा वाढदिवस', icon: '💍' },
    { value: 'Death',       label: 'स्मरण',          icon: '🕯️' },
    { value: 'Custom',      label: 'इतर',            icon: '🌸' }
];

const RELATION_CHIPS = [
    { value: 'SELF',   label: 'स्वतःचा · Their own' },
    { value: 'CHILD',  label: 'मुलगा/मुलगी · Child' },
    { value: 'SPOUSE', label: 'पती/पत्नी · Spouse' },
    { value: 'PARENT', label: 'आई/वडील · Parent' },
    { value: 'FRIEND', label: 'मित्र · Friend' }
];

const HEADCOUNT_CHIPS = [
    { value: '1', label: '१' }, { value: '2', label: '२' },
    { value: '3', label: '३' }, { value: '4', label: '४' },
    { value: '5', label: '५' }, { value: 'more', label: '५+' }
];

export class ScheduledItemForm {
    constructor({ item = null, date = null, direction = null, backfill = false, onSaved = null } = {}) {
        this.item = item;
        this.isEdit = !!item;
        this.direction = item?.direction || direction || SCHEDULED_ITEM_DIRECTION.OUTBOUND;
        this.date = item?.date || date;
        this.backfill = backfill;
        this.onSaved = onSaved || (() => {});
        this.matchedVisitor = null;
        this.noPhone = false;
        this.root = null;
        this.sheet = null;
    }

    get isInbound() { return this.direction === SCHEDULED_ITEM_DIRECTION.INBOUND; }

    render() {
        const body = document.createElement('div');
        body.className = 'si-form';

        this.errors = document.createElement('div');
        this.errors.className = 'si-errors hidden';
        body.appendChild(this.errors);

        if (this.isInbound) body.appendChild(this._phoneFirst());
        body.appendChild(this._whatAndWhen());
        if (this.isInbound) body.appendChild(this._occasion());
        body.appendChild(this._notes());

        const actions = [];
        if (this.isEdit) {
            actions.push({ label: 'काढून टाका · Delete', variant: 'danger', onClick: () => this.remove() });
        }
        actions.push({ label: 'रद्द · Cancel', variant: 'quiet', onClick: () => this.close() });
        actions.push({
            label: this.isEdit ? 'जतन करा · Save' : 'जतन करा · Save',
            variant: 'primary',
            onClick: () => this.save()
        });

        this.sheet = new Sheet({
            title: this.isEdit
                ? 'बदल करा'
                : (this.isInbound ? 'कुणीतरी येतंय · Someone is coming' : 'भेट ठरवा · Plan a visit'),
            // Explanation at the point of confusion (PR-4), not in a help page.
            hint: this.isInbound
                ? 'फोन नंबर टाका — बाकी सगळं एका बोटाने.'
                : 'Plan a visit your team will make.',
            body,
            actions,
            onClose: () => { this.root = null; }
        });

        this.root = this.sheet.render();
        this._wire();
        return this.root;
    }

    /* ------------------------------------------------------------- sections */

    _phoneFirst() {
        const wrap = document.createElement('div');
        wrap.innerHTML = `
            <label class="si-label" for="si-phone">फोन नंबर · Phone number</label>
            <input class="si-input" id="si-phone" type="tel" inputmode="numeric"
                   value="${escapeHTML(this.item?.phone || '')}"
                   placeholder="10-digit number">
            <div id="si-match" class="si-match"></div>
            <label class="si-check">
                <input type="checkbox" id="si-nophone"
                       ${this.item && this.item.phone === null && this.isEdit ? 'checked' : ''}>
                <span>त्यांनी नंबर दिला नाही · They did not give a number</span>
            </label>
            <p class="si-hint" id="si-nophone-warn"></p>

            <label class="si-label" for="si-name">त्यांचं नाव · Their name</label>
            <input class="si-input" id="si-name" value="${escapeHTML(this.item?.visitorName || '')}">

            <label class="si-label">किती माणसं? · How many people</label>
        `;

        const initial = this.item?.headcount;
        this.headcount = new Chips({
            options: HEADCOUNT_CHIPS,
            selected: initial ? [initial <= 5 ? String(initial) : 'more'] : [],
            onChange: vals => this._onHeadcount(vals)
        });
        wrap.appendChild(this.headcount.render());

        // Revealed only when "5+" is chosen, so the common case stays one tap
        // and the uncommon one stays possible.
        this.headcountMore = document.createElement('input');
        this.headcountMore.className = 'si-input hidden';
        this.headcountMore.type = 'number';
        this.headcountMore.min = '6';
        this.headcountMore.max = '999';
        this.headcountMore.placeholder = 'किती?';
        if (initial > 5) {
            this.headcountMore.value = String(initial);
            this.headcountMore.classList.remove('hidden');
        }
        wrap.appendChild(this.headcountMore);
        return wrap;
    }

    _whatAndWhen() {
        const wrap = document.createElement('div');
        wrap.innerHTML = `
            <label class="si-label" for="si-title">काय आहे? · What is it?</label>
            <input class="si-input" id="si-title" maxlength="120"
                   value="${escapeHTML(this.item?.title || '')}"
                   placeholder="${this.isInbound ? 'उदा. जाधव कुटुंब येणार' : 'e.g. Ward 3 visits'}">

            <div class="si-row">
                <div>
                    <label class="si-label" for="si-date">तारीख · Date</label>
                    <input class="si-input" id="si-date" type="date" value="${escapeHTML(this.date || '')}">
                </div>
                <div>
                    <label class="si-label" for="si-time">वेळ · Time</label>
                    <input class="si-input" id="si-time" type="time" value="${escapeHTML(this.item?.time || '')}">
                </div>
            </div>

            <label class="si-label">प्रकार · Type</label>
        `;
        this.type = new Chips({
            options: TYPE_CHIPS,
            selected: [this.item?.type || (this.isInbound ? 'visit' : 'task')]
        });
        wrap.appendChild(this.type.render());
        return wrap;
    }

    _occasion() {
        const occ = this.item?.occasion || {};
        const wrap = document.createElement('div');
        wrap.className = 'si-occasion';
        wrap.innerHTML = `<label class="si-label">कशासाठी? · Is it for an occasion?</label>`;

        this.occType = new Chips({
            options: OCCASION_CHIPS,
            selected: occ.type ? [occ.type] : [],
            tone: 'occasion',
            onChange: vals => this._toggleOccasionDetail(vals.length > 0)
        });
        wrap.appendChild(this.occType.render());

        this.occDetail = document.createElement('div');
        this.occDetail.className = occ.type ? 'si-occ-detail' : 'si-occ-detail hidden';
        this.occDetail.innerHTML = `
            <div class="si-row">
                <div>
                    <label class="si-label" for="si-occ-date">त्या दिवसाची तारीख · Occasion date</label>
                    <input class="si-input" id="si-occ-date" type="date" value="${escapeHTML(occ.date || '')}">
                </div>
                <div>
                    <label class="si-label" for="si-occ-whose">कुणाचा? · Whose?</label>
                    <input class="si-input" id="si-occ-whose" value="${escapeHTML(occ.whose || '')}"
                           placeholder="उदा. मुलीचं नाव">
                </div>
            </div>
            <label class="si-label">नातं · Relation</label>
        `;
        this.occRel = new Chips({
            options: RELATION_CHIPS,
            selected: occ.relation ? [occ.relation] : []
        });
        this.occDetail.appendChild(this.occRel.render());

        const hint = document.createElement('p');
        hint.className = 'si-hint';
        // The whole reason the occasion carries its own date.
        hint.textContent = 'त्यांच्या वाढदिवसाची तारीख आणि भेटीची तारीख वेगळी असू शकते — लोक जवळच्या रविवारी येतात.';
        this.occDetail.appendChild(hint);

        wrap.appendChild(this.occDetail);
        return wrap;
    }

    _notes() {
        const wrap = document.createElement('div');
        wrap.innerHTML = `
            <label class="si-label" for="si-notes">नोंद · Notes</label>
            <textarea class="si-input" id="si-notes" rows="2">${escapeHTML(this.item?.notes || '')}</textarea>
            ${this.isInbound
                ? '<p class="si-hint">या नोंदी या फोनवर राहतात. प्रत्यक्ष काय घडलं ते sync केल्यावर सगळ्यांना कळतं.</p>'
                : ''}
        `;
        return wrap;
    }

    /* --------------------------------------------------------------- wiring */

    _wire() {
        const $ = sel => this.root.querySelector(sel);

        const phone = $('#si-phone');
        if (phone) {
            phone.addEventListener('input', () => this.lookup(phone.value));
            this.lookup(phone.value);
        }

        const noPhone = $('#si-nophone');
        if (noPhone) {
            noPhone.addEventListener('change', () => {
                this.noPhone = noPhone.checked;
                phone.disabled = noPhone.checked;
                const warn = $('#si-nophone-warn');
                warn.textContent = noPhone.checked
                    ? 'नंबराशिवाय पुढच्या वर्षी ही भेट त्यांच्याशी जोडता येणार नाही.'
                    : '';
                warn.className = noPhone.checked ? 'si-hint si-hint--warn' : 'si-hint';
            });
        }
    }

    _onHeadcount(vals) {
        if (!this.headcountMore) return;
        this.headcountMore.classList.toggle('hidden', vals[0] !== 'more');
        if (vals[0] === 'more') this.headcountMore.focus();
    }

    _toggleOccasionDetail(show) {
        this.occDetail?.classList.toggle('hidden', !show);
    }

    /** Phone-first identity resolution: the required field that saves you work. */
    lookup(raw) {
        const box = this.root?.querySelector('#si-match');
        if (!box) return;
        const digits = normalizePhone(raw || '');
        if (!digits) {
            box.innerHTML = '';
            this.matchedVisitor = null;
            return;
        }
        // P1.7 — search every contact's number, not only the SELF one. A
        // supporter giving their spouse's or son's number is a household we
        // already know, and offering to create a duplicate mid phone call is
        // the worst possible moment to get this wrong.
        const hit = VisitorService.findByPhone(digits);
        const match = hit ? hit.visitor : null;
        this.matchedVisitor = match || null;

        if (match) {
            const visits = StateManager.getInteractions().filter(i => i.visitorId === match.id).length;
            // Say WHOSE number it is when it is not the supporter's own, so the
            // staffer can see why this person came up and correct it if wrong.
            const via = hit && !hit.isSelf && hit.contact?.name
                ? ` <span>(${escapeHTML(hit.contact.name)}चा नंबर)</span>`
                : '';
            box.innerHTML = `<div class="si-match-hit">✓ ${escapeHTML(visitorDisplayName(match))}${via}
                <span>याआधी ${visits} वेळा</span></div>`;
            const name = this.root.querySelector('#si-name');
            const self = match.contacts.find(c => c.relationType === RELATIONSHIP_TYPES.SELF);
            if (name && !name.value) name.value = self?.name || '';
        } else {
            box.innerHTML = '<div class="si-match-new">नवीन — यादीत जोडले जातील.</div>';
        }
    }

    /* ----------------------------------------------------------------- save */

    collect() {
        const $ = sel => this.root.querySelector(sel);
        const occType = this.occType?.value()[0] || '';

        let headcount = null;
        const hc = this.headcount?.value()[0];
        if (hc === 'more') {
            const n = parseInt(this.headcountMore?.value || '', 10);
            headcount = Number.isFinite(n) ? n : null;
        } else if (hc) {
            headcount = parseInt(hc, 10);
        }

        return {
            id: this.item?.id,
            direction: this.direction,
            date: $('#si-date').value,
            time: $('#si-time').value || null,
            type: this.type.value()[0] || (this.isInbound ? 'visit' : 'task'),
            title: $('#si-title').value,
            notes: $('#si-notes').value,
            status: this.item?.status || SCHEDULED_ITEM_STATUS.PLANNED,
            // Explicit null, never a placeholder — see the header comment.
            phone: this.isInbound ? (this.noPhone ? null : ($('#si-phone').value || null)) : null,
            visitorName: this.isInbound ? ($('#si-name')?.value || '') : (this.item?.visitorName || ''),
            headcount,
            visitorId: this.matchedVisitor?.id || this.item?.visitorId || null,
            occasion: occType ? {
                type: occType,
                whose: $('#si-occ-whose')?.value || '',
                relation: this.occRel?.value()[0] || null,
                date: $('#si-occ-date')?.value || null
            } : null
        };
    }

    save() {
        const data = this.collect();

        // D-20 — a phone OR a name, never neither. This used to demand a name
        // outright, which is the inversion D-07 corrects: it mandated the field
        // with spelling variance while the identity key stayed optional. A
        // volunteer who got a number and no name could not save at all.
        if (this.isInbound && !data.visitorName.trim() && !normalizePhone(data.phone)) {
            return this.showErrors(['फोन नंबर टाका, किंवा त्यांनी दिला नसेल तर नाव टाका.']);
        }

        const errors = ScheduledItem.validate(data);
        if (errors.length) return this.showErrors(errors);

        // A new supporter is created from the call, because this is the only
        // moment the NGO learns they exist. Only ever with a real number —
        // without one there is nothing to find them by next year.
        if (this.isInbound && !data.visitorId && data.phone) {
            data.visitorId = this.createVisitorFromCall(data);
        }

        const item = new ScheduledItem(data).toJSON();
        const ok = this.isEdit
            ? StateManager.updateScheduledItem(this.item.id, item)
            : StateManager.addScheduledItem(item);

        if (!ok) return this.showErrors(['जतन करता आलं नाही. फोनची जागा भरली असेल.']);
        this.onSaved(item);
        this.close();
    }

    /**
     * Turn a phone call into a supporter — and, when the occasion belongs to
     * someone else in the family, into a Contact carrying that date.
     *
     * This is the flow that compounds (DF-3). A call about a daughter's
     * birthday creates a CHILD contact with that birthday, and the reminder
     * engine surfaces it every year from now on, unprompted. One call becomes
     * a permanent relationship.
     */
    createVisitorFromCall(data) {
        const self = new Contact({
            relationType: RELATIONSHIP_TYPES.SELF,
            name: (data.visitorName || '').trim(),
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
        Toast.show(`${visitorDisplayName(visitor)} यादीत जोडले.`, 'success');
        return visitor.id;
    }

    showErrors(list) {
        if (!this.errors) return;
        this.errors.className = 'si-errors';
        this.errors.innerHTML = list.map(e => `<div>${escapeHTML(e)}</div>`).join('');
        this.errors.scrollIntoView?.({ block: 'nearest' });
    }

    remove() {
        StateManager.deleteScheduledItem(this.item.id);
        this.onSaved(null);
        this.close();
    }

    close() { this.sheet?.close(); }
}

/** Write an occasion onto a contact as the event the reminder engine reads. */
function applyEvent(contact, occasion) {
    const d = occasion.date;
    if (!d) return;
    if (occasion.type === EVENT_TYPES.BIRTHDAY || occasion.type === 'Birthday') contact.dob = d;
    else if (occasion.type === EVENT_TYPES.ANNIVERSARY || occasion.type === 'Anniversary') contact.marriageDate = d;
    else if (occasion.type === EVENT_TYPES.DEATH || occasion.type === 'Death') contact.deathDate = d;
    else {
        contact.customEvents = contact.customEvents || [];
        contact.customEvents.push({ label: occasion.whose || occasion.type, date: d });
    }
}

export default ScheduledItemForm;
