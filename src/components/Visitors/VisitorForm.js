// Visitor Form Component - Multi-step wizard for adding/editing visitors

import VisitorService from '../../services/VisitorService.js';
import { normalizePhone } from '../../utils/formatters.js';
import { t } from '../../utils/i18n.js';
import Router, { ROUTES } from '../../core/router.js';
import { Contact } from '../../models/Contact.js';
import { RELATIONSHIP_TYPES, RELATIONSHIP_LABELS } from '../../utils/constants.js';
import { generateId } from '../../utils/helpers.js';
import { ConfirmDialog } from '../UI/ConfirmDialog.js';
import { Toast } from '../UI/Toast.js';

export class VisitorForm {
  constructor(visitorId = null) {
    this.visitorId = visitorId;
    this.isEditMode = !!visitorId;
    this.currentStep = 1;
    this.totalSteps = 3;
    this.container = null;

    // Form data
    this.formData = {
      contacts: [],
      category: '',
      tags: [],
      notes: '',
      address: '',
      city: '',
      communicationPreference: 'whatsapp',
      consentGiven: false,
      contactFrequencyDays: null
    };

    // Load existing visitor if editing
    if (this.isEditMode) {
      this.loadVisitor();
    } else {
      // Initialize with empty SELF contact
      this.formData.contacts.push(this.createEmptyContact('SELF'));
    }
  }

  /**
   * Load existing visitor for editing
   */
  loadVisitor() {
    const visitor = VisitorService.getById(this.visitorId);
    if (visitor) {
      this.formData = {
        contacts: visitor.contacts,
        category: visitor.category || '',
        tags: visitor.tags || [],
        notes: visitor.notes || '',
        address: visitor.address || '',
        city: visitor.city || '',
        communicationPreference: visitor.communicationPreference || 'whatsapp',
        consentGiven: visitor.consentGiven || false,
        contactFrequencyDays: visitor.contactFrequencyDays || null
      };
    }
  }

  /**
   * Create empty contact
   */
  createEmptyContact(relationType = 'SELF') {
    return {
      id: generateId('contact'),
      relationType,
      name: '',
      phones: [''],
      emails: [''],
      dob: '',
      dobMonthOnly: false,
      marriageDate: '',
      marriageMonthOnly: false,
      deathDate: '',
      deathMonthOnly: false,
      notes: ''
    };
  }

