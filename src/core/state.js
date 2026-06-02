// State Management - Reactive state with observers

import StorageManager from './storage.js';
import EventBus, { EVENTS } from './events.js';
import { deepClone } from '../utils/helpers.js';

class StateManager {
    constructor() {
        this.state = null;
        this.observers = [];
        this.initialized = false;
    }

    /**
     * Initialize state from storage
     */
    async init() {
        if (this.initialized) return this.state;

        this.state = StorageManager.loadState();
        this.initialized = true;

        EventBus.emit(EVENTS.STATE_LOADED, this.state);

        return this.state;
    }

    /**
     * Get current state (read-only copy)
     */
    getState() {
        if (!this.initialized) {
            throw new Error('State not initialized. Call init() first.');
        }
        return deepClone(this.state);
    }

    /**
     * Update state
     */
    setState(updates) {
        if (!this.initialized) {
            throw new Error('State not initialized. Call init() first.');
        }

        // Merge updates
        this.state = {
            ...this.state,
            ...updates
        };

        // Persist to storage
        const saved = StorageManager.saveState(this.state);

        if (saved) {
            // Notify observers
            this.notifyObservers();

            // Emit events
            EventBus.emit(EVENTS.STATE_CHANGED, this.state);
            EventBus.emit(EVENTS.STATE_SAVED, this.state);
        }

        return saved;
    }

    /**
     * Update specific part of state
     */
    updateState(path, value) {
        if (!this.initialized) {
            throw new Error('State not initialized. Call init() first.');
        }

        // Simple path update (e.g., 'settings.theme')
        const parts = path.split('.');
        let current = this.state;

        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }

        current[parts[parts.length - 1]] = value;

        // Persist and notify
        const saved = StorageManager.saveState(this.state);

        if (saved) {
            this.notifyObservers();
            EventBus.emit(EVENTS.STATE_CHANGED, this.state);
            EventBus.emit(EVENTS.STATE_SAVED, this.state);
        }

