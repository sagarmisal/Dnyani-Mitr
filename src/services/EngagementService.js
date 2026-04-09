// Engagement Service - Calculate visitor engagement health scores

import StateManager from '../core/state.js';
import VisitorService from './VisitorService.js';
import { ENGAGEMENT_THRESHOLDS } from '../utils/constants.js';

class EngagementService {
    /**
     * Calculate engagement score for a single visitor (0-100).
     * Components: Recency (40%), Frequency (30%), Variety (15%), Depth (15%)
     */
    calculateScore(visitorId) {
        const interactions = StateManager.getInteractions()
            .filter(i => i.visitorId === visitorId);
        const visitor = VisitorService.getById(visitorId);
        if (!visitor || visitor.status === 'deleted') return 0;

        const recency = this._recencyScore(interactions);
        const frequency = this._frequencyScore(interactions);
        const variety = this._varietyScore(interactions);
        const depth = this._depthScore(visitor);

        return Math.round(recency * 0.4 + frequency * 0.3 + variety * 0.15 + depth * 0.15);
    }

    /**
     * Recency: how recently the last interaction occurred.
     * 100 = today, 0 = 90+ days ago or never.
     */
    _recencyScore(interactions) {
        if (interactions.length === 0) return 0;

        const now = new Date();
        const lastDate = interactions.reduce((latest, i) => {
            const d = new Date(i.interactionDate);
            return d > latest ? d : latest;
        }, new Date(0));

        const daysSince = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

        if (daysSince <= 7) return 100;
        if (daysSince <= 14) return 85;
        if (daysSince <= 30) return 65;
        if (daysSince <= 60) return 40;
        if (daysSince <= 90) return 20;
        return 0;
    }

    /**
     * Frequency: interactions per quarter vs target (4 per quarter = 100).
     */
    _frequencyScore(interactions) {
        if (interactions.length === 0) return 0;

        const now = new Date();
        const quarterAgo = new Date(now);
        quarterAgo.setDate(quarterAgo.getDate() - 90);

        const recentCount = interactions.filter(i =>
            new Date(i.interactionDate) >= quarterAgo
        ).length;

        const target = 4; // 4 interactions per quarter = healthy
        return Math.min(100, Math.round((recentCount / target) * 100));
    }

    /**
     * Variety: mix of interaction types used (more types = higher score).
     */
    _varietyScore(interactions) {
        if (interactions.length === 0) return 0;

        const types = new Set(interactions.map(i => i.interactionType));
        // 1 type = 30, 2 = 60, 3+ = 100
        if (types.size >= 3) return 100;
        if (types.size === 2) return 60;
        return 30;
    }

    /**
     * Depth: how complete the visitor profile is.
     * Family members known, events tracked.
     */
    _depthScore(visitor) {
        let score = 0;
        const contacts = visitor.contacts || [];
        const selfContact = contacts.find(c => c.relationType === 'SELF');

        // Has phone (20 points)
        if (selfContact?.phones?.length > 0) score += 20;

        // Has email (10 points)
        if (selfContact?.emails?.length > 0) score += 10;

        // Has at least one event date (20 points)
        if (selfContact?.dob || selfContact?.marriageDate) score += 20;

        // Has family members (20 points)
        if (contacts.length > 1) score += 20;

        // Has address/city (10 points)
        if (visitor.city) score += 10;

        // Has category (10 points)
        if (visitor.category) score += 10;

        // Has notes (10 points)
        if (visitor.notes) score += 10;

        return Math.min(100, score);
    }

    /**
     * Get the engagement label for a score.
     */
    getLabel(score) {
        if (score >= ENGAGEMENT_THRESHOLDS.HEALTHY) return 'Healthy';
        if (score >= ENGAGEMENT_THRESHOLDS.ATTENTION) return 'Attention';
        if (score >= ENGAGEMENT_THRESHOLDS.AT_RISK) return 'At Risk';
        return 'Lapsed';
    }

    /**
     * Get CSS class for engagement score badge.
     */
    getColorClass(score) {
        if (score >= ENGAGEMENT_THRESHOLDS.HEALTHY) return 'engagement-healthy';
        if (score >= ENGAGEMENT_THRESHOLDS.ATTENTION) return 'engagement-attention';
        if (score >= ENGAGEMENT_THRESHOLDS.AT_RISK) return 'engagement-at-risk';
        return 'engagement-lapsed';
    }

    /**
     * Recalculate and cache scores for all active visitors.
     * Returns count of visitors updated.
     */
    recalculateAll() {
        const visitors = VisitorService.getAll();
        let updated = 0;

        visitors.forEach(visitor => {
            const score = this.calculateScore(visitor.id);
            const now = new Date().toISOString();

            if (visitor.engagementScore !== score) {
                StateManager.updateVisitor(visitor.id, {
                    engagementScore: score,
                    engagementUpdatedAt: now
                });
                updated++;
            }
        });

        return updated;
    }

