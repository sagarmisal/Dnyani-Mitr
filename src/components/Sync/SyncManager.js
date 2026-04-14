import ActivationManager from '../../core/activation.js';
import StateManager from '../../core/state.js';
import VisitorService from '../../services/VisitorService.js';
import SyncService from '../../services/SyncService.js';
import TextSyncService from '../../services/TextSyncService.js';
import { downloadFile } from '../../utils/helpers.js';
import { ConfirmDialog } from '../UI/ConfirmDialog.js';
import { Toast } from '../UI/Toast.js';
import { APP_VERSION } from '../../utils/constants.js';

export class SyncManager {
    constructor() {
        this.container = null;
        this.machineInfo = ActivationManager.getMachineInfo();
        // Holds the currently-generated text blob for export (so Copy / Share / regenerate stay in sync)
        this.generatedTextBlob = null;
        this.generatedChunkCount = 0;
    }

    render() {
        const container = document.createElement('div');
        container.className = 'sync-manager';

        const isRoot = this.machineInfo.machineRole === 'root';
        const backupInfo = SyncService.getBackupInfo();

        container.innerHTML = `
      <div class="dashboard-header" style="margin-bottom: 2rem;">
        <h2>Data Management & Sync</h2>
        <p class="text-secondary">${isRoot
            ? 'Share your master list with volunteers. Import their field updates.'
            : 'Get the latest contacts from your coordinator. Send back your field updates.'}</p>
      </div>

      <!-- Hero: Text-based sync (primary path) -->
      <div class="card sync-hero" style="border: 2px solid var(--color-primary); margin-bottom: 2rem;">
        <div class="card-header" style="background: linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%);">
          <h3 class="card-title">💬 Share via WhatsApp (Recommended)</h3>
          <p style="margin: 0.5rem 0 0 0; font-size: 0.85rem; color: var(--color-text-secondary);">
            Copy and paste sync messages directly. No files, no download folders, no permissions.
          </p>
        </div>
        <div class="card-body">
          <div class="sync-text-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr)); gap: 1.5rem;">

            <!-- Export via text -->
            <div class="sync-text-panel">
              <h4 style="margin: 0 0 0.75rem 0; font-size: 1rem;">📤 Share Your Data</h4>
              <p style="font-size: 0.8rem; color: var(--color-text-secondary); margin-bottom: 0.75rem;">
                ${isRoot
                    ? 'Generates a message to send your contact list to volunteers.'
                    : 'Generates a message to send your field updates to the coordinator.'}
              </p>

              <div class="form-group" style="margin-bottom: 0.75rem;">
                <label class="form-checkbox" style="font-size: 0.85rem;">
                  <input type="checkbox" id="text-export-history" checked />
                  <span>Include interaction history</span>
                </label>
              </div>

              <button id="text-export-generate-btn" class="btn btn-primary" style="width: 100%;">
                Generate WhatsApp Message
              </button>

              <div id="text-export-output" class="hidden" style="margin-top: 1rem;">
                <div id="text-export-stats" style="font-size: 0.8rem; color: var(--color-text-secondary); margin-bottom: 0.5rem;"></div>
                <textarea id="text-export-textarea" readonly rows="4" class="form-textarea" style="font-family: monospace; font-size: 0.7rem;"></textarea>
                <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap;">
                  <button id="text-export-share-btn" class="btn btn-success btn-sm" style="flex: 1;">📲 Share to WhatsApp</button>
                  <button id="text-export-copy-btn" class="btn btn-primary btn-sm" style="flex: 1;">📋 Copy Text</button>
                </div>
                <div id="text-export-chunked-hint" class="hidden" style="margin-top: 0.5rem; padding: 0.5rem; background: #fef3c7; border: 1px solid #f59e0b; border-radius: var(--radius-sm); font-size: 0.75rem;">
                  <strong>This will be multiple WhatsApp messages.</strong>
                  <p style="margin: 0.25rem 0 0 0;">Send them all in order to the receiver. They'll paste them into the import box and the app reassembles automatically.</p>
                </div>
              </div>
            </div>

            <!-- Import via text -->
            <div class="sync-text-panel">
              <h4 style="margin: 0 0 0.75rem 0; font-size: 1rem;">📥 Import From Message</h4>
              <p style="font-size: 0.8rem; color: var(--color-text-secondary); margin-bottom: 0.75rem;">
                Paste the WhatsApp message(s) you received here. If multiple messages, paste them one by one into the same box.
              </p>

              <textarea id="text-import-textarea" rows="6" class="form-textarea" placeholder="Long-press in WhatsApp → Copy → paste here" style="font-family: monospace; font-size: 0.75rem;"></textarea>

              <div id="text-import-status" style="margin-top: 0.5rem; min-height: 1.5rem; font-size: 0.8rem;"></div>

              <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                <button id="text-import-preview-btn" class="btn btn-success btn-sm" style="flex: 1;" disabled>Preview Import</button>
                <button id="text-import-clear-btn" class="btn btn-secondary btn-sm">Clear</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Unified import preview (shared between text and file paths) -->
      <div id="import-preview" class="hidden card" style="margin-bottom: 2rem; border: 2px solid var(--color-warning);">
        <div class="card-header">
          <h3 class="card-title">Review Import</h3>
        </div>
        <div class="card-body">
          <div id="preview-stats" style="font-size: 0.875rem; color: var(--color-text-secondary); margin-bottom: 1.5rem;"></div>
          <div style="display: flex; gap: 0.5rem;">
            <button id="confirm-import-btn" class="btn btn-success" style="flex: 1;">Proceed with Import</button>
            <button id="cancel-import-btn" class="btn btn-secondary">Cancel</button>
          </div>
        </div>
      </div>

      <!-- File-based sync (fallback, collapsible) -->
      <details class="card" style="margin-bottom: 2rem;">
        <summary style="cursor: pointer; padding: 1rem 1.5rem; font-weight: 600;">
          📁 File-based Sync (desktop / fallback)
        </summary>
        <div class="card-body" style="border-top: 1px solid var(--color-border);">
          <p style="font-size: 0.85rem; color: var(--color-text-secondary); margin-bottom: 1rem;">
            Use this when sharing through email, USB drives, or file transfer apps. On Android, WhatsApp-shared files can be hard to re-open — prefer the text option above.
          </p>

          <div class="sync-layout" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr)); gap: 1.5rem;">
            <div>
              <h4 style="margin: 0 0 0.75rem 0; font-size: 0.95rem;">Export to File</h4>
              <div class="form-group" style="margin-bottom: 0.75rem;">
                <label class="form-checkbox" style="font-size: 0.85rem;">
                  <input type="checkbox" id="file-export-history" checked />
                  <span>Include interaction history</span>
                </label>
              </div>
              <button id="file-export-btn" class="btn btn-secondary" style="width: 100%;">
                Download .json File
              </button>
            </div>

            <div>
              <h4 style="margin: 0 0 0.75rem 0; font-size: 0.95rem;">Import from File</h4>
              <div class="import-dropzone" id="import-dropzone" style="border: 2px dashed var(--color-border); border-radius: var(--radius-md); padding: 1.25rem; text-align: center; cursor: pointer;">
                <p style="font-size: 1.25rem; margin: 0 0 0.25rem 0;">📁</p>
                <p style="margin: 0; font-size: 0.85rem;">Tap to select a JSON file</p>
                <input type="file" id="import-file-input" style="display: none;" accept=".json,application/json,text/plain,*/*" />
              </div>
              <details style="margin-top: 0.75rem;">
                <summary style="cursor: pointer; color: var(--color-primary); font-size: 0.8rem;">Paste JSON manually</summary>
                <div style="margin-top: 0.5rem;">
                  <textarea id="manual-json-input" class="form-textarea" rows="4" placeholder="Paste raw JSON here..." style="font-size: 0.75rem; font-family: monospace;"></textarea>
                  <button id="manual-import-btn" class="btn btn-secondary btn-sm" style="width: 100%; margin-top: 0.5rem;">Load Pasted JSON</button>
                </div>
              </details>
            </div>
          </div>
        </div>
      </details>

      <!-- Full Backup (text-first + file) -->
      <div class="card" style="margin-bottom: 2rem;">
        <div class="card-header">
          <h3 class="card-title">💾 Full Backup (Disaster Recovery)</h3>
        </div>
        <div class="card-body">
          <p style="font-size: 0.85rem; color: var(--color-text-secondary); margin-bottom: 1rem;">
            Includes everything: visitors, interactions, reminder actions, settings, and sync log. Store this in your own WhatsApp (send to yourself), email, or cloud drive. Use it to restore after phone loss or reinstall.
          </p>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button id="backup-text-btn" class="btn btn-primary" style="flex: 1; min-width: 180px;">
              💬 Copy Backup as Text
            </button>
            <button id="backup-file-btn" class="btn btn-secondary" style="flex: 1; min-width: 180px;">
              📁 Download Backup File
            </button>
          </div>

          <div id="backup-output" class="hidden" style="margin-top: 1rem;">
            <textarea id="backup-textarea" readonly rows="4" class="form-textarea" style="font-family: monospace; font-size: 0.7rem;"></textarea>
            <div id="backup-stats" style="font-size: 0.8rem; color: var(--color-text-secondary); margin-top: 0.5rem;"></div>
          </div>

          <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid var(--color-border);" />

          <h4 style="margin: 0 0 0.5rem 0; font-size: 0.95rem;">Restore from Backup</h4>
          <p style="font-size: 0.8rem; color: var(--color-text-secondary); margin-bottom: 0.75rem;">
            Paste a backup message, or use an imported file/text above. Restoring replaces ALL current data including settings.
          </p>
          <textarea id="restore-textarea" rows="4" class="form-textarea" placeholder="Paste full backup message here..." style="font-family: monospace; font-size: 0.75rem;"></textarea>
          <button id="restore-text-btn" class="btn btn-error btn-sm" style="margin-top: 0.5rem; width: 100%;">Restore from Pasted Backup</button>
        </div>
      </div>

      <!-- Pre-sync backup restore (automatic) -->
      <div class="card" id="restore-section" style="margin-bottom: 2rem; ${backupInfo ? '' : 'display: none;'}">
        <div class="card-header">
          <h3 class="card-title">🔄 Undo Last Sync</h3>
        </div>
        <div class="card-body">
          <p style="font-size: 0.85rem; color: var(--color-text-secondary);">
            A safety backup is created automatically before every sync. You can roll back to the state from just before the last import.
          </p>
          ${backupInfo ? `
            <p style="font-size: 0.85rem; margin-top: 0.5rem;">
              <strong>Backup point:</strong> ${new Date(backupInfo.createdAt).toLocaleString()}
            </p>
          ` : ''}
          <button id="restore-backup-btn" class="btn btn-secondary" style="margin-top: 1rem;">
            Restore from Last Sync Backup
          </button>
        </div>
      </div>

      ${this.renderSyncLog()}
      ${this.renderKnownMachines()}

      <!-- System Stats -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📊 Local Storage</h3>
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
            <div>
              <div style="font-size: 1rem; font-weight: 700;">${this.escapeHtml(this.machineInfo.machineName)}</div>
              <div class="text-secondary">${this.machineInfo.machineRole.toUpperCase()}</div>
            </div>
          </div>
        </div>
      </div>
    `;

        this.container = container;
        this.attachEventListeners();
        return container;
    }