  /**
   * Render form
   */
  render() {
    const container = document.createElement('div');
    container.className = 'visitor-form-container';

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">${this.isEditMode ? 'Edit' : 'Add'} Visitor</h2>
          <div class="progress-steps" style="margin-top: 1rem;">
            ${this.renderProgressSteps()}
          </div>
        </div>
        
        <div class="card-body" id="form-step-content">
          <!-- Step content will be rendered here -->
        </div>
        
        <div class="card-footer">
          <button type="button" id="cancel-btn" class="btn btn-secondary">${t('action.cancel')}</button>
          <div style="flex: 1;"></div>
          <button type="button" id="prev-btn" class="btn btn-secondary" ${this.currentStep === 1 ? 'disabled' : ''}>
            ← Previous
          </button>
          <button type="button" id="next-btn" class="btn btn-primary">
            ${this.currentStep === this.totalSteps ? 'Save' : 'Next →'}
          </button>
        </div>
      </div>
    `;

    this.container = container;
    this.renderCurrentStep();
    this.attachEventListeners();

    return container;
  }



  /**
   * Render current step
   */
  renderCurrentStep() {
    const stepContent = this.container.querySelector('#form-step-content');

    switch (this.currentStep) {
      case 1:
        stepContent.innerHTML = this.renderStep1();
        break;
      case 2:
        stepContent.innerHTML = this.renderStep2();
        break;
      case 3:
        stepContent.innerHTML = this.renderStep3();
        break;
    }

    // Attach step-specific listeners
    this.attachStepListeners();
  }

  /**
   * Helper: Render Smart Date Group (Day / Month / Year)
   */
  renderDateGroup(fieldId, label, dateStr, isMonthOnly) {
    let dateValue = '';
    let yearUnknown = false;

    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        // Format as YYYY-MM-DD for input[type=date]
        const yyyy = String(d.getFullYear()).padStart(4, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        dateValue = `${yyyy}-${mm}-${dd}`;
        if (isMonthOnly && d.getFullYear() === 2000) {
          yearUnknown = true;
        }
      }
    }

    return `
      <div class="form-group date-field-group" style="margin-bottom: 0;">
        <label class="form-label" for="${fieldId}">${label}</label>
        <input type="date" id="${fieldId}" class="form-input" value="${dateValue}" />
        <label class="year-unknown-label">
          <input type="checkbox" id="${fieldId}-year-unknown" ${yearUnknown ? 'checked' : ''} />
          ${t('form.noYear')}
        </label>
      </div>
    `;
  }

  /**
   * Helper: Parse Smart Date Group
   * Returns { date: 'YYYY-MM-DD', monthOnly: boolean }
   */
  parseDateGroup(fieldId) {
    const dateInput = this.container.querySelector(`#${fieldId}`);
    const yearUnknownCheckbox = this.container.querySelector(`#${fieldId}-year-unknown`);

    if (!dateInput || !dateInput.value) return { date: '', monthOnly: false };

    const dateValue = dateInput.value; // 'YYYY-MM-DD'
    const yearUnknown = yearUnknownCheckbox?.checked || false;

    if (yearUnknown) {
      // Replace year with 2000 (leap-year-safe dummy)
      const parts = dateValue.split('-');
      return { date: `2000-${parts[1]}-${parts[2]}`, monthOnly: true };
    }

    return { date: dateValue, monthOnly: false };
  }


