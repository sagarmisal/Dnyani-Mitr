// Reminder Dashboard Component - UAT Optimizations

import ReminderService from '../../services/ReminderService.js';
import VisitorService from '../../services/VisitorService.js';
import StateManager from '../../core/state.js';
import Router, { ROUTES } from '../../core/router.js';
import { formatDateShort, getDaysUntil, normalizePhone } from '../../utils/formatters.js';
import { Toast } from '../UI/Toast.js';
import { InteractionLogger } from '../UI/InteractionLogger.js';
import { GreetingQueue } from '../UI/GreetingQueue.js';

export class ReminderDashboard {
  constructor() {
    this.container = null;
    const settings = StateManager.getSettings();
    this.lookaheadDays = settings.reminderLookahead || 30;
    this.reminders = [];
    this.filteredReminders = { urgent: [], upcoming: [] };

    // Filters
    this.filters = {
      search: '', // Name only now (City has own filter)
      city: '',   // New City Filter
      type: 'all', // Birthday, Anniversary, etc.
      view: 'dashboard' // 'dashboard' or 'month'
    };

    // Stats
    this.stats = { urgent: 0, upcoming: 0, total: 0 };

    // Pagination
    this.page = 1;
    this.pageSize = 50;
    this.selectedMonth = '';

    // Selection for batch greetings
    this.selectedIds = new Set();

    this.loadData();

    // Try to resume interrupted greeting queue
    GreetingQueue.tryResume(() => this.refresh());
  }

