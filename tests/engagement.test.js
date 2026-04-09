import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// Mock dependencies
const mockVisitors = [];
const mockInteractions = [];
const mockSettings = { lapseThresholdDays: 60 };

vi.mock('../src/core/state.js', () => ({
    default: {
        getInteractions: () => [...mockInteractions],
        getVisitors: () => [...mockVisitors],
        getSettings: () => ({ ...mockSettings }),
        updateVisitor: vi.fn(() => true),
        getMachineInfo: () => ({ machineId: 'machine_1', machineName: 'Test Machine', machineRole: 'root' }),
        getKnownMachines: () => ({}),
        getMachineName: (id) => id === 'machine_1' ? 'Test Machine' : null
    }
}));

vi.mock('../src/services/VisitorService.js', () => ({
    default: {
        getAll: () => mockVisitors.filter(v => v.status === 'active' && !v.deletedAt),
        getById: (id) => mockVisitors.find(v => v.id === id) || null
    }
}));

vi.mock('../src/utils/constants.js', () => ({
    ENGAGEMENT_THRESHOLDS: { HEALTHY: 80, ATTENTION: 50, AT_RISK: 25 }
}));

describe('EngagementService', () => {
    let EngagementService;

    beforeAll(async () => {
        const mod = await import('../src/services/EngagementService.js');
        EngagementService = mod.default;
    });

    beforeEach(() => {
        mockVisitors.length = 0;
        mockInteractions.length = 0;
    });

    function makeVisitor(id, opts = {}) {
        const v = {
            id,
            status: 'active',
            deletedAt: null,
            doNotContact: false,
            category: opts.category || '',
            city: opts.city || '',
            notes: opts.notes || '',
            contacts: opts.contacts || [
                { relationType: 'SELF', name: 'Test', phones: ['9876543210'], emails: [], dob: '1990-01-15' }
            ],
            engagementScore: 0,
            engagementUpdatedAt: null,
            createdAt: opts.createdAt || '2026-01-01T00:00:00Z',
            ...opts
        };
        mockVisitors.push(v);
        return v;
    }

    function makeInteraction(visitorId, opts = {}) {
        const i = {
            id: `int_${Math.random().toString(36).slice(2)}`,
            visitorId,
            interactionType: opts.type || 'call',
            interactionDate: opts.date || new Date().toISOString(),
            outcome: opts.outcome || null,
            createdBy: opts.createdBy || 'machine_1',
            notes: '',
            duration: null,
            followUpDate: null,
            followUpNotes: ''
        };
        mockInteractions.push(i);
        return i;
    }

    describe('calculateScore', () => {
        it('returns low score for visitor with no interactions (only depth component)', () => {
            makeVisitor('v1');
            const score = EngagementService.calculateScore('v1');
            // No recency/frequency/variety, but depth gives points for phone + dob
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThan(20);
        });

        it('returns > 0 for visitor with recent interaction', () => {
            makeVisitor('v1');
            makeInteraction('v1', { date: new Date().toISOString() });
            const score = EngagementService.calculateScore('v1');
            expect(score).toBeGreaterThan(0);
        });

        it('gives higher score for more recent interactions', () => {
            makeVisitor('v1');
            makeInteraction('v1', { date: new Date().toISOString() });

            makeVisitor('v2');
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 80);
            makeInteraction('v2', { date: oldDate.toISOString() });

            const score1 = EngagementService.calculateScore('v1');
            const score2 = EngagementService.calculateScore('v2');
            expect(score1).toBeGreaterThan(score2);
        });

        it('gives higher score for variety of interaction types', () => {
            makeVisitor('v1');
            makeInteraction('v1', { type: 'call' });
            makeInteraction('v1', { type: 'whatsapp' });
            makeInteraction('v1', { type: 'visit' });

            makeVisitor('v2');
            makeInteraction('v2', { type: 'call' });
            makeInteraction('v2', { type: 'call' });
            makeInteraction('v2', { type: 'call' });

            const score1 = EngagementService.calculateScore('v1');
            const score2 = EngagementService.calculateScore('v2');
            expect(score1).toBeGreaterThan(score2);
        });

        it('returns 0 for deleted visitor', () => {
            makeVisitor('v1', { status: 'deleted' });
            makeInteraction('v1');
            expect(EngagementService.calculateScore('v1')).toBe(0);
        });

        it('returns 0 for non-existent visitor', () => {
            expect(EngagementService.calculateScore('nonexistent')).toBe(0);
        });
    });

    describe('getLabel and getColorClass', () => {
        it('returns correct labels for thresholds', () => {
            expect(EngagementService.getLabel(90)).toBe('Healthy');
            expect(EngagementService.getLabel(60)).toBe('Attention');
            expect(EngagementService.getLabel(30)).toBe('At Risk');
            expect(EngagementService.getLabel(10)).toBe('Lapsed');
        });

        it('returns correct CSS classes', () => {
            expect(EngagementService.getColorClass(90)).toBe('engagement-healthy');
            expect(EngagementService.getColorClass(60)).toBe('engagement-attention');
            expect(EngagementService.getColorClass(30)).toBe('engagement-at-risk');
            expect(EngagementService.getColorClass(10)).toBe('engagement-lapsed');
        });
    });

    describe('getDaysSinceLastInteraction', () => {
        it('returns Infinity for visitor with no interactions', () => {
            makeVisitor('v1');
            expect(EngagementService.getDaysSinceLastInteraction('v1')).toBe(Infinity);
        });

        it('returns 0 for visitor contacted today', () => {
            makeVisitor('v1');
            makeInteraction('v1', { date: new Date().toISOString() });
            expect(EngagementService.getDaysSinceLastInteraction('v1')).toBe(0);
        });
    });

    describe('getLapsedVisitors', () => {
        it('returns empty arrays when no visitors exist', () => {
            const result = EngagementService.getLapsedVisitors();
            expect(result.lapsed).toHaveLength(0);
            expect(result.neverContacted).toHaveLength(0);
        });

        it('classifies visitor with no interactions as never contacted', () => {
            makeVisitor('v1');
            const result = EngagementService.getLapsedVisitors();
            expect(result.neverContacted).toHaveLength(1);
            expect(result.lapsed).toHaveLength(0);
        });

        it('classifies visitor with old interaction as lapsed', () => {
            makeVisitor('v1');
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 90);
            makeInteraction('v1', { date: oldDate.toISOString() });

            const result = EngagementService.getLapsedVisitors(60);
            expect(result.lapsed).toHaveLength(1);
            expect(result.lapsed[0].daysSince).toBeGreaterThanOrEqual(90);
        });

        it('excludes doNotContact visitors', () => {
            makeVisitor('v1', { doNotContact: true });
            const result = EngagementService.getLapsedVisitors();
            expect(result.neverContacted).toHaveLength(0);
            expect(result.lapsed).toHaveLength(0);
        });

        it('does not include recently contacted visitors as lapsed', () => {
            makeVisitor('v1');
            makeInteraction('v1', { date: new Date().toISOString() });
            const result = EngagementService.getLapsedVisitors(60);
            expect(result.lapsed).toHaveLength(0);
        });

        it('uses custom threshold', () => {
            makeVisitor('v1');
            const date = new Date();
            date.setDate(date.getDate() - 35);
            makeInteraction('v1', { date: date.toISOString() });

            // 30-day threshold: should be lapsed
            const result30 = EngagementService.getLapsedVisitors(30);
            expect(result30.lapsed).toHaveLength(1);

            // 60-day threshold: should not be lapsed
            const result60 = EngagementService.getLapsedVisitors(60);
            expect(result60.lapsed).toHaveLength(0);
        });
    });

    describe('getDataQualityMetrics', () => {
        it('returns zeros when no visitors', () => {
            const metrics = EngagementService.getDataQualityMetrics();
            expect(metrics.totalVisitors).toBe(0);
            expect(metrics.phonePercent).toBe(0);
        });

        it('calculates percentages correctly', () => {
            makeVisitor('v1', { contacts: [{ relationType: 'SELF', name: 'A', phones: ['123'], emails: [], dob: '1990-01-01' }] });
            makeVisitor('v2', { contacts: [{ relationType: 'SELF', name: 'B', phones: [], emails: [] }] });

            const metrics = EngagementService.getDataQualityMetrics();
            expect(metrics.totalVisitors).toBe(2);
            expect(metrics.withPhone).toBe(1);
            expect(metrics.phonePercent).toBe(50);
            expect(metrics.withEvents).toBe(1);
            expect(metrics.eventsPercent).toBe(50);
        });

        it('calculates outcome percentage from interactions', () => {
            makeVisitor('v1');
            makeInteraction('v1', { outcome: 'successful' });
            makeInteraction('v1', { outcome: null });

            const metrics = EngagementService.getDataQualityMetrics();
            expect(metrics.totalInteractions).toBe(2);
            expect(metrics.withOutcome).toBe(1);
            expect(metrics.outcomePercent).toBe(50);
        });
    });
});
