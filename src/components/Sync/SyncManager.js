import ActivationManager from '../../core/activation.js';
import StateManager from '../../core/state.js';
import VisitorService from '../../services/VisitorService.js';
import SyncService from '../../services/SyncService.js';
import { downloadFile } from '../../utils/helpers.js';
import { getCurrentDate } from '../../utils/formatters.js';

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

        container.innerHTML = `
      <div class="dashboard-header" style="margin-bottom: 2rem;">
        <h2>Data Management & Sync</h2>
        <p class="text-secondary">Sync data between Root and Satellite machines</p>
      </div>

      <div class="sync-layout" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 2rem;">
        
        <!-- Export Section -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">📤 Export Data</h3>
          </div>
          <div class="card-body">
            <p>Export all visitors, interactions, and reminders from this machine for syncing or backup.</p>
            
            <div style="background: var(--color-bg); padding: 1.5rem; border-radius: var(--radius-md); margin-bottom: 2rem;">
              <strong>Machine Metadata Attached:</strong>
              <ul style="margin: 0.5rem 0 0 0; font-size: 0.875rem; color: var(--color-text-secondary);">
                <li>Name: ${this.machineInfo.machineName}</li>
                <li>Role: ${this.machineInfo.machineRole.toUpperCase()}</li>
                <li>ID: <code>${this.machineInfo.machineId}</code></li>
              </ul>
            </div>

            <div class="form-group">
              <label class="form-checkbox">
                <input type="checkbox" id="export-history" checked />
                <span>Include Interaction History</span>
              </label>
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
            <p>Sync data from a Satellite machine into this Root machine, or restore from a backup.</p>
            
            ${this.machineInfo.machineRole !== 'root' ? `
              <div class="alert alert-warning" style="margin-bottom: 1.5rem; background: #fffbeb; border: 1px solid #fef3c7; color: #92400e; padding: 1rem; border-radius: 0.5rem;">
                <strong>⚠️ Warning:</strong> This is a Satellite machine. Importing data from others may create conflicts. Sycing should usually happen on the Root machine.
              </div>
            ` : ''}

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
        // Export handler
        this.container.querySelector('#export-json-btn').addEventListener('click', () => {
            const data = StateManager.getState();
            const exportPackage = {
                metadata: {
                    app: 'NGO_Visitor_Manager',
                    version: '2.0',
                    exportedAt: getCurrentDate(),
                    machineId: this.machineInfo.machineId,
                    machineName: this.machineInfo.machineName,
                    machineRole: this.machineInfo.machineRole
                },
                data: {
                    visitors: data.visitors,
                    interactions: data.interactions,
                    reminderActions: data.reminderActions,
                    settings: data.settings
                }
            };

            const filename = `NGO_Sync_${this.machineInfo.machineName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
            downloadFile(JSON.stringify(exportPackage, null, 2), filename);
            alert('Export package generated and downloaded! Transfer this file to the Root machine for syncing.');
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
            const text = textarea?.value?.trim();
            if (!text) {
                alert('Please paste JSON data first.');
                return;
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
                const text = e.target.result;
                if (!text || text.trim().length === 0) {
                    alert('File is empty.');
                    return;
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
     * Show import preview
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
        <p><strong>Source:</strong> ${this.escapeHtml(pkg.metadata.machineName)} (${pkg.metadata.machineRole})</p>
        <p><strong>Exported On:</strong> ${new Date(pkg.metadata.exportedAt).toLocaleString()}</p>
        <hr style="margin: 0.5rem 0; opacity: 0.1;"/>
        <p><strong>Visitors:</strong> ${pkg.data.visitors?.length || 0}</p>
        <p><strong>Interactions:</strong> ${pkg.data.interactions?.length || 0}</p>
      </div>
    `;
    }

    /**
   * Perform the actual import
   */
    performImport() {
        if (!this.pendingImport) return;

        if (confirm('Are you sure you want to merge this data? This will update existing records and add new ones.')) {
            try {
                const results = SyncService.merge(this.pendingImport.data);

                alert(`Sync successful!
- ${results.visitorsAdded} new visitors added
- ${results.visitorsUpdated} existing visitors updated
- ${results.interactionsAdded} interactions synced`);

                this.resetImport();
                window.location.reload();
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
