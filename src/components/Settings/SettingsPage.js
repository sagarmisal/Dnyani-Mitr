// Settings Page Component

import StateManager from '../../core/state.js';
import ActivationManager from '../../core/activation.js';
import { Toast } from '../UI/Toast.js';
import { APP_VERSION, APP_NAME, ORGANIZATION, DEFAULT_SETTINGS, DEFAULT_MESSAGE_TEMPLATES } from '../../utils/constants.js';

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
                  <td>${machineInfo.machineName || '—'}</td>
                </tr>
                <tr>
                  <td>Role</td>
                  <td>${machineInfo.machineRole === 'root' ? 'Root (Data Aggregator)' : 'Satellite (Field Collection)'}</td>
                </tr>
                <tr>
                  <td>Machine ID</td>
                  <td><code style="font-size: 0.8rem;">${machineInfo.machineId || '—'}</code></td>
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
    `;

    this.attachEventListeners();
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
        lapseThresholdDays: lapseThreshold
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
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
