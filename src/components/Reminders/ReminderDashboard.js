// Reminder Dashboard Component

import ReminderService from '../../services/ReminderService.js';
import { t } from '../../utils/i18n.js';
import VisitorService from '../../services/VisitorService.js';
import StateManager from '../../core/state.js';
import Router, { ROUTES } from '../../core/router.js';
import { formatDateShort, getDaysUntil, normalizePhone } from '../../utils/formatters.js';
import { Toast } from '../UI/Toast.js';
import { InteractionLogger } from '../UI/InteractionLogger.js';
import { GreetingQueue } from '../UI/GreetingQueue.js';
import { SmsBatchQueue } from '../UI/SmsBatchQueue.js';
import SmsService from '../../services/SmsService.js';

export class ReminderDashboard {
  constructor() {
    this.container = null;
    const settings = StateManager.getSettings();
    this.lookaheadDays = settings.reminderLookahead || 30;
    this.reminders = [];
    this.filteredReminders = { urgent: [], upcoming: [] };

    this.filters = {
      search: '',
      city: '',
      type: 'all',
      view: 'dashboard'
    };

    this.stats = { urgent: 0, upcoming: 0, total: 0 };

    this.page = 1;
    this.pageSize = 50;
    this.selectedMonth = '';
    this.selectedIds = new Set();
    this.filtersOpen = false;

    this.loadData();
    GreetingQueue.tryResume(() => this.refresh());
  }

  loadData() {
    try {
      if (this.selectedMonth !== '') {
        this.rawReminders = ReminderService.getRemindersForMonth(this.selectedMonth);
      } else {
        const grouped = ReminderService.getGroupedReminders(this.lookaheadDays);
        this.rawReminders = [
          ...grouped.overdue,
          ...grouped.today,
          ...grouped.urgent,
          ...grouped.upcoming
        ];
      }
      this.applyFilters();
    } catch (err) {
      console.error('Error loading reminder data:', err);
      this.rawReminders = [];
      this.filteredReminders = { list: [], urgent: [], upcoming: [] };
    }
  }

  applyFilters() {
    let filtered = [...(this.rawReminders || [])];

    if (this.filters.search) {
      const term = this.filters.search.toLowerCase().trim();
      filtered = filtered.filter(r => {
        try {
          const visitor = VisitorService.getById(r.visitorId);
          const contact = visitor?.contacts.find(c => c.id === r.contactId);
          return (contact?.name || '').toLowerCase().includes(term);
        } catch (e) { return false; }
      });
    }

    if (this.filters.city) {
      filtered = filtered.filter(r => {
        const visitor = VisitorService.getById(r.visitorId);
        return visitor?.city === this.filters.city;
      });
    }

    if (this.filters.type !== 'all') {
      filtered = filtered.filter(r => r.eventType === this.filters.type);
    }

    if (this.selectedMonth !== '') {
      this.filteredReminders = { list: filtered };
    } else {
      const daysUrgent = 7;
      // Three-bucket split — overdue is a first-class section in Iter 9.1
      // (previously the generator filtered it out entirely; now that it flows
      // through, surface it under its own header instead of mis-labelling it
      // as "this week").
      this.filteredReminders = {
        overdue: filtered.filter(r => getDaysUntil(r.eventDate) < 0),
        urgent: filtered.filter(r => {
          const d = getDaysUntil(r.eventDate);
          return d >= 0 && d <= daysUrgent;
        }),
        upcoming: filtered.filter(r => getDaysUntil(r.eventDate) > daysUrgent)
      };
    }

    this.updateStats();
  }

  updateStats() {
    if (this.selectedMonth !== '') {
      this.stats.total = this.filteredReminders.list.length;
    } else {
      this.stats.overdue = this.filteredReminders.overdue?.length || 0;
      this.stats.urgent = this.filteredReminders.urgent?.length || 0;
      this.stats.upcoming = this.filteredReminders.upcoming?.length || 0;
      this.stats.total = this.stats.overdue + this.stats.urgent + this.stats.upcoming;
    }
  }

