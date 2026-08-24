// LocalStorage Management

import { STORAGE_KEYS, APP_VERSION, DEFAULT_SETTINGS, DEFAULT_MESSAGE_TEMPLATES, DEFAULT_OCCASIONS } from '../utils/constants.js';
import { safeJSONParse } from '../utils/helpers.js';

/**
 * Storage Manager - Handles all localStorage operations
 */
class StorageManager {
    constructor() {
        this.storageKey = STORAGE_KEYS.APP_STATE;
        this.activationKey = STORAGE_KEYS.ACTIVATION;
    }

    /**
     * Load app state from localStorage
     */
    loadState() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (!data) return this.getDefaultState();

            const state = safeJSONParse(data, this.getDefaultState());

            // Schema migration runs ONLY on actual schema differences (v1.x or
            // v2.x → v3). v3.x.y → v3.a.b is just a release bump — no data shape
            // changed, so don't re-run the (idempotent but noisy) migration.
            // Before Iter 9.1 this was `state.version !== APP_VERSION`, which
            // re-migrated and spammed the console on every app version bump.
            const needsSchemaMigration = !state.version
                || state.version.startsWith('1.')
                || state.version.startsWith('2.');

            if (needsSchemaMigration) {
                return this.migrateState(state);
            }

            // Same MAJOR schema (v3.x). migrateState does NOT run here, so any
            // collections/fields introduced in a later v3 MINOR release (e.g.
            // Iter 10 occasions/campaigns + settings) must be back-filled
            // idempotently before use. Then refresh the version stamp silently.
            let changed = this.ensureForwardFields(state);
            if (state.version !== APP_VERSION) {
                state.version = APP_VERSION;
                changed = true;
            }
            if (changed) {
                this.saveState(state);
            }

