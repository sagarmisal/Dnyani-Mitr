import ActivationManager from '../../core/activation.js';
import StateManager from '../../core/state.js';
import VisitorService from '../../services/VisitorService.js';
import SyncService from '../../services/SyncService.js';
import TextSyncService from '../../services/TextSyncService.js';
import { saveFile, getSyncCapabilities } from '../../utils/helpers.js';
import { ConfirmDialog } from '../UI/ConfirmDialog.js';
import { Toast } from '../UI/Toast.js';
import { APP_VERSION } from '../../utils/constants.js';

export class SyncManager {
    constructor() {
        this.container = null;
        this.machineInfo = ActivationManager.getMachineInfo();
        this.caps = getSyncCapabilities();
        this.generatedTextBlob = null;
        this.generatedChunkCount = 0;
        this.pendingImport = null;
    }

    render() {
        const container = document.createElement('div');
        container.className = 'sync-manager';

        const isRoot = this.machineInfo.machineRole === 'root';
        const roleLabel = isRoot ? 'Coordinator' : 'Volunteer';

        // Role-aware copy
        const sendTitle = isRoot
            ? 'Share with volunteers'
            : 'Send to coordinator';
        const sendDesc = isRoot
            ? 'Send your master contact list to field volunteers.'
            : 'Send your visit notes and new contacts to the coordinator.';
        const receiveTitle = isRoot
            ? 'Import from a volunteer'
            : 'Get latest from coordinator';
        const receiveDesc = isRoot
            ? 'Bring in field updates from a volunteer device.'
            : 'Add the coordinator\'s latest contact list to your device.';

        // Recommended path label based on device capabilities
        const recommendedShare = this.caps.canShareText
            ? 'Share via WhatsApp'
            : 'Copy and paste into WhatsApp';
        const recommendedSave = this.caps.canShareFiles
            ? 'Save (opens share sheet)'
            : 'Save as file';

        const backupInfo = SyncService.getBackupInfo();

        container.innerHTML = `
      <div class="dashboard-header" style="margin-bottom: 1.5rem;">
        <h2 style="margin: 0;">Sync your data</h2>
        <p class="text-secondary" style="margin: 0.25rem 0 0 0;">
          ${this.escapeHtml(this.machineInfo.machineName)} · ${roleLabel}
        </p>
      </div>

      <!-- Capability hint - tells user which path works best on their device -->
      <div class="sync-capability-hint" style="background: var(--color-surface-hover); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 0.75rem 1rem; margin-bottom: 1.5rem; font-size: 0.9rem;">
        <strong>On this ${this.escapeHtml(this.caps.platformLabel)}:</strong>
        ${this.caps.canShareText
                ? 'Sharing through WhatsApp works directly. Files open the share sheet.'
                : 'Copy the text and paste into WhatsApp manually. File downloads work normally.'}
      </div>

      <!-- Primary actions: Send + Receive side-by-side -->
      <div class="sync-primary-actions" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr)); gap: 1.25rem; margin-bottom: 1.5rem;">

        <!-- SEND -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">📤 ${this.escapeHtml(sendTitle)}</h3>
          </div>
          <div class="card-body">
            <p style="margin: 0 0 1rem 0; font-size: 0.9rem; color: var(--color-text-secondary);">
              ${this.escapeHtml(sendDesc)}
            </p>

            <label class="form-checkbox" style="margin-bottom: 1rem; display: block;">
              <input type="checkbox" id="send-include-history" checked />
              <span>Include visit notes &amp; interactions</span>
            </label>

            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              <button id="send-share-btn" class="btn btn-primary">
                💬 ${this.escapeHtml(recommendedShare)}
              </button>
              <button id="send-file-btn" class="btn btn-secondary">
                📁 ${this.escapeHtml(recommendedSave)}
              </button>
            </div>

            <!-- Output preview (shown after generate) -->
            <div id="send-output" class="hidden" style="margin-top: 1rem;">
              <div id="send-stats" style="font-size: 0.85rem; color: var(--color-text-secondary); margin-bottom: 0.5rem;"></div>
              <textarea id="send-textarea" readonly rows="4" class="form-textarea" style="font-size: 0.85rem;"></textarea>
              <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap;">
                <button id="send-copy-btn" class="btn btn-secondary btn-sm" style="flex: 1; min-width: 140px;">📋 Copy text</button>
                <button id="send-reshare-btn" class="btn btn-secondary btn-sm" style="flex: 1; min-width: 140px;">↗ Share again</button>
              </div>
              <div id="send-chunked-hint" class="hidden" style="margin-top: 0.5rem; padding: 0.5rem 0.75rem; background: #fef3c7; border: 1px solid #f59e0b; border-radius: var(--radius-sm); font-size: 0.85rem;">
                This will send as multiple WhatsApp messages. Send all of them to the receiver — the app puts them back together when they paste.
              </div>
            </div>
          </div>
        </div>

        <!-- RECEIVE -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">📥 ${this.escapeHtml(receiveTitle)}</h3>
          </div>
          <div class="card-body">
            <p style="margin: 0 0 1rem 0; font-size: 0.9rem; color: var(--color-text-secondary);">
              ${this.escapeHtml(receiveDesc)}
            </p>

            <label class="form-label" for="receive-textarea" style="margin-bottom: 0.25rem;">Paste sync message</label>
            <textarea id="receive-textarea" rows="4" class="form-textarea" style="font-size: 0.85rem;" placeholder="Long-press in WhatsApp → Copy → paste here. If multiple messages, paste them one after another."></textarea>
            <div id="receive-status" style="margin-top: 0.5rem; min-height: 1.4rem; font-size: 0.85rem;"></div>

            <button id="receive-preview-btn" class="btn btn-success" style="width: 100%;" disabled>
              Review &amp; import
            </button>

            <div style="display: flex; align-items: center; gap: 0.5rem; margin: 1rem 0; color: var(--color-text-tertiary); font-size: 0.85rem;">
              <span style="flex: 1; height: 1px; background: var(--color-border);"></span>
              <span>or open a file</span>
              <span style="flex: 1; height: 1px; background: var(--color-border);"></span>
            </div>

            <button id="receive-file-btn" class="btn btn-secondary" style="width: 100%;">
              📁 Open .json file
            </button>
            <input type="file" id="receive-file-input" style="display: none;" accept=".json,application/json,text/plain,*/*" />
          </div>
        </div>
      </div>

      <!-- Import preview (shared by paste + file paths) -->
      <div id="import-preview" class="hidden card" style="margin-bottom: 1.5rem; border: 2px solid var(--color-warning);">
        <div class="card-header">
          <h3 class="card-title">Review import</h3>
        </div>
        <div class="card-body">
          <div id="preview-stats" style="font-size: 0.9rem; margin-bottom: 1rem;"></div>
          <div style="display: flex; gap: 0.5rem;">
            <button id="confirm-import-btn" class="btn btn-success" style="flex: 1;">Import</button>
            <button id="cancel-import-btn" class="btn btn-secondary">Cancel</button>
          </div>
        </div>
      </div>

      ${backupInfo ? this.renderUndoCard(backupInfo) : ''}

      <!-- More options - collapsed by default -->
      <details class="sync-more-options card" style="margin-bottom: 1.5rem;">
        <summary style="cursor: pointer; padding: 1rem 1.5rem; font-weight: 600; list-style: none; display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1rem;">▸</span> More options &amp; backup
        </summary>
        <div class="card-body" style="border-top: 1px solid var(--color-border);">

          <!-- Full backup -->
          <h4 style="margin: 0 0 0.5rem 0;">💾 Full backup (everything)</h4>
          <p style="font-size: 0.9rem; color: var(--color-text-secondary); margin: 0 0 0.75rem 0;">
            Save a complete snapshot — visitors, visit notes, settings, sync log. Use for disaster recovery: send to your own WhatsApp or save to email/cloud.
          </p>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button id="backup-text-btn" class="btn btn-primary btn-sm" style="flex: 1; min-width: 160px;">
              💬 Backup as text
            </button>
            <button id="backup-file-btn" class="btn btn-secondary btn-sm" style="flex: 1; min-width: 160px;">
              📁 Backup as file
            </button>
          </div>

          <div id="backup-output" class="hidden" style="margin-top: 0.75rem;">
            <textarea id="backup-textarea" readonly rows="3" class="form-textarea" style="font-size: 0.85rem;"></textarea>
            <div id="backup-stats" style="font-size: 0.85rem; color: var(--color-text-secondary); margin-top: 0.25rem;"></div>
          </div>

          <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid var(--color-border);" />

          <h4 style="margin: 0 0 0.5rem 0;">Restore from backup</h4>
          <p style="font-size: 0.9rem; color: var(--color-text-secondary); margin: 0 0 0.75rem 0;">
            Paste a backup message below. Restoring replaces ALL current data.
          </p>
          <textarea id="restore-textarea" rows="3" class="form-textarea" style="font-size: 0.85rem;" placeholder="Paste backup message here..."></textarea>
          <button id="restore-text-btn" class="btn btn-error btn-sm" style="margin-top: 0.5rem; width: 100%;">Restore from pasted backup</button>

          ${this.renderSyncLog()}
          ${this.renderKnownMachines()}
          ${this.renderStorageStats()}
        </div>
      </details>
    `;

        this.container = container;
        this.attachEventListeners();
        return container;
    }

