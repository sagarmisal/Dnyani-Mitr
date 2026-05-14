import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the heavy dependencies — we only care about SmsService's own logic here.
vi.mock('../src/services/InteractionService.js', () => ({
    default: { log: vi.fn() }
}));
vi.mock('../src/services/ReminderService.js', () => ({
    default: { recordAction: vi.fn() }
}));
vi.mock('../src/components/UI/InteractionLogger.js', () => ({
    InteractionLogger: {
        composeMessage: vi.fn((eventType, name) => `Happy ${eventType} ${name}!`),
        openSMS: vi.fn()
    }
}));

// Import after mocks so the mocked modules are wired.
const { default: SmsService, SMS_SEND_INTERVAL_MS } = await import('../src/services/SmsService.js');
const { default: InteractionService } = await import('../src/services/InteractionService.js');
const { default: ReminderService } = await import('../src/services/ReminderService.js');

function setCapacitor(plugin, isNative = true) {
    globalThis.window = globalThis.window || {};
    globalThis.window.Capacitor = {
        isNativePlatform: () => isNative,
        Plugins: plugin ? { Sms: plugin } : {}
    };
}

function clearCapacitor() {
    if (globalThis.window) delete globalThis.window.Capacitor;
}

describe('SmsService.checkCapability', () => {
    beforeEach(() => clearCapacitor());

    it('returns PROTOCOL when not running in Capacitor', async () => {
        const res = await SmsService.checkCapability();
        expect(res.mode).toBe(SmsService.CAPABILITY.PROTOCOL);
        expect(res.granted).toBe(false);
    });

    it('returns PROTOCOL when plugin is missing', async () => {
        setCapacitor(null);
        const res = await SmsService.checkCapability();
        expect(res.mode).toBe(SmsService.CAPABILITY.PROTOCOL);
        expect(res.reason).toMatch(/plugin/i);
    });

    it('returns NATIVE when plugin reports permission granted', async () => {
        setCapacitor({ checkPermission: async () => ({ granted: true }) });
        const res = await SmsService.checkCapability();
        expect(res.mode).toBe(SmsService.CAPABILITY.NATIVE);
        expect(res.granted).toBe(true);
    });

    it('returns PROTOCOL when plugin reports permission denied', async () => {
        setCapacitor({ checkPermission: async () => ({ granted: false }) });
        const res = await SmsService.checkCapability();
        expect(res.mode).toBe(SmsService.CAPABILITY.PROTOCOL);
        expect(res.granted).toBe(false);
    });

    it('returns PROTOCOL when plugin throws', async () => {
        setCapacitor({ checkPermission: async () => { throw new Error('boom'); } });
        const res = await SmsService.checkCapability();
        expect(res.mode).toBe(SmsService.CAPABILITY.PROTOCOL);
        expect(res.reason).toContain('boom');
    });
});