  /**
   * Step 1: Primary Contact (SELF)
   */
  renderStep1() {
    const selfContact = this.formData.contacts.find(c => c.relationType === 'SELF') || this.createEmptyContact('SELF');

    return `
      <h3 style="margin: 0 0 0.25rem 0;">${t('form.primary')}</h3>
      <p class="text-secondary" style="margin: 0 0 1.5rem 0;">The main person you're recording.</p>

      <div class="form-row">
        <div class="form-group form-col-2">
          <label class="form-label" for="self-name">${t('form.fullName')}</label>
          <input type="text" id="self-name" class="form-input" value="${this.escapeHtml(selfContact.name)}" required autocomplete="name" placeholder="${t('form.namePlaceholder')}" />
          <div class="field-error" data-error-for="self-name"></div>
        </div>
        <div class="form-group form-col-1">
          <label class="form-label" for="self-comm-pref">${t('form.preferredContact')}</label>
          <select id="self-comm-pref" class="form-select">
            <option value="whatsapp" ${this.formData.communicationPreference === 'whatsapp' ? 'selected' : ''}>WhatsApp</option>
            <option value="call" ${this.formData.communicationPreference === 'call' ? 'selected' : ''}>${t('form.phoneCall')}</option>
            <option value="sms" ${this.formData.communicationPreference === 'sms' ? 'selected' : ''}>SMS</option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group form-col-1">
          <label class="form-label" for="self-city">${t('form.city')}</label>
          <input type="text" id="self-city" class="form-input" value="${this.escapeHtml(this.formData.city)}" autocomplete="address-level2" placeholder="${t('form.cityPlaceholder')}" />
        </div>
        <div class="form-group form-col-2">
          <label class="form-label" for="self-address">${t('form.address')}</label>
          <input type="text" id="self-address" class="form-input" value="${this.escapeHtml(this.formData.address)}" autocomplete="street-address" placeholder="${t('form.addressPlaceholder')}" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">${t('form.phones')}</label>
          <div id="self-phones">
            ${selfContact.phones.map((phone, idx) => `
              <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                <input type="tel" inputmode="tel" autocomplete="tel" class="form-input phone-input" data-index="${idx}" value="${this.escapeHtml(phone)}" placeholder="${t('form.mobile')}" style="flex: 1; min-width: 0;" />
                ${idx > 0 ? `<button type="button" class="btn btn-secondary btn-sm remove-phone" data-index="${idx}" aria-label="${t('form.removePhone')}" style="flex: 0 0 auto; min-width: 44px;">✕</button>` : ''}
              </div>
            `).join('')}
          </div>
          <button type="button" id="add-phone" class="btn btn-secondary btn-sm" style="width: 100%;">+ ${t('form.addPhone')}</button>
        </div>

        <div class="form-group">
          <label class="form-label">${t('form.emails')}</label>
          <div id="self-emails">
            ${selfContact.emails.map((email, idx) => `
              <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                <input type="email" inputmode="email" autocomplete="email" class="form-input email-input" data-index="${idx}" value="${this.escapeHtml(email)}" placeholder="${t('form.email')}" style="flex: 1; min-width: 0;" />
                ${idx > 0 ? `<button type="button" class="btn btn-secondary btn-sm remove-email" data-index="${idx}" aria-label="${t('form.removeEmail')}" style="flex: 0 0 auto; min-width: 44px;">✕</button>` : ''}
              </div>
            `).join('')}
          </div>
          <button type="button" id="add-email" class="btn btn-secondary btn-sm" style="width: 100%;">+ ${t('form.addEmail')}</button>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          ${this.renderDateGroup('self-dob', t('form.dob'), selfContact.dob, selfContact.dobMonthOnly)}
        </div>
        <div class="form-group">
          ${this.renderDateGroup('self-marriage', 'Anniversary', selfContact.marriageDate, selfContact.marriageMonthOnly)}
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="self-notes">${t('form.notes')}</label>
        <textarea id="self-notes" class="form-textarea" rows="2" placeholder="Anything you want to remember about this person...">${this.escapeHtml(selfContact.notes || '')}</textarea>
      </div>

      ${!this.isEditMode ? `
      <div class="form-group consent-group" style="margin-top: 1rem; padding: 0.9rem 1rem; background: var(--color-surface-hover); border: 1px solid var(--color-border); border-left: 3px solid var(--color-success); border-radius: var(--radius-md);">
        <label class="consent-label" style="display: flex; align-items: flex-start; gap: 0.75rem; cursor: pointer; margin: 0;">
          <input type="checkbox" id="consent-checkbox" ${this.formData.consentGiven ? 'checked' : ''} style="margin-top: 0.2rem; min-width: 20px; min-height: 20px; flex-shrink: 0;" />
          <span style="font-size: 0.95rem;">I have permission to store this person's contact information.</span>
        </label>
        <div class="field-error" data-error-for="consent-checkbox"></div>
      </div>
      ` : ''}
    `;
  }

  /**
   * Step 2: Family Members
   */
  renderStep2() {
    const familyContacts = this.formData.contacts.filter(c => c.relationType !== 'SELF');

    return `
      <h3 style="margin: 0 0 0.25rem 0;">${t('form.familyMembers')}</h3>
      <p class="text-secondary" style="margin: 0 0 1.5rem 0;">Spouse, children, or parents — so you can remember birthdays for the whole family. Optional.</p>

      <div id="family-contacts">
        ${familyContacts.map((contact, idx) => this.renderFamilyContact(contact, idx)).join('')}
      </div>

      <button type="button" id="add-family-member" class="btn btn-primary" style="width: 100%;">+ Add family member</button>
    `;
  }

