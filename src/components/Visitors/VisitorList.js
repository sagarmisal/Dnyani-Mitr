// Visitor List Component

import VisitorService from '../../services/VisitorService.js';
import SearchService from '../../services/SearchService.js';
import Router, { ROUTES } from '../../core/router.js';
import EventBus, { EVENTS } from '../../core/events.js';
import { formatRelativeTime } from '../../utils/formatters.js';
import { RELATIONSHIP_LABELS } from '../../utils/constants.js';

export class VisitorList {
  constructor() {
    this.container = null;
    this.currentPage = 1;
    this.pageSize = 50;
    this.searchQuery = '';
    this.filterCategory = null;
    this.filterCity = null;
    this.sortField = 'updatedAt';
    this.sortOrder = 'desc';
  }

  /**
   * Render visitor list
   */
  render() {
    const container = document.createElement('div');
    container.className = 'visitor-list-container';

    container.innerHTML = `
      <div class="visitor-list-header" style="margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h2>Visitors</h2>
          <button id="add-visitor-btn" class="btn btn-primary">
            ➕ Add Visitor
          </button>
        </div>

        <div class="filter-toolbar">
          <div class="filter-group-search">
            <input 
              type="search" 
              id="visitor-search" 
              class="form-input" 
              placeholder="Search visitors..."
              value="${this.escapeHtml(this.searchQuery)}"
            />
          </div>
          
          <div class="filter-group-select">
            <select id="visitor-category-filter" class="form-select">
              <option value="">All Categories</option>
            </select>
          </div>

          <div class="filter-group-select">
            <select id="visitor-city-filter" class="form-select">
              <option value="">All Cities</option>
            </select>
          </div>

          <div class="filter-group-select">
            <select id="visitor-sort" class="form-select">
              <option value="updatedAt:desc">Last Updated</option>
              <option value="createdAt:desc">Recently Added</option>
              <option value="name:asc">Name (A-Z)</option>
              <option value="city:asc">City (A-Z)</option>
            </select>
          </div>
        </div>

        <div id="visitor-stats" class="text-secondary" style="font-size: 0.875rem;">
          Loading...
        </div>
      </div>

      <div id="visitor-list-content" class="visitor-grid">
        <!-- Visitor cards will be rendered here -->
      </div>

      <div id="visitor-pagination" style="margin-top: 2rem; text-align: center;">
        <!-- Pagination will be rendered here -->
      </div>
    `;

    this.container = container;
    this.attachEventListeners();
    this.loadFilters(); // Load categories and cities
    this.loadVisitors();

    // Subscribe to state changes
    EventBus.on(EVENTS.VISITOR_ADDED, () => this.loadVisitors());
    EventBus.on(EVENTS.VISITOR_UPDATED, () => this.loadVisitors());
    EventBus.on(EVENTS.VISITOR_DELETED, () => this.loadVisitors());

    return container;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Add visitor button
    const addBtn = this.container.querySelector('#add-visitor-btn');
    addBtn.addEventListener('click', () => {
      Router.navigate(ROUTES.VISITOR_ADD);
    });

    // Search input
    const searchInput = this.container.querySelector('#visitor-search');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.searchQuery = e.target.value;
        this.currentPage = 1;
        this.loadVisitors();
      }, 300);
    });

    // Category filter
    this.container.querySelector('#visitor-category-filter').addEventListener('change', (e) => {
      this.filterCategory = e.target.value || null;
      this.currentPage = 1;
      this.loadVisitors();
    });

    // City filter
    this.container.querySelector('#visitor-city-filter').addEventListener('change', (e) => {
      this.filterCity = e.target.value || null;
      this.currentPage = 1;
      this.loadVisitors();
    });

    // Sort
    const sortSelect = this.container.querySelector('#visitor-sort');
    sortSelect.addEventListener('change', (e) => {
      const [field, order] = e.target.value.split(':');
      this.sortField = field;
      this.sortOrder = order;
      this.loadVisitors();
    });
  }

  /**
   * Load categories for filter
   */
  /**
   * Load filter options (Categories & Cities)
   */
  loadFilters() {
    // Categories
    const categories = VisitorService.getCategories();
    const catSelect = this.container.querySelector('#visitor-category-filter');
    catSelect.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      catSelect.appendChild(option);
    });

    // Cities (Extract unique cities from all visitors)
    const visitors = VisitorService.getAll();
    const cities = [...new Set(visitors.map(v => v.city).filter(c => c))].sort();

    const citySelect = this.container.querySelector('#visitor-city-filter');
    citySelect.innerHTML = '<option value="">All Cities</option>';
    cities.forEach(city => {
      const option = document.createElement('option');
      option.value = city;
      option.textContent = city;
      citySelect.appendChild(option); // Fixed: was missing this line in original logic
    });
  }

  /**
   * Load and display visitors
   */
  loadVisitors() {
    // Get visitors
    let visitors = VisitorService.search(this.searchQuery, {
      category: this.filterCategory,
      city: this.filterCity
    });

    // Sort
    if (this.sortField === 'name') {
      visitors = SearchService.sort(visitors, 'contacts[0].name', this.sortOrder);
    } else {
      visitors = SearchService.sort(visitors, this.sortField, this.sortOrder);
    }

    // Paginate
    const paginated = SearchService.paginate(visitors, this.currentPage, this.pageSize);

    // Update stats
    this.updateStats(paginated.total);

    // Render visitors
    this.renderVisitors(paginated.items);

    // Render pagination
    this.renderPagination(paginated);
  }

  /**
   * Update statistics display
   */
  updateStats(count) {
    const stats = VisitorService.getStats();
    const statsDiv = this.container.querySelector('#visitor-stats');

    let text = `Showing ${count} visitor${count !== 1 ? 's' : ''}`;
    if (this.searchQuery || this.filterCategory) {
      text += ` (filtered from ${stats.active} total)`;
    }

    statsDiv.textContent = text;
  }

  /**
   * Render visitor cards
   */
  renderVisitors(visitors) {
    const listContent = this.container.querySelector('#visitor-list-content');

    if (visitors.length === 0) {
      const hasFilters = this.searchQuery || this.filterCategory || this.filterCity;
      listContent.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${hasFilters ? '🔍' : '👋'}</div>
          <p class="empty-state-text">${hasFilters ? 'No visitors match your search' : 'No visitors yet!'}</p>
          <p class="empty-state-hint">${hasFilters ? 'Try broadening your search or clearing filters.' : 'Start by adding your first visitor to build your community network.'}</p>
          ${!hasFilters ? `<button class="btn btn-primary" style="margin-top: 1rem;" onclick="window.location.hash='${ROUTES.VISITOR_ADD}'">Add Your First Visitor</button>` : ''}
        </div>
      `;
      return;
    }

    listContent.innerHTML = visitors.map(visitor => this.renderVisitorCard(visitor)).join('');

    // Attach event listeners to cards
    listContent.querySelectorAll('.visitor-card').forEach(card => {
      card.addEventListener('click', () => {
        const visitorId = card.dataset.visitorId;
        Router.navigate(`${ROUTES.VISITOR_VIEW}?id=${visitorId}`);
      });
    });
  }

  /**
   * Render a single visitor card
   */
  renderVisitorCard(visitor) {
    const self = visitor.contacts.find(c => c.relationType === 'SELF');
    const familyCount = visitor.contacts.length - 1;

    return `
      <div class="visitor-card tile-card" data-visitor-id="${visitor.id}">
        <div class="tile-header">
           <h3 class="tile-title" title="${this.escapeHtml(self?.name)}">${this.escapeHtml(self?.name || 'Unknown')}</h3>
           <span class="badge ${visitor.category === 'Donor' ? 'badge-success' : 'badge-primary'}">${visitor.category || 'General'}</span>
        </div>
        
        <div class="tile-body">
           ${visitor.city ? `<div class="tile-info">📍 ${this.escapeHtml(visitor.city)}</div>` : ''}
           ${self?.phones?.[0] ? `<div class="tile-info">📞 ${this.escapeHtml(self.phones[0])}</div>` : ''}
           
           <div class="tile-meta">
              <span>👨‍👩‍👧‍👦 ${familyCount} Family</span>
              <span>📅 ${formatRelativeTime(visitor.updatedAt)}</span>
           </div>
        </div>
      </div>
    `;
  }

  /**
   * Render pagination controls
   */
  renderPagination(paginated) {
    const paginationDiv = this.container.querySelector('#visitor-pagination');

    if (paginated.totalPages <= 1) {
      paginationDiv.innerHTML = '';
      return;
    }

    const buttons = [];

    // Previous button
    if (paginated.hasPrev) {
      buttons.push(`<button class="btn btn-secondary" data-page="${paginated.page - 1}">← Previous</button>`);
    }

    // Page numbers (show current and 2 on each side)
    const startPage = Math.max(1, paginated.page - 2);
    const endPage = Math.min(paginated.totalPages, paginated.page + 2);

    if (startPage > 1) {
      buttons.push(`<button class="btn btn-secondary" data-page="1">1</button>`);
      if (startPage > 2) buttons.push(`<span style="padding: 0 0.5rem;">...</span>`);
    }

    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === paginated.page;
      buttons.push(`<button class="btn ${isActive ? 'btn-primary' : 'btn-secondary'}" data-page="${i}" ${isActive ? 'disabled' : ''}>${i}</button>`);
    }

    if (endPage < paginated.totalPages) {
      if (endPage < paginated.totalPages - 1) buttons.push(`<span style="padding: 0 0.5rem;">...</span>`);
      buttons.push(`<button class="btn btn-secondary" data-page="${paginated.totalPages}">${paginated.totalPages}</button>`);
    }

    // Next button
    if (paginated.hasNext) {
      buttons.push(`<button class="btn btn-secondary" data-page="${paginated.page + 1}">Next →</button>`);
    }

    paginationDiv.innerHTML = `
      <div style="display: flex; gap: 0.5rem; justify-content: center; align-items: center; flex-wrap: wrap;">
        ${buttons.join('')}
      </div>
    `;

    // Attach click events
    paginationDiv.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentPage = parseInt(btn.dataset.page);
        this.loadVisitors();
        window.scrollTo(0, 0);
      });
    });
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Destroy component
   */
  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}