        return saved;
    }

    /**
     * Subscribe to state changes
     */
    subscribe(observer) {
        this.observers.push(observer);

        // Return unsubscribe function
        return () => {
            const index = this.observers.indexOf(observer);
            if (index > -1) {
                this.observers.splice(index, 1);
            }
        };
    }

    /**
     * Notify all observers
     */
    notifyObservers() {
        const stateCopy = this.getState();
        this.observers.forEach(observer => {
            try {
                observer(stateCopy);
            } catch (error) {
                console.error('Error in state observer:', error);
            }
        });
    }

    /**
     * Get visitors
     */
    getVisitors() {
        return deepClone(this.state.visitors || []);
    }

    /**
     * Add visitor
     */
    addVisitor(visitor) {
        this.state.visitors.push(visitor);
        const saved = StorageManager.saveState(this.state);

        if (saved) {
            this.notifyObservers();
            EventBus.emit(EVENTS.VISITOR_ADDED, visitor);
            EventBus.emit(EVENTS.STATE_CHANGED, this.state);
        }

        return saved;
    }

    /**
     * Update visitor
     */
    updateVisitor(visitorId, updates) {
        const index = this.state.visitors.findIndex(v => v.id === visitorId);

        if (index === -1) {
            console.error('Visitor not found:', visitorId);
            return false;
        }

        this.state.visitors[index] = {
            ...this.state.visitors[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        const saved = StorageManager.saveState(this.state);

        if (saved) {
            this.notifyObservers();
            EventBus.emit(EVENTS.VISITOR_UPDATED, this.state.visitors[index]);
            EventBus.emit(EVENTS.STATE_CHANGED, this.state);
        }

        return saved;
    }

    /**
     * Delete visitor (soft delete)
     */
    deleteVisitor(visitorId) {
        const index = this.state.visitors.findIndex(v => v.id === visitorId);

        if (index === -1) {
            console.error('Visitor not found:', visitorId);
            return false;
        }

        this.state.visitors[index].deletedAt = new Date().toISOString();
        this.state.visitors[index].status = 'deleted';

        const saved = StorageManager.saveState(this.state);

        if (saved) {
            this.notifyObservers();
            EventBus.emit(EVENTS.VISITOR_DELETED, visitorId);
            EventBus.emit(EVENTS.STATE_CHANGED, this.state);
        }

        return saved;
    }

    /**
     * Get reminder actions
     */
    getReminderActions() {
        return deepClone(this.state.reminderActions || []);
    }

    /**
     * Add reminder action
     */
    addReminderAction(action) {
        this.state.reminderActions.push(action);
        const saved = StorageManager.saveState(this.state);

        if (saved) {
            this.notifyObservers();
            EventBus.emit(EVENTS.REMINDER_ACTION_CREATED, action);
            EventBus.emit(EVENTS.STATE_CHANGED, this.state);
        }

        return saved;
    }

    /**
     * Get interactions
     */
    getInteractions() {
        return deepClone(this.state.interactions || []);
    }

    /**
     * Add interaction
     */
    addInteraction(interaction) {
        this.state.interactions.push(interaction);
        const saved = StorageManager.saveState(this.state);

        if (saved) {
            this.notifyObservers();
            EventBus.emit(EVENTS.INTERACTION_ADDED, interaction);
            EventBus.emit(EVENTS.STATE_CHANGED, this.state);
        }

        return saved;
    }

    /**
     * Persist + notify helper (used by occasion/campaign mutators).
     */
    _saveAndNotify() {
        const saved = StorageManager.saveState(this.state);
        if (saved) {
            this.notifyObservers();
            EventBus.emit(EVENTS.STATE_CHANGED, this.state);
        }
        return saved;
    }

    // ─── Occasions (Iter 10) ───────────────────────────────────────────────
    getOccasions() {
        return deepClone(this.state.occasions || []);
    }

    addOccasion(occasion) {
        if (!this.state.occasions) this.state.occasions = [];
        this.state.occasions.push(occasion);
        return this._saveAndNotify();
    }

    updateOccasion(occasionId, updates) {
        const list = this.state.occasions || [];
        const index = list.findIndex(o => o.id === occasionId);
        if (index === -1) return false;
        list[index] = { ...list[index], ...updates, updatedAt: new Date().toISOString() };
        return this._saveAndNotify();
    }

    deleteOccasion(occasionId) {
        const list = this.state.occasions || [];
        const next = list.filter(o => o.id !== occasionId);
        if (next.length === list.length) return false;
        this.state.occasions = next;
        return this._saveAndNotify();
    }

    // ─── Campaigns (Iter 10) ───────────────────────────────────────────────
    getCampaigns() {
        return deepClone(this.state.campaigns || []);
    }

    addCampaign(campaign) {
        if (!this.state.campaigns) this.state.campaigns = [];
        this.state.campaigns.push(campaign);
        return this._saveAndNotify();
    }

    updateCampaign(campaignId, updates) {
        const list = this.state.campaigns || [];
        const index = list.findIndex(c => c.id === campaignId);
        if (index === -1) return false;
        list[index] = { ...list[index], ...updates, updatedAt: new Date().toISOString() };
        return this._saveAndNotify();
    }

    /**
     * Get settings
     */
    getSettings() {
        return deepClone(this.state.settings || {});
    }

    /**
     * Get known machines map
     */
    getKnownMachines() {
        return { ...(this.state.knownMachines || {}) };
    }

    /**
     * Register a known machine (from sync metadata)
     */
    registerKnownMachine(machineId, machineName) {
        if (!machineId) return;
        if (!this.state.knownMachines) this.state.knownMachines = {};
        this.state.knownMachines[machineId] = machineName || machineId;
        StorageManager.saveState(this.state);
    }

    /**
     * Get machine name by ID (from knownMachines)
     */
    getMachineName(machineId) {
        if (!machineId) return null;
        // Check if it's the current machine
        if (this.state.machineId === machineId) return this.state.machineName;
        return this.state.knownMachines?.[machineId] || null;
    }

    /**
     * Get sync log
     */
    getSyncLog() {
        return [...(this.state.syncLog || [])];
    }

    /**
     * Add sync log entry (keep last 50)
     */
    addSyncLogEntry(entry) {
        if (!this.state.syncLog) this.state.syncLog = [];
        this.state.syncLog.unshift(entry);
        if (this.state.syncLog.length > 50) {
            this.state.syncLog = this.state.syncLog.slice(0, 50);
        }
        StorageManager.saveState(this.state);
    }

    /**
     * Update settings
     */
    updateSettings(updates) {
        this.state.settings = {
            ...this.state.settings,
            ...updates
        };

        return StorageManager.saveState(this.state);
    }

    /**
     * Check if activated
     */
    isActivated() {
        return this.state.activated === true;
    }

    /**
     * Get machine info
     */
    getMachineInfo() {
        return {
            machineId: this.state.machineId,
            machineRole: this.state.machineRole,
            machineName: this.state.machineName
        };
    }
}

// Export singleton instance
export default new StateManager();
