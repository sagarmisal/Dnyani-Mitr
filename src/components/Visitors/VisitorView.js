// Visitor View Component - Read-only display of visitor details

import VisitorService from '../../services/VisitorService.js';
import InteractionService from '../../services/InteractionService.js';
import Router, { ROUTES } from '../../core/router.js';
import EventBus, { EVENTS } from '../../core/events.js';
import { formatDate, formatRelativeTime } from '../../utils/formatters.js';
import { RELATIONSHIP_LABELS, INTERACTION_TYPE_LABELS } from '../../utils/constants.js';

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

    container.innerHTML = `
      <div class="view-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <div>
          <button id="back-btn" class="btn btn-secondary btn-sm" style="margin-bottom: 0.5rem;">← Back</button>
          <h2 style="margin: 0;">${this.escapeHtml(self?.name || 'Unknown Visitor')}</h2>
          <p class="text-secondary" style="margin: 0.25rem 0 0 0;">
            Visitor ID: <code>${this.visitor.id}</code> | Category: ${this.escapeHtml(this.visitor.category || 'None')}
          </p>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button id="log-interaction-btn" class="btn btn-success">Log Interaction</button>
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
        <div class="text-center text-secondary" style="padding: 2rem 0;">
          <p style="font-size: 0.875rem;">No interactions logged yet.</p>
        </div>
      `;
    }

    // Sort by date newest first
    const sorted = [...this.interactions].sort((a, b) => new Date(b.interactionDate) - new Date(a.interactionDate));

    return sorted.map(interaction => `
      <div class="timeline-item" style="position: relative; padding-left: 1.5rem; margin-bottom: 2rem; border-left: 2px solid var(--color-border);">
        <div style="position: absolute; left: -9px; top: 0; width: 16px; height: 16px; border-radius: 50%; background: var(--color-primary); border: 3px solid white;"></div>
        <div style="font-size: 0.75rem; color: var(--color-text-tertiary); margin-bottom: 0.25rem;">
          ${formatDate(interaction.interactionDate)} (${formatRelativeTime(interaction.interactionDate)})
        </div>
        <div style="font-weight: 600; font-size: 0.875rem; margin-bottom: 0.25rem;">
          ${typeof interaction.interactionType === 'object' ? interaction.interactionType.interactionType : (INTERACTION_TYPE_LABELS[interaction.interactionType] || interaction.interactionType)}
        </div>
        ${interaction.notes ? `
          <div style="font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.4;">
            ${this.escapeHtml(interaction.notes)}
          </div>
        ` : ''}
      </div>
    `).join('');
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

    this.container.querySelector('#delete-visitor-btn').addEventListener('click', () => {
      const name = this.visitor.contacts.find(c => c.relationType === 'SELF')?.name || 'this visitor';
      if (confirm(`Are you sure you want to delete ${name}? This action can be undone by an administrator.`)) {
        VisitorService.delete(this.visitorId);
        alert('Visitor deleted successfully');
        Router.navigate(ROUTES.VISITORS);
      }
    });

    this.container.querySelector('#log-interaction-btn').addEventListener('click', () => {
      // For now, prompt for a simple interaction
      const note = prompt('Enter interaction notes:');
      if (note !== null) {
        InteractionService.log(this.visitorId, {
          interactionType: 'CALL',
          notes: note
        });
        this.loadData();
        this.renderTimelineContainer();
      }
    });
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