  render() {
    try {
      const container = document.createElement('div');
      container.className = 'reminder-dashboard';

      const isMonthView = this.selectedMonth !== '';
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const hasFilters = this.filters.search || this.filters.city || this.filters.type !== 'all';
      const headerLabel = isMonthView ? months[parseInt(this.selectedMonth)] : `Next ${this.lookaheadDays} days`;

      container.innerHTML = `
        <!-- Top bar: title + view toggle + filter toggle -->
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;">
          <div>
            <h2 style="margin: 0;">${t('rem.title')}</h2>
            <p style="margin: 0.15rem 0 0 0; color: var(--color-text-secondary); font-size: 0.9rem;">
              ${this.stats.total} ${this.stats.total === 1 ? 'reminder' : 'reminders'} · ${this.escapeHtml(headerLabel)}
            </p>
          </div>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
            <button id="toggle-filters-btn" class="btn btn-secondary btn-sm" aria-expanded="${this.filtersOpen || hasFilters ? 'true' : 'false'}">
              ${hasFilters ? '✓ Filters active' : '☰ Filters'}
            </button>
            <select id="month-filter" class="form-select" style="min-width: 150px; max-width: 200px;">
              <option value="">${t('rem.upcoming')}</option>
              ${months.map((m, i) => `<option value="${i}" ${this.selectedMonth === String(i) ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Filter bar (collapsed unless toggled or active) -->
        <div id="filter-bar" class="${(this.filtersOpen || hasFilters) ? '' : 'hidden'}" style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 0.75rem 1rem; margin-bottom: 1rem;">
          <div class="filter-toolbar" style="margin: 0;">
            <div class="filter-group-search" style="flex: 2; min-width: 180px;">
              <input type="text" id="search-filter" class="form-input" placeholder="${t('rem.search')}" value="${this.escapeHtml(this.filters.search)}" />
            </div>
            <div class="filter-group-select" style="flex: 1; min-width: 140px;">
              <select id="city-filter" class="form-select">
                <option value="">${t('rem.allCities')}</option>
              </select>
            </div>
            <div class="filter-group-select" style="flex: 1; min-width: 140px;">
              <select id="type-filter" class="form-select">
                <option value="all" ${this.filters.type === 'all' ? 'selected' : ''}>${t('rem.allEvents')}</option>
                <option value="Birthday" ${this.filters.type === 'Birthday' ? 'selected' : ''}>🎂 Birthday</option>
                <option value="Anniversary" ${this.filters.type === 'Anniversary' ? 'selected' : ''}>💍 Anniversary</option>
                <option value="Death" ${this.filters.type === 'Death' ? 'selected' : ''}>🕯️ Death</option>
              </select>
            </div>
            ${hasFilters ? `
              <button id="clear-filters" class="btn btn-secondary btn-sm">${t('rem.clear')}</button>
            ` : ''}
          </div>
        </div>

        <!-- Batch greeting bar - only visible when something selected -->
        <div id="batch-bar" class="${this.selectedIds.size > 0 ? '' : 'hidden'}" style="background: #f0f9ff; border: 1px solid #38bdf8; border-radius: var(--radius-md); padding: 0.75rem 1rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
          <span id="selected-count" style="font-weight: 600;">0 selected</span>
          <div style="flex: 1;"></div>
          <button id="select-all-visible" class="btn btn-secondary btn-sm">${t('rem.selectAll')}</button>
          <button id="clear-selection" class="btn btn-secondary btn-sm">${t('rem.clearSelection')}</button>
          ${this._isCapacitor() ? `
            <button id="send-sms-batch-btn" class="btn btn-primary btn-sm" style="background: #0ea5e9; border-color: #0ea5e9;" title="${t('rem.smsAll')}">
              📱 Send SMS
            </button>` : ''}
          <button id="send-greetings-btn" class="btn btn-sm" style="background: #25d366; border-color: #25d366; color: white;" title="${t('rem.whatsappEach')}">
            💬 WhatsApp
          </button>
        </div>

        <!-- Reminders -->
        <div id="reminder-content">
          ${isMonthView ? this.renderList(this.filteredReminders.list, 'events') : this.renderDashboardViews()}
        </div>
      `;

      this.container = container;
      this.populateCityFilter();
      this.attachEventListeners();
      return container;
    } catch (err) {
      console.error('Render Error:', err);
      const errDiv = document.createElement('div');
      errDiv.innerHTML = `<div class="alert alert-danger">Error rendering dashboard: ${err.message}. Please refresh.</div>`;
      return errDiv;
    }
  }

  populateCityFilter() {
    const select = this.container.querySelector('#city-filter');
    if (!select) return;
    const visitors = VisitorService.getAll();
    const cities = [...new Set(visitors.map(v => v.city).filter(c => c))].sort();
    let html = `<option value="">${t('rem.allCities')}</option>`;
    cities.forEach(c => {
      html += `<option value="${this.escapeHtml(c)}" ${this.filters.city === c ? 'selected' : ''}>${this.escapeHtml(c)}</option>`;
    });
    select.innerHTML = html;
  }

  renderDashboardViews() {
    const overdue = this.filteredReminders.overdue || [];
    const urgent = this.filteredReminders.urgent || [];
    const upcoming = this.filteredReminders.upcoming || [];
    const hasOverdue = overdue.length > 0;
    const hasUrgent = urgent.length > 0;
    const hasUpcoming = upcoming.length > 0;

    // Smart empty-state with CTAs (Iter 9.1 D) — when the upcoming/lookahead
    // view is genuinely empty and we have visitors in the database, point the
    // user at the alternative views instead of a dead-end blank page.
    if (!hasOverdue && !hasUrgent && !hasUpcoming) {
      return this._renderSmartEmptyState();
    }

    let html = '';
    if (hasOverdue) {
      html += `
        <section style="margin-bottom: 1.5rem;">
          <h3 style="margin: 0 0 0.75rem 0; font-size: 1rem; color: var(--color-text-primary); display: flex; align-items: center; gap: 0.5rem;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #b91c1c;"></span>
            ${t('rem.waiting')}
            <span style="color: var(--color-text-secondary); font-weight: 400;">(${overdue.length})</span>
          </h3>
          ${this.renderList(overdue, 'overdue')}
        </section>
      `;
    }
    if (hasUrgent) {
      html += `
        <section style="margin-bottom: 1.5rem;">
          <h3 style="margin: 0 0 0.75rem 0; font-size: 1rem; color: var(--color-text-primary); display: flex; align-items: center; gap: 0.5rem;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #ef4444;"></span>
            ${t('rem.thisWeek')}
            <span style="color: var(--color-text-secondary); font-weight: 400;">(${urgent.length})</span>
          </h3>
          ${this.renderList(urgent, 'urgent')}
        </section>
      `;
    }
    if (hasUpcoming) {
      html += `
        <section>
          <h3 style="margin: 0 0 0.75rem 0; font-size: 1rem; color: var(--color-text-primary); display: flex; align-items: center; gap: 0.5rem;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #f59e0b;"></span>
            ${t('rem.later')}
            <span style="color: var(--color-text-secondary); font-weight: 400;">(${upcoming.length})</span>
          </h3>
          ${this.renderPaginatedList(upcoming)}
        </section>
      `;
    }
    return html;
  }

  /**
   * Reminders default view shows the rolling window [today-30d, today+lookahead].
   * If that's empty AND the user has visitors with events, the page used to be
   * a dead-end "No reminders found" message. Now we offer two escape hatches:
   * jump to current calendar month, or expand to a 12-month overview. If there
   * are no visitors at all, route to Add Visitor instead.
   */
  _renderSmartEmptyState() {
    const visitorCount = VisitorService.getAll().filter(v => !v.doNotContact).length;
    const currentMonth = new Date().getMonth();
    const currentMonthName = ['January','February','March','April','May','June','July','August','September','October','November','December'][currentMonth];

    if (visitorCount === 0) {
      return `
        <div class="empty-state" style="padding: 2.5rem 1rem;">
          <div class="empty-state-icon">👋</div>
          <p class="empty-state-text">${t('rem.none')}</p>
          <p class="empty-state-hint">${t('p.addFirstBirthday')}</p>
          <div style="margin-top: 1.25rem;">
            <a href="#${ROUTES.VISITOR_NEW}" class="btn btn-primary btn-sm">+ Add Visitor</a>
          </div>
        </div>`;
    }

    return `
      <div class="empty-state" style="padding: 2.5rem 1rem;">
        <div class="empty-state-icon">📭</div>
        <p class="empty-state-text">Nothing in the next ${this.lookaheadDays} days</p>
        <p class="empty-state-hint">No events from the last 30 days either. Try a wider view:</p>
        <div style="margin-top: 1.25rem; display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
          <button class="btn btn-primary btn-sm" id="empty-view-current-month">📅 Show ${currentMonthName}</button>
          <button class="btn btn-secondary btn-sm" id="empty-view-all-months">📆 Show all 12 months</button>
        </div>
      </div>`;
  }

  renderList(items, type) {
    if (!items || items.length === 0) {
      return `
        <div class="empty-state" style="padding: 2rem 1rem;">
          <div class="empty-state-icon">📭</div>
          <p class="empty-state-text">No ${type} found</p>
          <p class="empty-state-hint">${t('p.tryOtherFilters')}</p>
        </div>`;
    }
    return `
      <div class="visitor-grid">
        ${items.map(r => this.renderTile(r, type === 'urgent')).join('')}
      </div>
    `;
  }

  renderPaginatedList(items) {
    if (!items || items.length === 0) return this.renderList([], 'upcoming');
    const start = (this.page - 1) * this.pageSize;
    const end = start + this.pageSize;
    const slice = items.slice(start, end);
    return `
      ${this.renderList(slice, 'upcoming')}
      ${this.renderPagination(items.length)}
    `;
  }

  /**
   * Small status pill for the top of a month-view tile that's already handled.
   * `reminder.handledReason` is set by ReminderService._annotateHandled.
   */
  _renderHandledBadge(reminder) {
    if (reminder.handledReason === 'snoozed' && reminder.handledUntil) {
      return `<span style="font-size: 0.75rem; color: #075985; background: #e0f2fe; padding: 0.15rem 0.5rem; border-radius: 999px;" title="${t('rem.snoozed')}">💤 Until ${this.escapeHtml(formatDateShort(reminder.handledUntil))}</span>`;
    }
    if (reminder.handledReason === 'contacted') {
      const when = reminder.handledAt ? formatDateShort(reminder.handledAt) : '';
      return `<span style="font-size: 0.75rem; color: #065f46; background: #d1fae5; padding: 0.15rem 0.5rem; border-radius: 999px;" title="${t('rem.alreadyDone')}">✓ Contacted${when ? ' ' + this.escapeHtml(when) : ''}</span>`;
    }
    return '';
  }

  renderTile(reminder, isUrgent) {
    const visitor = VisitorService.getById(reminder.visitorId);
    const contact = visitor?.contacts.find(c => c.id === reminder.contactId);
    const primary = visitor?.contacts.find(c => c.relationType === 'SELF' || c.relationType === 'Self' || c.relationType === 'Primary');

    let phone = contact?.phones?.[0];
    if (!phone && primary && primary.phones?.length > 0) phone = primary.phones[0];
    const hasValidPhone = !!normalizePhone(phone);
    const city = visitor?.city || '';

    let dateText = '';
    const days = getDaysUntil(reminder.eventDate);
    if (this.selectedMonth !== '') {
      dateText = formatDateShort(reminder.eventDate);
    } else if (days < 0) {
      dateText = `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
    } else if (days === 0) {
      dateText = 'Today';
    } else if (days === 1) {
      dateText = 'Tomorrow';
    } else {
      dateText = `In ${days} days`;
    }

    const icon = { 'Birthday': '🎂', 'Anniversary': '💍', 'Death': '🕯️', 'ContactDue': '⏰' }[reminder.eventType] || '📅';
    const prettyEventLabel = reminder.eventType === 'ContactDue' ? 'Contact due' : reminder.eventType;
    const dateColor = isUrgent ? '#dc2626' : '#b45309';
    const familyOf = (reminder.relationType !== 'SELF' && primary) ? primary.name : '';
    const isSelected = this.selectedIds.has(reminder.id);

    // Month view dims items the user has already snoozed or contacted this
    // cycle (annotated by ReminderService.getRemindersForMonth). Keeps the
    // tile visible for context but signals "no action needed right now".
    const handled = !!reminder.handled;
    const handledBadge = handled ? this._renderHandledBadge(reminder) : '';
    const cardStyle = [
      isUrgent ? 'border-left: 3px solid #ef4444;' : '',
      handled ? 'opacity: 0.65; background: var(--color-surface-hover);' : ''
    ].filter(Boolean).join(' ');

    return `
      <div class="tile-card" style="${cardStyle}">
        <!-- Top: checkbox + date + handled badge + event type pill -->
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap;">
          ${hasValidPhone ? `
            <input type="checkbox" class="tile-select" data-rid="${reminder.id}" data-vid="${visitor?.id}" data-phone="${this.escapeHtml(phone)}" data-name="${this.escapeHtml(contact?.name || '')}" data-event="${reminder.eventType}" ${isSelected ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; flex-shrink: 0;" aria-label="${t('rem.selectForGreeting')}" />
          ` : ''}
          <span style="font-size: 1.1rem; flex-shrink: 0;" aria-hidden="true">${icon}</span>
          <span style="font-weight: 700; color: ${dateColor};">${dateText}</span>
          ${handledBadge}
          <span style="margin-left: auto; font-size: 0.8rem; color: var(--color-text-secondary); background: var(--color-surface-hover); padding: 0.15rem 0.5rem; border-radius: 999px;">${this.escapeHtml(prettyEventLabel)}</span>
        </div>

        <!-- Name + meta -->
        <div style="margin-bottom: 0.75rem;">
          <h4 style="margin: 0 0 0.25rem 0; font-size: 1.05rem; color: var(--color-text-primary);">${this.escapeHtml(contact?.name || 'Unknown')}</h4>
          <div style="font-size: 0.85rem; color: var(--color-text-secondary); display: flex; flex-wrap: wrap; gap: 0.5rem;">
            ${familyOf ? `<span>Family of ${this.escapeHtml(familyOf)}</span>` : ''}
            ${city ? `<span>· ${this.escapeHtml(city)}</span>` : ''}
            ${phone ? `<span>· <a href="tel:${this.escapeHtml(phone)}" style="color: var(--color-primary); text-decoration: none;">${this.escapeHtml(phone)}</a></span>` : ''}
          </div>
        </div>

        <!-- Actions: WhatsApp (primary if phone) + secondary actions -->
        <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: stretch;">
          ${hasValidPhone ? `
            <button class="btn btn-sm quick-action-btn qa-whatsapp" data-action="whatsapp" data-rid="${reminder.id}" data-vid="${visitor?.id}" data-phone="${this.escapeHtml(phone)}" data-name="${this.escapeHtml(contact?.name || '')}" data-event="${reminder.eventType}" style="flex: 2; min-width: 130px;">💬 WhatsApp</button>
            <button class="btn btn-sm quick-action-btn qa-sms" data-action="sms" data-rid="${reminder.id}" data-vid="${visitor?.id}" data-phone="${this.escapeHtml(phone)}" data-name="${this.escapeHtml(contact?.name || '')}" data-event="${reminder.eventType}" style="flex: 1; min-width: 95px;" title="${t('rem.openSms')}">📱 SMS</button>
          ` : ''}
          <button class="btn btn-sm quick-action-btn qa-called" data-action="called" data-rid="${reminder.id}" data-vid="${visitor?.id}" data-phone="${this.escapeHtml(phone || '')}" data-name="${this.escapeHtml(contact?.name || '')}" data-event="${reminder.eventType}" style="flex: 1; min-width: 95px;" title="${t('rem.markCalled')}">📞 Called</button>
          <button class="btn btn-sm quick-action-btn qa-visited" data-action="visited" data-rid="${reminder.id}" data-vid="${visitor?.id}" data-name="${this.escapeHtml(contact?.name || '')}" data-event="${reminder.eventType}" style="flex: 1; min-width: 95px;" title="${t('rem.markVisited')}">🏠 Visited</button>
          <select class="form-select snooze-select" data-rid="${reminder.id}" style="flex: 1; min-width: 110px; min-height: 44px; font-size: 0.9rem;" aria-label="${t('rem.snooze')}">
            <option value="">💤 Later...</option>
            <option value="1">${t('rem.tomorrow')}</option>
            <option value="3">In 3 days</option>
            <option value="7">In 1 week</option>
          </select>
          <button class="btn btn-sm btn-secondary more-action-btn" data-vid="${visitor?.id}" data-name="${this.escapeHtml(contact?.name || '')}" style="flex: 0 0 auto; min-width: 44px;" title="${t('rem.logDetails')}" aria-label="${t('rem.logDetails')}">⋯</button>
          <button class="btn btn-sm btn-primary view-btn" data-vid="${visitor?.id}" style="flex: 1; min-width: 80px;">View →</button>
        </div>
      </div>
    `;
  }

  renderPagination(total) {
    const pages = Math.ceil(total / this.pageSize);
    if (pages <= 1) return '';
    return `
      <div style="display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 1.5rem;">
        <button class="btn btn-secondary btn-sm" id="prev-page" ${this.page === 1 ? 'disabled' : ''}>← Previous</button>
        <span style="color: var(--color-text-secondary);">Page ${this.page} of ${pages}</span>
        <button class="btn btn-secondary btn-sm" id="next-page" ${this.page === pages ? 'disabled' : ''}>Next →</button>
      </div>
    `;
  }

  attachEventListeners() {
    // Filter toggle
    const filtersToggle = this.container.querySelector('#toggle-filters-btn');
    if (filtersToggle) {
      filtersToggle.addEventListener('click', () => {
        this.filtersOpen = !this.filtersOpen;
        const bar = this.container.querySelector('#filter-bar');
        if (bar) bar.classList.toggle('hidden', !this.filtersOpen && !(this.filters.search || this.filters.city || this.filters.type !== 'all'));
        filtersToggle.setAttribute('aria-expanded', this.filtersOpen ? 'true' : 'false');
      });
    }

    // Search
    const searchInput = this.container.querySelector('#search-filter');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filters.search = e.target.value;
        this.page = 1;
        this.refresh();
      });
    }

