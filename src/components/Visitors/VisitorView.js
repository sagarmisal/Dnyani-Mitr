// Visitor View Component - Read-only display of visitor details

import VisitorService from '../../services/VisitorService.js';
import InteractionService from '../../services/InteractionService.js';
import EngagementService from '../../services/EngagementService.js';
import StateManager from '../../core/state.js';
import Router, { ROUTES } from '../../core/router.js';
import EventBus, { EVENTS } from '../../core/events.js';
import { formatDate, formatRelativeTime, normalizePhone } from '../../utils/formatters.js';
import { RELATIONSHIP_LABELS, INTERACTION_TYPE_LABELS, INTERACTION_OUTCOME_LABELS } from '../../utils/constants.js';
import { ConfirmDialog } from '../UI/ConfirmDialog.js';
import { Toast } from '../UI/Toast.js';
import { InteractionLogger } from '../UI/InteractionLogger.js';

export class VisitorView {
  constructor(visitorId) {
    this.visitorId = visitorId;
    this.visitor = null;
    this.interactions = [];
    this.container = null;

    this.loadData();
  }

  /**
   * Load visitor data and interactions
   */
  loadData() {
    this.visitor = VisitorService.getById(this.visitorId);
    if (this.visitor) {
      this.interactions = InteractionService.getForVisitor(this.visitorId);
    }
  }