  loadData() {
    try {
      // Reload full dataset
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

    // 1. Text Search (Name) - Robust check
    if (this.filters.search) {
      const term = this.filters.search.toLowerCase().trim();
      filtered = filtered.filter(r => {
        try {
          const visitor = VisitorService.getById(r.visitorId);
          const contact = visitor?.contacts.find(c => c.id === r.contactId);
          const name = contact?.name || '';
          return name.toLowerCase().includes(term);
        } catch (e) { return false; }
      });
    }

    // 2. City Filter
    if (this.filters.city) {
      filtered = filtered.filter(r => {
        const visitor = VisitorService.getById(r.visitorId);
        return visitor?.city === this.filters.city;
      });
    }

    // 3. Type Filter
    if (this.filters.type !== 'all') {
      filtered = filtered.filter(r => r.eventType === this.filters.type);
    }

    // Re-bucket for display
    if (this.selectedMonth !== '') {
      this.filteredReminders = { list: filtered };
    } else {
      // Urgent logic re-applied to filtered set
      // Urgent = Today, Overdue, or within 7 days
      const daysUrgent = 7;

      this.filteredReminders = {
        urgent: filtered.filter(r => {
          const days = getDaysUntil(r.eventDate);
          return days <= daysUrgent; // Includes overdue (negative days)
        }),
        upcoming: filtered.filter(r => {
          const days = getDaysUntil(r.eventDate);
          return days > daysUrgent;
        })
      };
    }

    this.updateStats();
  }

  updateStats() {
    if (this.selectedMonth !== '') {
      this.stats.total = this.filteredReminders.list.length;
    } else {
      this.stats.urgent = this.filteredReminders.urgent.length;
      this.stats.upcoming = this.filteredReminders.upcoming.length;
      this.stats.total = this.stats.urgent + this.stats.upcoming;
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

      // Check if filters are active for "Clear Filters" button
      const hasFilters = this.filters.search || this.filters.city || this.filters.type !== 'all';

      container.innerHTML = `
          <div class="dashboard-controls" style="background: var(--color-surface); padding: 1.5rem; border-radius: 0.5rem; border: 1px solid #94a3b8; margin-bottom: 2rem;">
            <!-- Header & Stats -->
            <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; margin-bottom: 1.5rem;">
              <div>
                 <h2 style="margin: 0; color: var(--color-primary);">Reminder Dashboard</h2>
                 <p class="text-secondary" style="margin-top: 0.25rem;">
                    ${this.stats.total} Activities found • ${isMonthView ? months[parseInt(this.selectedMonth)] : 'Next 30 Days'}
                 </p>
              </div>
              
              <!-- Quick filters (Clickable pills) -->
              <div style="display: flex; gap: 1rem;">
                 ${hasFilters ? `<button class="btn btn-secondary" id="clear-filters" style="color: #ef4444; border-color: #ef4444;">✖ Clear Filters</button>` : ''}
                 <button class="btn ${this.selectedMonth === '' ? 'btn-primary' : 'btn-secondary'}" id="view-dashboard">Live View</button>
                 <select id="month-filter" class="form-select" style="min-width: 150px;">
                    <option value="">📅 Month View...</option>
                    ${months.map((m, i) => `<option value="${i}" ${this.selectedMonth === String(i) ? 'selected' : ''}>${m}</option>`).join('')}
                 </select>
              </div>
            </div>

            <!-- Standard Filter Toolbar -->
            <div class="filter-toolbar">
               <div class="filter-group-search">
                  <input type="text" id="search-filter" class="form-input" placeholder="🔍 Search Name..." value="${this.escapeHtml(this.filters.search)}">
               </div>
               
               <div class="filter-group-select">
                  <select id="city-filter" class="form-select">
                     <option value="">All Cities</option>
                     <!-- Cities populated in post-render -->
                  </select>
               </div>

               <div class="filter-group-select">
                  <select id="type-filter" class="form-select">
                     <option value="all" ${this.filters.type === 'all' ? 'selected' : ''}>All Event Types</option>
                     <option value="Birthday" ${this.filters.type === 'Birthday' ? 'selected' : ''}>🎂 Birthday</option>
                     <option value="Anniversary" ${this.filters.type === 'Anniversary' ? 'selected' : ''}>💍 Anniversary</option>
                     <option value="Death" ${this.filters.type === 'Death' ? 'selected' : ''}>🕯️ Death</option>
                  </select>
               </div>
            </div>

            <!-- Batch Greeting Actions -->
            <div class="greeting-actions-bar" style="display:flex; align-items:center; gap:1rem; margin-top:1rem; padding-top:1rem; border-top:1px solid #e2e8f0;">
              <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-size:0.875rem;">
                <input type="checkbox" id="select-all-reminders" style="width:18px; height:18px;" />
                Select All
              </label>
              <span id="selected-count" class="text-secondary" style="font-size:0.85rem;"></span>
              <div style="flex:1;"></div>
              <button class="btn btn-primary btn-sm" id="send-greetings-btn" disabled style="background:#25d366; border-color:#25d366;">
                💬 Send Greetings
              </button>
            </div>
          </div>

          <!-- Main Layout -->
          <div id="reminder-content">
            ${isMonthView ? this.renderList(this.filteredReminders.list, 'Events') : this.renderDashboardViews()}
          </div>
        `;

      this.container = container;
      this.populateCityFilter(); // Populate cities
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

    let html = '<option value="">All Cities</option>';
    cities.forEach(c => {
      html += `<option value="${this.escapeHtml(c)}" ${this.filters.city === c ? 'selected' : ''}>${this.escapeHtml(c)}</option>`;
    });
    select.innerHTML = html;
  }

  renderDashboardViews() {
    // If we have filters, just show a flat list to avoid confusion? 
    // No, keep sections but handle empty states.
    return `
      <div class="urgent-section" style="margin-bottom: 2rem;">
         <h3 style="color: #991b1b; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
            🔴 Urgent <span class="badge" style="background:#fee2e2; color:#991b1b;">${this.stats.urgent}</span>
         </h3>
         ${this.renderList(this.filteredReminders.urgent, 'urgent')}
      </div>

      <div class="upcoming-section">
         <h3 style="color: #92400e; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
            🟡 Upcoming <span class="badge" style="background:#fef3c7; color:#92400e;">${this.stats.upcoming}</span>
         </h3>
         ${this.renderPaginatedList(this.filteredReminders.upcoming)}
      </div>
    `;
  }

  renderList(items, type) {
    if (!items || items.length === 0) {
      return `
        <div class="empty-state" style="padding: 2rem 1rem;">
          <div class="empty-state-icon">📭</div>
          <p class="empty-state-text">No ${type} reminders found</p>
          <p class="empty-state-hint">Try adjusting your search or filter criteria.</p>
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

  renderTile(reminder, isUrgent) {
    const visitor = VisitorService.getById(reminder.visitorId);
    const contact = visitor?.contacts.find(c => c.id === reminder.contactId);
    const primary = visitor?.contacts.find(c => c.relationType === 'SELF' || c.relationType === 'Self' || c.relationType === 'Primary');

    let phone = contact?.phones?.[0];
    if (!phone && primary && primary.phones?.length > 0) phone = primary.phones[0];
    const hasValidPhone = !!normalizePhone(phone);

    const city = visitor?.city || 'N/A';

    // Date Text
    let dateText = '';
    const days = getDaysUntil(reminder.eventDate);
    if (this.selectedMonth !== '') dateText = formatDateShort(reminder.eventDate);
    else {
      if (days === 0) dateText = 'Today';
      else if (days === 1) dateText = 'Tomorrow';
      else dateText = `In ${days} days`;
    }

    const icon = { 'Birthday': '🎂', 'Anniversary': '💍', 'Death': '🕯️' }[reminder.eventType] || '📅';

    return `
      <div class="tile-card ${isUrgent ? 'urgent' : ''}" style="${isUrgent ? 'border-left: 5px solid #ef4444;' : 'border-left: 5px solid #f59e0b;'}">
         <div class="tile-header" style="margin-bottom: 0.5rem;">
            <div style="display:flex; align-items:center; gap:0.5rem;">
                ${hasValidPhone ? `<input type="checkbox" class="tile-select" data-rid="${reminder.id}" data-vid="${visitor?.id}" data-phone="${this.escapeHtml(phone)}" data-name="${this.escapeHtml(contact?.name || '')}" data-event="${reminder.eventType}" ${this.selectedIds.has(reminder.id) ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer;" />` : ''}
                <span style="font-size:1.2rem;">${icon}</span>
                <span style="font-weight:700; color:${isUrgent ? '#ef4444' : '#f59e0b'}">${dateText}</span>
            </div>
            <span class="badge" style="font-size: 0.7rem; background: #f1f5f9; color: #64748b;">${reminder.eventType}</span>
         </div>

         <div class="tile-body">
            <h4 style="margin:0 0 0.5rem 0; font-size:1.1rem; color:var(--color-primary);">${this.escapeHtml(contact?.name || 'Unknown')}</h4>
            ${(reminder.relationType !== 'SELF' && primary) ?
        `<div style="font-size:0.8rem; margin-bottom:0.5rem; color:#64748b;">Family: ${this.escapeHtml(primary.name)}</div>` : ''}
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem;">
                <div class="tile-info">📍 ${this.escapeHtml(city)}</div>
                <div class="tile-info">📞 ${phone ? `<a href="tel:${phone}" style="text-decoration:none; color:inherit;">${phone}</a>` : '-'}</div>
            </div>
         </div>

         <div class="tile-footer" style="margin-top:1rem; padding-top:0.5rem; border-top:1px solid #e2e8f0;">
            <div class="quick-action-row">
               ${hasValidPhone ? `<button class="btn btn-sm quick-action-btn qa-whatsapp" data-action="whatsapp" data-rid="${reminder.id}" data-vid="${visitor?.id}" data-phone="${this.escapeHtml(phone)}" data-name="${this.escapeHtml(contact?.name || '')}" data-event="${reminder.eventType}">💬 WhatsApp</button>` : ''}
               <button class="btn btn-sm quick-action-btn qa-called" data-action="called" data-rid="${reminder.id}" data-vid="${visitor?.id}" data-phone="${this.escapeHtml(phone || '')}" data-name="${this.escapeHtml(contact?.name || '')}" data-event="${reminder.eventType}">📞 Called</button>
               <button class="btn btn-sm quick-action-btn qa-visited" data-action="visited" data-rid="${reminder.id}" data-vid="${visitor?.id}" data-name="${this.escapeHtml(contact?.name || '')}" data-event="${reminder.eventType}">🏠 Visited</button>
               <div class="snooze-group">
                 <button class="btn btn-sm btn-secondary snooze-toggle" data-rid="${reminder.id}">💤</button>
                 <div class="snooze-options" style="display:none;">
                   <button class="btn btn-sm btn-secondary snooze-btn" data-rid="${reminder.id}" data-days="1">1d</button>
                   <button class="btn btn-sm btn-secondary snooze-btn" data-rid="${reminder.id}" data-days="3">3d</button>
                   <button class="btn btn-sm btn-secondary snooze-btn" data-rid="${reminder.id}" data-days="7">7d</button>
                 </div>
               </div>
               <button class="btn btn-sm btn-secondary more-action-btn" data-vid="${visitor?.id}" data-name="${this.escapeHtml(contact?.name || '')}">...</button>
               <button class="btn btn-primary btn-sm view-btn" data-vid="${visitor?.id}">View</button>
            </div>
         </div>
      </div>
    `;
  }

  renderPagination(total) {
    const pages = Math.ceil(total / this.pageSize);
    if (pages <= 1) return '';
    return `
      <div style="display: flex; justify-content: center; gap: 1rem; margin-top: 2rem;">
         <button class="btn btn-secondary btn-sm" id="prev-page" ${this.page === 1 ? 'disabled' : ''}>Previous</button>
         <span>Page ${this.page} of ${pages}</span>
         <button class="btn btn-secondary btn-sm" id="next-page" ${this.page === pages ? 'disabled' : ''}>Next</button>
      </div>
    `;
  }

  attachEventListeners() {
    // 1. Text Search
    const searchInput = this.container.querySelector('#search-filter');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filters.search = e.target.value;
        this.page = 1;
        this.refresh();
      });
    }

    // 2. City Filter (Fixed: Was missing listener)
    const citySelect = this.container.querySelector('#city-filter');
    if (citySelect) {
      citySelect.addEventListener('change', (e) => {
        this.filters.city = e.target.value;
        this.page = 1;
        this.refresh();
      });
    }

    // 3. Type Filter
    const typeSelect = this.container.querySelector('#type-filter');
    if (typeSelect) {
      typeSelect.addEventListener('change', (e) => {
        this.filters.type = e.target.value;
        this.page = 1;
        this.refresh();
      });
    }

    // 4. Month Filter
    const monthSelect = this.container.querySelector('#month-filter');
    if (monthSelect) {
      monthSelect.addEventListener('change', (e) => {
        this.selectedMonth = e.target.value;
        this.page = 1;
        this.refresh();
      });
    }

    // 5. Live View Button
    const viewBtn = this.container.querySelector('#view-dashboard');
    if (viewBtn) {
      viewBtn.addEventListener('click', () => {
        this.selectedMonth = '';
        this.page = 1;
        if (monthSelect) monthSelect.value = '';
        this.refresh();
      });
    }

    // 5.1 Clear Filters Button
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

    // 6. Quick-action buttons (WhatsApp, Called, Visited)
    this.container.querySelectorAll('.quick-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const el = e.currentTarget;
        const action = el.dataset.action;
        const rid = el.dataset.rid;
        const vid = el.dataset.vid;
        const phone = el.dataset.phone;
        const name = el.dataset.name;
        const eventType = el.dataset.event;

        InteractionLogger.quickAction(action, {
          visitorId: vid,
          reminderId: rid,
          contactName: name,
          phone: phone,
          eventType: eventType,
          onDone: () => this.refresh()
        });
      });
    });

    // 6b. Snooze toggle + options
    this.container.querySelectorAll('.snooze-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const group = e.currentTarget.closest('.snooze-group');
        const opts = group.querySelector('.snooze-options');
        opts.style.display = opts.style.display === 'none' ? 'flex' : 'none';
      });
    });

    this.container.querySelectorAll('.snooze-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const rid = e.currentTarget.dataset.rid;
        const days = parseInt(e.currentTarget.dataset.days, 10);
        InteractionLogger.snooze(rid, days, () => this.refresh());
      });
    });

    // 6c. More (...) opens full InteractionLogger
    this.container.querySelectorAll('.more-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const vid = e.currentTarget.dataset.vid;
        const name = e.currentTarget.dataset.name;
        InteractionLogger.showFull({
          visitorId: vid,
          visitorName: name,
          onDone: () => this.refresh()
        });
      });
    });

    // 6d. Tile selection checkboxes
    this.container.querySelectorAll('.tile-select').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const rid = e.target.dataset.rid;
        if (e.target.checked) {
          this.selectedIds.add(rid);
        } else {
          this.selectedIds.delete(rid);
        }
        this._updateSelectionUI();
      });
    });

    // 6e. Select All checkbox
    const selectAllCb = this.container.querySelector('#select-all-reminders');
    if (selectAllCb) {
      selectAllCb.addEventListener('change', (e) => {
        const allCheckboxes = this.container.querySelectorAll('.tile-select');
        allCheckboxes.forEach(cb => {
          cb.checked = e.target.checked;
          const rid = cb.dataset.rid;
          if (e.target.checked) this.selectedIds.add(rid);
          else this.selectedIds.delete(rid);
        });
        this._updateSelectionUI();
      });
    }

    // 6f. Send Greetings button
    const sendBtn = this.container.querySelector('#send-greetings-btn');
    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
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
        if (items.length === 0) {
          Toast.show('Select reminders first', 'warning');
          return;
        }
        GreetingQueue.start(items, () => {
          this.selectedIds.clear();
          this.refresh();
        });
      });
    }

    this._updateSelectionUI();

    // 7. View Visitor Buttons
    this.container.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => Router.navigate(`${ROUTES.VISITOR_VIEW}?id=${e.target.dataset.vid}`));
    });

    // 8. Pagination
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
        // Refocus search if active
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
    const sendBtn = this.container?.querySelector('#send-greetings-btn');
    if (countEl) countEl.textContent = count > 0 ? `${count} selected` : '';
    if (sendBtn) {
      sendBtn.disabled = count === 0;
      sendBtn.textContent = count > 0 ? `💬 Send Greetings (${count})` : '💬 Send Greetings';
    }
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  destroy() { this.container = null; }
}