  /**
   * Render single family contact with Smart Dates
   */
  renderFamilyContact(contact, index) {
    // We need unique IDs for the date inputs within this list
    // Format: family-{index}-dob
    return `
      <div class="card family-contact-card" style="margin-bottom: 1.25rem; padding: 1rem; border: 1px solid var(--color-border);" data-contact-index="${index}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; gap: 0.5rem; flex-wrap: wrap;">
          <h4 style="margin: 0; font-size: 1rem; color: var(--color-text-primary);">${this.escapeHtml(contact.name || t('form.newFamilyMember'))}</h4>
          <button type="button" class="btn btn-secondary btn-sm remove-family" data-index="${index}">✕ Remove</button>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="family-${index}-relation">Relationship *</label>
            <select class="form-select family-relation" data-index="${index}" id="family-${index}-relation">
              ${Object.entries(RELATIONSHIP_LABELS).filter(([key]) => key !== 'SELF').map(([key, label]) => `
                <option value="${key}" ${contact.relationType === key ? 'selected' : ''}>${label}</option>
              `).join('')}
            </select>
          </div>
          <div class="form-group form-col-2">
            <label class="form-label" for="family-${index}-name">Name *</label>
            <input type="text" class="form-input family-name" id="family-${index}-name" data-index="${index}" value="${this.escapeHtml(contact.name)}" autocomplete="name" placeholder="${t('form.familyName')}" />
            <div class="field-error" data-error-for="family-${index}-name"></div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="family-${index}-phone">${t('form.phoneOptional')}</label>
          <input type="tel" inputmode="tel" autocomplete="tel" class="form-input family-phone" id="family-${index}-phone" data-index="${index}" value="${this.escapeHtml(contact.phones[0] || '')}" placeholder="${t('form.mobile')}" />
        </div>

        <div class="form-row">
          <div class="form-group">
            ${this.renderDateGroup(`family-${index}-dob`, t('form.dob'), contact.dob, contact.dobMonthOnly)}
          </div>
          <div class="form-group">
            ${this.renderDateGroup(`family-${index}-marriage`, 'Anniversary', contact.marriageDate, contact.marriageMonthOnly)}
          </div>
          <div class="form-group">
            ${this.renderDateGroup(`family-${index}-death`, t('form.deathAnniversary'), contact.deathDate, contact.deathMonthOnly)}
          </div>
        </div>
      </div>
    `;
  }

  renderStep3() {
    const existingCategories = VisitorService.getCategories();
    const hasFreq = this.formData.contactFrequencyDays != null && this.formData.contactFrequencyDays > 0;

    return `
      <h3 style="margin: 0 0 0.25rem 0;">${t('form.details')}</h3>
      <p class="text-secondary" style="margin: 0 0 1.5rem 0;">Categorize and add notes. All optional.</p>

      <div class="form-group">
        <label class="form-label" for="visitor-category">${t('form.category')}</label>
        <input type="text" id="visitor-category" class="form-input" value="${this.escapeHtml(this.formData.category)}" placeholder="e.g. Regular, Donor, VIP" list="category-suggestions" autocomplete="off" />
        <datalist id="category-suggestions">
          ${existingCategories.map(cat => `<option value="${this.escapeHtml(cat)}">`).join('')}
        </datalist>
        ${existingCategories.length > 0 ? `
          <p style="margin: 0.4rem 0 0 0; font-size: 0.85rem; color: var(--color-text-secondary);">
            Used before: ${existingCategories.slice(0, 5).map(c => `<button type="button" class="category-suggestion-chip" data-cat="${this.escapeHtml(c)}" style="background: var(--color-surface-hover); border: 1px solid var(--color-border); padding: 0.15rem 0.6rem; border-radius: 999px; font-size: 0.85rem; margin: 0 0.15rem; cursor: pointer;">${this.escapeHtml(c)}</button>`).join('')}
          </p>
        ` : ''}
      </div>

      <div class="form-group">
        <label class="form-label" for="visitor-tags">${t('form.tags')}</label>
        <input type="text" id="visitor-tags" class="form-input" value="${this.escapeHtml(this.formData.tags.join(', '))}" placeholder="Comma-separated, e.g. youth, mentor" autocomplete="off" />
      </div>

      <div class="form-group">
        <label class="form-label" for="visitor-notes">${t('form.generalNotes')}</label>
        <textarea id="visitor-notes" class="form-textarea" rows="4" placeholder="History, context, or anything you want to remember.">${this.escapeHtml(this.formData.notes)}</textarea>
      </div>

      <div class="form-group" style="background: var(--color-surface-hover); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1rem;">
        <label class="form-checkbox" style="display: flex; align-items: flex-start; gap: 0.75rem; cursor: pointer; margin-bottom: 0;">
          <input type="checkbox" id="visitor-freq-toggle" ${hasFreq ? 'checked' : ''} style="margin-top: 0.2rem; min-width: 20px; min-height: 20px; flex-shrink: 0;" />
          <span>
            <strong>Remind me if I haven't contacted them in a while</strong>
            <span style="display: block; font-size: 0.9rem; color: var(--color-text-secondary); font-weight: 400; margin-top: 0.15rem;">
              They'll show up in reminders when the interval has passed.
            </span>
          </span>
        </label>
        <div id="freq-input-row" class="${hasFreq ? '' : 'hidden'}" style="margin-top: 0.75rem; padding-left: 2rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <span>${t('form.every')}</span>
          <input type="number" id="visitor-freq-days" class="form-input" inputmode="numeric" min="1" max="365" step="1"
                 value="${this.formData.contactFrequencyDays ?? 30}"
                 style="width: 90px;" />
          <span>days</span>
        </div>
      </div>
    `;
  }

