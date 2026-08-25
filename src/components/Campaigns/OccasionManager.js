// OccasionManager — list / add / edit / delete occasions and their bilingual
// greeting + invitation templates. Mounted inside the Settings page.

import OccasionService from '../../services/OccasionService.js';
import { t } from '../../utils/i18n.js';
import { Toast } from '../UI/Toast.js';

export class OccasionManager {
    constructor() {
        this.container = null;
        this.editingId = null;   // occasion id being edited, or '__new__', or null
    }

    render() {
        this.container = document.createElement('div');
        this.container.className = 'card';
        this.container.style.marginTop = '1.5rem';
        this._paint();
        return this.container;
    }

    _paint() {
        const occasions = OccasionService.list();
        this.container.innerHTML = `
            <div class="card-header">
                <h2 class="card-title">🗓️ Occasions</h2>
            </div>
            <div class="card-body">
                <p class="text-secondary" style="margin-bottom: 1rem;">
                    Occasions power bulk greeting / invitation campaigns. Built-in national days are
                    seeded; add your own (Foundation Day, festivals like Diwali for this year). Each
                    occasion carries Marathi + English templates. Tokens:
                    <code>{name}</code> <code>{org}</code> <code>{occasion}</code> <code>{tagline}</code>.
                </p>
                <div class="occasion-list">
                    ${occasions.length
                        ? occasions.map(o => this._row(o)).join('')
                        : '<p class="text-secondary">No occasions yet.</p>'}
                </div>
                <button id="occ-add-btn" class="btn btn-primary btn-sm" style="margin-top: 1rem;">+ Add occasion</button>
                <div id="occ-editor" style="margin-top: 1rem;"></div>
            </div>
        `;
        this._wireList();
        if (this.editingId) this._renderEditor();
    }

    _row(o) {
        const primary = this._esc(o.nameMr || o.name || '(unnamed)');
        const secondary = (o.name && o.nameMr) ? ` <span class="text-secondary">(${this._esc(o.name)})</span>` : '';
        const builtin = o.builtin
            ? ' <span style="font-size:0.7rem; background:var(--color-surface-hover); color:var(--color-text-secondary); padding:0.1rem 0.4rem; border-radius:999px;">built-in</span>'
            : '';
        return `
            <div class="occasion-row" style="display:flex; align-items:center; gap:0.5rem; padding:0.6rem 0; border-bottom:1px solid var(--color-border);">
                <div style="flex:1; min-width:0;">
                    <strong>${primary}</strong>${secondary}${builtin}
                    <div class="text-secondary" style="font-size:0.85rem;">${o.day}/${o.month}</div>
                </div>
                <button class="btn btn-secondary btn-sm occ-edit" data-id="${o.id}">${t('action.edit')}</button>
                <button class="btn btn-error btn-sm occ-del" data-id="${o.id}" aria-label="${t('occ.delete')}">${t('action.delete')}</button>
            </div>
        `;
    }

    _wireList() {
        this.container.querySelector('#occ-add-btn')?.addEventListener('click', () => {
            this.editingId = '__new__';
            this._renderEditor();
        });
        this.container.querySelectorAll('.occ-edit').forEach(btn => {
            btn.addEventListener('click', () => { this.editingId = btn.dataset.id; this._renderEditor(); });
        });
        this.container.querySelectorAll('.occ-del').forEach(btn => {
            btn.addEventListener('click', () => {
                const o = OccasionService.list().find(x => x.id === btn.dataset.id);
                if (!o) return;
                if (!confirm(`Delete occasion "${o.nameMr || o.name}"? This cannot be undone.`)) return;
                OccasionService.remove(btn.dataset.id);
                Toast.show('Occasion deleted', 'success');
                this.editingId = null;
                this._paint();
            });
        });
    }

