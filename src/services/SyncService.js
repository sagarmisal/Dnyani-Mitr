// Sync Service - Logic for merging and reconciling data between machines

import StateManager from '../core/state.js';
import ActivationManager from '../core/activation.js';
import EventBus, { EVENTS } from '../core/events.js';
import { STORAGE_KEYS, APP_VERSION } from '../utils/constants.js';
import { normalizePhone, namesSimilar } from '../utils/formatters.js';

/**
 * Extract and normalize the primary phone of a visitor's SELF contact.
 */
function getVisitorPrimaryPhone(visitor) {
    const selfContact = visitor.contacts?.find(c => c.relationType === 'SELF');
    const rawPhone = selfContact?.phones?.[0];
    return normalizePhone(rawPhone);
}

class SyncService {
    /**
     * Create a pre-sync backup in localStorage.
     * Returns backup timestamp on success, null if storage is full.
     */
    createBackup() {
        const state = StateManager.getState();
        const backup = {
            state: state,
            createdAt: new Date().toISOString()
        };
        try {
            localStorage.setItem(STORAGE_KEYS.PRE_SYNC_BACKUP, JSON.stringify(backup));
            return backup.createdAt;
        } catch (e) {
            // QuotaExceededError — storage is too full for backup
            console.warn('Could not create pre-sync backup (storage full):', e.message);
            return null;
        }
    }

    /**
     * Restore state from pre-sync backup
     */
    restoreBackup() {
        const backupJson = localStorage.getItem(STORAGE_KEYS.PRE_SYNC_BACKUP);
        if (!backupJson) return null;

        const backup = JSON.parse(backupJson);
        StateManager.setState(backup.state);
        return backup.createdAt;
    }

    /**
     * Get info about existing backup (if any)
     */
    getBackupInfo() {
        const backupJson = localStorage.getItem(STORAGE_KEYS.PRE_SYNC_BACKUP);
        if (!backupJson) return null;

        try {
            const backup = JSON.parse(backupJson);
            return { createdAt: backup.createdAt };
        } catch {
            return null;
        }
    }

