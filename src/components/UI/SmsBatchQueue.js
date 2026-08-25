// SmsBatchQueue — bulk SMS sending UI for birthday / anniversary greetings.
//
// Native mode only: requires Capacitor + SEND_SMS permission. The caller
// should check SmsService.checkCapability() first and gate the entry button
// accordingly. This modal owns the permission-grant flow as a first step.
//
// State is persisted to localStorage so a WebView kill mid-batch lets us
// report what was actually sent (anything past `sentIndex - 1`) on resume.

import SmsService from '../../services/SmsService.js';
import { t } from '../../utils/i18n.js';
import { InteractionLogger } from './InteractionLogger.js';
import { Toast } from './Toast.js';
import { normalizePhone } from '../../utils/formatters.js';

const QUEUE_STORAGE_KEY = 'NGOApp_SmsBatchQueue';

export class SmsBatchQueue {

    /**
     * Launch the SMS batch send modal.
     * @param {Array} items - [{visitorId, reminderId, contactName, phone, eventType}]
     * @param {Function} [onComplete] - called when modal closes
     */
    static async start(items, onComplete) {
        const queue = items.filter(item => !!normalizePhone(item.phone));

        if (queue.length === 0) {
            Toast.show('No contacts with valid phone numbers to send SMS', 'warning');
            return;
        }

        SmsBatchQueue._render({
            items: queue,
            phase: 'intro',
            sent: 0,
            failed: 0,
            currentIndex: -1,
            cancelled: false,
            errors: [],
            permissionRequestCount: 0
        }, onComplete);
    }

    /**
     * Check for and resume a queue that was interrupted (cold-start recovery).
     * Currently a stub — native SMS sends are atomic per call, so a kill
     * mid-batch means some sends went through and some didn't, but each
     * successful send already logged its Interaction in real time.
     */
    static tryResume() {
        try {
            const data = localStorage.getItem(QUEUE_STORAGE_KEY);
            if (!data) return false;
            // Stale state — clear and report.
            const state = JSON.parse(data);
            const age = Date.now() - (state.startedAt || 0);
            if (age > 30 * 60 * 1000) {
                localStorage.removeItem(QUEUE_STORAGE_KEY);
                return false;
            }
            // Could resume here in future; for now just clear.
            localStorage.removeItem(QUEUE_STORAGE_KEY);
            return false;
        } catch (e) {
            return false;
        }
    }

