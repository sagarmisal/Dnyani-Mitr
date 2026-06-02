import { describe, it, expect } from 'vitest';
import NotificationService from '../src/services/NotificationService.js';

// Node environment: no window.Capacitor → must degrade gracefully (the property
// that keeps desktop / browser builds safe).
describe('NotificationService non-native guard', () => {
    it('isAvailable() is false without Capacitor', () => {
        expect(NotificationService.isAvailable()).toBe(false);
    });

    it('sync() no-ops off-device and reports why', async () => {
        const res = await NotificationService.sync({ notificationsEnabled: true, notificationDigestTime: '09:00' });
        expect(res).toEqual({ scheduled: 0, reason: 'not-native' });
    });

    it('cancelAll() does not throw off-device', async () => {
        await expect(NotificationService.cancelAll()).resolves.toBeUndefined();
    });

    it('requestPermission() reports unavailable off-device', async () => {
        const res = await NotificationService.requestPermission();
        expect(res.granted).toBe(false);
    });
});