    /**
     * Merge incoming data package into local state.
     * Two-tier matching: visitor ID (primary) + phone number dedup (secondary).
     */
    merge(packageData) {
        if (!packageData || !packageData.visitors) {
            throw new Error('Invalid sync package: No visitor data found');
        }

        if (!Array.isArray(packageData.visitors)) {
            throw new Error('Invalid sync package: visitors must be an array');
        }

        // Step 0: Auto-backup current state before merge
        const backupCreatedAt = this.createBackup();

        const currentState = StateManager.getState();
        const incomingVisitors = packageData.visitors;
        const incomingInteractions = packageData.interactions || [];
        const incomingActions = packageData.reminderActions || [];

        // Step 1: Build lookup indexes
        const localIdMap = new Map();
        const localPhoneMap = new Map();

        currentState.visitors.forEach(v => {
            localIdMap.set(v.id, v);
            const phone = getVisitorPrimaryPhone(v);
            if (phone) {
                localPhoneMap.set(phone, v.id);
            }
        });

        // Step 2: Process each incoming visitor
        let addedCount = 0;
        let updatedCount = 0;
        let updatedByPhoneCount = 0;
        let skippedCount = 0;
        const duplicateFlags = [];
        // Remap table: incoming visitor ID → local visitor ID (for phone-merged visitors)
        const visitorIdRemap = new Map();

        incomingVisitors.forEach(incoming => {
            // Validate: must have id and contacts array
            if (!incoming || !incoming.id || !Array.isArray(incoming.contacts)) {
                skippedCount++;
                return;
            }

            // Extract incoming primary phone
            const incomingSelf = incoming.contacts.find(c => c.relationType === 'SELF');
            const incomingPhone = normalizePhone(incomingSelf?.phones?.[0]);

            // Tier 1: Match by visitor ID
            if (localIdMap.has(incoming.id)) {
                const existing = localIdMap.get(incoming.id);

                // Soft delete check
                if (existing.status === 'deleted' && incoming.status !== 'deleted') {
                    if (new Date(existing.deletedAt) > new Date(incoming.updatedAt)) {
                        return; // Local delete is newer, skip incoming
                    }
                }

                // Last-write-wins by updatedAt
                if (new Date(incoming.updatedAt) > new Date(existing.updatedAt)) {
                    localIdMap.set(incoming.id, incoming);
                    updatedCount++;
                }
                return; // ID matched, done with this visitor
            }

            // Tier 2: Match by phone (only if Tier 1 failed)
            if (incomingPhone && localPhoneMap.has(incomingPhone)) {
                const existingId = localPhoneMap.get(incomingPhone);
                const existing = localIdMap.get(existingId);
                const existingSelf = existing?.contacts?.find(c => c.relationType === 'SELF');

                if (namesSimilar(incomingSelf?.name, existingSelf?.name)) {
                    // Same person, different IDs — merge into existing local ID
                    // Track remap so incoming interactions can be reassigned
                    visitorIdRemap.set(incoming.id, existingId);
                    if (new Date(incoming.updatedAt) > new Date(existing.updatedAt)) {
                        // Keep existing's local ID, replace data with incoming
                        const merged = { ...incoming, id: existingId };
                        localIdMap.set(existingId, merged);
                        updatedByPhoneCount++;
                    }
                    return; // Phone matched and merged, done
                } else {
                    // Same phone, different names — flag as potential duplicate
                    duplicateFlags.push({
                        incomingName: incomingSelf?.name || 'Unknown',
                        existingName: existingSelf?.name || 'Unknown',
                        phone: incomingPhone,
                        incomingId: incoming.id,
                        existingId: existingId
                    });
                    // Fall through to add as new — user reviews later
                }
            }

            // Tier 3: No match — add as new
            localIdMap.set(incoming.id, incoming);
            addedCount++;

            // Update phone map for subsequent incoming visitors
            if (incomingPhone) {
                localPhoneMap.set(incomingPhone, incoming.id);
            }
        });

        // Step 3: Merge Interactions (deduplicate by ID, remap visitor IDs for phone-merged visitors)
        const interactionIds = new Set(currentState.interactions.map(i => i.id));
        const mergedInteractions = [...currentState.interactions];

        incomingInteractions.forEach(i => {
            if (i && i.id && i.visitorId && i.interactionType && !interactionIds.has(i.id)) {
                // Remap visitorId if visitor was phone-merged into a different local ID
                const remappedVisitorId = visitorIdRemap.get(i.visitorId);
                if (remappedVisitorId) {
                    mergedInteractions.push({ ...i, visitorId: remappedVisitorId });
                } else {
                    mergedInteractions.push(i);
                }
            }
        });

        // Step 4: Merge Reminder Actions (deduplicate by ID)
        const actionIds = new Set(currentState.reminderActions.map(a => a.id));
        const mergedActions = [...currentState.reminderActions];

        incomingActions.forEach(a => {
            if (a && a.id && !actionIds.has(a.id)) {
                mergedActions.push(a);
            }
        });

        // Step 5: Save updated state + emit events
        StateManager.setState({
            visitors: Array.from(localIdMap.values()),
            interactions: mergedInteractions,
            reminderActions: mergedActions
        });

        EventBus.emit(EVENTS.IMPORT_COMPLETED);

        // Step 6: Record sync log + known machines
        const incomingMeta = packageData.metadata || {};
        if (incomingMeta.machineId) {
            StateManager.registerKnownMachine(incomingMeta.machineId, incomingMeta.machineName);
        }
        StateManager.addSyncLogEntry({
            timestamp: new Date().toISOString(),
            direction: 'import',
            machineId: incomingMeta.machineId || null,
            machineName: incomingMeta.machineName || 'Unknown',
            dataVersion: incomingMeta.dataVersion || incomingMeta.version || null,
            visitorsAdded: addedCount,
            visitorsUpdated: updatedCount + updatedByPhoneCount,
            interactionsAdded: mergedInteractions.length - currentState.interactions.length
        });

        // Step 7: Return results
        return {
            visitorsAdded: addedCount,
            visitorsUpdated: updatedCount,
            visitorsUpdatedByPhone: updatedByPhoneCount,
            visitorsSkipped: skippedCount,
            duplicateFlags: duplicateFlags,
            interactionsAdded: mergedInteractions.length - currentState.interactions.length,
            actionsAdded: mergedActions.length - currentState.reminderActions.length,
            backupCreated: backupCreatedAt !== null
        };
    }

    /**
     * Prepare an export package
     */
    prepareExport(options = {}) {
        const state = StateManager.getState();
        const machineInfo = ActivationManager.getMachineInfo();

        const exportData = {
            visitors: state.visitors
        };

        if (options.includeInteractions !== false) {
            exportData.interactions = state.interactions;
        }

        // Never export reminder actions or settings (local preference only)

        // Record export in sync log
        StateManager.addSyncLogEntry({
            timestamp: new Date().toISOString(),
            direction: 'export',
            machineId: machineInfo?.machineId || null,
            machineName: machineInfo?.machineName || 'Unknown',
            dataVersion: APP_VERSION,
            visitorsExported: exportData.visitors.length,
            interactionsExported: exportData.interactions?.length || 0
        });

        return {
            metadata: {
                app: 'NGO_Visitor_Manager',
                version: APP_VERSION,
                dataVersion: APP_VERSION,
                exportedAt: new Date().toISOString(),
                machineId: machineInfo?.machineId,
                machineName: machineInfo?.machineName,
                machineRole: machineInfo?.machineRole
            },
            data: exportData
        };
    }
}

export default new SyncService();
