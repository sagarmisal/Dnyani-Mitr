// LocalStorage Management

import { STORAGE_KEYS, APP_VERSION, DEFAULT_SETTINGS, DEFAULT_MESSAGE_TEMPLATES } from '../utils/constants.js';
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

            // Migrate if needed
            if (state.version !== APP_VERSION) {
                return this.migrateState(state);
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
            settings: { ...DEFAULT_SETTINGS },
            knownMachines: {},
            syncLog: []
        };
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
            followUpNotes: i.followUpNotes || ''
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
