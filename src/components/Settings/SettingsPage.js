// Settings Page Component

import StateManager from '../../core/state.js';
import ActivationManager from '../../core/activation.js';
import { Toast } from '../UI/Toast.js';
import { APP_VERSION, APP_NAME, DEFAULT_SETTINGS } from '../../utils/constants.js';

export class SettingsPage {
  constructor() {
    this.container = null;
    this.settings = { ...DEFAULT_SETTINGS, ...StateManager.getSettings() };
  }

  render() {
    const machineInfo = ActivationManager.getMachineInfo() || {};
    const lookahead = Math.max(1, Math.min(90, this.settings.reminderLookahead || 7));
    const backupDays = Math.max(1, Math.min(30, this.settings.autoBackupDays || 7));

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
    `;

    this.attachEventListeners();
    return this.container;
  }

  attachEventListeners() {
    this.container.querySelector('#save-settings-btn').addEventListener('click', () => {
      const lookahead = parseInt(this.container.querySelector('#reminder-lookahead').value, 10);
      const backupDays = parseInt(this.container.querySelector('#auto-backup-days').value, 10);

      if (isNaN(lookahead) || lookahead < 1 || lookahead > 90) {
        Toast.show('Reminder lookahead must be between 1 and 90 days', 'error');
        return;
      }
      if (isNaN(backupDays) || backupDays < 1 || backupDays > 30) {
        Toast.show('Backup reminder interval must be between 1 and 30 days', 'error');
        return;
      }

      StateManager.updateSettings({
        reminderLookahead: lookahead,
        autoBackupDays: backupDays
      });

      Toast.show('Settings saved', 'success');
    });
  }
}