  /**
   * Render component
   */
  render() {
    if (!this.visitor) {
      const errorContainer = document.createElement('div');
      errorContainer.innerHTML = `
        <div class="card text-center" style="padding: 3rem;">
          <h3>Visitor Not Found</h3>
          <p class="text-secondary">The visitor you are looking for does not exist or has been deleted.</p>
          <button class="btn btn-primary" onclick="window.location.hash='${ROUTES.VISITORS}'">Back to List</button>
        </div>
      `;
      return errorContainer;
    }

    const container = document.createElement('div');
    container.className = 'visitor-view-container';

    const self = this.visitor.contacts.find(c => c.relationType === 'SELF');
    const family = this.visitor.contacts.filter(c => c.relationType !== 'SELF');
    const phone = self?.phones?.[0] || '';
    const email = self?.emails?.[0] || '';
    const hasPhone = !!normalizePhone(phone);
    const isDnc = this.visitor.doNotContact;

    container.innerHTML = `
      <div class="view-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <button id="back-btn" class="btn btn-secondary btn-sm" style="margin-bottom: 0.5rem;">← Back</button>
          <h2 style="margin: 0;">
            ${this.escapeHtml(self?.name || 'Unknown Visitor')}
            ${isDnc ? '<span class="badge badge-dnc">Do Not Contact</span>' : ''}
            ${this.visitor.consentGiven ? '<span class="badge badge-consent" title="Consent recorded">Consent</span>' : ''}
            ${this.renderEngagementBadge()}
          </h2>
          <p class="text-secondary" style="margin: 0.25rem 0 0 0;">
            Visitor ID: <code>${this.visitor.id}</code> | Category: ${this.escapeHtml(this.visitor.category || 'None')}
            ${this.renderLastContactInfo()}
          </p>
        </div>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          ${!isDnc ? `
            ${hasPhone ? `<button class="btn btn-sm comm-btn" id="btn-whatsapp" title="WhatsApp">💬 WhatsApp</button>` : ''}
            ${hasPhone ? `<button class="btn btn-sm comm-btn" id="btn-call" title="Call">📞 Call</button>` : ''}
            ${hasPhone ? `<button class="btn btn-sm comm-btn" id="btn-sms" title="SMS">📱 SMS</button>` : ''}
            ${email ? `<button class="btn btn-sm comm-btn" id="btn-email" title="Email">📧 Email</button>` : ''}
          ` : ''}
          <button id="log-interaction-btn" class="btn btn-success">Log Interaction</button>
          <button id="toggle-dnc-btn" class="btn btn-sm ${isDnc ? 'btn-secondary' : 'btn-error'}">${isDnc ? 'Allow Contact' : 'Do Not Contact'}</button>
          <button id="edit-visitor-btn" class="btn btn-primary">Edit</button>
          <button id="delete-visitor-btn" class="btn btn-error">Delete</button>
        </div>
      </div>

      <div class="view-layout" style="display: grid; grid-template-columns: 1fr 350px; gap: 2rem;">
        <div class="view-main-column">
          <!-- Contact Cards -->
          <div class="card" style="margin-bottom: 2rem;">
            <div class="card-header">
              <h3 class="card-title">Primary Contact</h3>
            </div>
            <div class="card-body">
              ${this.renderContactDetails(self)}
            </div>
          </div>

          ${family.length > 0 ? `
            <div class="card" style="margin-bottom: 2rem;">
              <div class="card-header">
                <h3 class="card-title">Family members</h3>
              </div>
              <div class="card-body" style="padding: 0;">
                <div class="family-list">
                  ${family.map(member => `
                    <div style="padding: 1.5rem; border-bottom: 1px solid var(--color-border);">
                      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                        <h4 style="margin: 0;">${this.escapeHtml(member.name)}</h4>
                        <span class="badge" style="background: var(--color-bg); padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); font-size: 0.75rem;">
                          ${RELATIONSHIP_LABELS[member.relationType]}
                        </span>
                      </div>
                      ${this.renderContactDetails(member)}
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          ` : ''}

          <!-- General Notes -->
          ${this.visitor.notes ? `
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">General Notes</h3>
              </div>
              <div class="card-body">
                <p style="white-space: pre-wrap;">${this.escapeHtml(this.visitor.notes)}</p>
              </div>
            </div>
          ` : ''}
        </div>

        <div class="view-side-column">
          <!-- Timeline / Interactions -->
          <div class="card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
              <h3 class="card-title">Timeline</h3>
              <span class="badge badge-primary">${this.interactions.length}</span>
            </div>
            <div class="card-body" style="padding: 1rem;">
              <div class="timeline" id="interaction-timeline">
                ${this.renderTimeline()}
              </div>
            </div>
          </div>

          <!-- Tags -->
          <div class="card" style="margin-top: 2rem;">
            <div class="card-header">
              <h3 class="card-title">Tags</h3>
            </div>
            <div class="card-body">
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                ${this.visitor.tags.length > 0
        ? this.visitor.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')
        : '<p class="text-secondary" style="font-size: 0.875rem;">No tags</p>'}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.container = container;
    this.attachEventListeners();
    return container;
  }

  /**
   * Render contact details
   */
  renderContactDetails(contact) {
    if (!contact) return '';

    return `
      <div class="details-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
        <div>
          <label style="display: block; font-size: 0.75rem; color: var(--color-text-tertiary); text-transform: uppercase;">Phones</label>
          ${contact.phones.length > 0
        ? contact.phones.map(p => `<div>📞 ${this.escapeHtml(p)}</div>`).join('')
        : '<div class="text-secondary">---</div>'}
        </div>
        <div>
          <label style="display: block; font-size: 0.75rem; color: var(--color-text-tertiary); text-transform: uppercase;">Emails</label>
          ${contact.emails.length > 0
        ? contact.emails.map(e => `<div>📧 ${this.escapeHtml(e)}</div>`).join('')
        : '<div class="text-secondary">---</div>'}
        </div>
        <div>
          <label style="display: block; font-size: 0.75rem; color: var(--color-text-tertiary); text-transform: uppercase;">Dates</label>
          ${contact.dob ? `<div>🎂 ${formatDate(contact.dob, contact.dobMonthOnly)} (DOB)</div>` : ''}
          ${contact.marriageDate ? `<div>💍 ${formatDate(contact.marriageDate, contact.marriageMonthOnly)} (Anniversary)</div>` : ''}
          ${contact.deathDate ? `<div>🕯️ ${formatDate(contact.deathDate, contact.deathMonthOnly)} (Death)</div>` : ''}
          ${!contact.dob && !contact.marriageDate && !contact.deathDate ? '<div class="text-secondary">None logged</div>' : ''}
        </div>
        ${contact.notes ? `
          <div style="grid-column: 1 / -1;">
            <label style="display: block; font-size: 0.75rem; color: var(--color-text-tertiary); text-transform: uppercase;">Specific Notes</label>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.875rem;">${this.escapeHtml(contact.notes)}</p>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render timeline of interactions
   */
  renderTimeline() {
    if (this.interactions.length === 0) {
      return `
        <div class="empty-state" style="padding: 2rem 1rem;">
          <div class="empty-state-icon">💬</div>
          <p class="empty-state-text">No interactions yet</p>
          <p class="empty-state-hint">Use "Log Interaction" to record your first contact.</p>
        </div>
      `;
    }

    // Sort by date newest first
    const sorted = [...this.interactions].sort((a, b) => new Date(b.interactionDate) - new Date(a.interactionDate));

    return sorted.map(interaction => {
      const typeLabel = typeof interaction.interactionType === 'object'
        ? interaction.interactionType.interactionType
        : (INTERACTION_TYPE_LABELS[interaction.interactionType] || interaction.interactionType);
      const outcomeLabel = interaction.outcome ? (INTERACTION_OUTCOME_LABELS[interaction.outcome] || interaction.outcome) : '';

      return `
      <div class="timeline-item" style="position: relative; padding-left: 1.5rem; margin-bottom: 2rem; border-left: 2px solid var(--color-border);">
        <div style="position: absolute; left: -9px; top: 0; width: 16px; height: 16px; border-radius: 50%; background: var(--color-primary); border: 3px solid white;"></div>
        <div style="font-size: 0.75rem; color: var(--color-text-tertiary); margin-bottom: 0.25rem;">
          ${formatDate(interaction.interactionDate)} (${formatRelativeTime(interaction.interactionDate)})
        </div>
        <div style="font-weight: 600; font-size: 0.875rem; margin-bottom: 0.25rem;">
          ${typeLabel}${outcomeLabel ? ` — <span style="font-weight:400; color: var(--color-text-secondary);">${outcomeLabel}</span>` : ''}
          ${interaction.duration ? `<span style="font-weight:400; font-size:0.75rem; color:#64748b;"> (${interaction.duration} min)</span>` : ''}
        </div>
        ${interaction.notes ? `
          <div style="font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.4;">
            ${this.escapeHtml(interaction.notes)}
          </div>
        ` : ''}
        ${interaction.followUpDate ? `
          <div style="font-size: 0.75rem; color: #b45309; margin-top: 0.25rem;">
            Follow-up: ${formatDate(interaction.followUpDate)}${interaction.followUpNotes ? ` — ${this.escapeHtml(interaction.followUpNotes)}` : ''}
          </div>
        ` : ''}
        ${interaction.createdBy ? `
          <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 0.25rem;">
            Logged by ${this.escapeHtml(StateManager.getMachineName(interaction.createdBy) || String(interaction.createdBy).substring(0, 12))}
          </div>
        ` : ''}
      </div>
    `;
    }).join('');
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    this.container.querySelector('#back-btn').addEventListener('click', () => {
      Router.navigate(ROUTES.VISITORS);
    });

    this.container.querySelector('#edit-visitor-btn').addEventListener('click', () => {
      Router.navigate(`${ROUTES.VISITOR_EDIT}?id=${this.visitorId}`);
    });

    this.container.querySelector('#delete-visitor-btn').addEventListener('click', async () => {
      const name = this.visitor.contacts.find(c => c.relationType === 'SELF')?.name || 'this visitor';
      const confirmed = await ConfirmDialog.show({
        title: 'Delete Visitor',
        message: `Are you sure you want to delete ${name}?\nThis action can be undone by an administrator.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        type: 'danger'
      });
      if (confirmed) {
        VisitorService.delete(this.visitorId);
        Toast.show('Visitor deleted successfully', 'success');
        Router.navigate(ROUTES.VISITORS);
      }
    });

    this.container.querySelector('#log-interaction-btn').addEventListener('click', () => {
      const self = this.visitor.contacts.find(c => c.relationType === 'SELF');
      InteractionLogger.showFull({
        visitorId: this.visitorId,
        visitorName: self?.name || 'Unknown',
        onDone: () => {
          this.loadData();
          this.renderTimelineContainer();
        }
      });
    });

    // Communication buttons
    const self2 = this.visitor.contacts.find(c => c.relationType === 'SELF');
    const phone2 = self2?.phones?.[0] || '';
    const email2 = self2?.emails?.[0] || '';

    const whatsappBtn = this.container.querySelector('#btn-whatsapp');
    if (whatsappBtn) {
      whatsappBtn.addEventListener('click', () => {
        InteractionLogger.openWhatsApp(phone2, self2?.name);
        Toast.show('WhatsApp opened — use "Log Interaction" to record it', 'info');
      });
    }

    const callBtn = this.container.querySelector('#btn-call');
    if (callBtn) {
      callBtn.addEventListener('click', () => {
        InteractionLogger.openCall(phone2);
      });
    }

    const smsBtn = this.container.querySelector('#btn-sms');
    if (smsBtn) {
      smsBtn.addEventListener('click', () => {
        InteractionLogger.openSMS(phone2, self2?.name);
      });
    }

    const emailBtn = this.container.querySelector('#btn-email');
    if (emailBtn) {
      emailBtn.addEventListener('click', () => {
        InteractionLogger.openEmail(email2, self2?.name);
      });
    }

    // Do Not Contact toggle
    this.container.querySelector('#toggle-dnc-btn').addEventListener('click', async () => {
      const current = this.visitor.doNotContact;
      const action = current ? 'allow contact for' : 'mark as Do Not Contact for';
      const name = self2?.name || 'this visitor';
      const confirmed = await ConfirmDialog.show({
        title: current ? 'Allow Contact' : 'Do Not Contact',
        message: `Are you sure you want to ${action} ${name}?${!current ? '\nThey will be hidden from reminders and communication.' : ''}`,
        confirmText: current ? 'Allow Contact' : 'Mark DNC',
        type: current ? 'info' : 'warning'
      });
      if (confirmed) {
        VisitorService.update(this.visitorId, { doNotContact: !current });
        Toast.show(current ? 'Contact allowed' : 'Marked as Do Not Contact', 'success');
        this.loadData();
        this.fullRefresh();
      }
    });
  }

  fullRefresh() {
    const old = this.container;
    const parent = old?.parentNode;
    if (parent && old) {
      const newEl = this.render();
      parent.replaceChild(newEl, old);
    }
  }

  /**
   * Partially re-render just the timeline
   */
  renderTimelineContainer() {
    const timeline = this.container.querySelector('#interaction-timeline');
    if (timeline) {
      timeline.innerHTML = this.renderTimeline();
    }
  }

  /**
   * Render engagement score badge
   */
  renderEngagementBadge() {
    const score = EngagementService.calculateScore(this.visitorId);
    const label = EngagementService.getLabel(score);
    const colorClass = EngagementService.getColorClass(score);
    return `<span class="badge ${colorClass}" title="Engagement: ${score}/100">${label} (${score})</span>`;
  }

  /**
   * Render last contact info line
   */
  renderLastContactInfo() {
    const daysSince = EngagementService.getDaysSinceLastInteraction(this.visitorId);
    if (daysSince === Infinity) return ' | <span style="color:#ef4444;">Never contacted</span>';
    if (daysSince === 0) return ' | Last contact: <span style="color:#22c55e;">Today</span>';
    const color = daysSince <= 30 ? '#22c55e' : daysSince <= 60 ? '#f59e0b' : '#ef4444';
    return ` | Last contact: <span style="color:${color};">${daysSince} days ago</span>`;
  }

  /**
   * Simple HTML escaping
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Clean up
   */
  destroy() {
    this.container = null;
  }
}
