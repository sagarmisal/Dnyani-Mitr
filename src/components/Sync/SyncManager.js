import ActivationManager from '../../core/activation.js';
import StateManager from '../../core/state.js';
import VisitorService from '../../services/VisitorService.js';
import SyncService from '../../services/SyncService.js';
import { downloadFile } from '../../utils/helpers.js';

export class SyncManager {
    constructor() {
        this.container = null;
        this.machineInfo = ActivationManager.getMachineInfo();
    }

    /**
     * Render component
     */
    render() {
        const container = document.createElement('div');
        container.className = 'sync-manager';

        const isRoot = this.machineInfo.machineRole === 'root';
        const backupInfo = SyncService.getBackupInfo();

        container.innerHTML = `
      <div class="dashboard-header" style="margin-bottom: 2rem;">
        <h2>Data Management & Sync</h2>
        <p class="text-secondary">Sync data between Root and Satellite machines</p>
      </div>

      <div class="sync-layout" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(400px, 100%), 1fr)); gap: 2rem;">

        <!-- Export Section -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">📤 Export Data</h3>
          </div>
          <div class="card-body">
            <p>${isRoot
                ? 'Export your master contact list for volunteers to import.'
                : 'Export your field data for the coordinator to import.'}</p>

            <div style="background: var(--color-bg); padding: 1.5rem; border-radius: var(--radius-md); margin-bottom: 2rem;">
              <strong>Machine Metadata Attached:</strong>
              <ul style="margin: 0.5rem 0 0 0; font-size: 0.875rem; color: var(--color-text-secondary);">
                <li>Name: ${this.escapeHtml(this.machineInfo.machineName)}</li>
                <li>Role: ${this.machineInfo.machineRole.toUpperCase()}</li>
                <li>ID: <code>${this.machineInfo.machineId}</code></li>
              </ul>
            </div>

            <div class="form-group">
              <label class="form-checkbox">
                <input type="checkbox" id="export-history" checked />
                <span>Include Interaction History</span>
              </label>
              <p style="font-size: 0.75rem; color: var(--color-text-tertiary); margin-top: 0.25rem;">Uncheck for a smaller file (faster WhatsApp transfer)</p>
            </div>

            <button id="export-json-btn" class="btn btn-primary btn-lg" style="width: 100%;">
              Generate Export (.json)
            </button>
          </div>
        </div>

        <!-- Import Section -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">📥 Import / Sync Data</h3>
          </div>
          <div class="card-body">
            <p>${isRoot
                ? 'Import field data from volunteer devices.'
                : 'Import the latest contacts from coordinator.'}</p>

            <div class="import-dropzone" id="import-dropzone" style="border: 2px dashed var(--color-border); border-radius: var(--radius-md); padding: 2rem; text-align: center; cursor: pointer; transition: all 0.2s;">
              <p style="font-size: 1.5rem; margin-bottom: 0.5rem;">📁</p>
              <p>Tap to select a JSON sync file</p>
              <p style="font-size: 0.8rem; color: var(--color-text-tertiary);">Or drag & drop on desktop</p>
              <input type="file" id="import-file-input" style="display: none;" accept=".json,application/json,text/plain,*/*" />
            </div>

            <!-- Paste fallback for Android devices where file picker fails -->
            <details style="margin-top: 1rem;">
              <summary style="cursor: pointer; color: var(--color-primary); font-size: 0.875rem;">File picker not working? Paste JSON data manually</summary>
              <div style="margin-top: 0.75rem;">
                <textarea id="manual-json-input" class="form-textarea" rows="6" placeholder="Paste the contents of the exported JSON file here..."></textarea>
                <button id="manual-import-btn" class="btn btn-primary btn-sm" style="width: 100%; margin-top: 0.5rem;">Load Pasted Data</button>
              </div>
            </details>

            <div id="import-preview" class="hidden" style="margin-top: 2rem;">
              <h4 style="margin-bottom: 1rem;">File Preview</h4>
              <div id="preview-stats" style="font-size: 0.875rem; color: var(--color-text-secondary); margin-bottom: 1.5rem;"></div>

              <div style="display: flex; gap: 0.5rem;">
                <button id="confirm-import-btn" class="btn btn-success" style="flex: 1;">Proceed with Import</button>
                <button id="cancel-import-btn" class="btn btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Restore from Backup Section -->
        <div class="card" id="restore-section" style="grid-column: 1 / -1; ${backupInfo ? '' : 'display: none;'}">
          <div class="card-header">
            <h3 class="card-title">🔄 Restore from Backup</h3>
          </div>
          <div class="card-body">
            <p style="font-size: 0.875rem; color: var(--color-text-secondary);">
              A backup is automatically created before every sync. You can restore your data to the state before the last import.
            </p>
            ${backupInfo ? `
              <p style="font-size: 0.875rem; margin-top: 0.5rem;">
                <strong>Last backup:</strong> ${new Date(backupInfo.createdAt).toLocaleString()}
              </p>
            ` : ''}
            <button id="restore-backup-btn" class="btn btn-secondary" style="margin-top: 1rem;">
              Restore from Last Backup
            </button>
          </div>
        </div>

        <!-- System Stats -->
        <div class="card" style="grid-column: 1 / -1;">
          <div class="card-header">
            <h3 class="card-title">📊 Local Storage Stats</h3>
          </div>
          <div class="card-body">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; text-align: center;">
              <div>
                <div style="font-size: 1.5rem; font-weight: 700;">${VisitorService.getAll().length}</div>
                <div class="text-secondary">Visitors</div>
              </div>
              <div>
                <div style="font-size: 1.5rem; font-weight: 700;">${StateManager.getState().interactions?.length || 0}</div>
                <div class="text-secondary">Interactions</div>
              </div>
              <div>
                <div style="font-size: 1.5rem; font-weight: 700;">${this.calculateStorageSize()} KB</div>
                <div class="text-secondary">Used Space</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

        this.container = container;
        this.attachEventListeners();
        return container;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Export handler — uses SyncService.prepareExport with checkbox value
        this.container.querySelector('#export-json-btn').addEventListener('click', () => {
            const includeInteractions = this.container.querySelector('#export-history').checked;
            const exportPackage = SyncService.prepareExport({ includeInteractions });

            const filename = `NGO_Sync_${this.machineInfo.machineName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
            downloadFile(JSON.stringify(exportPackage, null, 2), filename);
            alert('Export package generated and downloaded! Transfer this file to the other machine for syncing.');
        });

