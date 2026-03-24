// Visitor Form Component - Multi-step wizard for adding/editing visitors

import VisitorService from '../../services/VisitorService.js';
import Router, { ROUTES } from '../../core/router.js';
import { Contact } from '../../models/Contact.js';
import { RELATIONSHIP_TYPES, RELATIONSHIP_LABELS } from '../../utils/constants.js';
import { generateId } from '../../utils/helpers.js';

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
      communicationPreference: 'whatsapp'
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
        communicationPreference: visitor.communicationPreference || 'whatsapp'
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
          <button type="button" id="cancel-btn" class="btn btn-secondary">Cancel</button>
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
    let day = '', month = '', year = '';

    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        day = d.getDate();
        month = d.getMonth(); // 0-11
        year = d.getFullYear();
      }
    }

    // If monthOnly is true, we might want to hide the year or show it as empty if it matches the dummy year
    // Let's assume 2000 is our dummy year for storage
    if (isMonthOnly && year === 2000) year = '';

    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return `
      <div class="form-group" style="margin-bottom: 0;">
         <label class="form-label">${label}</label>
         <div class="date-group-row" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <!-- Day -->
            <select id="${fieldId}-day" class="form-select date-day" style="flex: 1; min-width: 70px;">
                <option value="">Day</option>
                ${Array.from({ length: 31 }, (_, i) => i + 1).map(d =>
      `<option value="${d}" ${day === d ? 'selected' : ''}>${d}</option>`
    ).join('')}
            </select>

            <!-- Month -->
            <select id="${fieldId}-month" class="form-select date-month" style="flex: 2; min-width: 110px;">
                <option value="">Month</option>
                ${months.map((m, i) =>
      `<option value="${i}" ${month !== '' && month === i ? 'selected' : ''}>${m}</option>`
    ).join('')}
            </select>

            <!-- Year -->
            <input type="number" id="${fieldId}-year" class="form-input date-year" 
                   value="${year}" placeholder="Year (Opt)" style="flex: 1.5; min-width: 80px;" min="1900" max="2100" />
         </div>
      </div>
    `;
  }

  /**
   * Helper: Parse Smart Date Group
   * Returns { date: 'YYYY-MM-DD', monthOnly: boolean }
   */
  parseDateGroup(fieldId) {
    const container = this.container; // Scope
    // Handle array inputs (family members) where IDs are not unique globally but scoped? 
    // Actually renderDateGroup uses ID prefixes. For family members we construct dynamic IDs.

    const dayEl = container.querySelector(`#${fieldId}-day`);
    const monthEl = container.querySelector(`#${fieldId}-month`);
    const yearEl = container.querySelector(`#${fieldId}-year`);

    if (!dayEl || !monthEl) return { date: '', monthOnly: false };

    const day = parseInt(dayEl.value);
    const month = parseInt(monthEl.value); // 0-11
    let year = parseInt(yearEl.value);
    let monthOnly = false;

    if (!day || isNaN(month)) return { date: '', monthOnly: false };

    if (!year || isNaN(year)) {
      year = 2000; // Leap year safe default
      monthOnly = true;
    }

    // Construct Date string YYYY-MM-DD
    // Note: Month is 0-index in JS Date, but we need 1-index for string padding if manual.
    // Easier to use Date object to format
    const dateObj = new Date(year, month, day, 12, 0, 0); // Noon to avoid timezone shifts
    const iso = dateObj.toISOString().split('T')[0];

    return { date: iso, monthOnly };
  }


  /**
   * Step 1: Primary Contact (SELF)
   */
  renderStep1() {
    const selfContact = this.formData.contacts.find(c => c.relationType === 'SELF') || this.createEmptyContact('SELF');

    return `
      <h3 style="color:var(--color-primary); margin-bottom:0.5rem;">Primary Contact</h3>
      <p class="text-secondary" style="margin-bottom:1.5rem;">Main visitor information</p>
      
      <div class="form-row">
          <div class="form-group form-col-2">
            <label class="form-label">Full Name *</label>
            <input type="text" id="self-name" class="form-input" value="${this.escapeHtml(selfContact.name)}" required placeholder="e.g. Amit Patil" />
          </div>
          <div class="form-group form-col-1">
             <label class="form-label">Preference</label>
             <select id="self-comm-pref" class="form-select">
                <option value="whatsapp" ${this.formData.communicationPreference === 'whatsapp' ? 'selected' : ''}>WhatsApp</option>
                <option value="call" ${this.formData.communicationPreference === 'call' ? 'selected' : ''}>Phone Call</option>
                <option value="sms" ${this.formData.communicationPreference === 'sms' ? 'selected' : ''}>SMS</option>
             </select>
          </div>
      </div>
      
      <!-- Split Address Row -->
      <div class="form-row">
          <div class="form-group form-col-1">
             <label class="form-label">City / Village</label>
             <input type="text" id="self-city" class="form-input" value="${this.escapeHtml(this.formData.city)}" placeholder="e.g. Pune" />
          </div>
          <div class="form-group form-col-2">
             <label class="form-label">Address</label>
             <input type="text" id="self-address" class="form-input" value="${this.escapeHtml(this.formData.address)}" placeholder="Flat No, Building, Area..." />
          </div>
      </div>

      <!-- Phones and Emails -->
      <div class="form-row">
        <div class="form-group">
            <label class="form-label">Phone Numbers</label>
            <div id="self-phones">
              ${selfContact.phones.map((phone, idx) => `
                <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                  <input type="tel" class="form-input phone-input" data-index="${idx}" value="${this.escapeHtml(phone)}" placeholder="Mobile Number" />
                  ${idx > 0 ? `<button type="button" class="btn btn-secondary btn-sm remove-phone" data-index="${idx}">✕</button>` : ''}
                </div>
              `).join('')}
            </div>
            <button type="button" id="add-phone" class="btn btn-secondary btn-sm" style="width:100%">+ Add Phone</button>
        </div>
        
        <div class="form-group">
            <label class="form-label">Email Addresses</label>
            <div id="self-emails">
              ${selfContact.emails.map((email, idx) => `
                <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                  <input type="email" class="form-input email-input" data-index="${idx}" value="${this.escapeHtml(email)}" placeholder="Email Address" />
                  ${idx > 0 ? `<button type="button" class="btn btn-secondary btn-sm remove-email" data-index="${idx}">✕</button>` : ''}
                </div>
              `).join('')}
            </div>
            <button type="button" id="add-email" class="btn btn-secondary btn-sm" style="width:100%">+ Add Email</button>
        </div>
      </div>
      
      <!-- Smart Dates -->
      <div class="form-row">
        <div class="form-group">
            ${this.renderDateGroup('self-dob', 'Date of Birth', selfContact.dob, selfContact.dobMonthOnly)}
        </div>
        
        <div class="form-group">
            ${this.renderDateGroup('self-marriage', 'Anniversary', selfContact.marriageDate, selfContact.marriageMonthOnly)}
        </div>
      </div>
      
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea id="self-notes" class="form-textarea" rows="2" placeholder="Any additional details...">${this.escapeHtml(selfContact.notes || '')}</textarea>
      </div>
    `;
  }

  /**
   * Step 2: Family Members
   */
  renderStep2() {
    const familyContacts = this.formData.contacts.filter(c => c.relationType !== 'SELF');

    return `
      <h3>Family Members</h3>
      <p class="text-secondary">Add spouse, children, or parents. Important for relationship management.</p>
      
      <div id="family-contacts">
        ${familyContacts.map((contact, idx) => this.renderFamilyContact(contact, idx)).join('')}
      </div>
      
      ${familyContacts.length === 0 ? '<div style="padding: 2rem; text-align: center; background: #f8fafc; border-radius: 0.5rem; border: 1px dashed #cbd5e1; margin-bottom: 1rem;"><p class="text-secondary">No family members added.</p></div>' : ''}
      
      <button type="button" id="add-family-member" class="btn btn-primary" style="width: 100%;">+ Add Family Member</button>
    `;
  }

  /**
   * Render single family contact with Smart Dates
   */
  renderFamilyContact(contact, index) {
    // We need unique IDs for the date inputs within this list
    // Format: family-{index}-dob
    return `
      <div class="card" style="margin-bottom: 1.5rem; padding: 1.25rem; border-left: 4px solid var(--color-primary);" data-contact-index="${index}">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
          <h4 style="margin: 0; color: var(--color-primary);">${contact.name || 'New Member'}</h4>
          <button type="button" class="btn btn-error btn-sm remove-family" data-index="${index}">✕ Remove</button>
        </div>
        
        <div class="form-row">
            <div class="form-group">
              <label class="form-label">Relationship *</label>
              <select class="form-select family-relation" data-index="${index}">
                ${Object.entries(RELATIONSHIP_LABELS).filter(([key]) => key !== 'SELF').map(([key, label]) => `
                  <option value="${key}" ${contact.relationType === key ? 'selected' : ''}>${label}</option>
                `).join('')}
              </select>
            </div>
            
            <div class="form-group form-col-2">
              <label class="form-label">Name *</label>
              <input type="text" class="form-input family-name" data-index="${index}" value="${this.escapeHtml(contact.name)}" placeholder="Member Name" />
            </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Phone (Optional)</label>
          <input type="tel" class="form-input family-phone" data-index="${index}" value="${this.escapeHtml(contact.phones[0] || '')}" placeholder="Mobile Number" />
        </div>
        
        <div class="form-row">
            <div class="form-group">
                ${this.renderDateGroup(`family-${index}-dob`, 'Date of Birth', contact.dob, contact.dobMonthOnly)}
            </div>

            <div class="form-group">
                ${this.renderDateGroup(`family-${index}-marriage`, 'Anniversary', contact.marriageDate, contact.marriageMonthOnly)}
            </div>
            
            <div class="form-group">
                 ${this.renderDateGroup(`family-${index}-death`, 'Death Date', contact.deathDate, contact.deathMonthOnly)}
            </div>
        </div>
      </div>
    `;
  }

  // Step 3 remains similar...
  renderStep3() {
    return `
      <h3>Additional Details</h3>
      <p class="text-secondary">Categorize logic for better filtering.</p>
      
      <div class="form-group">
        <label class="form-label">Category</label>
        <input type="text" id="visitor-category" class="form-input" value="${this.escapeHtml(this.formData.category)}" 
               placeholder="e.g. Regular, Donor, VIP" list="category-suggestions" />
        <datalist id="category-suggestions">
          ${VisitorService.getCategories().map(cat => `<option value="${this.escapeHtml(cat)}">`).join('')}
        </datalist>
      </div>
      
      <div class="form-group">
        <label class="form-label">Tags</label>
        <input type="text" id="visitor-tags" class="form-input" value="${this.formData.tags.join(', ')}" 
               placeholder="Comma separated tags..." />
      </div>
      
      <div class="form-group">
        <label class="form-label">General Notes</label>
        <textarea id="visitor-notes" class="form-textarea" rows="4" placeholder="History, context, or special instructions...">${this.escapeHtml(this.formData.notes)}</textarea>
      </div>
    `;
  }

  // attachEventListeners same...
  attachEventListeners() {
    this.container.querySelector('#cancel-btn').addEventListener('click', () => {
      if (confirm('Discard changes?')) Router.navigate(ROUTES.VISITORS);
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
  }

  validateCurrentStep() {
    if (this.currentStep === 1) {
      const name = this.container.querySelector('#self-name').value.trim();
      if (!name) { alert('Visitor Name is required'); return false; }
    }
    if (this.currentStep === 2) {
      const names = this.container.querySelectorAll('.family-name');
      for (let n of names) { if (!n.value.trim()) { alert('Family Member Name required'); return false; } }
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
    }
  }

  saveVisitor() {
    try {
      if (this.isEditMode) {
        VisitorService.update(this.visitorId, this.formData);
        alert('Visitor updated!');
      } else {
        VisitorService.create(this.formData);
        alert('Visitor added!');
      }
      Router.navigate(ROUTES.VISITORS);
    } catch (e) { alert('Error: ' + e.message); }
  }

  updateView() {
    this.container.querySelector('.progress-steps').innerHTML = this.renderProgressSteps();
    const prev = this.container.querySelector('#prev-btn');
    const next = this.container.querySelector('#next-btn');
    prev.disabled = this.currentStep === 1;
    next.textContent = this.currentStep === this.totalSteps ? 'Save' : 'Next →';
    this.renderCurrentStep();
  }

  // renderProgressSteps, details etc
  renderProgressSteps() {
    const steps = ['Primary', 'Family', 'Details'];
    return steps.map((s, i) => {
      const n = i + 1;
      const active = n === this.currentStep;
      const done = n < this.currentStep;
      return `<div class="progress-step ${active ? 'active' : ''} ${done ? 'completed' : ''}" style="margin-right:1rem; display:inline-flex; align-items:center;">
         <span style="width:24px; height:24px; background:${active ? 'var(--color-primary)' : done ? 'var(--color-success)' : '#cbd5e1'}; color:white; border-radius:50%; text-align:center; line-height:24px; display:inline-block; margin-right:0.5rem; font-size:0.8rem;">${done ? '✓' : n}</span>
         <span style="color:${active ? 'var(--color-primary)' : '#64748b'}">${s}</span>
       </div>`;
    }).join('');
  }

  escapeHtml(t) { if (!t) return ''; const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
  destroy() { if (this.container?.parentNode) this.container.parentNode.removeChild(this.container); this.container = null; }
}
