// My Day Dashboard - Default home screen for daily planning

import ReminderService from '../../services/ReminderService.js';
import VisitorService from '../../services/VisitorService.js';
import InteractionService from '../../services/InteractionService.js';
import EngagementService from '../../services/EngagementService.js';
import ReportService from '../../services/ReportService.js';
import TextSyncService from '../../services/TextSyncService.js';
import StateManager from '../../core/state.js';
import Router, { ROUTES } from '../../core/router.js';
import { formatDateShort, formatRelativeTime, normalizePhone } from '../../utils/formatters.js';
import { INTERACTION_TYPE_LABELS } from '../../utils/constants.js';
import { InteractionLogger } from '../UI/InteractionLogger.js';
import { Toast } from '../UI/Toast.js';
import { downloadFile } from '../../utils/helpers.js';

export class MyDayDashboard {
    constructor() {
        this.container = null;
    }

    render() {
        const container = document.createElement('div');
        container.className = 'my-day-dashboard';

        const todayReminders = this._getTodayReminders();
        const overdueReminders = this._getOverdueReminders();
        const followUps = this._getFollowUpsDue();
        const lapsedData = EngagementService.getLapsedVisitors();
        const weekStats = this._getWeekStats();
        const dataQuality = EngagementService.getDataQualityMetrics();

        container.innerHTML = `
            <div class="dashboard-header">
                <h2>My Day</h2>
                <p class="text-secondary">${this._getGreeting()} &mdash; ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            </div>

            ${this._renderQuickStats(weekStats)}

            ${this._renderTodaySection(todayReminders)}

            ${this._renderOverdueSection(overdueReminders)}

            ${this._renderFollowUpsSection(followUps)}

            ${this._renderNeedsAttentionSection(lapsedData)}

            ${this._renderDataQualitySection(dataQuality)}

            ${this._renderReportsSection()}
        `;

        this.container = container;
        this._attachEventListeners();

        // Recalculate engagement scores in background
        setTimeout(() => EngagementService.recalculateAll(), 100);

        return container;
    }