    // City
    const citySelect = this.container.querySelector('#city-filter');
    if (citySelect) {
      citySelect.addEventListener('change', (e) => {
        this.filters.city = e.target.value;
        this.page = 1;
        this.refresh();
      });
    }

    // Type
    const typeSelect = this.container.querySelector('#type-filter');
    if (typeSelect) {
      typeSelect.addEventListener('change', (e) => {
        this.filters.type = e.target.value;
        this.page = 1;
        this.refresh();
      });
    }

    // Month
    const monthSelect = this.container.querySelector('#month-filter');
    if (monthSelect) {
      monthSelect.addEventListener('change', (e) => {
        this.selectedMonth = e.target.value;
        this.page = 1;
        this.refresh();
      });
    }

    // Clear filters
    const clearBtn = this.container.querySelector('#clear-filters');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.filters.search = '';
        this.filters.city = '';
        this.filters.type = 'all';
        this.page = 1;
        this.refresh();
      });
    }

    // Quick actions: WhatsApp / Called / Visited
    this.container.querySelectorAll('.quick-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const el = e.currentTarget;
        InteractionLogger.quickAction(el.dataset.action, {
          visitorId: el.dataset.vid,
          reminderId: el.dataset.rid,
          contactName: el.dataset.name,
          phone: el.dataset.phone,
          eventType: el.dataset.event,
          onDone: () => this.refresh()
        });
      });
    });

    // Snooze dropdowns
    this.container.querySelectorAll('.snooze-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const days = parseInt(e.currentTarget.value, 10);
        const rid = e.currentTarget.dataset.rid;
        if (!days) return;
        InteractionLogger.snooze(rid, days, () => this.refresh());
      });
    });

    // More (...) → full InteractionLogger
    this.container.querySelectorAll('.more-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        InteractionLogger.showFull({
          visitorId: e.currentTarget.dataset.vid,
          visitorName: e.currentTarget.dataset.name,
          onDone: () => this.refresh()
        });
      });
    });

    // Tile checkbox selection
    this.container.querySelectorAll('.tile-select').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const rid = e.target.dataset.rid;
        if (e.target.checked) this.selectedIds.add(rid);
        else this.selectedIds.delete(rid);
        this._updateSelectionUI();
      });
    });

    // Batch bar buttons
    const selectAllVisible = this.container.querySelector('#select-all-visible');
    if (selectAllVisible) {
      selectAllVisible.addEventListener('click', () => {
        this.container.querySelectorAll('.tile-select').forEach(cb => {
          cb.checked = true;
          this.selectedIds.add(cb.dataset.rid);
        });
        this._updateSelectionUI();
      });
    }

    const clearSelection = this.container.querySelector('#clear-selection');
    if (clearSelection) {
      clearSelection.addEventListener('click', () => {
        this.selectedIds.clear();
        this.container.querySelectorAll('.tile-select').forEach(cb => { cb.checked = false; });
        this._updateSelectionUI();
      });
    }

    // Collect selected items as a queue payload (used by both SMS + WhatsApp paths).
    const collectSelected = () => {
      const items = [];
      this.container.querySelectorAll('.tile-select:checked').forEach(cb => {
        items.push({
          visitorId: cb.dataset.vid,
          reminderId: cb.dataset.rid,
          contactName: cb.dataset.name,
          phone: cb.dataset.phone,
          eventType: cb.dataset.event
        });
      });
      return items;
    };

    // Send greetings via WhatsApp (existing flow)
    const sendBtn = this.container.querySelector('#send-greetings-btn');
    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        const items = collectSelected();
        if (items.length === 0) {
          Toast.show(t('p.pickFirst'), 'warning');
          return;
        }
        GreetingQueue.start(items, () => {
          this.selectedIds.clear();
          this.refresh();
        });
      });
    }

    // Send SMS in bulk (Capacitor-only — button is not rendered on desktop)
    const smsBtn = this.container.querySelector('#send-sms-batch-btn');
    if (smsBtn) {
      smsBtn.addEventListener('click', () => {
        const items = collectSelected();
        if (items.length === 0) {
          Toast.show(t('p.pickFirst'), 'warning');
          return;
        }
        SmsBatchQueue.start(items, () => {
          this.selectedIds.clear();
          this.refresh();
        });
      });
    }

    this._updateSelectionUI();

    // View visitor
    this.container.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => Router.navigate(`${ROUTES.VISITOR_VIEW}?id=${e.currentTarget.dataset.vid}`));
    });

    // Empty-state CTAs (Iter 9.1 D) — only present when the rolling window is empty
    const showMonthBtn = this.container.querySelector('#empty-view-current-month');
    if (showMonthBtn) {
      showMonthBtn.addEventListener('click', () => {
        this.selectedMonth = String(new Date().getMonth());
        this.page = 1;
        this.refresh();
      });
    }
    const showAllBtn = this.container.querySelector('#empty-view-all-months');
    if (showAllBtn) {
      showAllBtn.addEventListener('click', () => {
        // Temporarily widen the rolling window to a full year so the dashboard
        // view (not month view) shows everything. Persists for this render only;
        // the next data load reads the setting again.
        this.lookaheadDays = 365;
        this.refresh();
      });
    }

    // Pagination
    const prev = this.container.querySelector('#prev-page');
    if (prev) prev.addEventListener('click', () => { this.page--; this.refresh(); });
    const next = this.container.querySelector('#next-page');
    if (next) next.addEventListener('click', () => { this.page++; this.refresh(); });
  }

  refresh() {
    this.loadData();
    const old = this.container;
    const parent = old?.parentNode;
    if (parent && old) {
      try {
        const newEl = this.render();
        parent.replaceChild(newEl, old);
        if (this.filters.search) {
          const input = newEl.querySelector('#search-filter');
          if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
          }
        }
      } catch (e) {
        console.error("Refresh failed", e);
      }
    }
  }

  _updateSelectionUI() {
    const count = this.selectedIds.size;
    const countEl = this.container?.querySelector('#selected-count');
    const bar = this.container?.querySelector('#batch-bar');
    if (countEl) countEl.textContent = count > 0 ? `${count} selected` : '0 selected';
    if (bar) bar.classList.toggle('hidden', count === 0);
  }

  _isCapacitor() {
    return !!(typeof window !== 'undefined'
      && window.Capacitor
      && typeof window.Capacitor.isNativePlatform === 'function'
      && window.Capacitor.isNativePlatform());
  }

  escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  destroy() { this.container = null; }
}