            return state;
        } catch (error) {
            console.error('Error loading state:', error);
            return this.getDefaultState();
        }
    }

    /**
     * Save app state to localStorage
     */
    saveState(state) {
        try {
            const serialized = JSON.stringify(state);
            localStorage.setItem(this.storageKey, serialized);
            return true;
        } catch (error) {
            console.error('Error saving state:', error);

            // Check if quota exceeded
            if (error.name === 'QuotaExceededError') {
                console.error('LocalStorage quota exceeded!');
                // Could trigger cleanup or warning to user
            }

            return false;
        }
    }

    /**
     * Get default state structure
     */
    getDefaultState() {
        return {
            version: APP_VERSION,
            activated: false,
            machineId: null,
            machineRole: null,
            machineName: null,
            visitors: [],
            reminderActions: [],
            interactions: [],
            occasions: this._seedOccasions(),
            campaigns: [],
            scheduledItems: [],
            settings: { ...DEFAULT_SETTINGS },
            knownMachines: {},
            syncLog: []
        };
    }

    /**
     * Fresh deep copy of the seeded built-in occasions (Iter 10).
     */
    _seedOccasions() {
        return JSON.parse(JSON.stringify(DEFAULT_OCCASIONS));
    }

    /**
     * Idempotently back-fill collections/fields added in later v3 MINOR releases
     * onto an already-v3 state. Runs on same-major load (where migrateState does
     * not). Returns true if anything was added. Preserves existing data and any
     * falsy user-set values (uses `=== undefined` checks, not truthiness).
     */
    ensureForwardFields(state) {
        let changed = false;

        // Iter 10: occasions — seed ONCE if never present; respect later user deletions
        // (an empty array means the user cleared them, so don't resurrect).
        if (!Array.isArray(state.occasions)) {
            state.occasions = this._seedOccasions();
            changed = true;
        }
        // Iter 10: campaigns collection
        if (!Array.isArray(state.campaigns)) {
            state.campaigns = [];
            changed = true;
        }
        // Iter 11: scheduled items. Unlike occasions there is nothing to seed, so
        // an empty array is simply the correct initial state — no "user cleared
        // it" ambiguity to respect.
        if (!Array.isArray(state.scheduledItems)) {
            state.scheduledItems = [];
            changed = true;
        }
        // Iter 11: back-fill the follow-up completion field on existing
        // interactions. Records arriving from an older machine via sync do NOT
        // pass through the Interaction constructor (SyncService.merge assigns
        // plain objects), so every consumer must also treat a missing value as
        // null rather than relying on this pass alone.
        if (Array.isArray(state.interactions)) {
            state.interactions.forEach(i => {
                if (i && i.followUpCompletedAt === undefined) {
                    i.followUpCompletedAt = null;
                    changed = true;
                }
                // Phase 2: thanked-state and contribution. Same caveat as above —
                // records arriving through sync bypass the constructor, so every
                // consumer must also treat a missing value as null/[] rather than
                // trusting this pass. Note contribution CANNOT be backfilled with
                // real data: nobody recorded what past visitors brought, and
                // guessing would be inventing history.
                if (i && i.thankedAt === undefined) {
                    i.thankedAt = null;
                    changed = true;
                }
                if (i && !Array.isArray(i.contribution)) {
                    i.contribution = [];
                    changed = true;
                }
            });
        }
        // Iter 10: new settings fields
        if (!state.settings || typeof state.settings !== 'object') {
            state.settings = { ...DEFAULT_SETTINGS };
            changed = true;
        } else {
            const forwardSettings = {
                taglineMr: DEFAULT_SETTINGS.taglineMr,
                taglineEn: DEFAULT_SETTINGS.taglineEn,
                defaultCampaignLanguage: DEFAULT_SETTINGS.defaultCampaignLanguage,
                notificationsEnabled: DEFAULT_SETTINGS.notificationsEnabled,
                notificationDigestTime: DEFAULT_SETTINGS.notificationDigestTime,
                calendarStartsOn: DEFAULT_SETTINGS.calendarStartsOn,
                landingScreen: DEFAULT_SETTINGS.landingScreen,
                whatsNewSeenVersion: DEFAULT_SETTINGS.whatsNewSeenVersion
            };
            for (const key in forwardSettings) {
                if (state.settings[key] === undefined) {
                    state.settings[key] = forwardSettings[key];
                    changed = true;
                }
            }
        }

        return changed;
    }

    /**
     * Load activation data
     */
    loadActivation() {
        try {
            const data = localStorage.getItem(this.activationKey);
            return safeJSONParse(data, null);
        } catch (error) {
            console.error('Error loading activation:', error);
            return null;
        }
    }

    /**
     * Save activation data
     */
    saveActivation(activationData) {
        try {
            const serialized = JSON.stringify(activationData);
            localStorage.setItem(this.activationKey, serialized);
            return true;
        } catch (error) {
            console.error('Error saving activation:', error);
            return false;
        }
    }

    /**
     * Clear all data (for testing or reset)
     */
    clearAll() {
        try {
            localStorage.removeItem(this.storageKey);
            localStorage.removeItem(this.activationKey);
            return true;
        } catch (error) {
            console.error('Error clearing storage:', error);
            return false;
        }
    }

    /**
     * Migrate state from older version
     */
    migrateState(oldState) {
        console.log(`Migrating from version ${oldState.version} to ${APP_VERSION}`);

        // Start with default state
        const newState = this.getDefaultState();

        // Migrate data based on version
        if (oldState.version && oldState.version.startsWith('1.')) {
            // Migrate from v1 to v2
            newState.visitors = this.migrateV1Visitors(oldState.visitors || []);
            newState.reminderActions = oldState.reminderActions || [];
        } else {
            // Copy compatible fields
            newState.visitors = oldState.visitors || [];
            newState.reminderActions = oldState.reminderActions || [];
            newState.interactions = oldState.interactions || [];
            newState.settings = { ...DEFAULT_SETTINGS, ...oldState.settings };
        }

        // Preserve activation state
        newState.activated = oldState.activated || false;
        newState.machineId = oldState.machineId || null;
        newState.machineRole = oldState.machineRole || null;
        newState.machineName = oldState.machineName || null;

        // v2→v3 migration: add new fields with safe defaults
        newState.interactions = newState.interactions.map(i => ({
            ...i,
            outcome: i.outcome || null,
            duration: (i.duration != null) ? i.duration : null,
            followUpDate: i.followUpDate || null,
            followUpNotes: i.followUpNotes || '',
            followUpCompletedAt: i.followUpCompletedAt || null
        }));

        newState.visitors = newState.visitors.map(v => ({
            ...v,
            consentGiven: v.consentGiven || false,
            consentDate: v.consentDate || null,
            doNotContact: v.doNotContact || false,
            contactFrequencyDays: v.contactFrequencyDays || null,
            engagementScore: v.engagementScore || 0,
            engagementUpdatedAt: v.engagementUpdatedAt || null
        }));

        // Ensure v3 settings fields
        newState.settings.organizationName = newState.settings.organizationName || 'Sewa Sankalp Pratishthan';
        newState.settings.lapseThresholdDays = newState.settings.lapseThresholdDays || 60;
        newState.settings.messageTemplates = newState.settings.messageTemplates || { ...DEFAULT_MESSAGE_TEMPLATES };

        // Ensure v3 state-level fields
        newState.knownMachines = oldState.knownMachines || {};
        newState.syncLog = oldState.syncLog || [];
        // Carry over occasions/campaigns if an older state somehow had them; otherwise
        // newState already holds the seeded defaults from getDefaultState().
        if (Array.isArray(oldState.occasions)) newState.occasions = oldState.occasions;
        if (Array.isArray(oldState.campaigns)) newState.campaigns = oldState.campaigns;

        // Back-fill any later-v3-minor fields (idempotent) before persisting.
        this.ensureForwardFields(newState);

        // Save migrated state
        this.saveState(newState);

        return newState;
    }

    /**
     * Migrate v1 visitors to v2 format
     */
    migrateV1Visitors(v1Visitors) {
        // v1 had similar structure, just ensure compatibility
        return v1Visitors.map(visitor => ({
            ...visitor,
            // Ensure all required fields exist
            tags: visitor.tags || [],
            status: visitor.status || 'active',
            customFields: visitor.customFields || {},
            deletedAt: visitor.deletedAt || null
        }));
    }

    /**
     * Get storage usage info
     */
    getStorageInfo() {
        try {
            const stateSize = localStorage.getItem(this.storageKey)?.length || 0;
            const activationSize = localStorage.getItem(this.activationKey)?.length || 0;
            const totalSize = stateSize + activationSize;

            // Estimate in KB
            const sizeKB = (totalSize / 1024).toFixed(2);

            return {
                totalSize,
                sizeKB,
                stateSize,
                activationSize
            };
        } catch (error) {
            console.error('Error getting storage info:', error);
            return null;
        }
    }
}

// Export singleton instance
export default new StorageManager();