    /**
     * Recalculate score for a single visitor and cache it.
     */
    recalculateForVisitor(visitorId) {
        const score = this.calculateScore(visitorId);
        StateManager.updateVisitor(visitorId, {
            engagementScore: score,
            engagementUpdatedAt: new Date().toISOString()
        });
        return score;
    }

    /**
     * Get last interaction date for a visitor.
     */
    getLastInteractionDate(visitorId) {
        const interactions = StateManager.getInteractions()
            .filter(i => i.visitorId === visitorId);

        if (interactions.length === 0) return null;

        return interactions.reduce((latest, i) => {
            const d = new Date(i.interactionDate);
            return d > new Date(latest) ? i.interactionDate : latest;
        }, interactions[0].interactionDate);
    }

    /**
     * Get days since last interaction for a visitor.
     */
    getDaysSinceLastInteraction(visitorId) {
        const lastDate = this.getLastInteractionDate(visitorId);
        if (!lastDate) return Infinity;

        const now = new Date();
        const last = new Date(lastDate);
        return Math.floor((now - last) / (1000 * 60 * 60 * 24));
    }

    /**
     * Detect lapsed visitors: no interaction in X days.
     * Returns two arrays: lapsed (had interactions before) and neverContacted.
     */
    getLapsedVisitors(thresholdDays = null) {
        const settings = StateManager.getSettings();
        const threshold = thresholdDays ?? settings.lapseThresholdDays ?? 60;
        const visitors = VisitorService.getAll().filter(v => !v.doNotContact);
        const allInteractions = StateManager.getInteractions();

        // Build maps: visitorId -> last interaction date, visitorId -> last interaction object
        const lastInteractionMap = new Map();
        const lastInteractionObjMap = new Map();
        allInteractions.forEach(i => {
            const existingDate = lastInteractionMap.get(i.visitorId);
            if (!existingDate || new Date(i.interactionDate) > new Date(existingDate)) {
                lastInteractionMap.set(i.visitorId, i.interactionDate);
                lastInteractionObjMap.set(i.visitorId, i);
            }
        });

        const lapsed = [];
        const neverContacted = [];

        visitors.forEach(visitor => {
            const lastDate = lastInteractionMap.get(visitor.id);

            if (!lastDate) {
                neverContacted.push({
                    visitor,
                    daysSince: Infinity,
                    lastInteractionDate: null,
                    lastInteractionType: null
                });
            } else {
                const daysSince = Math.floor(
                    (new Date() - new Date(lastDate)) / (1000 * 60 * 60 * 24)
                );

                if (daysSince >= threshold) {
                    const lastInteraction = lastInteractionObjMap.get(visitor.id);

                    lapsed.push({
                        visitor,
                        daysSince,
                        lastInteractionDate: lastDate,
                        lastInteractionType: lastInteraction?.interactionType || null,
                        lastInteractionBy: lastInteraction?.createdBy || null
                    });
                }
            }
        });

        // Sort: worst first (most days since contact)
        lapsed.sort((a, b) => b.daysSince - a.daysSince);
        neverContacted.sort((a, b) =>
            new Date(a.visitor.createdAt) - new Date(b.visitor.createdAt)
        );

        return { lapsed, neverContacted, threshold };
    }

    /**
     * Get data quality metrics (computed, no new state needed).
     */
    getDataQualityMetrics() {
        const visitors = VisitorService.getAll();
        const interactions = StateManager.getInteractions();

        if (visitors.length === 0) {
            return { totalVisitors: 0, withPhone: 0, withEvents: 0, withOutcome: 0, phonePercent: 0, eventsPercent: 0, outcomePercent: 0 };
        }

        let withPhone = 0;
        let withEvents = 0;

        visitors.forEach(v => {
            const self = v.contacts?.find(c => c.relationType === 'SELF');
            if (self?.phones?.length > 0 && self.phones[0]) withPhone++;
            if (self?.dob || self?.marriageDate || self?.deathDate) withEvents++;
        });

        const withOutcome = interactions.filter(i => i.outcome != null).length;

        return {
            totalVisitors: visitors.length,
            withPhone,
            withEvents,
            withOutcome,
            totalInteractions: interactions.length,
            phonePercent: Math.round((withPhone / visitors.length) * 100),
            eventsPercent: Math.round((withEvents / visitors.length) * 100),
            outcomePercent: interactions.length > 0
                ? Math.round((withOutcome / interactions.length) * 100)
                : 0
        };
    }
}

// Export singleton instance
export default new EngagementService();
