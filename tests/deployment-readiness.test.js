// @vitest-environment happy-dom
/**
 * What happens to a real NGO on the day they install this.
 *
 * They are on v3.1.0 or v3.2.0 with two years of register. They will upgrade
 * over WhatsApp, unsupervised, and nobody downstream will catch a mistake
 * (D-24). So the questions are narrow and unforgiving:
 *
 *   does anything they own disappear?
 *   does everything they own still travel to the other phones?
 *   can they still get to the screen that saves them?
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/core/activation.js', () => ({
    default: {
        getMachineInfo: () => ({ machineId: 'm_ngo', machineName: 'Office', machineRole: 'root' }),
        isActivated: () => true,
        ensureActivated: () => ({ machineId: 'm_ngo', machineName: 'Office', machineRole: 'root' })
    }
}));

import StateManager from '../src/core/state.js';
import StorageManager from '../src/core/storage.js';
import SyncService from '../src/services/SyncService.js';
import VisitorService from '../src/services/VisitorService.js';

/** A register as v3.1.0 wrote it — before scheduledItems, thankedAt, contribution. */
function v310State() {
    return {
        version: '3.1.0',
        visitors: [
            { id: 'visitor_1', category: 'Regular', city: 'बारामती', tags: ['donor'],
              isDeleted: false, status: 'active',
              createdAt: '2024-06-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z',
              contacts: [
                { id: 'c1', relationType: 'SELF', name: 'सुनीता पाटील',
                  phones: ['9822012345'], emails: ['s@x.com'], dob: '1978-03-14', customEvents: [] },
                { id: 'c2', relationType: 'CHILD', name: 'अनन्या',
                  phones: [], emails: [], dob: '2015-08-18', customEvents: [] }
              ] },
            { id: 'visitor_2', category: '', city: '', tags: [], isDeleted: false, status: 'active',
              createdAt: '2024-07-01T00:00:00.000Z', updatedAt: '2024-07-01T00:00:00.000Z',
              contacts: [{ id: 'c3', relationType: 'SELF', name: 'Ramesh Jadhav',
                           phones: ['9822012346'], emails: [], customEvents: [] }] }
        ],
        interactions: [
            { id: 'int_1', visitorId: 'visitor_1', interactionType: 'visit',
              interactionDate: '2025-08-24T12:00:00.000Z', notes: 'जेवण दिलं',
              createdAt: '2025-08-24T12:05:00.000Z', createdBy: 'm_old' }
        ],
        reminderActions: [{ id: 'ra_1', reminderId: 'r1', action: 'contacted', at: '2025-08-24' }],
        occasions: [{ id: 'occasion_diwali', name: 'Diwali', movable: true, dates: {}, builtin: true }],
        campaigns: [{ id: 'camp_1', occasionId: 'occasion_diwali', sentCount: 12 }],
        settings: { organizationName: 'भगवान बाबा बालिकाश्रम', calendarStartsOn: 'mon' },
        syncLog: [{ at: '2025-08-01', machineId: 'm_other' }],
        knownMachines: { m_other: { name: 'Field phone' } }
    };
}

function installV310() {
    localStorage.clear();
    localStorage.setItem('NGOApp_v2_State', JSON.stringify(v310State()));
    StateManager.initialized = false;
    StateManager.init();
}

describe('the upgrade — nothing they own may disappear', () => {
    beforeEach(installV310);

    it('keeps every visitor, interaction, occasion and campaign', () => {
        const s = StateManager.getState();
        expect(s.visitors).toHaveLength(2);
        expect(s.interactions).toHaveLength(1);
        expect(s.occasions).toHaveLength(1);
        expect(s.campaigns).toHaveLength(1);
        expect(s.reminderActions).toHaveLength(1);
    });

    it('keeps the family contact that carries next year’s reminder', () => {
        const v = StateManager.getState().visitors.find(x => x.id === 'visitor_1');
        expect(v.contacts.find(c => c.relationType === 'CHILD').dob).toBe('2015-08-18');
    });

    it('keeps their settings, including the name in the header', () => {
        expect(StateManager.getState().settings.organizationName).toBe('भगवान बाबा बालिकाश्रम');
    });

    it('keeps who they sync with', () => {
        expect(StateManager.getState().knownMachines.m_other).toBeTruthy();
        expect(StateManager.getState().syncLog).toHaveLength(1);
    });

    it('adds the new fields with safe defaults, never undefined', () => {
        const i = StateManager.getState().interactions[0];
        expect(i.thankedAt).toBeNull();
        expect(i.contribution).toEqual([]);
        expect(Array.isArray(StateManager.getState().scheduledItems)).toBe(true);
    });

    it('their old records are still findable, from either script', () => {
        expect(VisitorService.search('sunita')).toHaveLength(1);
        expect(VisitorService.search('सुनीता')).toHaveLength(1);
        expect(VisitorService.findByPhone('9822012345')).toBeTruthy();
    });
});