    _getGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    }

    _getTodayReminders() {
        const grouped = ReminderService.getGroupedReminders(0);
        return grouped.today || [];
    }

    _getOverdueReminders() {
        const grouped = ReminderService.getGroupedReminders(30);
        return grouped.overdue || [];
    }

    _getFollowUpsDue() {
        const interactions = StateManager.getInteractions();
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        return interactions
            .filter(i => i.followUpDate && new Date(i.followUpDate) <= today)
            .sort((a, b) => new Date(a.followUpDate) - new Date(b.followUpDate))
            .slice(0, 10)
            .map(i => {
                const visitor = VisitorService.getById(i.visitorId);
                const selfContact = visitor?.contacts?.find(c => c.relationType === 'SELF');
                return { interaction: i, visitor, visitorName: selfContact?.name || 'Unknown' };
            });
    }

    _getWeekStats() {
        const interactions = StateManager.getInteractions();
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const weekInteractions = interactions.filter(i =>
            new Date(i.interactionDate) >= weekAgo
        );

        const byType = {};
        weekInteractions.forEach(i => {
            byType[i.interactionType] = (byType[i.interactionType] || 0) + 1;
        });

        const reminderActions = StateManager.getReminderActions();
        const weekActions = reminderActions.filter(a =>
            new Date(a.actionAt) >= weekAgo && a.action === 'contacted'
        );

        return {
            contacted: weekInteractions.length,
            remindersCompleted: weekActions.length,
            byType
        };
    }

    _renderQuickStats(stats) {
        const typeBreakdown = Object.entries(stats.byType)
            .map(([type, count]) => `${INTERACTION_TYPE_LABELS[type] || type}: ${count}`)
            .join(' | ');

        return `
            <div class="dashboard-stats-bar">
                <div class="stat-item">
                    <span class="stat-number">${stats.contacted}</span>
                    <span class="stat-label">Contacted this week</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${stats.remindersCompleted}</span>
                    <span class="stat-label">Reminders completed</span>
                </div>
                <div class="stat-item stat-breakdown">
                    <span class="stat-detail">${typeBreakdown || 'No activity yet'}</span>
                </div>
            </div>
        `;
    }

    _renderTodaySection(reminders) {
        if (reminders.length === 0) {
            return `
                <div class="dashboard-card">
                    <div class="dashboard-card-header">
                        <h3>Today</h3>
                        <span class="badge badge-success">All clear</span>
                    </div>
                    <div class="empty-state-compact">No birthdays or anniversaries today.</div>
                </div>`;
        }

        return `
            <div class="dashboard-card dashboard-card-today">
                <div class="dashboard-card-header">
                    <h3>Today</h3>
                    <span class="badge badge-primary">${reminders.length}</span>
                </div>
                <div class="dashboard-card-body">
                    ${reminders.map(r => this._renderReminderRow(r, false)).join('')}
                </div>
            </div>`;
    }

    _renderOverdueSection(reminders) {
        if (reminders.length === 0) return '';

        return `
            <div class="dashboard-card dashboard-card-overdue">
                <div class="dashboard-card-header">
                    <h3>Overdue</h3>
                    <span class="badge badge-danger">${reminders.length}</span>
                </div>
                <div class="dashboard-card-body">
                    ${reminders.slice(0, 10).map(r => this._renderReminderRow(r, true)).join('')}
                    ${reminders.length > 10 ? `<div class="dashboard-more-link"><a href="#${ROUTES.REMINDERS}">View all ${reminders.length} overdue...</a></div>` : ''}
                </div>
            </div>`;
    }

    _renderReminderRow(reminder, isOverdue) {
        const visitor = VisitorService.getById(reminder.visitorId);
        const contact = visitor?.contacts?.find(c => c.id === reminder.contactId);
        const selfContact = visitor?.contacts?.find(c => c.relationType === 'SELF');
        const name = contact?.name || 'Unknown';
        let phone = contact?.phones?.[0];
        if (!phone && selfContact) phone = selfContact.phones?.[0];
        const hasValidPhone = !!normalizePhone(phone);

        const icon = { 'Birthday': '🎂', 'Anniversary': '💍', 'Death': '🕯️' }[reminder.eventType] || '📅';

        return `
            <div class="dashboard-reminder-row ${isOverdue ? 'overdue' : ''}">
                <div class="reminder-row-info">
                    <span class="reminder-icon">${icon}</span>
                    <div>
                        <span class="reminder-name">${this._escapeHtml(name)}</span>
                        <span class="reminder-type">${reminder.eventType}${reminder.relationType !== 'SELF' ? ` (${this._escapeHtml(contact?.relationType || '')})` : ''}</span>
                    </div>
                </div>
                <div class="reminder-row-actions">
                    ${hasValidPhone ? `<button class="btn btn-sm qa-whatsapp" data-action="whatsapp" data-rid="${reminder.id}" data-vid="${visitor?.id}" data-phone="${this._escapeHtml(phone)}" data-name="${this._escapeHtml(name)}" data-event="${reminder.eventType}">💬</button>` : ''}
                    <button class="btn btn-sm qa-called" data-action="called" data-rid="${reminder.id}" data-vid="${visitor?.id}" data-phone="${this._escapeHtml(phone || '')}" data-name="${this._escapeHtml(name)}" data-event="${reminder.eventType}">📞</button>
                    <button class="btn btn-sm btn-secondary view-visitor-btn" data-vid="${visitor?.id}">View</button>
                </div>
            </div>`;
    }

    _renderFollowUpsSection(followUps) {
        if (followUps.length === 0) return '';

        return `
            <div class="dashboard-card dashboard-card-followups">
                <div class="dashboard-card-header">
                    <h3>Follow-ups Due</h3>
                    <span class="badge badge-warning">${followUps.length}</span>
                </div>
                <div class="dashboard-card-body">
                    ${followUps.map(fu => `
                        <div class="dashboard-followup-row">
                            <div class="followup-info">
                                <span class="followup-name">${this._escapeHtml(fu.visitorName)}</span>
                                <span class="followup-notes">${this._escapeHtml(fu.interaction.followUpNotes || fu.interaction.notes || '')}</span>
                                <span class="followup-date">Due: ${formatDateShort(fu.interaction.followUpDate)}</span>
                            </div>
                            <div class="followup-actions">
                                <button class="btn btn-sm btn-primary log-followup-btn" data-vid="${fu.visitor?.id}" data-name="${this._escapeHtml(fu.visitorName)}">Log</button>
                                <button class="btn btn-sm btn-secondary view-visitor-btn" data-vid="${fu.visitor?.id}">View</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>`;
    }

    _renderNeedsAttentionSection(lapsedData) {
        const combined = [
            ...lapsedData.lapsed.slice(0, 5),
            ...lapsedData.neverContacted.slice(0, 3)
        ];

        if (combined.length === 0) return '';

        return `
            <div class="dashboard-card dashboard-card-attention">
                <div class="dashboard-card-header">
                    <h3>Needs Attention</h3>
                    <span class="badge badge-danger">${lapsedData.lapsed.length + lapsedData.neverContacted.length}</span>
                </div>
                <div class="dashboard-card-body">
                    ${lapsedData.lapsed.slice(0, 5).map(item => {
                        const selfContact = item.visitor.contacts?.find(c => c.relationType === 'SELF');
                        const name = selfContact?.name || 'Unknown';
                        const lastType = item.lastInteractionType ? (INTERACTION_TYPE_LABELS[item.lastInteractionType] || item.lastInteractionType) : '';
                        return `
                            <div class="dashboard-lapsed-row">
                                <div class="lapsed-info">
                                    <span class="lapsed-name">${this._escapeHtml(name)}</span>
                                    <span class="lapsed-detail">${item.daysSince} days since last contact${lastType ? ` (${lastType})` : ''}</span>
                                </div>
                                <div class="lapsed-actions">
                                    <button class="btn btn-sm btn-primary log-interaction-btn" data-vid="${item.visitor.id}" data-name="${this._escapeHtml(name)}">Contact</button>
                                    <button class="btn btn-sm btn-secondary view-visitor-btn" data-vid="${item.visitor.id}">View</button>
                                </div>
                            </div>`;
                    }).join('')}
                    ${lapsedData.neverContacted.slice(0, 3).map(item => {
                        const selfContact = item.visitor.contacts?.find(c => c.relationType === 'SELF');
                        const name = selfContact?.name || 'Unknown';
                        return `
                            <div class="dashboard-lapsed-row never-contacted">
                                <div class="lapsed-info">
                                    <span class="lapsed-name">${this._escapeHtml(name)}</span>
                                    <span class="lapsed-detail">Never contacted</span>
                                </div>
                                <div class="lapsed-actions">
                                    <button class="btn btn-sm btn-primary log-interaction-btn" data-vid="${item.visitor.id}" data-name="${this._escapeHtml(name)}">Contact</button>
                                    <button class="btn btn-sm btn-secondary view-visitor-btn" data-vid="${item.visitor.id}">View</button>
                                </div>
                            </div>`;
                    }).join('')}
                    ${(lapsedData.lapsed.length + lapsedData.neverContacted.length) > 8
                        ? `<div class="dashboard-more-link"><a href="#${ROUTES.VISITORS}">View all visitors...</a></div>`
                        : ''}
                </div>
            </div>`;
    }

    _renderDataQualitySection(metrics) {
        if (metrics.totalVisitors === 0) return '';

        return `
            <div class="dashboard-card dashboard-card-quality">
                <div class="dashboard-card-header">
                    <h3>Data Quality</h3>
                </div>
                <div class="dashboard-quality-bars">
                    ${this._renderQualityBar('With Phone', metrics.phonePercent)}
                    ${this._renderQualityBar('With Events', metrics.eventsPercent)}
                    ${metrics.totalInteractions > 0 ? this._renderQualityBar('With Outcome', metrics.outcomePercent) : ''}
                </div>
            </div>`;
    }

    _renderReportsSection() {
        return `
            <div class="dashboard-card dashboard-card-reports">
                <div class="dashboard-card-header">
                    <h3>📊 Reports &amp; Share</h3>
                </div>
                <p class="dashboard-card-subtitle">WhatsApp-friendly summary for your board or group · CSV for spreadsheet analysis</p>
                <div class="dashboard-reports-actions">
                    <button id="report-copy-monthly-btn" class="btn btn-primary btn-sm">💬 Copy Monthly Report</button>
                    <button id="report-share-monthly-btn" class="btn btn-secondary btn-sm">📲 Share Monthly Report</button>
                    <button id="report-download-csv-btn" class="btn btn-secondary btn-sm">📄 Download Visitor CSV</button>
                </div>
                <details class="dashboard-report-preview">
                    <summary>Preview monthly report</summary>
                    <pre id="report-preview-text" class="dashboard-report-pre"></pre>
                </details>
            </div>`;
    }

    _renderQualityBar(label, percent) {
        const color = percent >= 80 ? '#22c55e' : percent >= 50 ? '#f59e0b' : '#ef4444';
        return `
            <div class="quality-bar-row">
                <span class="quality-label">${label}</span>
                <div class="quality-bar-track">
                    <div class="quality-bar-fill" style="width: ${percent}%; background: ${color};"></div>
                </div>
                <span class="quality-percent">${percent}%</span>
            </div>`;
    }

    _attachEventListeners() {
        // Quick action buttons (WhatsApp, Called)
        this.container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const el = e.currentTarget;
                InteractionLogger.quickAction(el.dataset.action, {
                    visitorId: el.dataset.vid,
                    reminderId: el.dataset.rid,
                    contactName: el.dataset.name,
                    phone: el.dataset.phone,
                    eventType: el.dataset.event,
                    onDone: () => this._refresh()
                });
            });
        });

        // View visitor buttons
        this.container.querySelectorAll('.view-visitor-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                Router.navigate(`${ROUTES.VISITOR_VIEW}?id=${e.currentTarget.dataset.vid}`);
            });
        });

        // Log interaction buttons (for lapsed visitors)
        this.container.querySelectorAll('.log-interaction-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                InteractionLogger.showFull({
                    visitorId: e.currentTarget.dataset.vid,
                    visitorName: e.currentTarget.dataset.name,
                    onDone: () => this._refresh()
                });
            });
        });

        // Log follow-up buttons
        this.container.querySelectorAll('.log-followup-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                InteractionLogger.showFull({
                    visitorId: e.currentTarget.dataset.vid,
                    visitorName: e.currentTarget.dataset.name,
                    onDone: () => this._refresh()
                });
            });
        });

        // Populate report preview when details opens
        const previewPre = this.container.querySelector('#report-preview-text');
        if (previewPre) previewPre.textContent = ReportService.generateMonthlyTextReport();

        // Copy monthly report
        this.container.querySelector('#report-copy-monthly-btn')?.addEventListener('click', async () => {
            const text = ReportService.generateMonthlyTextReport();
            const ok = await TextSyncService.copyText(text);
            if (ok) {
                Toast.show('Monthly report copied. Paste into WhatsApp or email.', 'success', 4000);
            } else {
                Toast.show('Could not copy automatically. Use the preview below to select and copy manually.', 'warning', 5000);
            }
        });

        // Share monthly report via native share sheet
        this.container.querySelector('#report-share-monthly-btn')?.addEventListener('click', async () => {
            const text = ReportService.generateMonthlyTextReport();
            const result = await TextSyncService.shareText(text, 'Monthly Report');
            if (result.method === 'share') {
                Toast.show('Share sheet opened.', 'success');
            } else if (result.method === 'clipboard') {
                Toast.show('Share not available — report copied to clipboard.', 'info', 4000);
            } else if (result.method === 'none' && result.error) {
                Toast.show('Could not share: ' + result.error, 'error');
            }
        });

        // Download CSV
        this.container.querySelector('#report-download-csv-btn')?.addEventListener('click', () => {
            const csv = ReportService.generateVisitorCSV();
            const filename = `Visitors_${new Date().toISOString().split('T')[0]}.csv`;
            // Prepend BOM so Excel handles UTF-8 correctly
            downloadFile('\ufeff' + csv, filename);
            Toast.show('CSV downloaded.', 'success');
        });
    }

    _refresh() {
        const parent = this.container?.parentNode;
        if (parent) {
            const newEl = this.render();
            parent.replaceChild(newEl, this.container);
        }
    }

    _escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