  // attachEventListeners same...
  attachEventListeners() {
    this.container.querySelector('#cancel-btn').addEventListener('click', async () => {
      const confirmed = await ConfirmDialog.show({
        title: t('form.discard'),
        message: 'Are you sure you want to discard your changes?',
        confirmText: 'Discard',
        cancelText: t('form.keepEditing'),
        type: 'warning'
      });
      if (confirmed) Router.navigate(ROUTES.VISITORS);
    });

    this.container.querySelector('#prev-btn').addEventListener('click', () => {
      this.saveCurrentStep();
      this.currentStep--;
      this.updateView();
    });

    this.container.querySelector('#next-btn').addEventListener('click', () => {
      if (this.validateCurrentStep()) {
        this.saveCurrentStep();
        if (this.currentStep === this.totalSteps) {
          this.saveVisitor();
        } else {
          this.currentStep++;
          this.updateView();
        }
      }
    });
  }

  // attachStepListeners same...
  attachStepListeners() {
    if (this.currentStep === 1) {
      const addPhoneBtn = this.container.querySelector('#add-phone');
      if (addPhoneBtn) addPhoneBtn.addEventListener('click', () => {
        this.saveCurrentStep();
        const self = this.formData.contacts.find(c => c.relationType === 'SELF');
        if (self) { self.phones.push(''); this.renderCurrentStep(); }
      });

      this.container.querySelectorAll('.remove-phone').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.saveCurrentStep();
          const idx = parseInt(e.target.dataset.index);
          const self = this.formData.contacts.find(c => c.relationType === 'SELF');
          if (self) { self.phones.splice(idx, 1); this.renderCurrentStep(); }
        });
      });
      // ... same for emails
      const addEmailBtn = this.container.querySelector('#add-email');
      if (addEmailBtn) addEmailBtn.addEventListener('click', () => {
        this.saveCurrentStep();
        const self = this.formData.contacts.find(c => c.relationType === 'SELF');
        if (self) { self.emails.push(''); this.renderCurrentStep(); }
      });

      this.container.querySelectorAll('.remove-email').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.saveCurrentStep();
          const idx = parseInt(e.target.dataset.index);
          const self = this.formData.contacts.find(c => c.relationType === 'SELF');
          if (self) { self.emails.splice(idx, 1); this.renderCurrentStep(); }
        });
      });
    }

    if (this.currentStep === 2) {
      const addFamilyBtn = this.container.querySelector('#add-family-member');
      if (addFamilyBtn) addFamilyBtn.addEventListener('click', () => {
        this.saveCurrentStep();
        this.formData.contacts.push(this.createEmptyContact('SPOUSE'));
        this.renderCurrentStep();
      });

      this.container.querySelectorAll('.remove-family').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.saveCurrentStep();
          const idx = parseInt(e.target.dataset.index);
          const families = this.formData.contacts.filter(c => c.relationType !== 'SELF');
          const realIdx = this.formData.contacts.indexOf(families[idx]);
          this.formData.contacts.splice(realIdx, 1);
          this.renderCurrentStep();
        });
      });
    }

    if (this.currentStep === 3) {
      const freqToggle = this.container.querySelector('#visitor-freq-toggle');
      const freqInputRow = this.container.querySelector('#freq-input-row');
      if (freqToggle && freqInputRow) {
        freqToggle.addEventListener('change', (e) => {
          freqInputRow.classList.toggle('hidden', !e.target.checked);
        });
      }

      this.container.querySelectorAll('.category-suggestion-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
          const catInput = this.container.querySelector('#visitor-category');
          if (catInput) {
            catInput.value = e.currentTarget.dataset.cat;
            catInput.focus();
          }
        });
      });
    }
  }

  showFieldError(fieldId, message) {
    const errorEl = this.container.querySelector(`[data-error-for="${fieldId}"]`);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('visible');
    }
    const fieldEl = this.container.querySelector(`#${fieldId}`);
    if (fieldEl) {
      fieldEl.classList.add('field-invalid');
      fieldEl.focus();
    }
  }

  clearFieldErrors() {
    this.container.querySelectorAll('.field-error').forEach(el => {
      el.textContent = '';
      el.classList.remove('visible');
    });
    this.container.querySelectorAll('.field-invalid').forEach(el => {
      el.classList.remove('field-invalid');
    });
  }

  validateCurrentStep() {
    this.clearFieldErrors();
    if (this.currentStep === 1) {
      // D-07 / D-20 — a phone OR a name, never neither.
      //
      // This path demanded a name long after the decision landed in the
      // validator and in the calendar's capture sheet. That is RC-2 exactly:
      // the rule reached the files I was working in and not its sibling. A
      // volunteer adding someone from a phone call, who has a number and no
      // name yet, was refused here while being accepted two screens away.
      const name = this.container.querySelector('#self-name').value.trim();
      const hasPhone = [...this.container.querySelectorAll('.phone-input')]
        .some(el => normalizePhone(el.value));
      if (!name && !hasPhone) {
        this.showFieldError('self-name', t('error.needPhoneOrName'));
        return false;
      }
      if (!this.isEditMode) {
        const consent = this.container.querySelector('#consent-checkbox');
        if (consent && !consent.checked) {
          this.showFieldError('consent-checkbox', t('form.consentNeeded'));
          return false;
        }
      }
    }
    if (this.currentStep === 2) {
      const names = this.container.querySelectorAll('.family-name');
      for (let n of names) {
        if (!n.value.trim()) {
          this.showFieldError(n.id, 'Please enter a name for this family member, or remove the entry.');
          return false;
        }
      }
    }
    return true;
  }

  saveCurrentStep() {
    if (this.currentStep === 1) {
      const self = this.formData.contacts.find(c => c.relationType === 'SELF');
      self.name = this.container.querySelector('#self-name').value.trim();

      self.phones = Array.from(this.container.querySelectorAll('.phone-input')).map(i => i.value.trim()).filter(v => v);
      if (!self.phones.length) self.phones = [''];

      self.emails = Array.from(this.container.querySelectorAll('.email-input')).map(i => i.value.trim()).filter(v => v);

      // Save Smart Dates
      const dobData = this.parseDateGroup('self-dob');
      self.dob = dobData.date;
      self.dobMonthOnly = dobData.monthOnly;

      const marrData = this.parseDateGroup('self-marriage');
      self.marriageDate = marrData.date;
      self.marriageMonthOnly = marrData.monthOnly;

      self.notes = this.container.querySelector('#self-notes').value.trim();

      this.formData.communicationPreference = this.container.querySelector('#self-comm-pref').value;
      this.formData.city = this.container.querySelector('#self-city').value.trim();
      this.formData.address = this.container.querySelector('#self-address').value.trim();

      if (!this.isEditMode) {
        const consent = this.container.querySelector('#consent-checkbox');
        if (consent) this.formData.consentGiven = consent.checked;
      }
    }

    if (this.currentStep === 2) {
      const families = this.formData.contacts.filter(c => c.relationType !== 'SELF');
      families.forEach((c, idx) => {
        const rel = this.container.querySelector(`.family-relation[data-index="${idx}"]`);
        const name = this.container.querySelector(`.family-name[data-index="${idx}"]`);
        const phone = this.container.querySelector(`.family-phone[data-index="${idx}"]`);

        if (rel) c.relationType = rel.value;
        if (name) c.name = name.value.trim();
        if (phone) c.phones = [phone.value.trim()].filter(v => v);

        // Smart Dates for Family
        const dobData = this.parseDateGroup(`family-${idx}-dob`);
        c.dob = dobData.date;
        c.dobMonthOnly = dobData.monthOnly;

        const marrData = this.parseDateGroup(`family-${idx}-marriage`);
        c.marriageDate = marrData.date;
        c.marriageMonthOnly = marrData.monthOnly;

        const deathData = this.parseDateGroup(`family-${idx}-death`);
        c.deathDate = deathData.date;
        c.deathMonthOnly = deathData.monthOnly;
      });
    }

    if (this.currentStep === 3) {
      this.formData.category = this.container.querySelector('#visitor-category').value.trim();
      this.formData.tags = this.container.querySelector('#visitor-tags').value.split(',').map(t => t.trim()).filter(t => t);
      this.formData.notes = this.container.querySelector('#visitor-notes').value.trim();

      const freqToggle = this.container.querySelector('#visitor-freq-toggle');
      const freqInput = this.container.querySelector('#visitor-freq-days');
      if (freqToggle && freqToggle.checked && freqInput) {
        const n = parseInt(freqInput.value.trim(), 10);
        this.formData.contactFrequencyDays = (!isNaN(n) && n > 0) ? n : null;
      } else {
        this.formData.contactFrequencyDays = null;
      }
    }
  }

  saveVisitor() {
    try {
      if (this.isEditMode) {
        VisitorService.update(this.visitorId, this.formData);
        Toast.show(t('form.saved'), 'success');
      } else {
        const data = {
          ...this.formData,
          consentGiven: this.formData.consentGiven || false,
          consentDate: this.formData.consentGiven ? new Date().toISOString() : null
        };
        VisitorService.create(data);
        Toast.show(t('form.saved'), 'success');
      }
      Router.navigate(ROUTES.VISITORS);
    } catch (e) { Toast.show('Error: ' + e.message, 'error'); }
  }

  updateView() {
    this.container.querySelector('.progress-steps').innerHTML = this.renderProgressSteps();
    const prev = this.container.querySelector('#prev-btn');
    const next = this.container.querySelector('#next-btn');
    prev.disabled = this.currentStep === 1;
    next.textContent = this.currentStep === this.totalSteps ? 'Save' : 'Next →';
    this.renderCurrentStep();
  }

  renderProgressSteps() {
    const steps = ['Primary', 'Family', 'Details'];
    return `<div style="display: flex; flex-wrap: wrap; gap: 0.75rem 1rem; align-items: center;">${steps.map((s, i) => {
      const n = i + 1;
      const active = n === this.currentStep;
      const done = n < this.currentStep;
      const bg = active ? 'var(--color-primary)' : done ? 'var(--color-success)' : 'var(--color-border)';
      const labelColor = active ? 'var(--color-primary)' : 'var(--color-text-secondary)';
      return `<div class="progress-step ${active ? 'active' : ''} ${done ? 'completed' : ''}" style="display: inline-flex; align-items: center; gap: 0.5rem;">
         <span style="width: 24px; height: 24px; background: ${bg}; color: white; border-radius: 50%; text-align: center; line-height: 24px; font-size: 0.8rem; flex-shrink: 0;">${done ? '✓' : n}</span>
         <span style="color: ${labelColor}; font-size: 0.95rem;">${s}</span>
       </div>`;
    }).join('')}</div>`;
  }

  escapeHtml(t) { if (!t) return ''; const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
  destroy() { if (this.container?.parentNode) this.container.parentNode.removeChild(this.container); this.container = null; }
}
