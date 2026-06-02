// Settings Page Component

import StateManager from '../../core/state.js';
import StorageManager from '../../core/storage.js';
import ActivationManager from '../../core/activation.js';
import { Toast } from '../UI/Toast.js';
import { APP_VERSION, APP_NAME, ORGANIZATION, DEFAULT_SETTINGS, DEFAULT_MESSAGE_TEMPLATES } from '../../utils/constants.js';
import SmsService from '../../services/SmsService.js';
import { InteractionLogger } from '../UI/InteractionLogger.js';
import { OccasionManager } from '../Campaigns/OccasionManager.js';
import NotificationService from '../../services/NotificationService.js';
import { normalizePhone, formatDateShort } from '../../utils/formatters.js';

export class SettingsPage {
  constructor() {
    this.container = null;
    this.settings = { ...DEFAULT_SETTINGS, ...StateManager.getSettings() };
  }

  render() {
    const machineInfo = ActivationManager.getMachineInfo() || {};
    const lookahead = Math.max(1, Math.min(90, this.settings.reminderLookahead || 7));
    const backupDays = Math.max(1, Math.min(30, this.settings.autoBackupDays || 7));
    const lapseThreshold = Math.max(7, Math.min(365, this.settings.lapseThresholdDays || 60));
    const orgName = this.settings.organizationName || ORGANIZATION;
    const templates = this.settings.messageTemplates || DEFAULT_MESSAGE_TEMPLATES;

    this.container = document.createElement('div');
    this.container.className = 'settings-page';
    this.container.innerHTML = `
      <div class="settings-grid">
        <div>
          <div class="card">
            <div class="card-header">
              <h2 class="card-title">Preferences</h2>
            </div>
            <div class="card-body">
              <div class="setting-item">
                <label for="org-name">Organization Name</label>
                <input type="text" id="org-name" class="form-input"
                  value="${this.escapeHtml(orgName)}" placeholder="Your NGO name" />
                <div class="setting-help">Used in message templates as {org}. Appears in WhatsApp/SMS greetings.</div>
              </div>

              <div class="setting-item">
                <label for="reminder-lookahead">Reminder Lookahead (days)</label>
                <input type="number" id="reminder-lookahead" class="form-input"
                  min="1" max="90" value="${lookahead}" />
                <div class="setting-help">How many days ahead to show upcoming reminders (1–90)</div>
              </div>

              <div class="setting-item">
                <label for="auto-backup-days">Backup Reminder Interval (days)</label>
                <input type="number" id="auto-backup-days" class="form-input"
                  min="1" max="30" value="${backupDays}" />
                <div class="setting-help">Remind to export data backup after this many days (1–30)</div>
              </div>

              <div class="setting-item">
                <label for="lapse-threshold">Lapse Threshold (days)</label>
                <input type="number" id="lapse-threshold" class="form-input"
                  min="7" max="365" value="${lapseThreshold}" />
                <div class="setting-help">Mark visitors as "needs attention" if no contact for this many days (7–365)</div>
              </div>

              <div class="setting-item">
                <label for="tagline-mr">Campaign sign-off (Marathi tagline)</label>
                <input type="text" id="tagline-mr" class="form-input"
                  value="${this.escapeHtml(this.settings.taglineMr || '')}" placeholder="चला जरा वेगळे जगुया ..." />
                <div class="setting-help">Appended to campaign greetings/invitations as {tagline}.</div>
              </div>

              <div class="setting-item">
                <label for="default-campaign-lang">Default campaign language</label>
                <select id="default-campaign-lang" class="form-select">
                  <option value="mr" ${this.settings.defaultCampaignLanguage === 'mr' ? 'selected' : ''}>मराठी (Marathi)</option>
                  <option value="en" ${this.settings.defaultCampaignLanguage === 'en' ? 'selected' : ''}>English</option>
                </select>
              </div>

              <div style="margin-top: 1.5rem;">
                <button id="save-settings-btn" class="btn btn-primary">Save Settings</button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div class="card">
            <div class="card-header">
              <h2 class="card-title">Machine Information</h2>
            </div>
            <div class="card-body">
              <table class="machine-info-table">
                <tr>
                  <td>Machine Name</td>
                  <td>${this.escapeHtml(machineInfo.machineName || '—')}</td>
                </tr>
                <tr>
                  <td>Role</td>
                  <td>${machineInfo.machineRole === 'root' ? 'Root (Data Aggregator)' : 'Satellite (Field Collection)'}</td>
                </tr>
                <tr>
                  <td>Machine ID</td>
                  <td><code style="font-size: 0.8rem;">${this.escapeHtml(machineInfo.machineId || '—')}</code></td>
                </tr>
                <tr>
                  <td>Activated</td>
                  <td>${machineInfo.activatedAt ? new Date(machineInfo.activatedAt).toLocaleDateString() : '—'}</td>
                </tr>
              </table>
            </div>
          </div>

          <div class="card" style="margin-top: 1.5rem;">
            <div class="card-header">
              <h2 class="card-title">About</h2>
            </div>
            <div class="card-body">
              <p><strong>${APP_NAME}</strong></p>
              <p>Version ${APP_VERSION}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top: 1.5rem;">
        <div class="card-header">
          <h2 class="card-title">Message Templates</h2>
        </div>
        <div class="card-body">
          <p class="text-secondary" style="margin-bottom: 1rem;">
            Templates for WhatsApp / SMS greetings. Available variables:<br/>
            <code>{name}</code> = contact name,
            <code>{org}</code> = organization name (from above),
            <code>{volunteer}</code> = current machine name
          </p>

          ${Object.entries({
            birthday: 'Birthday Wish',
            anniversary: 'Anniversary Wish',
            deathAnniversary: 'Death Anniversary',
            followUp: 'Follow-up',
            thankYou: 'Thank You'
          }).map(([key, label]) => `
            <div class="setting-item">
              <label for="tpl-${key}">${label}</label>
              <textarea id="tpl-${key}" class="form-textarea" rows="2">${this.escapeHtml(templates[key] || '')}</textarea>
            </div>
          `).join('')}

          <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
            <button id="save-templates-btn" class="btn btn-primary">Save Templates</button>
            <button id="reset-templates-btn" class="btn btn-secondary">Reset to Defaults</button>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top: 1.5rem;">
        <div class="card-header">
          <h2 class="card-title">📱 SMS Sending</h2>
        </div>
        <div class="card-body">
          <p class="text-secondary" style="margin-bottom: 0.75rem;">
            Bulk SMS sends from your phone's SIM at ~1 message every 1.5 seconds.
            Standard SMS charges from your carrier apply.
            Per-contact 📱 buttons always work and open your system SMS app — no permission needed.
          </p>
          <div id="sms-permission-status" class="sms-perm-row" style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; padding: 0.75rem; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 0.5rem;">
            <span id="sms-perm-state" style="font-weight: 600;">Checking…</span>
            <div style="flex: 1;"></div>
            <button id="sms-perm-request-btn" class="btn btn-primary btn-sm" style="display:none;">Grant SMS permission</button>
            <span id="sms-perm-note" class="text-secondary" style="font-size: 0.85rem;"></span>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top: 1.5rem;">
        <div class="card-header">
          <h2 class="card-title">🔔 Notifications</h2>
        </div>
        <div class="card-body">
          <p class="text-secondary" style="margin-bottom: 0.75rem;">
            Local reminders on this device (works offline). A daily digest of due reminders plus a nudge before upcoming occasions. Available in the Android app.
          </p>
          <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
            <input type="checkbox" id="notif-enabled" ${this.settings.notificationsEnabled ? 'checked' : ''}/> Enable daily notifications
          </label>
          <div class="setting-item" style="margin-top:0.75rem;">
            <label for="notif-time">Daily time</label>
            <input type="time" id="notif-time" class="form-input" value="${this.escapeHtml(this.settings.notificationDigestTime || '09:00')}" style="max-width:160px;" />
          </div>
          <button id="notif-save" class="btn btn-primary btn-sm" style="margin-top:0.5rem;">Save &amp; apply</button>
          <div id="notif-status" class="setting-help"></div>
        </div>
      </div>

      <div id="occasion-manager-mount"></div>

      ${this._renderDiagnosticPanel()}
    `;

    this.attachEventListeners();

    // Mount the Occasion manager (separate component) into its placeholder.
    const occMount = this.container.querySelector('#occasion-manager-mount');
    if (occMount) occMount.appendChild(new OccasionManager().render());

    return this.container;
  }

