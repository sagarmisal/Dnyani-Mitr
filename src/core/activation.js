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
