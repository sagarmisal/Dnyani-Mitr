// Sync Service - Logic for merging and reconciling data between machines

import StateManager from '../core/state.js';
import ActivationManager from '../core/activation.js';
import StorageManager from '../core/storage.js';
import { ScheduledItem } from '../models/ScheduledItem.js';
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
     *
     * Accepts both v3 wrapped shape `{ metadata, data: { visitors, ... } }` and
     * legacy/flat shape `{ visitors, interactions, ... }`. The wrapped shape is
     * what prepareExport produces; without unwrapping here, metadata (sender
     * machine name, dataVersion) is silently lost from the sync log.
     */
    merge(packageData) {
        if (!packageData) {
            throw new Error('Invalid sync package: No data found');
        }

        // Unwrap v3 shape if present; otherwise treat the package as already flat.
        const data = packageData.data && typeof packageData.data === 'object'
            ? packageData.data
            : packageData;
        const incomingMeta = packageData.metadata || {};

        if (!data.visitors) {
            throw new Error('Invalid sync package: No visitor data found');
        }

        if (!Array.isArray(data.visitors)) {
            throw new Error('Invalid sync package: visitors must be an array');
        }

        // Step 0: Auto-backup current state before merge
        const backupCreatedAt = this.createBackup();

        const currentState = StateManager.getState();
        const incomingVisitors = data.visitors;
        const incomingInteractions = data.interactions || [];
        const incomingActions = data.reminderActions || [];

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

    // ─── Full backup / restore (Iter 11, R0) ───────────────────────────────
    //
    // Before this existed, `SyncManager` assembled its own payload inline and
    // stamped it `backupType: 'full'` while omitting `occasions`, `campaigns`
    // and `scheduledItems` — so a restore after a reinstall silently lost every
    // custom occasion and every campaign the NGO had ever built. And a backup
    // FILE could not be restored at all: the file path always ran through
    // merge(), which reads three collections and drops the rest while reporting
    // success. Both are fixed here, in one authoritative place.

    /**
     * Every persisted collection, in one package.
     *
     * `metadata.collections` lists what is inside, so a future collection that
     * someone forgets to add here is DETECTABLE rather than silently missing.
     * The guard test asserts it against StorageManager.getDefaultState().
     */
    prepareFullBackup() {
        const state = StateManager.getState();
        const machineInfo = ActivationManager.getMachineInfo();

        const data = {
            visitors: state.visitors || [],
            interactions: state.interactions || [],
            reminderActions: state.reminderActions || [],
            occasions: state.occasions || [],
            campaigns: state.campaigns || [],
            scheduledItems: state.scheduledItems || [],
            settings: state.settings || {},
            syncLog: state.syncLog || [],
            knownMachines: state.knownMachines || {}
        };

        return {
            metadata: {
                app: 'NGO_Visitor_Manager',
                version: APP_VERSION,
                dataVersion: APP_VERSION,
                backupType: 'full',
                collections: Object.keys(data),
                exportedAt: new Date().toISOString(),
                machineId: machineInfo?.machineId || null,
                machineName: machineInfo?.machineName || null,
                machineRole: machineInfo?.machineRole || null
            },
            data
        };
    }

    /** True when a package is a full backup rather than a sync/merge package. */
    isFullBackup(pkg) {
        return !!(pkg && pkg.metadata && pkg.metadata.backupType === 'full' && pkg.data);
    }

    /**
     * REPLACE this device's data with a full backup. Not a merge — the caller
     * must have said so explicitly, because everything currently here is
     * discarded. A pre-restore snapshot is taken first.
     *
     * Version-tolerant in both directions: the restored state is passed through
     * StorageManager.ensureForwardFields(), so a v3.1.0 backup (no
     * scheduledItems, no followUpCompletedAt) lands cleanly in v3.2.0.
     */
    restoreFullBackup(pkg) {
        if (!this.isFullBackup(pkg)) {
            throw new Error('This is not a full backup. Use Import to merge a sync file instead.');
        }
        const data = pkg.data;
        if (!Array.isArray(data.visitors)) {
            throw new Error('This backup is damaged: the visitor list is missing.');
        }

        const backupCreatedAt = this.createBackup();

        const restored = {
            visitors: data.visitors || [],
            interactions: data.interactions || [],
            reminderActions: data.reminderActions || []
        };

        // ABSENT is not the same as EMPTY, and conflating them loses data.
        // A genuine v3.1.0 backup carries NO `occasions` key at all (that is
        // R-DEFECT-1: the old builder omitted it) — yet those devices had
        // occasions. Writing [] here would tell ensureForwardFields "the user
        // deleted them all, do not reseed", leaving the device with none.
        // So a key that is absent is left untouched: the built-ins get seeded on
        // a fresh install, and an existing device keeps what it already had.
        // A key that IS present, even as [], is an instruction and is honoured.
        ['occasions', 'campaigns', 'scheduledItems'].forEach(key => {
            if (Array.isArray(data[key])) restored[key] = data[key];
        });
        if (data.knownMachines && typeof data.knownMachines === 'object') {
            restored.knownMachines = data.knownMachines;
        }
        if (Array.isArray(data.syncLog)) restored.syncLog = data.syncLog;
        if (data.settings && typeof data.settings === 'object') {
            restored.settings = data.settings;
        }

        // Bring an older backup up to the current shape before it is stored, so
        // no consumer has to cope with fields that release did not have.
        StorageManager.ensureForwardFields(restored);

        StateManager.setState(restored);

        StateManager.addSyncLogEntry({
            timestamp: new Date().toISOString(),
            direction: 'restore',
            machineId: pkg.metadata.machineId || null,
            machineName: pkg.metadata.machineName || 'Unknown',
            dataVersion: pkg.metadata.dataVersion || pkg.metadata.version || null,
            visitorsRestored: restored.visitors.length,
            interactionsRestored: restored.interactions.length
        });

        EventBus.emit(EVENTS.IMPORT_COMPLETED);

        return {
            backupCreated: backupCreatedAt !== null,
            counts: {
                visitors: restored.visitors.length,
                interactions: restored.interactions.length,
                reminderActions: restored.reminderActions.length,
                occasions: restored.occasions.length,
                campaigns: restored.campaigns.length,
                scheduledItems: restored.scheduledItems.length
            }
        };
    }

    // ─── Shareable plans (Iter 11, Phase S) ────────────────────────────────
    //
    // Measured against the real channel (gzip -> base64 -> 3500-char chunks):
    // a full backup of 25 visitors + 200 interactions is ~5 WhatsApp messages,
    // a week of plans is 1 — and the gap only widens as history accumulates.
    // Plan-sharing is a DAILY act, so it must cost one message.

    /**
     * Plans from `fromKey` forward, plus the people they point at.
     *
     * Cancellations travel too (S4). Sync has no delete propagation, which is
     * fine for visitors and fatal for plans: if the office cancels Tuesday and
     * the cancellation never arrives, the volunteer makes the trip anyway.
     */
    preparePlansExport({ fromKey = null, onlyDate = null } = {}) {
        const state = StateManager.getState();
        const machineInfo = ActivationManager.getMachineInfo();
        const today = fromKey || new Date().toISOString().slice(0, 10);

        const cancelledFloor = new Date(today + 'T00:00:00');
        cancelledFloor.setDate(cancelledFloor.getDate() - 30);
        const floorKey = cancelledFloor.toISOString().slice(0, 10);

        const all = state.scheduledItems || [];
        const items = all.filter(i => {
            if (!i || !i.date) return false;
            if (onlyDate) return i.date === onlyDate;
            if (i.status === 'cancelled') return i.date >= floorKey;   // tombstone window
            return i.date >= today;
        });

        // S3: carry a stub for every referenced visitor so an item never renders
        // as "Unknown" on a device that has not met that person yet. Deliberately
        // a stub and not a full record — the receiver must NOT create visitors
        // from it, or the master list fills with half-people.
        const byId = new Map((state.visitors || []).map(v => [v.id, v]));
        const refs = [];
        const seen = new Set();
        items.forEach(i => {
            if (!i.visitorId || seen.has(i.visitorId)) return;
            seen.add(i.visitorId);
            const v = byId.get(i.visitorId);
            if (!v) return;
            const self = (v.contacts || []).find(c => c.relationType === 'SELF');
            refs.push({ id: v.id, name: self?.name || '', phone: (self?.phones || [])[0] || null });
        });

        return {
            metadata: {
                app: 'NGO_Visitor_Manager',
                version: APP_VERSION,
                dataVersion: APP_VERSION,
                backupType: 'plans',
                exportedAt: new Date().toISOString(),
                machineId: machineInfo?.machineId || null,
                machineName: machineInfo?.machineName || null,
                fromDate: onlyDate || today,
                count: items.length
            },
            data: { scheduledItems: items, visitorRefs: refs }
        };
    }

    isPlansPackage(pkg) {
        return !!(pkg && pkg.metadata && pkg.metadata.backupType === 'plans' && pkg.data);
    }

    /**
     * S10 — a plain line above the data block. `parseChunks` scans with a regex,
     * so surrounding text is ignored by the parser but READ BY THE PERSON before
     * they paste. Without it, a not-yet-upgraded device answers a plans message
     * with "Invalid sync package: No visitor data found", and the volunteer
     * concludes the feature is broken.
     */
    plansMessageHeader(pkg) {
        const n = pkg?.metadata?.count ?? 0;
        const when = pkg?.metadata?.fromDate || '';
        return `📅 Dnyani Mitr — ${n} plan${n === 1 ? '' : 's'} from ${when}.`
            + `\nNeeds app version ${APP_VERSION} or later. Paste the whole message into Sync.`;
    }

    /**
     * Merge incoming plans. Last-write-wins by `updatedAt`, with three rules the
     * naive version gets wrong:
     *   S5 — `done` is TERMINAL on this device. A plan is an intention, a
     *        completion is a fact; an incoming edit may change the title, never
     *        un-complete work already recorded here.
     *   S6 — re-importing the same message, or an older one after a newer one,
     *        must be a no-op. Forwarding twice is normal behaviour here.
     *   S7 — no authority exists in an all-satellite NGO, so an incoming item
     *        matching an existing one on (visitorId, date, type) is flagged as a
     *        duplicate rather than silently added twice.
     */
    mergePlans(pkg) {
        if (!this.isPlansPackage(pkg)) {
            throw new Error('This is not a plans message.');
        }
        const incoming = Array.isArray(pkg.data.scheduledItems) ? pkg.data.scheduledItems : [];
        const refs = Array.isArray(pkg.data.visitorRefs) ? pkg.data.visitorRefs : [];
        const refById = new Map(refs.map(r => [r.id, r]));

        const current = StateManager.getScheduledItems();
        const byId = new Map(current.map(i => [i.id, i]));

        let added = 0, updated = 0, skipped = 0, cancelled = 0;
        const duplicates = [];

        const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

        incoming.forEach(item => {
            if (!item || !item.id || !DAY_KEY.test(item.date || '')) { skipped++; return; }

            // SEC: normalise through the model before anything is stored. This
            // is a NEW ingestion path from a file a volunteer received over
            // WhatsApp, so it must not write unvetted objects into state: the
            // constructor coerces type/status/direction to known values and
            // drops unknown fields, which stops junk being stored AND re-exported
            // onwards to the next device.
            const ref = item.visitorId ? refById.get(item.visitorId) : null;
            const incomingItem = new ScheduledItem(item).toJSON();
            incomingItem.createdAt = item.createdAt || incomingItem.createdAt;
            incomingItem.updatedAt = item.updatedAt || incomingItem.updatedAt;
            if (!incomingItem.visitorName && ref?.name) incomingItem.visitorName = ref.name;

            const existing = byId.get(item.id);

            if (!existing) {
                const clash = current.find(c =>
                    c.visitorId && c.visitorId === item.visitorId &&
                    c.date === item.date && c.type === item.type && c.id !== item.id);
                if (clash) {
                    duplicates.push({ incoming: item.title, existing: clash.title, date: item.date });
                    skipped++;
                    return;
                }
                StateManager.addScheduledItem(incomingItem);
                added++;
                if (item.status === 'cancelled') cancelled++;
                return;
            }

            if (existing.status === 'done') { skipped++; return; }              // S5
            const a = new Date(existing.updatedAt || 0).getTime();
            const b = new Date(item.updatedAt || 0).getTime();
            if (!(b > a)) { skipped++; return; }                                 // S6

            // preserveUpdatedAt: keep the sender's edit time. Re-stamping here
            // would make this device claim authorship of someone else's edit.
            StateManager.updateScheduledItem(item.id, {
                ...incomingItem,
                updatedAt: item.updatedAt
            }, true);
            updated++;
            if (item.status === 'cancelled') cancelled++;
        });

        StateManager.addSyncLogEntry({
            timestamp: new Date().toISOString(),
            direction: 'plans-import',
            machineId: pkg.metadata.machineId || null,
            machineName: pkg.metadata.machineName || 'Unknown',
            plansAdded: added,
            plansUpdated: updated
        });

        return { added, updated, skipped, cancelled, duplicates };
    }
}

export default new SyncService();
