// @vitest-environment happy-dom
/**
 * INITIATIVE.md D-28 / P2.14 / P2.15 — the front door.
 *
 * The first screen a volunteer met used to be a master key they had to obtain
 * from us, followed by "Root Machine or Satellite Machine?" — an architecture
 * question asked of someone with no basis to answer it, before the app had
 * shown them anything worth having.
 *
 * The key protected nothing: the valid ones shipped in KEYS.md, in the repo.
 * With adoption from zero as the real problem, a wall at the front door is the
 * most expensive thing in the app.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import ActivationManager from '../src/core/activation.js';
import StorageManager from '../src/core/storage.js';

beforeEach(() => {
    localStorage.clear();
    ActivationManager.activationData = null;
});

describe('a device provisions itself', () => {
    it('is usable immediately, with no key and no questions', () => {
        expect(ActivationManager.isActivated()).toBe(false);
        const info = ActivationManager.ensureActivated();
        expect(ActivationManager.isActivated()).toBe(true);
        expect(info.machineId).toBeTruthy();
    });

    it('still gets a machineId — records are stamped with it and sync merges on it', () => {
        const info = ActivationManager.ensureActivated();
        expect(typeof info.machineId).toBe('string');
        expect(info.machineId.length).toBeGreaterThan(8);
    });

    it('defaults to satellite, which is the safe assumption', () => {
        // A satellite that should be root can be promoted in Settings. A device
        // wrongly believing it is root claims authority over deletions it
        // should not have, and that authority travels through sync.
        expect(ActivationManager.ensureActivated().machineRole).toBe('satellite');
    });

    it('marks itself auto-provisioned, so these are distinguishable later', () => {
        ActivationManager.ensureActivated();
        expect(StorageManager.loadActivation().autoProvisioned).toBe(true);
    });
});

describe('an existing device keeps the identity it already has', () => {
    it('does not re-provision on upgrade', () => {
        // Changing machineId on an existing install would orphan every record
        // it ever created and confuse sync about who wrote what.
        StorageManager.saveActivation({
            activated: true, machineId: 'machine_existing_01',
            machineName: 'Office', machineRole: 'root',
            activatedAt: '2026-01-01T00:00:00.000Z'
        });
        ActivationManager.activationData = null;

        const info = ActivationManager.ensureActivated();
        expect(info.machineId).toBe('machine_existing_01');
        expect(info.machineRole).toBe('root');       // a root machine stays root
        expect(info.machineName).toBe('Office');
    });

    it('is idempotent — calling it twice changes nothing', () => {
        const first = ActivationManager.ensureActivated();
        const second = ActivationManager.ensureActivated();
        expect(second.machineId).toBe(first.machineId);
    });
});

describe('the gate is gone, not merely hidden', () => {
    it('no master-key list ships with the app any more', async () => {
        const { readdirSync, existsSync } = await import('node:fs');
        expect(existsSync('KEYS.md'), 'KEYS.md still present').toBe(false);
        expect(existsSync('src/components/Activation'), 'activation screen still present').toBe(false);
    });

    it('main.js no longer references an activation screen', async () => {
        const { readFileSync } = await import('node:fs');
        const src = readFileSync('src/main.js', 'utf8');
        expect(src).not.toContain('ActivationScreen');
        expect(src).not.toContain('showActivationScreen');
    });
});