    _renderEditor() {
        const mount = this.container.querySelector('#occ-editor');
        if (!mount) return;
        const isNew = this.editingId === '__new__';
        const o = isNew ? null : OccasionService.list().find(x => x.id === this.editingId);
        if (!isNew && !o) { this.editingId = null; return; }
        const t = (o && o.templates) || { greeting: { en: '', mr: '' }, invitation: { en: '', mr: '' } };

        mount.innerHTML = `
            <div style="border:1px solid var(--color-border); border-radius:0.5rem; padding:1rem; background:var(--color-surface);">
                <h4 style="margin:0 0 0.75rem 0;">${isNew ? 'Add occasion' : 'Edit occasion'}</h4>
                <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                    <div class="setting-item" style="flex:1; min-width:160px;">
                        <label for="occ-name">${t('occ.nameEn')}</label>
                        <input id="occ-name" class="form-input" value="${this._esc(o?.name || '')}" placeholder="e.g. Foundation Day" />
                    </div>
                    <div class="setting-item" style="flex:1; min-width:160px;">
                        <label for="occ-nameMr">${t('occ.nameMr')}</label>
                        <input id="occ-nameMr" class="form-input" value="${this._esc(o?.nameMr || '')}" placeholder="उदा. स्थापना दिन" />
                    </div>
                </div>
                <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                    <div class="setting-item" style="flex:1; min-width:120px;">
                        <label for="occ-day">Day (1–31)</label>
                        <input id="occ-day" type="number" min="1" max="31" class="form-input" value="${o?.day || ''}" />
                    </div>
                    <div class="setting-item" style="flex:1; min-width:120px;">
                        <label for="occ-month">Month (1–12)</label>
                        <input id="occ-month" type="number" min="1" max="12" class="form-input" value="${o?.month || ''}" />
                    </div>
                </div>
                <div class="setting-item">
                    <label for="occ-greet-mr">Greeting — Marathi</label>
                    <textarea id="occ-greet-mr" class="form-textarea" rows="2">${this._esc(t.greeting?.mr || '')}</textarea>
                </div>
                <div class="setting-item">
                    <label for="occ-greet-en">Greeting — English</label>
                    <textarea id="occ-greet-en" class="form-textarea" rows="2">${this._esc(t.greeting?.en || '')}</textarea>
                </div>
                <div class="setting-item">
                    <label for="occ-inv-mr">Invitation — Marathi</label>
                    <textarea id="occ-inv-mr" class="form-textarea" rows="2">${this._esc(t.invitation?.mr || '')}</textarea>
                </div>
                <div class="setting-item">
                    <label for="occ-inv-en">Invitation — English</label>
                    <textarea id="occ-inv-en" class="form-textarea" rows="2">${this._esc(t.invitation?.en || '')}</textarea>
                </div>
                <div style="display:flex; gap:0.5rem; margin-top:0.5rem;">
                    <button id="occ-save" class="btn btn-primary btn-sm">${isNew ? 'Add' : 'Save'}</button>
                    <button id="occ-cancel" class="btn btn-secondary btn-sm">${t('action.cancel')}</button>
                </div>
            </div>
        `;

        mount.querySelector('#occ-cancel').addEventListener('click', () => {
            this.editingId = null;
            mount.innerHTML = '';
        });

        mount.querySelector('#occ-save').addEventListener('click', () => {
            const data = {
                name: mount.querySelector('#occ-name').value.trim(),
                nameMr: mount.querySelector('#occ-nameMr').value.trim(),
                day: mount.querySelector('#occ-day').value,
                month: mount.querySelector('#occ-month').value,
                templates: {
                    greeting: { mr: mount.querySelector('#occ-greet-mr').value, en: mount.querySelector('#occ-greet-en').value },
                    invitation: { mr: mount.querySelector('#occ-inv-mr').value, en: mount.querySelector('#occ-inv-en').value }
                }
            };
            const res = isNew ? OccasionService.add(data) : OccasionService.update(this.editingId, data);
            if (!res.ok) {
                Toast.show(res.errors.join(' '), 'error');
                return;
            }
            Toast.show(isNew ? 'Occasion added' : 'Occasion saved', 'success');
            this.editingId = null;
            this._paint();
        });
    }

    _esc(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}