describe('sharing — everything they own must travel', () => {
    beforeEach(installV310);

    it('a full backup declares and carries all nine collections', () => {
        const pkg = SyncService.prepareFullBackup();
        ['visitors', 'interactions', 'reminderActions', 'occasions', 'campaigns',
         'scheduledItems', 'settings', 'syncLog', 'knownMachines'].forEach(k => {
            expect(pkg.metadata.collections, `${k} not declared`).toContain(k);
            expect(pkg.data[k], `${k} not carried`).toBeDefined();
        });
    });

    it('a backup taken today restores onto a wiped device intact', () => {
        const pkg = SyncService.prepareFullBackup();
        StateManager.state = StorageManager.getDefaultState();
        StorageManager.saveState(StateManager.state);
        expect(StateManager.getState().visitors).toHaveLength(0);

        SyncService.restoreFullBackup(JSON.parse(JSON.stringify(pkg)));
        const s = StateManager.getState();
        expect(s.visitors).toHaveLength(2);
        expect(s.campaigns).toHaveLength(1);
        expect(s.occasions).toHaveLength(1);
        expect(s.settings.organizationName).toBe('भगवान बाबा बालिकाश्रम');
    });

    it('the phone-to-phone merge carries the new fields, not just the old ones', () => {
        // merge() assigns plain objects rather than running them through the
        // models, so a field it has never heard of has to ride along untouched.
        const pkg = SyncService.prepareFullBackup();
        pkg.data.interactions[0].thankedAt = '2026-08-20T00:00:00.000Z';
        pkg.data.interactions[0].contribution = ['meal', 'books'];
        pkg.data.interactions[0].id = 'int_from_other_phone';
        pkg.data.interactions[0].visitorId = 'visitor_2';

        SyncService.merge(JSON.parse(JSON.stringify(pkg)));
        const arrived = StateManager.getInteractions().find(i => i.id === 'int_from_other_phone');
        expect(arrived, 'the interaction did not arrive').toBeTruthy();
        expect(arrived.thankedAt).toBe('2026-08-20T00:00:00.000Z');
        expect(arrived.contribution).toEqual(['meal', 'books']);
    });

    it('merging the same package twice does not duplicate anyone', () => {
        const pkg = SyncService.prepareFullBackup();
        SyncService.merge(JSON.parse(JSON.stringify(pkg)));
        SyncService.merge(JSON.parse(JSON.stringify(pkg)));
        expect(StateManager.getState().visitors).toHaveLength(2);
    });

    it('takes a pre-sync snapshot, so a wrong import is recoverable', () => {
        SyncService.merge(JSON.parse(JSON.stringify(SyncService.prepareFullBackup())));
        expect(localStorage.getItem('NGOApp_v2_PreSyncBackup')).toBeTruthy();
    });
});

describe('operating — the screens that matter are reachable', () => {
    it('Settings links to backup, history and campaigns', () => {
        const src = readFileSync('src/components/Settings/SettingsPage.js', 'utf8');
        ['SYNC', 'INTERACTIONS', 'CAMPAIGNS'].forEach(r =>
            expect(src, `Settings does not link to ROUTES.${r}`).toContain(`ROUTES.${r}`));
    });
});

import { readFileSync } from 'node:fs';

describe('a record can never be present but invisible', () => {
    it('a visitor arriving without status is still listed', async () => {
        // getAll() filters on status === 'active'. The model defaults it and the
        // v2 migration sets it, but SyncService.merge assigns plain objects and
        // bypasses both — so a visitor from another machine could sit in storage
        // and appear nowhere, with nothing reported. Found while writing J4.
        localStorage.clear();
        localStorage.setItem('NGOApp_v2_State', JSON.stringify({
            version: '3.3.0',
            visitors: [{ id: 'v_nostatus', isDeleted: false,
                contacts: [{ relationType: 'SELF', name: 'सुनीता', phones: ['9822012345'], emails: [] }] }],
            interactions: [], settings: {}
        }));
        StateManager.initialized = false;
        StateManager.init();

        const { default: VS } = await import('../src/services/VisitorService.js');
        expect(VS.getAll(), 'a statusless visitor vanished').toHaveLength(1);
        expect(StateManager.getState().visitors[0].status).toBe('active');
    });

    it('a deleted visitor without status stays deleted', () => {
        localStorage.clear();
        localStorage.setItem('NGOApp_v2_State', JSON.stringify({
            version: '3.3.0',
            visitors: [{ id: 'v_del', isDeleted: true,
                contacts: [{ relationType: 'SELF', name: 'x', phones: [], emails: [] }] }],
            interactions: [], settings: {}
        }));
        StateManager.initialized = false;
        StateManager.init();
        expect(StateManager.getState().visitors[0].status).toBe('deleted');
    });
});