describe('SmsService.sendBulkNative', () => {
    beforeEach(() => {
        clearCapacitor();
        InteractionService.log.mockClear();
        ReminderService.recordAction.mockClear();
    });

    const sampleItems = (n) => Array.from({ length: n }, (_, i) => ({
        visitorId: `v${i}`,
        reminderId: `r${i}`,
        contactName: `Contact ${i}`,
        phone: `98765432${String(i).padStart(2, '0')}`,
        eventType: 'Birthday'
    }));

    it('sends each item, logs interactions, marks reminders', async () => {
        const sendSms = vi.fn(async () => ({ sent: true, parts: 1 }));
        setCapacitor({ sendSms, checkPermission: async () => ({ granted: true }) });

        const progress = [];
        const result = await SmsService.sendBulkNative(sampleItems(3), {
            onProgress: (p) => progress.push({ index: p.index, status: p.status })
        });

        expect(result.sent).toBe(3);
        expect(result.failed).toBe(0);
        expect(sendSms).toHaveBeenCalledTimes(3);
        expect(InteractionService.log).toHaveBeenCalledTimes(3);
        expect(ReminderService.recordAction).toHaveBeenCalledTimes(3);

        // Each item should report sending then sent.
        expect(progress.filter(p => p.status === 'sending').length).toBe(3);
        expect(progress.filter(p => p.status === 'sent').length).toBe(3);
    });

    it('surfaces log failures as warnings without marking the send as failed', async () => {
        const sendSms = vi.fn(async () => ({ sent: true, parts: 1 }));
        setCapacitor({ sendSms, checkPermission: async () => ({ granted: true }) });

        // First call to log() succeeds, second throws.
        InteractionService.log
            .mockImplementationOnce(() => undefined)
            .mockImplementationOnce(() => { throw new Error('localStorage quota exceeded'); });

        const result = await SmsService.sendBulkNative(sampleItems(2));

        // Both SMSes went out (carrier received them).
        expect(result.sent).toBe(2);
        expect(result.failed).toBe(0);
        // But one logging call failed — surfaced as a warning, not a failure.
        expect(result.logWarnings).toHaveLength(1);
        expect(result.logWarnings[0].logError).toMatch(/quota/i);
    });

    it('reports invalid phone as failure without calling the plugin', async () => {
        const sendSms = vi.fn(async () => ({ sent: true, parts: 1 }));
        setCapacitor({ sendSms, checkPermission: async () => ({ granted: true }) });

        const items = [{ visitorId: 'v1', contactName: 'A', phone: 'abc', eventType: 'Birthday' }];
        const result = await SmsService.sendBulkNative(items);

        expect(result.sent).toBe(0);
        expect(result.failed).toBe(1);
        expect(sendSms).not.toHaveBeenCalled();
        expect(InteractionService.log).not.toHaveBeenCalled();
    });

    it('aborts early when plugin reports PERMISSION_DENIED', async () => {
        const sendSms = vi.fn()
            .mockResolvedValueOnce({ sent: true, parts: 1 })
            .mockRejectedValueOnce(new Error('PERMISSION_DENIED: revoked'));
        setCapacitor({ sendSms, checkPermission: async () => ({ granted: true }) });

        const result = await SmsService.sendBulkNative(sampleItems(5));

        expect(result.cancelled).toBe(true);
        expect(result.permissionRevoked).toBe(true);
        expect(result.sent).toBe(1);
        expect(sendSms).toHaveBeenCalledTimes(2);
    });

    it('honours shouldCancel between sends', async () => {
        const sendSms = vi.fn(async () => ({ sent: true, parts: 1 }));
        setCapacitor({ sendSms, checkPermission: async () => ({ granted: true }) });

        let calls = 0;
        const shouldCancel = () => ++calls > 1;

        const result = await SmsService.sendBulkNative(sampleItems(5), { shouldCancel });

        expect(result.cancelled).toBe(true);
        expect(result.sent).toBe(1);
        expect(sendSms).toHaveBeenCalledTimes(1);
    });

    it('paces sends with the configured interval', async () => {
        // Fake timers — we don't want a real 1.5s wait per send in tests.
        vi.useFakeTimers();
        const sendSms = vi.fn(async () => ({ sent: true, parts: 1 }));
        setCapacitor({ sendSms, checkPermission: async () => ({ granted: true }) });

        const promise = SmsService.sendBulkNative(sampleItems(3));
        // Drain pending microtasks + timers
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result.sent).toBe(3);
        expect(SMS_SEND_INTERVAL_MS).toBeGreaterThanOrEqual(1000);
        vi.useRealTimers();
    });
});

describe('SmsService.requestPermission', () => {
    beforeEach(() => clearCapacitor());

    it('returns granted=false when not on Capacitor', async () => {
        const res = await SmsService.requestPermission();
        expect(res.granted).toBe(false);
    });

    it('forwards the plugin response when on Capacitor', async () => {
        setCapacitor({ requestPermission: async () => ({ granted: true, state: 'granted' }) });
        const res = await SmsService.requestPermission();
        expect(res.granted).toBe(true);
        expect(res.state).toBe('granted');
    });
});