    attachEventListeners() {
        // -------- TEXT EXPORT --------
        this.container.querySelector('#text-export-generate-btn').addEventListener('click', async () => {
            await this.generateTextExport();
        });

        this.container.querySelector('#text-export-share-btn').addEventListener('click', async () => {
            if (!this.generatedTextBlob) return;
            const result = await TextSyncService.shareText(
                this.generatedTextBlob,
                `Dnyani Mitra sync — ${this.machineInfo.machineName}`
            );
            if (result.method === 'share') {
                Toast.show('Opened share sheet. Pick WhatsApp to send.', 'success');
            } else if (result.method === 'clipboard') {
                Toast.show('Share not available — text copied to clipboard instead. Paste it into WhatsApp.', 'info', 5000);
            } else if (result.method === 'none' && result.error) {
                Toast.show('Could not share: ' + result.error, 'error');
            }
        });

        this.container.querySelector('#text-export-copy-btn').addEventListener('click', async () => {
            if (!this.generatedTextBlob) return;
            const ok = await TextSyncService.copyText(this.generatedTextBlob);
            if (ok) {
                Toast.show('Copied to clipboard. Paste it into a WhatsApp chat.', 'success');
            } else {
                // Fallback: select the textarea
                const ta = this.container.querySelector('#text-export-textarea');
                ta.select();
                Toast.show('Select the text and copy manually (Ctrl+C or long-press).', 'warning', 5000);
            }
        });

        // -------- TEXT IMPORT --------
        const textImportTA = this.container.querySelector('#text-import-textarea');
        const textImportStatus = this.container.querySelector('#text-import-status');
        const textImportPreviewBtn = this.container.querySelector('#text-import-preview-btn');
        const textImportClearBtn = this.container.querySelector('#text-import-clear-btn');

        const updateTextImportStatus = () => {
            const raw = textImportTA.value;
            const inspection = TextSyncService.inspect(raw);
            if (inspection.status === 'empty') {
                textImportStatus.innerHTML = '';
                textImportPreviewBtn.disabled = true;
            } else if (inspection.status === 'invalid') {
                textImportStatus.innerHTML = '<span style="color:#ef4444;">✗ No sync data detected. Make sure to include the ====DM-SYNC==== markers.</span>';
                textImportPreviewBtn.disabled = true;
            } else if (inspection.status === 'partial') {
                textImportStatus.innerHTML = `<span style="color:#f59e0b;">⏳ Received ${inspection.received} of ${inspection.total} messages. Missing: ${inspection.missing.join(', ')}. Paste the remaining messages.</span>`;
                textImportPreviewBtn.disabled = true;
            } else {
                textImportStatus.innerHTML = `<span style="color:#22c55e;">✓ All ${inspection.total} messages received. Click Preview to review.</span>`;
                textImportPreviewBtn.disabled = false;
            }
        };

        textImportTA.addEventListener('input', updateTextImportStatus);
        textImportTA.addEventListener('paste', () => setTimeout(updateTextImportStatus, 50));

        textImportPreviewBtn.addEventListener('click', async () => {
            try {
                const { pkg } = await TextSyncService.decode(textImportTA.value);
                this.pendingImport = pkg;
                this.showPreview(pkg);
            } catch (err) {
                Toast.show(err.message, 'error', 6000);
            }
        });

        textImportClearBtn.addEventListener('click', () => {
            textImportTA.value = '';
            updateTextImportStatus();
        });

        // -------- FILE EXPORT (fallback) --------
        this.container.querySelector('#file-export-btn').addEventListener('click', () => {
            const includeInteractions = this.container.querySelector('#file-export-history').checked;
            const exportPackage = SyncService.prepareExport({ includeInteractions });
            const filename = `NGO_Sync_${this.machineInfo.machineName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
            downloadFile(JSON.stringify(exportPackage, null, 2), filename);
            Toast.show('File downloaded. Transfer it to the other machine.', 'success', 5000);
        });

        // -------- FILE IMPORT (fallback) --------
        const dropzone = this.container.querySelector('#import-dropzone');
        const fileInput = this.container.querySelector('#import-file-input');
        dropzone.addEventListener('click', () => fileInput.click());
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--color-primary)';
        });
        dropzone.addEventListener('dragleave', () => {
            dropzone.style.borderColor = 'var(--color-border)';
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--color-border)';
            const file = e.dataTransfer?.files?.[0];
            if (file) this.handleFileSelection(file);
        });
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.handleFileSelection(file);
        });

        this.container.querySelector('#manual-import-btn')?.addEventListener('click', () => {
            const textarea = this.container.querySelector('#manual-json-input');
            let text = textarea?.value?.trim();
            if (!text) {
                Toast.show('Please paste JSON data first.', 'warning');
                return;
            }
            if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
            try {
                this.pendingImport = JSON.parse(text);
                this.showPreview(this.pendingImport);
            } catch (err) {
                Toast.show('Invalid JSON. Check the pasted content.', 'error');
            }
        });

        // -------- PREVIEW / CONFIRM / CANCEL IMPORT --------
        this.container.querySelector('#confirm-import-btn')?.addEventListener('click', async () => {
            await this.performImport();
        });
        this.container.querySelector('#cancel-import-btn')?.addEventListener('click', () => {
            this.resetImport();
        });

        // -------- FULL BACKUP --------
        this.container.querySelector('#backup-text-btn').addEventListener('click', async () => {
            await this.generateFullBackup('text');
        });
        this.container.querySelector('#backup-file-btn').addEventListener('click', async () => {
            await this.generateFullBackup('file');
        });

        // -------- RESTORE FROM PASTED BACKUP --------
        this.container.querySelector('#restore-text-btn').addEventListener('click', async () => {
            const ta = this.container.querySelector('#restore-textarea');
            const raw = ta.value?.trim();
            if (!raw) {
                Toast.show('Paste the backup text first.', 'warning');
                return;
            }
            const confirmed = await ConfirmDialog.show({
                title: 'Restore Full Backup?',
                message: 'This will replace ALL current data (visitors, interactions, settings) with the backup. Your current data will be saved as a safety backup first.',
                confirmText: 'Restore',
                cancelText: 'Cancel',
                type: 'danger'
            });
            if (!confirmed) return;
            await this.restoreFromText(raw);
        });

        // -------- UNDO LAST SYNC --------
        this.container.querySelector('#restore-backup-btn')?.addEventListener('click', async () => {
            const confirmed = await ConfirmDialog.show({
                title: 'Undo Last Sync',
                message: 'This restores your data to the state from just before the last import. Are you sure?',
                confirmText: 'Restore',
                cancelText: 'Cancel',
                type: 'danger'
            });
            if (!confirmed) return;
            try {
                const restoredAt = SyncService.restoreBackup();
                if (restoredAt) {
                    Toast.show(`Restored to state from ${new Date(restoredAt).toLocaleString()}`, 'success', 5000);
                    setTimeout(() => window.location.reload(), 500);
                } else {
                    Toast.show('No backup found to restore.', 'warning');
                }
            } catch (err) {
                Toast.show('Restore failed: ' + err.message, 'error', 5000);
            }
        });
    }

    /**
     * Generate text export blob and display it
     */
    async generateTextExport() {
        const includeInteractions = this.container.querySelector('#text-export-history').checked;
        const pkg = SyncService.prepareExport({ includeInteractions });

        try {
            const { text, chunkCount, sizeChars, compressed, warnLarge } = await TextSyncService.encode(pkg);
            this.generatedTextBlob = text;
            this.generatedChunkCount = chunkCount;

            const output = this.container.querySelector('#text-export-output');
            const ta = this.container.querySelector('#text-export-textarea');
            const stats = this.container.querySelector('#text-export-stats');
            const chunkedHint = this.container.querySelector('#text-export-chunked-hint');

            ta.value = text;
            const visitors = pkg.data?.visitors?.length || 0;
            const interactions = pkg.data?.interactions?.length || 0;
            const sizeKB = (sizeChars / 1024).toFixed(1);
            stats.innerHTML = `
                ${visitors} visitors · ${interactions} interactions · ${sizeKB} KB
                ${chunkCount > 1 ? `· <strong>${chunkCount} WhatsApp messages</strong>` : '· 1 WhatsApp message'}
                ${compressed ? '· compressed' : '· uncompressed'}
            `;

            if (chunkCount > 1) {
                chunkedHint.classList.remove('hidden');
            } else {
                chunkedHint.classList.add('hidden');
            }

            if (warnLarge) {
                Toast.show('Large payload. Consider unchecking "Include interaction history" for a smaller share.', 'warning', 6000);
            }

            output.classList.remove('hidden');
        } catch (err) {
            Toast.show('Could not generate text: ' + err.message, 'error', 5000);
        }
    }

    /**
     * Generate full backup (text or file)
     */
    async generateFullBackup(mode) {
        const state = StateManager.getState();
        // Full backup = everything
        const backupPkg = {
            metadata: {
                app: 'NGO_Visitor_Manager',
                version: APP_VERSION,
                dataVersion: APP_VERSION,
                exportedAt: new Date().toISOString(),
                machineId: this.machineInfo.machineId,
                machineName: this.machineInfo.machineName,
                machineRole: this.machineInfo.machineRole,
                backupType: 'full'
            },
            data: {
                visitors: state.visitors,
                interactions: state.interactions,
                reminderActions: state.reminderActions,
                settings: state.settings,
                syncLog: state.syncLog,
                knownMachines: state.knownMachines
            }
        };

        if (mode === 'file') {
            const filename = `DnyaniMitra_Backup_${this.machineInfo.machineName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
            downloadFile(JSON.stringify(backupPkg, null, 2), filename);
            Toast.show('Full backup file downloaded. Store it safely.', 'success', 5000);
            return;
        }

        // Text mode
        try {
            const { text, sizeChars, chunkCount } = await TextSyncService.encode(backupPkg);
            const ta = this.container.querySelector('#backup-textarea');
            const stats = this.container.querySelector('#backup-stats');
            const output = this.container.querySelector('#backup-output');
            ta.value = text;
            stats.innerHTML = `${(sizeChars / 1024).toFixed(1)} KB · ${chunkCount} WhatsApp message${chunkCount > 1 ? 's' : ''}`;
            output.classList.remove('hidden');
            const copied = await TextSyncService.copyText(text);
            if (copied) {
                Toast.show('Full backup copied to clipboard. Send it to yourself on WhatsApp to save it safely.', 'success', 6000);
            } else {
                ta.select();
                Toast.show('Select the backup text and copy manually.', 'info', 5000);
            }
        } catch (err) {
            Toast.show('Could not generate backup: ' + err.message, 'error', 5000);
        }
    }

    /**
     * Restore from pasted text backup
     */
    async restoreFromText(raw) {
        try {
            const { pkg } = await TextSyncService.decode(raw);
            if (!pkg.data || !pkg.data.visitors) {
                Toast.show('Pasted data does not look like a backup.', 'error');
                return;
            }
            // Safety backup of current state
            SyncService.createBackup();

            // Replace state
            const newState = {
                visitors: pkg.data.visitors || [],
                interactions: pkg.data.interactions || [],
                reminderActions: pkg.data.reminderActions || [],
                knownMachines: pkg.data.knownMachines || {},
                syncLog: pkg.data.syncLog || []
            };
            if (pkg.data.settings) newState.settings = pkg.data.settings;

            StateManager.setState(newState);
            Toast.show('Backup restored successfully. Reloading...', 'success');
            setTimeout(() => window.location.reload(), 800);
        } catch (err) {
            Toast.show('Restore failed: ' + err.message, 'error', 6000);
        }
    }

    handleFileSelection(file) {
        if (!file) return;
        if (file.size > 50 * 1024 * 1024) {
            Toast.show('File too large. Max 50MB.', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                let text = e.target.result;
                if (!text?.trim()) {
                    Toast.show('File is empty.', 'warning');
                    return;
                }
                if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
                this.pendingImport = JSON.parse(text);
                this.showPreview(this.pendingImport);
            } catch {
                Toast.show('Could not read this file as JSON. Try the paste option or the WhatsApp text method above.', 'error', 6000);
            }
        };
        reader.onerror = () => {
            Toast.show('Failed to read file. Try the WhatsApp text method above instead.', 'error', 6000);
        };
        reader.readAsText(file, 'UTF-8');
    }

    showPreview(pkg) {
        if (!pkg.metadata || !pkg.data) {
            Toast.show('This does not look like a valid sync package.', 'error');
            return;
        }
        const preview = this.container.querySelector('#import-preview');
        const stats = this.container.querySelector('#preview-stats');
        const incomingVersion = pkg.metadata.dataVersion || pkg.metadata.version || 'unknown';
        const localVersion = APP_VERSION;
        let versionWarning = '';
        if (incomingVersion !== localVersion) {
            const incomingMajor = parseInt(incomingVersion);
            const localMajor = parseInt(localVersion);
            if (incomingMajor < localMajor) {
                versionWarning = `<div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: var(--radius-sm); padding: 0.75rem; margin-top: 0.75rem;"><strong>⚠️ Older version data (v${this.escapeHtml(incomingVersion)})</strong><p style="font-size: 0.8rem; margin: 0.25rem 0 0 0;">Newer fields (outcome, follow-up, consent) will be empty for imported records. Import will work correctly.</p></div>`;
            } else if (incomingMajor > localMajor) {
                versionWarning = `<div style="background: #fee2e2; border: 1px solid #ef4444; border-radius: var(--radius-sm); padding: 0.75rem; margin-top: 0.75rem;"><strong>⚠️ Newer version data (v${this.escapeHtml(incomingVersion)})</strong><p style="font-size: 0.8rem; margin: 0.25rem 0 0 0;">Your app is v${this.escapeHtml(localVersion)}. Update before importing to avoid field loss.</p></div>`;
            }
        }
        preview.classList.remove('hidden');
        stats.innerHTML = `
      <div style="background: #f8fafc; padding: 1rem; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
        <p><strong>Source:</strong> ${this.escapeHtml(pkg.metadata.machineName || 'Unknown')} (${this.escapeHtml(pkg.metadata.machineRole || '')})</p>
        <p><strong>Exported:</strong> ${new Date(pkg.metadata.exportedAt).toLocaleString()}</p>
        <p><strong>App Version:</strong> v${this.escapeHtml(incomingVersion)}</p>
        <hr style="margin: 0.5rem 0; opacity: 0.1;"/>
        <p><strong>Visitors:</strong> ${pkg.data.visitors?.length || 0}</p>
        <p><strong>Interactions:</strong> ${pkg.data.interactions?.length || 0}</p>
        ${versionWarning}
        <p style="margin-top: 0.75rem; font-size: 0.8rem; color: var(--color-text-tertiary);">Your current data will be backed up automatically.</p>
      </div>
    `;
        // Scroll preview into view for mobile
        preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async performImport() {
        if (!this.pendingImport) return;
        const confirmed = await ConfirmDialog.show({
            title: 'Confirm Import',
            message: 'Merge this data into your current list? A safety backup is created automatically.',
            confirmText: 'Import',
            cancelText: 'Cancel',
            type: 'warning'
        });
        if (!confirmed) return;
        try {
            const results = SyncService.merge(this.pendingImport.data);
            let message = `${results.visitorsAdded} new visitors added\n`;
            message += `${results.visitorsUpdated} existing visitors updated (by ID)\n`;
            if (results.visitorsUpdatedByPhone > 0) {
                message += `${results.visitorsUpdatedByPhone} visitors matched by phone number\n`;
            }
            message += `${results.interactionsAdded} interactions synced`;
            if (results.visitorsSkipped > 0) {
                message += `\n${results.visitorsSkipped} invalid visitors skipped`;
            }
            if (results.duplicateFlags?.length > 0) {
                message += `\n\n⚠️ ${results.duplicateFlags.length} potential duplicate(s):`;
                results.duplicateFlags.forEach(d => {
                    message += `\n  - "${d.incomingName}" may be same as "${d.existingName}" (phone: ${d.phone})`;
                });
                message += '\n\nReview manually.';
            }
            if (results.backupCreated) {
                message += '\n\nYour previous data was backed up automatically.';
            } else {
                message += '\n\n⚠️ Backup could not be created (storage nearly full).';
            }
            await ConfirmDialog.show({
                title: 'Sync Successful',
                message,
                confirmText: 'OK',
                cancelText: null,
                type: 'info'
            });
            this.resetImport();
            setTimeout(() => window.location.reload(), 500);
        } catch (err) {
            Toast.show('Sync failed: ' + err.message, 'error', 5000);
        }
    }

    resetImport() {
        this.pendingImport = null;
        this.container.querySelector('#import-preview').classList.add('hidden');
        const fi = this.container.querySelector('#import-file-input');
        if (fi) fi.value = '';
        const mi = this.container.querySelector('#manual-json-input');
        if (mi) mi.value = '';
        const ti = this.container.querySelector('#text-import-textarea');
        if (ti) {
            ti.value = '';
            const status = this.container.querySelector('#text-import-status');
            if (status) status.innerHTML = '';
            const btn = this.container.querySelector('#text-import-preview-btn');
            if (btn) btn.disabled = true;
        }
    }

    renderSyncLog() {
        const syncLog = StateManager.getSyncLog();
        if (syncLog.length === 0) return '';
        return `
            <div class="card" style="margin-bottom: 2rem;">
                <div class="card-header">
                    <h3 class="card-title">📋 Sync History</h3>
                </div>
                <div class="card-body">
                    <div style="max-height: 300px; overflow-y: auto;">
                        <table style="width:100%; font-size:0.85rem; border-collapse:collapse;">
                            <thead>
                                <tr style="border-bottom:2px solid #e2e8f0; text-align:left;">
                                    <th style="padding:0.5rem;">When</th>
                                    <th style="padding:0.5rem;">Direction</th>
                                    <th style="padding:0.5rem;">Machine</th>
                                    <th style="padding:0.5rem;">Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${syncLog.slice(0, 20).map(entry => `
                                    <tr style="border-bottom:1px solid #f1f5f9;">
                                        <td style="padding:0.5rem;">${new Date(entry.timestamp).toLocaleString()}</td>
                                        <td style="padding:0.5rem;">${entry.direction === 'import' ? '📥 Import' : '📤 Export'}</td>
                                        <td style="padding:0.5rem;">${this.escapeHtml(entry.machineName || 'Unknown')}</td>
                                        <td style="padding:0.5rem;">
                                            ${entry.direction === 'import'
                                                ? `+${entry.visitorsAdded || 0} new, ${entry.visitorsUpdated || 0} updated, ${entry.interactionsAdded || 0} interactions`
                                                : `${entry.visitorsExported || 0} visitors, ${entry.interactionsExported || 0} interactions`}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;
    }

    renderKnownMachines() {
        const knownMachines = StateManager.getKnownMachines();
        const entries = Object.entries(knownMachines);
        if (entries.length === 0) return '';
        return `
            <div class="card" style="margin-bottom: 2rem;">
                <div class="card-header">
                    <h3 class="card-title">🖥️ Known Machines</h3>
                </div>
                <div class="card-body">
                    <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:0.75rem;">
                        ${entries.map(([id, name]) => `
                            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:var(--radius-sm); padding:0.75rem;">
                                <div style="font-weight:600;">${this.escapeHtml(name)}</div>
                                <div style="font-size:0.75rem; color:#94a3b8;"><code>${id.substring(0, 12)}...</code></div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>`;
    }

    calculateStorageSize() {
        const data = JSON.stringify(localStorage);
        return (data.length / 1024).toFixed(2);
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    destroy() {
        this.container = null;
    }
}