  attachEventListeners() {
    this.container.querySelector('#save-settings-btn').addEventListener('click', () => {
      const orgNameVal = this.container.querySelector('#org-name').value.trim();
      const lookahead = parseInt(this.container.querySelector('#reminder-lookahead').value, 10);
      const backupDays = parseInt(this.container.querySelector('#auto-backup-days').value, 10);
      const lapseThreshold = parseInt(this.container.querySelector('#lapse-threshold').value, 10);

      if (!orgNameVal) {
        Toast.show('Organization name is required', 'error');
        return;
      }
      if (isNaN(lookahead) || lookahead < 1 || lookahead > 90) {
        Toast.show('Reminder lookahead must be between 1 and 90 days', 'error');
        return;
      }
      if (isNaN(backupDays) || backupDays < 1 || backupDays > 30) {
        Toast.show('Backup reminder interval must be between 1 and 30 days', 'error');
        return;
      }
      if (isNaN(lapseThreshold) || lapseThreshold < 7 || lapseThreshold > 365) {
        Toast.show('Lapse threshold must be between 7 and 365 days', 'error');
        return;
      }

      StateManager.updateSettings({
        organizationName: orgNameVal,
        reminderLookahead: lookahead,
        autoBackupDays: backupDays,
        lapseThresholdDays: lapseThreshold,
        taglineMr: this.container.querySelector('#tagline-mr').value.trim(),
        defaultCampaignLanguage: this.container.querySelector('#default-campaign-lang').value
      });

      Toast.show('Settings saved', 'success');
    });

    // Message template save
    const saveTemplatesBtn = this.container.querySelector('#save-templates-btn');
    if (saveTemplatesBtn) {
      saveTemplatesBtn.addEventListener('click', () => {
        const templates = {};
        ['birthday', 'anniversary', 'deathAnniversary', 'followUp', 'thankYou'].forEach(key => {
          const el = this.container.querySelector(`#tpl-${key}`);
          if (el) templates[key] = el.value;
        });
        StateManager.updateSettings({ messageTemplates: templates });
        Toast.show('Templates saved', 'success');
      });
    }

    // Reset templates
    const resetBtn = this.container.querySelector('#reset-templates-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        ['birthday', 'anniversary', 'deathAnniversary', 'followUp', 'thankYou'].forEach(key => {
          const el = this.container.querySelector(`#tpl-${key}`);
          if (el) el.value = DEFAULT_MESSAGE_TEMPLATES[key] || '';
        });
        Toast.show('Templates reset to defaults (not saved yet)', 'warning');
      });
    }

    // SMS permission status + request
    this._wireSmsPermissionPanel();

    // App Health diagnostic panel (Iter 9.1 E)
    this._wireDiagnosticPanel();

    // Notifications (Iter 10 D) — save setting + (re)schedule on device.
    const notifSave = this.container.querySelector('#notif-save');
    if (notifSave) {
      notifSave.addEventListener('click', async () => {
        const enabled = this.container.querySelector('#notif-enabled').checked;
        const time = this.container.querySelector('#notif-time').value || '09:00';
        StateManager.updateSettings({ notificationsEnabled: enabled, notificationDigestTime: time });
        const statusEl = this.container.querySelector('#notif-status');
        if (!NotificationService.isAvailable()) {
          if (statusEl) statusEl.textContent = 'Notifications run in the Android app — saved; they will apply on the device.';
          Toast.show('Saved. Notifications apply in the Android app.', 'info');
          return;
        }
        const res = await NotificationService.sync({ ...StateManager.getSettings() });
        if (res.reason === 'denied') {
          Toast.show('Notification permission was denied.', 'warning');
        } else {
          Toast.show(enabled ? `Notifications scheduled (${res.scheduled}).` : 'Notifications turned off.', 'success');
        }
      });
    }
  }

  /**
   * App Health: one-screen self-check for volunteers + field debugging.
   * Read-only state summary + three test buttons that exercise the actual
   * comm paths. Designed so a volunteer can screenshot this panel when
   * reporting "WhatsApp doesn't work on my phone" and the screenshot gives
   * a deterministic signal instead of a vague complaint.
   */
  _renderDiagnosticPanel() {
    const machineInfo = ActivationManager.getMachineInfo() || {};
    const storage = StorageManager.getStorageInfo() || { sizeKB: '?', totalSize: 0 };
    const visitorCount = StateManager.getVisitors().filter(v => !v.deletedAt).length;
    const interactionCount = StateManager.getInteractions().length;
    const knownMachines = StateManager.getKnownMachines();
    const knownCount = Object.keys(knownMachines).length;
    const syncLog = StateManager.getSyncLog();
    const lastSync = syncLog[0] || null;
    const lastSyncStr = lastSync
      ? `${lastSync.direction || 'sync'} ${lastSync.machineName ? `with ${this.escapeHtml(lastSync.machineName)}` : ''} on ${formatDateShort(lastSync.timestamp)}`
      : 'No sync yet';
    const platform = this._detectPlatform();

    // 5 MB is the conservative localStorage browser cap. Warn at 80%.
    const quotaWarn = storage.totalSize > 4 * 1024 * 1024;

    return `
      <div class="card" style="margin-top: 1.5rem;">
        <div class="card-header">
          <h2 class="card-title">🩺 App Health</h2>
        </div>
        <div class="card-body">
          <p class="text-secondary" style="margin-bottom: 1rem;">
            Snapshot of what this device knows about itself. Screenshot this panel when reporting an issue — it tells us exactly what's working and what isn't.
          </p>

          <table class="machine-info-table" style="width: 100%; margin-bottom: 1rem;">
            <tr><td>Platform</td><td>${platform.label}</td></tr>
            <tr><td>App version</td><td>${APP_VERSION}</td></tr>
            <tr><td>Machine</td><td>${this.escapeHtml(machineInfo.machineName || '—')} (${machineInfo.machineRole === 'root' ? 'Root' : 'Satellite'})</td></tr>
            <tr><td>Visitors</td><td>${visitorCount}</td></tr>
            <tr><td>Interactions</td><td>${interactionCount}</td></tr>
            <tr><td>Known machines</td><td>${knownCount}</td></tr>
            <tr><td>Last sync</td><td>${lastSyncStr}</td></tr>
            <tr><td>Storage used</td><td><span ${quotaWarn ? 'style="color: #dc2626; font-weight: 600;"' : ''}>${storage.sizeKB} KB${quotaWarn ? ' ⚠️ approaching browser limit' : ''}</span></td></tr>
            <tr><td>SMS permission</td><td><span id="diag-sms-perm">Checking…</span></td></tr>
          </table>

          <h4 style="margin: 0 0 0.5rem 0; font-size: 0.95rem;">Test communication paths</h4>
          <p class="text-secondary" style="font-size: 0.85rem; margin-bottom: 0.75rem;">
            Enter your own mobile number to test that each path actually reaches your phone. Useful before running a real batch.
          </p>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; margin-bottom: 0.5rem;">
            <input type="tel" id="diag-test-phone" class="form-input" placeholder="Your 10-digit mobile" inputmode="numeric" autocomplete="tel" style="flex: 1; min-width: 180px;" />
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button id="diag-test-whatsapp" class="btn btn-sm" style="background: #25d366; color: white; border: none;">💬 Test WhatsApp link</button>
            <button id="diag-test-sms-protocol" class="btn btn-secondary btn-sm">📱 Test SMS app</button>
            <button id="diag-test-sms-native" class="btn btn-primary btn-sm" style="background: #0ea5e9; border-color: #0ea5e9;">📡 Send 1 test SMS now</button>
          </div>
          <p class="text-secondary" style="font-size: 0.8rem; margin-top: 0.5rem;">
            "Test WhatsApp link" and "Test SMS app" open external apps without sending — you just close them. "Send 1 test SMS now" actually dispatches one SMS through SmsManager to verify the bulk path works. Standard SMS charge applies (one message).
          </p>
        </div>
      </div>
    `;
  }

  _detectPlatform() {
    const isCapacitor = !!(typeof window !== 'undefined'
      && window.Capacitor
      && typeof window.Capacitor.isNativePlatform === 'function'
      && window.Capacitor.isNativePlatform());
    if (isCapacitor) return { label: '✅ Android (Capacitor APK)', mode: 'capacitor' };
    const ua = navigator.userAgent || '';
    if (/Android/i.test(ua)) return { label: '🌐 Android browser (no native SMS)', mode: 'android-web' };
    if (/iPhone|iPad/i.test(ua)) return { label: '🌐 iOS browser (no native SMS)', mode: 'ios-web' };
    return { label: '🖥 Desktop browser (no native SMS)', mode: 'desktop' };
  }

  async _wireDiagnosticPanel() {
    // Live SMS permission badge (mirrors the dedicated panel above)
    const permBadge = this.container.querySelector('#diag-sms-perm');
    if (permBadge) {
      const cap = await SmsService.checkCapability();
      if (cap.mode === SmsService.CAPABILITY.NATIVE) {
        permBadge.textContent = '✅ Granted (bulk SMS available)';
      } else if (this._detectPlatform().mode === 'capacitor') {
        permBadge.textContent = '⚠️ Not granted (per-contact SMS still works)';
      } else {
        permBadge.textContent = '— Not applicable on this platform';
      }
    }

    const getTestPhone = () => {
      const raw = this.container.querySelector('#diag-test-phone')?.value || '';
      const phone = normalizePhone(raw);
      if (!phone) {
        Toast.show('Enter a 10-digit mobile number first', 'warning');
        return null;
      }
      return phone;
    };

    this.container.querySelector('#diag-test-whatsapp')?.addEventListener('click', () => {
      const phone = getTestPhone();
      if (!phone) return;
      // Reuses the production code path — same fix as Iter 8. If this opens
      // WhatsApp on the user's device, the deep-link is verified working here.
      InteractionLogger.openExternalUrl(`https://wa.me/91${phone}?text=${encodeURIComponent('App health test — please ignore.')}`);
      Toast.show('Opened WhatsApp. If it landed in the right chat with prefilled text, the deep-link works.', 'info', 5000);
    });

    this.container.querySelector('#diag-test-sms-protocol')?.addEventListener('click', () => {
      const phone = getTestPhone();
      if (!phone) return;
      InteractionLogger._openProtocolLink(`sms:+91${phone}?body=${encodeURIComponent('App health test — please ignore.')}`);
      Toast.show('Opened SMS app. If it has your number + prefilled text, the sms: path works.', 'info', 5000);
    });

    this.container.querySelector('#diag-test-sms-native')?.addEventListener('click', async () => {
      const phone = getTestPhone();
      if (!phone) return;

      const cap = await SmsService.checkCapability();
      if (cap.mode !== SmsService.CAPABILITY.NATIVE) {
        const req = await SmsService.requestPermission();
        if (!req.granted) {
          Toast.show('Permission not granted — bulk SMS unavailable. Per-contact path still works.', 'warning', 4500);
          return;
        }
      }

      const btn = this.container.querySelector('#diag-test-sms-native');
      btn.disabled = true;
      btn.textContent = 'Sending…';
      try {
        const result = await SmsService.sendBulkNative(
          [{ visitorId: null, reminderId: null, contactName: 'Self (test)', phone, eventType: null }],
          { onProgress: () => {} }
        );
        if (result.sent === 1) {
          Toast.show('✅ Test SMS dispatched. Check your inbox — bulk path verified.', 'success', 5000);
        } else if (result.errors[0]) {
          Toast.show(`Test failed: ${result.errors[0].error}`, 'error', 5000);
        } else {
          Toast.show('Test send did not confirm — check your carrier and try again.', 'warning', 5000);
        }
      } catch (e) {
        Toast.show(`Test error: ${e.message || e}`, 'error', 5000);
      } finally {
        btn.disabled = false;
        btn.textContent = '📡 Send 1 test SMS now';
      }
    });
  }

  async _wireSmsPermissionPanel() {
    const stateEl = this.container.querySelector('#sms-perm-state');
    const noteEl = this.container.querySelector('#sms-perm-note');
    const btn = this.container.querySelector('#sms-perm-request-btn');
    if (!stateEl || !btn) return;

    const refresh = async () => {
      const cap = await SmsService.checkCapability();
      const isCapacitor = !!(typeof window !== 'undefined'
        && window.Capacitor
        && typeof window.Capacitor.isNativePlatform === 'function'
        && window.Capacitor.isNativePlatform());

      if (!isCapacitor) {
        stateEl.textContent = '🖥 Bulk SMS unavailable on this device';
        noteEl.textContent = 'Open the Android app to enable bulk SMS sending.';
        btn.style.display = 'none';
        return;
      }
      if (cap.mode === SmsService.CAPABILITY.NATIVE) {
        stateEl.textContent = '✅ Permission granted — bulk SMS ready';
        noteEl.textContent = '';
        btn.style.display = 'none';
      } else {
        stateEl.textContent = '⚠️ Permission not granted';
        noteEl.textContent = cap.reason || '';
        btn.style.display = '';
      }
    };

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const res = await SmsService.requestPermission();
      btn.disabled = false;
      if (res.granted) {
        Toast.show('SMS permission granted', 'success');
      } else {
        Toast.show(res.reason ? `Not granted: ${res.reason}` : 'Permission was denied', 'warning');
      }
      await refresh();
    });

    await refresh();
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
