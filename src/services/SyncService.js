// Sync Service - Logic for merging and reconciling data between machines

import StateManager from '../core/state.js';
import VisitorService from './VisitorService.js';
import EventBus, { EVENTS } from '../core/events.js';

class SyncService {
    /**
     * Merge incoming data package into local state
     */
    merge(packageData) {
        if (!packageData || !packageData.visitors) {
            throw new Error('Invalid sync package: No visitor data found');
        }

        const currentState = StateManager.getState();
        const incomingVisitors = packageData.visitors;
        const incomingInteractions = packageData.interactions || [];
        const incomingActions = packageData.reminderActions || [];

        // 1. Merge Visitors
        const visitorMap = new Map();
        currentState.visitors.forEach(v => visitorMap.set(v.id, v));

        let updatedCount = 0;
        let addedCount = 0;

        incomingVisitors.forEach(incoming => {
            if (visitorMap.has(incoming.id)) {
                const existing = visitorMap.get(incoming.id);
                // Keep the one with the latest updatedAt
                if (new Date(incoming.updatedAt) > new Date(existing.updatedAt)) {
                    visitorMap.set(incoming.id, incoming);
                    updatedCount++;
                }
            } else {
                visitorMap.set(incoming.id, incoming);
                addedCount++;
            }
        });

        // 2. Merge Interactions (avoid duplicates by ID)
        const interactionIds = new Set(currentState.interactions.map(i => i.id));
        const mergedInteractions = [...currentState.interactions];

        incomingInteractions.forEach(i => {
            if (!interactionIds.has(i.id)) {
                mergedInteractions.push(i);
            }
        });

        // 3. Merge Reminder Actions
        const actionIds = new Set(currentState.reminderActions.map(a => a.id));
        const mergedActions = [...currentState.reminderActions];

        incomingActions.forEach(a => {
            if (!actionIds.has(a.id)) {
                mergedActions.push(a);
            }
        });

        // 4. Save updated state
        StateManager.setState({
            visitors: Array.from(visitorMap.values()),
            interactions: mergedInteractions,
            reminderActions: mergedActions
        });

        EventBus.emit(EVENTS.DATA_CHANGED);

        return {
            visitorsAdded: addedCount,
            visitorsUpdated: updatedCount,
            interactionsAdded: mergedInteractions.length - currentState.interactions.length,
            actionsAdded: mergedActions.length - currentState.reminderActions.length
        };
    }

    /**
     * Prepare an export package
     */
    prepareExport() {
        const state = StateManager.getState();
        const machine = StateManager.getSettings().machine || {};

        return {
            metadata: {
                exportedAt: new Date().toISOString(),
                machineId: machine.machineId,
                machineName: machine.machineName,
                machineRole: machine.machineRole
            },
            data: {
                visitors: state.visitors,
                interactions: state.interactions,
                reminderActions: state.reminderActions
            }
        };
    }
}

export default new SyncService();
