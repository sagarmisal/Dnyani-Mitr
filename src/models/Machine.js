// Machine Model

import { generateUUID } from '../utils/helpers.js';
import { getCurrentDate } from '../utils/formatters.js';
import { MACHINE_ROLES } from '../utils/constants.js';

export class Machine {
    constructor(data = {}) {
        this.id = data.id || generateUUID();
        this.name = data.name || '';
        this.role = data.role || MACHINE_ROLES.SATELLITE;
        this.activatedAt = data.activatedAt || getCurrentDate();
    }

    /**
     * Check if this is root machine
     */
    isRoot() {
        return this.role === MACHINE_ROLES.ROOT;
    }

    /**
     * Check if this is satellite machine
     */
    isSatellite() {
        return this.role === MACHINE_ROLES.SATELLITE;
    }

    /**
     * Convert to plain object
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            role: this.role,
            activatedAt: this.activatedAt
        };
    }

    /**
     * Create from plain object
     */
    static fromJSON(data) {
        return new Machine(data);
    }
}
