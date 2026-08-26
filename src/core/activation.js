// Activation System - Master Key Validation and Machine Setup

import StorageManager from './storage.js';
import StateManager from './state.js';
import EventBus, { EVENTS } from './events.js';
import { validateMasterKey } from '../utils/crypto.js';
import { validateMasterKeyFormat } from '../utils/validators.js';
import { generateUUID } from '../utils/helpers.js';
import { MACHINE_ROLES } from '../utils/constants.js';

class ActivationManager {
    constructor() {
        this.activationData = null;
    }

    /**
     * Check if app is activated
     */
    isActivated() {
        if (this.activationData) return true;

        // Load from storage
        this.activationData = StorageManager.loadActivation();
        return this.activationData !== null && this.activationData.activated === true;
    }

    /**
     * Make sure this device has an identity, without asking anyone anything.
     * (INITIATIVE.md D-28, P2.14/P2.15 — answers Q-01.)
     *
     * WHY THE GATE WENT
     * -----------------
     * The master key never protected anything: the valid keys were listed in
     * KEYS.md, in the repository, and any device with the file could type one.
     * What it did do was stand in the doorway — the first screen a volunteer
     * met was a code they had to obtain from us, followed by "Root Machine or
     * Satellite Machine?", an architecture question asked of someone with no
     * basis to answer it, before the app had shown them a single thing worth
     * having. With adoption from zero as the actual problem (D-27), a wall at
     * the front door is the most expensive thing in the app.
     *
     * Provenance is handled properly now, by D-22: the Seva Sankalp mark is on
     * every screen and cannot be edited. That is a better claim of authorship
     * than a shared code ever was.
     *
     * WHAT SURVIVES
     * -------------
     * machineId stamps createdBy on every record and is the identity sync
     * merges on, so it is still generated — just silently, here. Role defaults
     * to satellite because that is the safe assumption: a satellite that should
     * have been root can be promoted in Settings, whereas a device wrongly
     * believing it is root claims authority over deletions it should not have.
     *
     * Idempotent. An already-activated device keeps the identity it has, so
     * upgrading changes nothing about who this machine is.
     */
    ensureActivated() {
        if (this.isActivated()) return this.getMachineInfo();

        const machineId = generateUUID();
        const data = {
            activated: true,
            activatedAt: new Date().toISOString(),
            machineId,
            machineName: 'This device',
            machineRole: MACHINE_ROLES.SATELLITE,
            autoProvisioned: true      // so we can tell these apart later
        };
        StorageManager.saveActivation(data);
        this.activationData = data;
        return this.getMachineInfo();
    }

    /**
     * Activate with master key
     */
    activate(masterKey, machineSetup) {
        // Validate key format
        if (!validateMasterKeyFormat(masterKey)) {
            EventBus.emit(EVENTS.ACTIVATION_FAILED, 'Invalid key format');
            return {
                success: false,
                error: 'Invalid key format. Expected format: SSP-XXXX-XXXX-XXXX'
            };
        }

        // Validate key
        if (!validateMasterKey(masterKey)) {
            EventBus.emit(EVENTS.ACTIVATION_FAILED, 'Invalid key');
            return {
                success: false,
                error: 'Invalid master key. Please check your key and try again.'
            };
        }

        // Validate machine setup
        if (!machineSetup || !machineSetup.machineName || !machineSetup.machineRole) {
            return {
                success: false,
                error: 'Machine name and role are required'
            };
        }

        if (!Object.values(MACHINE_ROLES).includes(machineSetup.machineRole)) {
            return {
                success: false,
                error: 'Invalid machine role'
            };
        }

        // Generate machine ID
        const machineId = generateUUID();

        // Create activation data
        this.activationData = {
            activated: true,
            activatedAt: new Date().toISOString(),
            machineId,
            machineName: machineSetup.machineName,
            machineRole: machineSetup.machineRole
        };

        // Save activation
        const saved = StorageManager.saveActivation(this.activationData);

        if (!saved) {
            return {
                success: false,
                error: 'Failed to save activation data'
            };
        }

        // Update app state
        StateManager.setState({
            activated: true,
            machineId,
            machineName: machineSetup.machineName,
            machineRole: machineSetup.machineRole
        });

        // Emit success event
        EventBus.emit(EVENTS.ACTIVATION_SUCCESS, this.activationData);

        return {
            success: true,
            data: this.activationData
        };
    }

    /**
     * Get activation data
     */
    getActivationData() {
        if (!this.activationData) {
            this.activationData = StorageManager.loadActivation();
        }
        return this.activationData;
    }

    /**
     * Get machine info
     */
    getMachineInfo() {
        const data = this.getActivationData();
        if (!data) return null;

        return {
            machineId: data.machineId,
            machineName: data.machineName,
            machineRole: data.machineRole,
            activatedAt: data.activatedAt
        };
    }

    /**
     * Deactivate (for testing/reset)
     */
    deactivate() {
        this.activationData = null;
        StorageManager.saveActivation(null);

        StateManager.setState({
            activated: false,
            machineId: null,
            machineName: null,
            machineRole: null
        });

        return true;
    }
}

// Export singleton instance
export default new ActivationManager();