    renderUndoCard(backupInfo) {
        return `
      <div class="card" id="undo-card" style="margin-bottom: 1.5rem; border-left: 4px solid var(--color-warning);">
        <div class="card-body" style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 200px;">
            <strong>Need to undo your last import?</strong>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--color-text-secondary);">
              We saved a snapshot just before it: ${new Date(backupInfo.createdAt).toLocaleString()}
            </p>
          </div>
          <button id="undo-sync-btn" class="btn btn-secondary btn-sm">Undo last import</button>
        </div>
      </div>
    `;
    }

    attachEventListeners() {
        // ---- SEND: share via WhatsApp / generate text ----
        this.container.querySelector('#send-share-btn').addEventListener('click', async () => {
            await this.handleSendShare();
        });

        this.container.querySelector('#send-file-btn').addEventListener('click', async () => {
            await this.handleSendFile();
        });

        this.container.querySelector('#send-copy-btn').addEventListener('click', async () => {
            if (!this.generatedTextBlob) return;
            const ok = await TextSyncService.copyText(this.generatedTextBlob);
            if (ok) {
                Toast.show('Copied. Paste into WhatsApp.', 'success');
            } else {
                const ta = this.container.querySelector('#send-textarea');
                ta.select();
                Toast.show('Select the text and copy manually.', 'warning', 5000);
            }
        });

        this.container.querySelector('#send-reshare-btn').addEventListener('click', async () => {
            if (!this.generatedTextBlob) return;
            const result = await TextSyncService.shareText(
                this.generatedTextBlob,
                `Dnyani Mitra sync — ${this.machineInfo.machineName}`
            );
            this.toastForShareResult(result);
        });

        // ---- RECEIVE: paste textarea + file picker ----
        const receiveTA = this.container.querySelector('#receive-textarea');
        const receiveStatus = this.container.querySelector('#receive-status');
        const receivePreviewBtn = this.container.querySelector('#receive-preview-btn');

        const updateReceiveStatus = () => {
            const raw = receiveTA.value;

            // Try sync-text format first
            const inspection = TextSyncService.inspect(raw);
            if (inspection.status === 'empty') {
                // Maybe it's raw JSON?
                if (raw.trim().startsWith('{')) {
                    receiveStatus.innerHTML = '<span style="color: #059669;">✓ JSON detected. Click Review.</span>';
                    receivePreviewBtn.disabled = false;
                    receivePreviewBtn.dataset.format = 'json';
                } else {
                    receiveStatus.innerHTML = '';
                    receivePreviewBtn.disabled = true;
                    receivePreviewBtn.dataset.format = '';
                }
                return;
            }
            if (inspection.status === 'invalid') {
                receiveStatus.innerHTML = '<span style="color: #dc2626;">Couldn\'t find a sync message in what you pasted.</span>';
                receivePreviewBtn.disabled = true;
                receivePreviewBtn.dataset.format = '';
                return;
            }
            if (inspection.status === 'partial') {
                receiveStatus.innerHTML = `<span style="color: #d97706;">Got ${inspection.received} of ${inspection.total} messages. Still need: ${inspection.missing.join(', ')}. Paste the missing ones below.</span>`;
                receivePreviewBtn.disabled = true;
                receivePreviewBtn.dataset.format = '';
                return;
            }
            // complete
            receiveStatus.innerHTML = `<span style="color: #059669;">✓ All ${inspection.total} message${inspection.total > 1 ? 's' : ''} received.</span>`;
            receivePreviewBtn.disabled = false;
            receivePreviewBtn.dataset.format = 'sync-text';
        };

        receiveTA.addEventListener('input', updateReceiveStatus);
        receiveTA.addEventListener('paste', () => setTimeout(updateReceiveStatus, 50));

        receivePreviewBtn.addEventListener('click', async () => {
            const raw = receiveTA.value.trim();
            const format = receivePreviewBtn.dataset.format;
            try {
                if (format === 'json') {
                    let cleaned = raw;
                    if (cleaned.charCodeAt(0) === 0xFEFF) cleaned = cleaned.slice(1);
                    this.pendingImport = JSON.parse(cleaned);
                } else {
                    const { pkg } = await TextSyncService.decode(raw);
                    this.pendingImport = pkg;
                }
                this.showPreview(this.pendingImport);
            } catch (err) {
                Toast.show(err.message || 'Could not read this data.', 'error', 6000);
            }
        });

        // File picker
        const fileBtn = this.container.querySelector('#receive-file-btn');
        const fileInput = this.container.querySelector('#receive-file-input');
        fileBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.handleFileSelection(file);
        });

        // ---- IMPORT PREVIEW: confirm / cancel ----
        this.container.querySelector('#confirm-import-btn').addEventListener('click', async () => {
            await this.performImport();
        });
        this.container.querySelector('#cancel-import-btn').addEventListener('click', () => {
            this.resetImport();
        });

        // ---- BACKUP ----
        this.container.querySelector('#backup-text-btn').addEventListener('click', async () => {
            await this.generateFullBackup('text');
        });
        this.container.querySelector('#backup-file-btn').addEventListener('click', async () => {
            await this.generateFullBackup('file');
        });

        // ---- RESTORE FROM PASTE ----
        this.container.querySelector('#restore-text-btn').addEventListener('click', async () => {
            const ta = this.container.querySelector('#restore-textarea');
            const raw = ta.value?.trim();
            if (!raw) {
                Toast.show('Paste the backup text first.', 'warning');
                return;
            }
            const confirmed = await ConfirmDialog.show({
                title: 'Restore full backup?',
                message: 'This replaces ALL current data (visitors, visit notes, settings) with the backup. Your current data will be saved as a safety snapshot first.',
                confirmText: 'Restore',
                cancelText: 'Cancel',
                type: 'danger'
            });
            if (!confirmed) return;
            await this.restoreFromText(raw);
        });

        // ---- UNDO LAST SYNC ----
        const undoBtn = this.container.querySelector('#undo-sync-btn');
        if (undoBtn) {
            undoBtn.addEventListener('click', async () => {
                const confirmed = await ConfirmDialog.show({
                    title: 'Undo last import',
                    message: 'Restore your data to the snapshot from just before the last import. Are you sure?',
                    confirmText: 'Undo',
                    cancelText: 'Cancel',
                    type: 'danger'
                });
                if (!confirmed) return;
                try {
                    const restoredAt = SyncService.restoreBackup();
                    if (restoredAt) {
                        Toast.show(`Restored to ${new Date(restoredAt).toLocaleString()}`, 'success', 5000);
                        setTimeout(() => window.location.reload(), 500);
                    } else {
                        Toast.show('No snapshot found.', 'warning');
                    }
                } catch (err) {
                    Toast.show('Undo failed: ' + err.message, 'error', 5000);
                }
            });
        }
    }

    /**
     * SEND: generate text package and immediately try to share it.
     */
    async handleSendShare() {
        const includeInteractions = this.container.querySelector('#send-include-history').checked;
        const pkg = SyncService.prepareExport({ includeInteractions });

        try {
            const { text, chunkCount, sizeChars, warnLarge } = await TextSyncService.encode(pkg);
            this.generatedTextBlob = text;
            this.generatedChunkCount = chunkCount;

            this._showSendOutput({ text, chunkCount, sizeChars, pkg });

            if (warnLarge) {
                Toast.show('Large message. Consider unchecking "Include visit notes" for a smaller share.', 'warning', 6000);
            }

            // Trigger the appropriate sharing path based on caps
            const result = await TextSyncService.shareText(
                text,
                `Dnyani Mitra sync — ${this.machineInfo.machineName}`
            );
            this.toastForShareResult(result);
        } catch (err) {
            Toast.show('Could not generate sync message: ' + err.message, 'error', 5000);
        }
    }

    /**
     * SEND: generate raw JSON file and save/share it.
     */
    async handleSendFile() {
        const includeInteractions = this.container.querySelector('#send-include-history').checked;
        const pkg = SyncService.prepareExport({ includeInteractions });
        const filename = `NGO_Sync_${this.machineInfo.machineName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;

        try {
            const result = await saveFile(JSON.stringify(pkg, null, 2), filename);
            if (result.method === 'share' && !result.cancelled) {
                Toast.show('Share sheet opened. Pick WhatsApp, Drive, or Email.', 'success', 5000);
            } else if (result.method === 'share' && result.cancelled) {
                // user dismissed share sheet — silent
            } else if (result.method === 'download') {
                Toast.show('File downloaded. Transfer it to the other machine.', 'success', 5000);
            } else {
                Toast.show('Saved (data URI fallback). Check your downloads.', 'info', 5000);
            }
        } catch (err) {
            Toast.show('Save failed: ' + err.message, 'error', 5000);
        }
    }

    _showSendOutput({ text, chunkCount, sizeChars, pkg }) {
        const output = this.container.querySelector('#send-output');
        const ta = this.container.querySelector('#send-textarea');
        const stats = this.container.querySelector('#send-stats');
        const chunkedHint = this.container.querySelector('#send-chunked-hint');

        ta.value = text;
        const visitors = pkg.data?.visitors?.length || 0;
        const interactions = pkg.data?.interactions?.length || 0;
        const sizeKB = (sizeChars / 1024).toFixed(1);
        stats.textContent = `${visitors} visitors · ${interactions} visit notes · ${sizeKB} KB${chunkCount > 1 ? ` · ${chunkCount} messages` : ''}`;

        if (chunkCount > 1) chunkedHint.classList.remove('hidden');
        else chunkedHint.classList.add('hidden');

        output.classList.remove('hidden');
    }

    toastForShareResult(result) {
        if (result.method === 'share') {
            Toast.show('Share sheet opened. Pick WhatsApp.', 'success');
        } else if (result.method === 'clipboard') {
            Toast.show('Copied to clipboard. Paste into WhatsApp.', 'success', 5000);
        } else if (result.method === 'none' && result.error) {
            Toast.show(result.error, 'error', 5000);
        }
    }

    /**
     * Generate full backup (text or file)
     */
    async generateFullBackup(mode) {
        const state = StateManager.getState();
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
            const result = await saveFile(JSON.stringify(backupPkg, null, 2), filename);
            if (result.method === 'share' && !result.cancelled) {
                Toast.show('Share sheet opened — pick where to save your backup.', 'success', 5000);
            } else if (result.method === 'download') {
                Toast.show('Backup file downloaded. Store it safely.', 'success', 5000);
            }
            return;
        }

        try {
            const { text, sizeChars, chunkCount } = await TextSyncService.encode(backupPkg);
            const ta = this.container.querySelector('#backup-textarea');
            const stats = this.container.querySelector('#backup-stats');
            const output = this.container.querySelector('#backup-output');
            ta.value = text;
            stats.textContent = `${(sizeChars / 1024).toFixed(1)} KB · ${chunkCount} message${chunkCount > 1 ? 's' : ''}`;
            output.classList.remove('hidden');
            const copied = await TextSyncService.copyText(text);
            if (copied) {
                Toast.show('Backup copied. Send it to yourself on WhatsApp to keep it safe.', 'success', 6000);
            } else {
                ta.select();
                Toast.show('Select the text and copy manually.', 'info', 5000);
            }
        } catch (err) {
            Toast.show('Could not generate backup: ' + err.message, 'error', 5000);
        }
    }

    async restoreFromText(raw) {
        try {
            const { pkg } = await TextSyncService.decode(raw);
            if (!pkg.data || !pkg.data.visitors) {
                Toast.show('That doesn\'t look like a backup.', 'error');
                return;
            }
            SyncService.createBackup();
            const newState = {
                visitors: pkg.data.visitors || [],
                interactions: pkg.data.interactions || [],
                reminderActions: pkg.data.reminderActions || [],
                knownMachines: pkg.data.knownMachines || {},
                syncLog: pkg.data.syncLog || []
            };
            if (pkg.data.settings) newState.settings = pkg.data.settings;
            StateManager.setState(newState);
            Toast.show('Backup restored. Reloading...', 'success');
            setTimeout(() => window.location.reload(), 800);
        } catch (err) {
            Toast.show('Restore failed: ' + err.message, 'error', 6000);
        }
    }

    handleFileSelection(file) {
        if (!file) return;
        if (file.size > 50 * 1024 * 1024) {
            Toast.show('File too large. Max 50 MB.', 'error');
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
                Toast.show('Could not read this as a sync file. Try the paste option above.', 'error', 6000);
            }
        };
        reader.onerror = () => {
            Toast.show('Could not open the file. Try the paste option above.', 'error', 6000);
        };
        reader.readAsText(file, 'UTF-8');
    }

    showPreview(pkg) {
        if (!pkg.metadata || !pkg.data) {
            Toast.show('That data doesn\'t look like a sync package.', 'error');
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
                versionWarning = `<div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: var(--radius-sm); padding: 0.75rem; margin-top: 0.75rem;"><strong>Older version data (v${this.escapeHtml(incomingVersion)})</strong><p style="font-size: 0.85rem; margin: 0.25rem 0 0 0;">Newer fields (outcome, follow-up, consent) will be empty for these records. Import still works.</p></div>`;
            } else if (incomingMajor > localMajor) {
                versionWarning = `<div style="background: #fee2e2; border: 1px solid #ef4444; border-radius: var(--radius-sm); padding: 0.75rem; margin-top: 0.75rem;"><strong>Newer version data (v${this.escapeHtml(incomingVersion)})</strong><p style="font-size: 0.85rem; margin: 0.25rem 0 0 0;">Your app is v${this.escapeHtml(localVersion)}. Update before importing to avoid losing fields.</p></div>`;
            }
        }
        preview.classList.remove('hidden');
        stats.innerHTML = `
      <div style="background: var(--color-surface-hover); padding: 1rem; border-radius: var(--radius-sm); border: 1px solid var(--color-border);">
        <div style="display: grid; grid-template-columns: auto 1fr; gap: 0.5rem 1rem; font-size: 0.9rem;">
          <span style="color: var(--color-text-secondary);">From:</span>
          <span><strong>${this.escapeHtml(pkg.metadata.machineName || 'Unknown')}</strong>${pkg.metadata.machineRole ? ' · ' + this.escapeHtml(pkg.metadata.machineRole) : ''}</span>
          <span style="color: var(--color-text-secondary);">Exported:</span>
          <span>${new Date(pkg.metadata.exportedAt).toLocaleString()}</span>
          <span style="color: var(--color-text-secondary);">Visitors:</span>
          <span><strong>${pkg.data.visitors?.length || 0}</strong></span>
          <span style="color: var(--color-text-secondary);">Visit notes:</span>
          <span><strong>${pkg.data.interactions?.length || 0}</strong></span>
        </div>
        ${versionWarning}
        <p style="margin: 0.75rem 0 0 0; font-size: 0.85rem; color: var(--color-text-secondary);">Your current data will be saved as a snapshot first — you can undo this.</p>
      </div>
    `;
        preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async performImport() {
        if (!this.pendingImport) return;
        const confirmed = await ConfirmDialog.show({
            title: 'Import this data?',
            message: 'Merge into your current list. A safety snapshot is saved first — you can undo afterwards.',
            confirmText: 'Import',
            cancelText: 'Cancel',
            type: 'warning'
        });
        if (!confirmed) return;
        try {
            // Pass the whole package — merge unwraps `.data` and reads `.metadata`
            // so the sender's machine name lands in the sync log + knownMachines.
            const results = SyncService.merge(this.pendingImport);
            let message = `${results.visitorsAdded} new visitors added\n`;
            message += `${results.visitorsUpdated} existing visitors updated\n`;
            if (results.visitorsUpdatedByPhone > 0) {
                message += `${results.visitorsUpdatedByPhone} matched by phone number\n`;
            }
            message += `${results.interactionsAdded} visit notes synced`;
            if (results.visitorsSkipped > 0) {
                message += `\n${results.visitorsSkipped} invalid records skipped`;
            }
            if (results.duplicateFlags?.length > 0) {
                message += `\n\n${results.duplicateFlags.length} possible duplicate(s):`;
                results.duplicateFlags.forEach(d => {
                    message += `\n  - "${d.incomingName}" may be the same as "${d.existingName}" (phone: ${d.phone})`;
                });
                message += '\n\nReview these manually.';
            }
            if (results.backupCreated) {
                message += '\n\nYour previous data is saved as a snapshot.';
            } else {
                message += '\n\n(Could not save snapshot — storage nearly full.)';
            }
            await ConfirmDialog.show({
                title: 'Import complete',
                message,
                confirmText: 'OK',
                cancelText: null,
                type: 'info'
            });
            this.resetImport();
            setTimeout(() => window.location.reload(), 500);
        } catch (err) {
            Toast.show('Import failed: ' + err.message, 'error', 5000);
        }
    }

    resetImport() {
        this.pendingImport = null;
        this.container.querySelector('#import-preview').classList.add('hidden');
        const fi = this.container.querySelector('#receive-file-input');
        if (fi) fi.value = '';
        const ti = this.container.querySelector('#receive-textarea');
        if (ti) {
            ti.value = '';
            const status = this.container.querySelector('#receive-status');
            if (status) status.innerHTML = '';
            const btn = this.container.querySelector('#receive-preview-btn');
            if (btn) {
                btn.disabled = true;
                btn.dataset.format = '';
            }
        }
    }

    renderSyncLog() {
        const syncLog = StateManager.getSyncLog();
        if (!syncLog || syncLog.length === 0) return '';
        return `
      <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid var(--color-border);" />
      <h4 style="margin: 0 0 0.5rem 0;">📋 Sync history</h4>
      <div style="max-height: 280px; overflow-y: auto;">
        ${syncLog.slice(0, 20).map(entry => `
          <div style="padding: 0.5rem 0; border-bottom: 1px solid var(--color-border); font-size: 0.85rem;">
            <div style="display: flex; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap;">
              <span><strong>${entry.direction === 'import' ? '📥 In' : '📤 Out'}</strong> · ${this.escapeHtml(entry.machineName || 'Unknown')}</span>
              <span style="color: var(--color-text-secondary); font-size: 0.8rem;">${new Date(entry.timestamp).toLocaleString()}</span>
            </div>
            <div style="color: var(--color-text-secondary); margin-top: 0.15rem;">
              ${entry.direction === 'import'
                ? `${entry.visitorsAdded || 0} new, ${entry.visitorsUpdated || 0} updated, ${entry.interactionsAdded || 0} notes`
                : `${entry.visitorsExported || 0} visitors, ${entry.interactionsExported || 0} notes`}
            </div>
          </div>
        `).join('')}
      </div>
    `;
    }

    renderKnownMachines() {
        const knownMachines = StateManager.getKnownMachines();
        const entries = Object.entries(knownMachines || {});
        if (entries.length === 0) return '';
        return `
      <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid var(--color-border);" />
      <h4 style="margin: 0 0 0.5rem 0;">🖥️ Devices you've synced with</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr)); gap: 0.5rem;">
        ${entries.map(([id, name]) => `
          <div style="background: var(--color-surface-hover); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 0.6rem 0.75rem;">
            <div style="font-weight: 600; font-size: 0.9rem;">${this.escapeHtml(name)}</div>
          </div>
        `).join('')}
      </div>
    `;
    }

    renderStorageStats() {
        return `
      <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid var(--color-border);" />
      <h4 style="margin: 0 0 0.5rem 0;">📊 On this device</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(140px, 100%), 1fr)); gap: 1rem; text-align: center;">
        <div>
          <div style="font-size: 1.5rem; font-weight: 700;">${VisitorService.getAll().length}</div>
          <div style="color: var(--color-text-secondary); font-size: 0.85rem;">Visitors</div>
        </div>
        <div>
          <div style="font-size: 1.5rem; font-weight: 700;">${StateManager.getState().interactions?.length || 0}</div>
          <div style="color: var(--color-text-secondary); font-size: 0.85rem;">Visit notes</div>
        </div>
        <div>
          <div style="font-size: 1.5rem; font-weight: 700;">${this.calculateStorageSize()} KB</div>
          <div style="color: var(--color-text-secondary); font-size: 0.85rem;">Used</div>
        </div>
      </div>
    `;
    }

    calculateStorageSize() {
        const data = JSON.stringify(localStorage);
        return (data.length / 1024).toFixed(2);
    }

    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    destroy() {
        this.container = null;
    }
}