        // Import handlers
        const dropzone = this.container.querySelector('#import-dropzone');
        const fileInput = this.container.querySelector('#import-file-input');

        dropzone.addEventListener('click', () => fileInput.click());

        // Drag and drop (desktop)
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--color-primary)';
            dropzone.style.background = '#f0f7ff';
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.style.borderColor = 'var(--color-border)';
            dropzone.style.background = '';
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--color-border)';
            dropzone.style.background = '';
            const file = e.dataTransfer?.files?.[0];
            if (file) this.handleFileSelection(file);
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.handleFileSelection(file);
        });

        // Manual JSON paste import (Android fallback)
        this.container.querySelector('#manual-import-btn')?.addEventListener('click', () => {
            const textarea = this.container.querySelector('#manual-json-input');
            let text = textarea?.value?.trim();
            if (!text) {
                alert('Please paste JSON data first.');
                return;
            }
            // Remove BOM if present
            if (text.charCodeAt(0) === 0xFEFF) {
                text = text.slice(1);
            }
            try {
                this.pendingImport = JSON.parse(text);
                this.showPreview(this.pendingImport);
            } catch (err) {
                alert('Invalid JSON data. Please check the pasted content.');
            }
        });

        this.container.querySelector('#confirm-import-btn')?.addEventListener('click', () => {
            this.performImport();
        });

        this.container.querySelector('#cancel-import-btn')?.addEventListener('click', () => {
            this.resetImport();
        });

        // Restore from backup handler
        this.container.querySelector('#restore-backup-btn')?.addEventListener('click', () => {
            if (confirm('Are you sure you want to restore from the last backup? This will replace all current data with the backup.')) {
                try {
                    const restoredAt = SyncService.restoreBackup();
                    if (restoredAt) {
                        alert(`Data restored successfully to the state from ${new Date(restoredAt).toLocaleString()}.`);
                        setTimeout(() => {
                            window.location.reload();
                        }, 500);
                    } else {
                        alert('No backup found to restore.');
                    }
                } catch (err) {
                    alert('Restore failed: ' + err.message);
                }
            }
        });
    }

    /**
     * Handle file selection for import
     */
    handleFileSelection(file) {
        if (!file) {
            alert('No file selected.');
            return;
        }

        // Validate file size (max 50MB -- reasonable for sync data)
        if (file.size > 50 * 1024 * 1024) {
            alert('File is too large. Maximum size is 50MB.');
            return;
        }

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                let text = e.target.result;
                if (!text || text.trim().length === 0) {
                    alert('File is empty.');
                    return;
                }
                // Remove BOM (Byte Order Mark) if present — common on Android-exported files
                if (text.charCodeAt(0) === 0xFEFF) {
                    text = text.slice(1);
                }
                this.pendingImport = JSON.parse(text);
                this.showPreview(this.pendingImport);
            } catch (err) {
                alert('Could not read this file as JSON. Make sure it is a valid sync export file.\n\nIf the file picker is not working on your phone, try the "Paste JSON data manually" option below.');
            }
        };

        reader.onerror = () => {
            alert('Failed to read the file. This can happen on some Android devices.\n\nTry the "Paste JSON data manually" option below as an alternative.');
        };

        reader.readAsText(file, 'UTF-8');
    }

    /**
     * Show import preview with source info
     */
    showPreview(pkg) {
        if (!pkg.metadata || !pkg.data) {
            alert('This file does not appear to be a valid NGO Sync package.');
            return;
        }

        const preview = this.container.querySelector('#import-preview');
        const stats = this.container.querySelector('#preview-stats');

        preview.classList.remove('hidden');
        stats.innerHTML = `
      <div style="background: #f8fafc; padding: 1rem; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
        <p><strong>Source:</strong> ${this.escapeHtml(pkg.metadata.machineName)} (${this.escapeHtml(pkg.metadata.machineRole)})</p>
        <p><strong>Exported On:</strong> ${new Date(pkg.metadata.exportedAt).toLocaleString()}</p>
        <hr style="margin: 0.5rem 0; opacity: 0.1;"/>
        <p><strong>Visitors in file:</strong> ${pkg.data.visitors?.length || 0}</p>
        <p><strong>Interactions in file:</strong> ${pkg.data.interactions?.length || 0}</p>
        <p style="margin-top: 0.75rem; font-size: 0.8rem; color: var(--color-text-tertiary);">Your current data will be backed up automatically before syncing.</p>
      </div>
    `;
    }

    /**
     * Perform the actual import with enhanced results display
     */
    performImport() {
        if (!this.pendingImport) return;

        if (confirm('Are you sure you want to merge this data? Your current data will be backed up automatically.')) {
            try {
                const results = SyncService.merge(this.pendingImport.data);

                // Build detailed result message
                let message = 'Sync successful!\n';
                message += `\n- ${results.visitorsAdded} new visitors added`;
                message += `\n- ${results.visitorsUpdated} existing visitors updated (by ID)`;

                if (results.visitorsUpdatedByPhone > 0) {
                    message += `\n- ${results.visitorsUpdatedByPhone} visitors matched by phone number`;
                }

                message += `\n- ${results.interactionsAdded} interactions synced`;

                if (results.visitorsSkipped > 0) {
                    message += `\n- ${results.visitorsSkipped} invalid visitors skipped`;
                }

                // Show duplicate flags warning
                if (results.duplicateFlags && results.duplicateFlags.length > 0) {
                    message += `\n\n⚠️ ${results.duplicateFlags.length} potential duplicate(s) detected:`;
                    results.duplicateFlags.forEach(d => {
                        message += `\n  - "${d.incomingName}" may be same as "${d.existingName}" (phone: ${d.phone})`;
                    });
                    message += '\n\nPlease review these visitors manually.';
                }

                if (results.backupCreated) {
                    message += '\n\nYour previous data was backed up automatically.';
                } else {
                    message += '\n\n⚠️ Backup could not be created (storage nearly full). Consider exporting your data regularly.';
                }

                alert(message);

                this.resetImport();
                // Delay reload to ensure localStorage write completes on slow devices
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            } catch (err) {
                alert('Sync failed: ' + err.message);
            }
        }
    }

    /**
     * Reset import state
     */
    resetImport() {
        this.pendingImport = null;
        this.container.querySelector('#import-preview').classList.add('hidden');
        this.container.querySelector('#import-file-input').value = '';
        const manualInput = this.container.querySelector('#manual-json-input');
        if (manualInput) manualInput.value = '';
    }

    /**
     * Calculate storage size
     */
    calculateStorageSize() {
        const data = JSON.stringify(localStorage);
        return (data.length / 1024).toFixed(2);
    }

    /**
     * Simple HTML escaping
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Clean up
     */
    destroy() {
        this.container = null;
    }
}