    static _persist(state) {
        try {
            localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify({
                startedAt: Date.now(),
                sent: state.sent,
                failed: state.failed,
                total: state.items.length
            }));
        } catch (e) { /* ignore */ }
    }

    static _clearPersisted() {
        try { localStorage.removeItem(QUEUE_STORAGE_KEY); } catch (e) { /* ignore */ }
    }

    static _render(state, onComplete) {
        const existing = document.querySelector('.sms-batch-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'sms-batch-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        const close = () => {
            SmsBatchQueue._clearPersisted();
            overlay.remove();
            document.body.style.overflow = '';
            if (onComplete) onComplete(state);
        };

        const rerender = (newState) => {
            Object.assign(state, newState);
            SmsBatchQueue._draw(overlay, state, { close, rerender, startSending: () => SmsBatchQueue._startSending(state, overlay, rerender, close) });
        };

        SmsBatchQueue._draw(overlay, state, {
            close,
            rerender,
            startSending: () => SmsBatchQueue._startSending(state, overlay, rerender, close)
        });
    }

    static _draw(overlay, state, handlers) {
        const { items, phase } = state;
        const total = items.length;

        if (phase === 'intro') {
            overlay.innerHTML = SmsBatchQueue._renderIntro(total);
            overlay.querySelector('#sms-cancel').addEventListener('click', handlers.close);
            overlay.querySelector('#sms-start').addEventListener('click', handlers.startSending);
            return;
        }

        if (phase === 'permission_denied') {
            const secondDeny = (state.permissionRequestCount || 0) >= 2;
            overlay.innerHTML = SmsBatchQueue._renderPermissionDenied(secondDeny);
            overlay.querySelector('#sms-close').addEventListener('click', handlers.close);
            const retryBtn = overlay.querySelector('#sms-retry');
            if (retryBtn) retryBtn.addEventListener('click', handlers.startSending);
            return;
        }

        if (phase === 'sending') {
            overlay.innerHTML = SmsBatchQueue._renderSending(state);
            const cancelBtn = overlay.querySelector('#sms-cancel-batch');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    state.cancelRequested = true;
                    cancelBtn.disabled = true;
                    cancelBtn.textContent = 'Cancelling…';
                });
            }
            return;
        }

        if (phase === 'done') {
            overlay.innerHTML = SmsBatchQueue._renderSummary(state);
            overlay.querySelector('#sms-close').addEventListener('click', handlers.close);
            return;
        }
    }

    static async _startSending(state, overlay, rerender, close) {
        // Confirm or request permission before the first send.
        const cap = await SmsService.checkCapability();
        if (cap.mode !== SmsService.CAPABILITY.NATIVE) {
            state.permissionRequestCount = (state.permissionRequestCount || 0) + 1;
            const req = await SmsService.requestPermission();
            if (!req.granted) {
                // On a second deny (likely "Don't ask again" was checked), Android
                // won't show the dialog anymore — direct the user to system
                // Settings instead of letting them tap Grant fruitlessly.
                rerender({ phase: 'permission_denied' });
                return;
            }
        }

        rerender({ phase: 'sending', currentIndex: 0, sent: 0, failed: 0, errors: [], logWarnings: [] });

        const result = await SmsService.sendBulkNative(state.items, {
            onProgress: (p) => {
                if (p.status === 'sending') {
                    state.currentIndex = p.index;
                } else if (p.status === 'sent') {
                    state.sent++;
                } else if (p.status === 'failed') {
                    state.failed++;
                    state.errors.push({ index: p.index, name: p.item?.contactName, error: p.error });
                }
                SmsBatchQueue._persist(state);
                // Repaint the sending UI in place (cheaper than full rerender).
                const sendingEl = overlay.querySelector('.sms-sending-area');
                if (sendingEl) {
                    sendingEl.innerHTML = SmsBatchQueue._renderSendingInner(state);
                }
            },
            shouldCancel: () => !!state.cancelRequested
        });

        state.permissionRevoked = !!result.permissionRevoked;
        state.logWarnings = result.logWarnings || [];
        rerender({ phase: 'done' });
    }

    // ── Render helpers ────────────────────────────────────────────────

    static _renderIntro(total) {
        return `
            <div class="sms-batch-modal">
                <div class="sms-header">
                    <h3>📱 Send SMS Greetings</h3>
                </div>
                <div class="sms-body">
                    <p class="sms-lead">
                        ${t('bulk.aboutToSendN', { n: total })}
                    </p>
                    <ul class="sms-disclaimer">
                        <li>${t('bulk.sentFromSim')} <strong>your number</strong> using your mobile plan.</li>
                        <li>Standard SMS charges from your carrier apply.</li>
                        <li>Sending paces at ~1 message every 1.5 seconds (≈${Math.ceil(total * 1.5)}s total).</li>
                        <li>You can cancel at any time. Already-sent messages can't be unsent.</li>
                    </ul>
                </div>
                <div class="sms-footer">
                    <button class="btn btn-secondary" id="sms-cancel">${t('action.cancel')}</button>
                    <button class="btn btn-primary" id="sms-start" style="flex:1;">${t('bulk.start')}</button>
                </div>
            </div>
        `;
    }

    static _renderPermissionDenied(secondDeny = false) {
        if (secondDeny) {
            // After the second deny, Android typically suppresses the system dialog
            // (the "Don't ask again" path). Re-tapping a Grant button accomplishes
            // nothing — route the user to the system app settings instead.
            return `
                <div class="sms-batch-modal">
                    <div class="sms-header">
                        <h3>${t('bulk.permBlocked')}</h3>
                    </div>
                    <div class="sms-body">
                        <p class="sms-lead">
                            Android is no longer showing the permission dialog for this app.
                        </p>
                        <p style="color: var(--color-text-secondary); font-size: 0.9rem;">
                            To enable bulk SMS, open your phone's <strong>Settings → Apps → Dnyani Mitr → Permissions → SMS</strong> and turn it on.
                        </p>
                        <p style="color: var(--color-text-secondary); font-size: 0.9rem; margin-top: 0.5rem;">
                            ${t('bulk.perContactAlways')}
                        </p>
                    </div>
                    <div class="sms-footer">
                        <button class="btn btn-primary" id="sms-close" style="flex:1;">${t('bulk.gotIt')}</button>
                    </div>
                </div>
            `;
        }
        return `
            <div class="sms-batch-modal">
                <div class="sms-header">
                    <h3>${t('bulk.permNeeded')}</h3>
                </div>
                <div class="sms-body">
                    <p class="sms-lead">
                        Sending SMS in bulk needs Android's <strong>${t('bulk.sendSms')}</strong> permission.
                    </p>
                    <p style="color: var(--color-text-secondary); font-size: 0.9rem;">
                        Without it, you can still tap the <span style="white-space:nowrap;">📱 button</span>
                        on each reminder to open your SMS app one at a time.
                    </p>
                </div>
                <div class="sms-footer">
                    <button class="btn btn-secondary" id="sms-close">${t('bulk.usePerContact')}</button>
                    <button class="btn btn-primary" id="sms-retry" style="flex:1;">${t('bulk.grant')}</button>
                </div>
            </div>
        `;
    }

    static _renderSending(state) {
        return `
            <div class="sms-batch-modal">
                <div class="sms-header">
                    <h3>Sending SMS…</h3>
                </div>
                <div class="sms-progress-bar">
                    <div class="sms-progress-fill" id="sms-progress-fill" style="width: 0%"></div>
                </div>
                <div class="sms-body sms-sending-area">
                    ${SmsBatchQueue._renderSendingInner(state)}
                </div>
                <div class="sms-footer">
                    <button class="btn btn-secondary" id="sms-cancel-batch">${t('action.cancel')}</button>
                </div>
            </div>
        `;
    }

    static _renderSendingInner(state) {
        const { items, currentIndex, sent, failed } = state;
        const total = items.length;
        const done = sent + failed;
        const pct = Math.round((done / total) * 100);
        const current = items[currentIndex] || null;

        // Update the progress fill if it exists.
        setTimeout(() => {
            const fill = document.getElementById('sms-progress-fill');
            if (fill) fill.style.width = `${pct}%`;
        }, 0);

        return `
            <div class="sms-status">
                <span class="sms-status-num">${done}</span>
                <span class="sms-status-label">of ${total} processed</span>
            </div>
            ${current ? `
                <div class="sms-current-row">
                    <span class="sms-current-spinner">⏳</span>
                    <div>
                        <div class="sms-current-name">${SmsBatchQueue._escape(current.contactName)}</div>
                        <div class="sms-current-detail">${current.eventType || ''} · ${SmsBatchQueue._escape(current.phone)}</div>
                    </div>
                </div>
            ` : ''}
            <div class="sms-counts">
                <span class="sms-count-sent">✓ ${sent} sent</span>
                <span class="sms-count-failed">✗ ${failed} failed</span>
                <span class="sms-count-remaining">⌛ ${total - done} remaining</span>
            </div>
        `;
    }

    static _renderSummary(state) {
        const { items, sent, failed, errors, permissionRevoked, logWarnings = [] } = state;
        const total = items.length;

        return `
            <div class="sms-batch-modal">
                <div class="sms-header">
                    <h3>${sent === total ? '✅ All Sent' : sent > 0 ? '✓ Done' : 'Done'}</h3>
                </div>
                <div class="sms-body" style="text-align:center;">
                    <div class="sms-summary-stats">
                        <div class="sms-stat sms-stat-sent">
                            <div class="sms-stat-num">${sent}</div>
                            <div class="sms-stat-label">${t('common.sent')}</div>
                        </div>
                        <div class="sms-stat sms-stat-failed">
                            <div class="sms-stat-num">${failed}</div>
                            <div class="sms-stat-label">${t('common.failed')}</div>
                        </div>
                        <div class="sms-stat sms-stat-total">
                            <div class="sms-stat-num">${total}</div>
                            <div class="sms-stat-label">${t('common.total')}</div>
                        </div>
                    </div>
                    ${sent > 0 && logWarnings.length === 0 ? `<p style="color:#16a34a; margin-top:1rem; font-size:0.9rem;">Sent messages logged as interactions.</p>` : ''}
                    ${logWarnings.length > 0 ? `<p style="color:#b45309; margin-top:0.75rem; font-size:0.9rem;">⚠️ ${logWarnings.length} message${logWarnings.length === 1 ? ' was' : 's were'} sent but couldn't be recorded locally. The SMS reached the recipient — the timeline entry didn't save.</p>` : ''}
                    ${permissionRevoked ? `<p style="color:#dc2626; margin-top:0.5rem; font-size:0.9rem;">SMS permission was revoked partway. Grant it again to continue.</p>` : ''}
                    ${errors.length > 0 ? `
                        <details class="sms-error-details">
                            <summary>${errors.length} error${errors.length === 1 ? '' : 's'} — tap to view</summary>
                            <ul class="sms-error-list">
                                ${errors.map(e => `<li><strong>${SmsBatchQueue._escape(e.name || 'Unknown')}:</strong> ${SmsBatchQueue._escape(e.error || 'Unknown error')}</li>`).join('')}
                            </ul>
                        </details>
                    ` : ''}
                </div>
                <div class="sms-footer" style="justify-content:center;">
                    <button class="btn btn-primary" id="sms-close">${t('bulk.done')}</button>
                </div>
            </div>
        `;
    }

    static _escape(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}
