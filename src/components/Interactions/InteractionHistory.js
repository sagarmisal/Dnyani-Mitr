// Interaction History View - Global chronological list of all interactions

import StateManager from '../../core/state.js';
import { t } from '../../utils/i18n.js';
import { visitorDisplayName } from '../../utils/formatters.js';
import VisitorService from '../../services/VisitorService.js';
import Router, { ROUTES } from '../../core/router.js';
import { formatDate, formatRelativeTime } from '../../utils/formatters.js';
import { INTERACTION_TYPE_LABELS, INTERACTION_OUTCOME_LABELS, INTERACTION_TYPES } from '../../utils/constants.js';
import { debounce } from '../../utils/helpers.js';

export class InteractionHistory {
    constructor() {
        this.container = null;
        this.page = 1;
        this.pageSize = 50;
        this.filters = {
            search: '',
            type: '',
            outcome: '',
            volunteer: '',
            dateFrom: '',
            dateTo: ''
        };
        this._visitorCache = new Map();
    }

    render() {
        const container = document.createElement('div');
        container.className = 'interaction-history';

        const interactions = this._getFilteredInteractions();
        const weekStats = this._getWeekStats();
        const machineInfo = StateManager.getMachineInfo();
        const isRoot = machineInfo.machineRole === 'root';
        const knownMachines = StateManager.getKnownMachines();

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">${t('hist.title')}</h2>
                    <p class="text-secondary">${this._renderWeekSummary(weekStats)}</p>
                </div>

                <div class="card-body">
                    <!-- Filters -->
                    <div class="interaction-filters" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:0.75rem; margin-bottom:1.5rem;">
                        <input type="text" id="ih-search" class="form-input" placeholder="Search visitor name..." value="${this._escapeHtml(this.filters.search)}">

                        <select id="ih-type" class="form-select">
                            <option value="">${t('hist.allTypes')}</option>
                            ${Object.entries(INTERACTION_TYPE_LABELS).map(([val, label]) =>
                                `<option value="${val}" ${this.filters.type === val ? 'selected' : ''}>${label}</option>`
                            ).join('')}
                        </select>

                        <select id="ih-outcome" class="form-select">
                            <option value="">${t('hist.allOutcomes')}</option>
                            ${Object.entries(INTERACTION_OUTCOME_LABELS).map(([val, label]) =>
                                `<option value="${val}" ${this.filters.outcome === val ? 'selected' : ''}>${label}</option>`
                            ).join('')}
                        </select>

                        ${isRoot ? `
                        <select id="ih-volunteer" class="form-select">
                            <option value="">${t('hist.allVolunteers')}</option>
                            <option value="${machineInfo.machineId}" ${this.filters.volunteer === machineInfo.machineId ? 'selected' : ''}>${this._escapeHtml(machineInfo.machineName)} (me)</option>
                            ${Object.entries(knownMachines)
                                .filter(([id]) => id !== machineInfo.machineId)
                                .map(([id, name]) =>
                                `<option value="${id}" ${this.filters.volunteer === id ? 'selected' : ''}>${this._escapeHtml(name)}</option>`
                            ).join('')}
                        </select>` : ''}

                        <input type="date" id="ih-date-from" class="form-input" value="${this.filters.dateFrom}" placeholder="${t('common.from')}">
                        <input type="date" id="ih-date-to" class="form-input" value="${this.filters.dateTo}" placeholder="${t('common.to')}">
                    </div>

                    <!-- Results -->
                    ${this._renderInteractionList(interactions)}
                </div>
            </div>
        `;

        this.container = container;
        this._attachEventListeners();
        return container;
    }

    _getFilteredInteractions() {
        let interactions = StateManager.getInteractions();

        // Sort chronologically (newest first)
        interactions.sort((a, b) => new Date(b.interactionDate) - new Date(a.interactionDate));

        // Apply filters
        if (this.filters.type) {
            interactions = interactions.filter(i => i.interactionType === this.filters.type);
        }

        if (this.filters.outcome) {
            interactions = interactions.filter(i => i.outcome === this.filters.outcome);
        }

        if (this.filters.volunteer) {
            interactions = interactions.filter(i => i.createdBy === this.filters.volunteer);
        }

        if (this.filters.dateFrom) {
            const from = new Date(this.filters.dateFrom);
            interactions = interactions.filter(i => new Date(i.interactionDate) >= from);
        }

        if (this.filters.dateTo) {
            const to = new Date(this.filters.dateTo);
            to.setHours(23, 59, 59, 999);
            interactions = interactions.filter(i => new Date(i.interactionDate) <= to);
        }

        if (this.filters.search) {
            const term = this.filters.search.toLowerCase().trim();
            interactions = interactions.filter(i => {
                const name = this._getVisitorName(i.visitorId).toLowerCase();
                return name.includes(term);
            });
        }

        return interactions;
    }

    _getWeekStats() {
        const interactions = StateManager.getInteractions();
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const week = interactions.filter(i => new Date(i.interactionDate) >= weekAgo);
        const byType = {};
        week.forEach(i => {
            byType[i.interactionType] = (byType[i.interactionType] || 0) + 1;
        });

        return { total: week.length, byType };
    }

    _renderWeekSummary(stats) {
        if (stats.total === 0) return t('p.noneThisWeek');
        const parts = Object.entries(stats.byType)
            .map(([type, count]) => `${count} ${INTERACTION_TYPE_LABELS[type] || type}`)
            .join(', ');
        return `This week: ${parts}`;
    }

    _renderInteractionList(interactions) {
        if (interactions.length === 0) {
            return `
                <div class="empty-state" style="padding:2rem;">
                    <div class="empty-state-icon">📋</div>
                    <p class="empty-state-text">${t('empty.history')}</p>
                    <p class="empty-state-hint">${t('empty.historyHint')}</p>
                </div>`;
        }

        const start = (this.page - 1) * this.pageSize;
        const pageItems = interactions.slice(start, start + this.pageSize);
        const totalPages = Math.ceil(interactions.length / this.pageSize);

        const machineInfo = StateManager.getMachineInfo();
        const isRoot = machineInfo.machineRole === 'root';

        return `
            <div class="text-secondary" style="margin-bottom:0.75rem; font-size:0.85rem;">
                Showing ${start + 1}-${Math.min(start + this.pageSize, interactions.length)} of ${interactions.length}
            </div>
            <div class="interaction-list">
                ${pageItems.map(i => this._renderInteractionRow(i, isRoot)).join('')}
            </div>
            ${totalPages > 1 ? this._renderPagination(totalPages) : ''}
        `;
    }

    _renderInteractionRow(interaction, isRoot) {
        const visitorName = this._getVisitorName(interaction.visitorId);
        const typeLabel = INTERACTION_TYPE_LABELS[interaction.interactionType] || interaction.interactionType;
        const outcomeLabel = interaction.outcome ? (INTERACTION_OUTCOME_LABELS[interaction.outcome] || interaction.outcome) : '';
        const volunteerName = this._getVolunteerName(interaction.createdBy);

        return `
            <div class="interaction-row">
                <div class="interaction-row-main">
                    <div class="interaction-row-type">${typeLabel}</div>
                    <div class="interaction-row-visitor">
                        <a href="#${ROUTES.VISITOR_VIEW}?id=${interaction.visitorId}" class="interaction-visitor-link">${this._escapeHtml(visitorName)}</a>
                    </div>
                    <div class="interaction-row-date">${formatRelativeTime(interaction.interactionDate)}</div>
                </div>
                <div class="interaction-row-details">
                    ${outcomeLabel ? `<span class="badge badge-sm">${outcomeLabel}</span>` : ''}
                    ${interaction.duration ? `<span class="text-secondary">${interaction.duration}min</span>` : ''}
                    ${interaction.notes ? `<span class="interaction-row-notes">${this._escapeHtml(interaction.notes)}</span>` : ''}
                    ${isRoot && volunteerName ? `<span class="volunteer-tag">${this._escapeHtml(volunteerName)}</span>` : ''}
                </div>
                ${interaction.followUpDate ? `
                    <div class="interaction-row-followup">
                        Follow-up: ${formatDate(interaction.followUpDate)}
                        ${interaction.followUpNotes ? ` - ${this._escapeHtml(interaction.followUpNotes)}` : ''}
                    </div>
                ` : ''}
            </div>`;
    }

    _renderPagination(totalPages) {
        return `
            <div style="display:flex; justify-content:center; gap:1rem; margin-top:1.5rem;">
                <button class="btn btn-secondary btn-sm" id="ih-prev" ${this.page === 1 ? 'disabled' : ''}>${t('common.previous')}</button>
                <span class="text-secondary">Page ${this.page} of ${totalPages}</span>
                <button class="btn btn-secondary btn-sm" id="ih-next" ${this.page === totalPages ? 'disabled' : ''}>${t('common.next')}</button>
            </div>`;
    }

    _getVisitorName(visitorId) {
        const v = VisitorService.getById(visitorId);
        return v ? visitorDisplayName(v) : 'Unknown';
    }

    _getVisitorNameLegacy(visitorId) {
        if (!visitorId) return 'Unknown Visitor';
        if (this._visitorCache.has(visitorId)) return this._visitorCache.get(visitorId);
        try {
            const visitor = VisitorService.getById(visitorId);
            const selfContact = visitor?.contacts?.find(c => c.relationType === 'SELF');
            const name = selfContact?.name || 'Unknown Visitor';
            this._visitorCache.set(visitorId, name);
            return name;
        } catch {
            return 'Unknown Visitor';
        }
    }

    _getVolunteerName(machineId) {
        if (!machineId) return null;
        return StateManager.getMachineName(machineId);
    }

    _attachEventListeners() {
        const debouncedRefresh = debounce(() => this._refresh(), 300);

        const searchInput = this.container.querySelector('#ih-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.search = e.target.value;
                this.page = 1;
                debouncedRefresh();
            });
        }

        ['ih-type', 'ih-outcome', 'ih-volunteer', 'ih-date-from', 'ih-date-to'].forEach(id => {
            const el = this.container.querySelector(`#${id}`);
            if (el) {
                el.addEventListener('change', (e) => {
                    const key = { 'ih-type': 'type', 'ih-outcome': 'outcome', 'ih-volunteer': 'volunteer', 'ih-date-from': 'dateFrom', 'ih-date-to': 'dateTo' }[id];
                    this.filters[key] = e.target.value;
                    this.page = 1;
                    this._refresh();
                });
            }
        });

        const prev = this.container.querySelector('#ih-prev');
        if (prev) prev.addEventListener('click', () => { if (this.page > 1) { this.page--; this._refresh(); } });

        const next = this.container.querySelector('#ih-next');
        if (next) next.addEventListener('click', () => { this.page++; this._refresh(); });
    }

    _refresh() {
        this._visitorCache.clear();
        const parent = this.container?.parentNode;
        if (parent) {
            const focusedId = document.activeElement?.id;
            const newEl = this.render();
            parent.replaceChild(newEl, this.container);
            if (focusedId) {
                const el = newEl.querySelector(`#${focusedId}`);
                if (el) {
                    el.focus();
                    if (el.type === 'text') el.setSelectionRange(el.value.length, el.value.length);
                }
            }
        }
    }

    _escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
