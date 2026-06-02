// @vitest-environment happy-dom
//
// Render smoke test for the Iter 10 campaign UI. The bundler proves the modules
// import; this proves their render() actually executes against a DOM and
// produces the expected structure (catches runtime errors build can't).

import { describe, it, expect, beforeAll } from 'vitest';
import StateManager from '../src/core/state.js';
import { CampaignList } from '../src/components/Campaigns/CampaignList.js';
import { CampaignBuilder } from '../src/components/Campaigns/CampaignBuilder.js';
import { OccasionManager } from '../src/components/Campaigns/OccasionManager.js';

beforeAll(async () => {
    await StateManager.init();
    StateManager.addVisitor({
        id: 'v1', status: 'active', deletedAt: null, city: 'Pune', category: 'Beneficiary',
        tags: ['Donor'], doNotContact: false, consentGiven: true,
        contacts: [{ relationType: 'SELF', id: 'c1', name: 'Asha', phones: ['9876543210'] }]
    });
});

describe('Campaign UI render smoke', () => {
    it('CampaignList renders with the New Campaign button', () => {
        const el = new CampaignList().render();
        expect(el.querySelector('#camp-new-btn')).toBeTruthy();
        expect(el.textContent).toContain('Campaigns');
    });

    it('OccasionManager renders seeded occasions + add control', () => {
        const el = new OccasionManager().render();
        expect(el.querySelector('#occ-add-btn')).toBeTruthy();
        expect(el.textContent).toContain('प्रजासत्ताक'); // seeded Marathi occasion name renders
    });

    it('CampaignBuilder renders; live preview substitutes name + tagline', () => {
        const el = new CampaignBuilder('occasion_republic_day').render();
        expect(el.querySelector('#cb-template')).toBeTruthy();
        const preview = el.querySelector('#cb-preview').textContent;
        expect(preview).toContain('Asha');                       // sample recipient name substituted
        expect(preview).toContain('चला जरा वेगळे जगुया');         // tagline appended via {tagline}
        expect(preview).not.toContain('{');                       // no raw tokens leak
    });

    it('CampaignBuilder shows a live recipient count', () => {
        const el = new CampaignBuilder('occasion_republic_day').render();
        expect(el.querySelector('#cb-count').textContent).toMatch(/recipient/);
    });
});
