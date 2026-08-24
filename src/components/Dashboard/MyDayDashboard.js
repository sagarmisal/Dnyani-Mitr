// My Day Dashboard - Default home screen for daily planning

import ReminderService from '../../services/ReminderService.js';
import OccasionService from '../../services/OccasionService.js';
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
import { SmsBatchQueue } from '../UI/SmsBatchQueue.js';
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

        container.innerHTML = `
            <div class="dashboard-header">
                <h2>My Day</h2>
                <a class="btn btn-sm btn-link" href="#/calendar">🗓 Open the calendar</a>
                <p class="text-secondary">${this._getGreeting()} &mdash; ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            </div>

            ${this._renderQuickStats(weekStats)}

            ${this._renderOccasionNudge()}

            ${this._renderTodaySection(todayReminders)}

            ${this._renderOverdueSection(overdueReminders)}

            ${this._renderFollowUpsSection(followUps)}

            ${this._renderNeedsAttentionSection(lapsedData)}


            ${this._renderReportsSection()}
        `;

        this.container = container;
        this._attachEventListeners();

        // Occasion nudge CTA → campaign builder preselected for that occasion.
        const occCta = container.querySelector('#dash-occasion-cta');
        if (occCta) {
            occCta.addEventListener('click', () => {
                Router.navigate(`/campaigns/new?occasionId=${encodeURIComponent(occCta.dataset.id)}`);
            });
        }

        // Recalculate engagement scores in background
        setTimeout(() => EngagementService.recalculateAll(), 100);

        return container;
    }

    _renderOccasionNudge() {
        let upcoming = [];
        try { upcoming = OccasionService.upcomingWithin(14); } catch (e) { return ''; }
        if (!upcoming.length) return '';
        const u = upcoming[0];
        const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const when = u.daysUntil === 0 ? 'today' : (u.daysUntil === 1 ? 'tomorrow' : `in ${u.daysUntil} days`);
        const name = esc(u.occasion.nameMr || u.occasion.name);
        return `
            <div class="card" style="margin: 1rem 0; border-left: 4px solid var(--color-primary);">
                <div class="card-body" style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
                    <div style="flex:1; min-width:0;">
                        🎉 <strong>${name}</strong> is ${when}. Send greetings to your beneficiaries in bulk.
                    </div>
                    <button id="dash-occasion-cta" class="btn btn-primary btn-sm" data-id="${esc(u.occasion.id)}">Create campaign</button>
                </div>
            </div>
        `;
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

        // Count reminders that are eligible for bulk SMS (have a valid phone).
        const eligibleCount = this._countSmsEligible(reminders);
        const showSmsBulk = this._isCapacitor() && eligibleCount > 1;

        return `
            <div class="dashboard-card dashboard-card-today">
                <div class="dashboard-card-header">
                    <h3>Today</h3>
                    <span class="badge badge-primary">${reminders.length}</span>
                </div>
                ${showSmsBulk ? `
                    <div style="padding: 0.5rem 1rem 0;">
                        <button id="dashboard-sms-bulk-btn" class="btn btn-sm" style="background: #0ea5e9; border-color: #0ea5e9; color: white; width: 100%;" title="Send SMS to all ${eligibleCount} contacts with phone numbers">
                            📱 Send SMS to all ${eligibleCount}
                        </button>
                    </div>` : ''}
                <div class="dashboard-card-body">
                    ${reminders.map(r => this._renderReminderRow(r, false)).join('')}
                </div>
            </div>`;
    }

    _countSmsEligible(reminders) {
        let count = 0;
        for (const r of reminders) {
            const visitor = VisitorService.getById(r.visitorId);
            const contact = visitor?.contacts?.find(c => c.id === r.contactId);
            const selfContact = visitor?.contacts?.find(c => c.relationType === 'SELF');
            let phone = contact?.phones?.[0];
            if (!phone && selfContact) phone = selfContact.phones?.[0];
            if (normalizePhone(phone)) count++;
        }
        return count;
    }

    _collectSmsItems(reminders) {
        const items = [];
        for (const r of reminders) {
            const visitor = VisitorService.getById(r.visitorId);
            const contact = visitor?.contacts?.find(c => c.id === r.contactId);
            const selfContact = visitor?.contacts?.find(c => c.relationType === 'SELF');
            const name = contact?.name || selfContact?.name || 'Unknown';
            let phone = contact?.phones?.[0];
            if (!phone && selfContact) phone = selfContact.phones?.[0];
            if (!normalizePhone(phone)) continue;
            items.push({
                visitorId: visitor?.id,
                reminderId: r.id,
                contactName: name,
                phone,
                eventType: r.eventType
            });
        }
        return items;
    }

    _isCapacitor() {
        return !!(typeof window !== 'undefined'
            && window.Capacitor
            && typeof window.Capacitor.isNativePlatform === 'function'
            && window.Capacitor.isNativePlatform());
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
                    ${hasValidPhone ? `<button class="btn btn-sm qa-whatsapp" data-action="whatsapp" data-rid="${reminder.id}" data-vid="${visitor?.id}" data-phone="${this._escapeHtml(phone)}" data-name="${this._escapeHtml(name)}" data-event="${reminder.eventType}" title="WhatsApp">💬</button>` : ''}
                    ${hasValidPhone ? `<button class="btn btn-sm qa-sms" data-action="sms" data-rid="${reminder.id}" data-vid="${visitor?.id}" data-phone="${this._escapeHtml(phone)}" data-name="${this._escapeHtml(name)}" data-event="${reminder.eventType}" title="SMS">📱</button>` : ''}
                    <button class="btn btn-sm qa-called" data-action="called" data-rid="${reminder.id}" data-vid="${visitor?.id}" data-phone="${this._escapeHtml(phone || '')}" data-name="${this._escapeHtml(name)}" data-event="${reminder.eventType}" title="Called">📞</button>
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

    // P2.17 — the Data Quality section is gone. It counted missing phone
    // numbers and empty fields: a maintainer's concern wearing a user's
    // clothing, serving none of the six jobs. The metrics themselves survive in
    // EngagementService, where WE can read them via the backup analyzer.


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
        // Bulk SMS button on Today section (Capacitor only)
        const bulkSmsBtn = this.container.querySelector('#dashboard-sms-bulk-btn');
        if (bulkSmsBtn) {
            bulkSmsBtn.addEventListener('click', () => {
                const reminders = this._getTodayReminders();
                const items = this._collectSmsItems(reminders);
                if (items.length === 0) {
                    Toast.show('No contacts with valid phone numbers for today.', 'warning');
                    return;
                }
                SmsBatchQueue.start(items, () => this._refresh());
            });
        }

        // Quick action buttons (WhatsApp, SMS, Called)
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
            downloadFile(csv, filename, 'text/csv;charset=utf-8;');   // BOM added in saveFile (P1.4)
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
