// Interaction Service - Track visitor interactions

import StateManager from '../core/state.js';
import { Interaction } from '../models/Interaction.js';
import { getCurrentDate } from '../utils/formatters.js';
import ActivationManager from '../core/activation.js';
import EventBus, { EVENTS } from '../core/events.js';

class InteractionService {
    /**
     * Log an interaction
     */
    log(visitorId, interactionType, notes, contactId = null, interactionDate = null) {
        const machineInfo = ActivationManager.getMachineInfo();

        const interaction = new Interaction({
            visitorId,
            contactId,
            interactionType,
            notes,
            interactionDate: interactionDate || getCurrentDate(),
            createdBy: machineInfo.machineId
        });

        const success = StateManager.addInteraction(interaction.toJSON());

        if (!success) {
            throw new Error('Failed to log interaction');
        }

        return interaction;
    }

    /**
     * Get interactions for a visitor
     */
    getForVisitor(visitorId) {
        const interactions = StateManager.getInteractions();
        return interactions
            .filter(i => i.visitorId === visitorId)
            .sort((a, b) => new Date(b.interactionDate) - new Date(a.interactionDate));
    }

    /**
     * Get recent interactions
     */
    getRecent(limit = 10) {
        const interactions = StateManager.getInteractions();
        return interactions
            .sort((a, b) => new Date(b.interactionDate) - new Date(a.interactionDate))
            .slice(0, limit);
    }

    /**
     * Get interaction statistics
     */
    getStats() {
        const interactions = StateManager.getInteractions();

        const byType = {};
        interactions.forEach(i => {
            byType[i.interactionType] = (byType[i.interactionType] || 0) + 1;
        });

        return {
            total: interactions.length,
            byType
        };
    }
}

// Export singleton instance
export default new InteractionService();
