// WhatsNew (Iter 11, U1) — shown once, on the first run after an upgrade.
//
// This release moves the screen people land on. With a self-serve rollout over
// WhatsApp, nobody is standing beside them to explain that, so the app has to.
//
// It also carries the daily-digest opt-in (G15). `notificationsEnabled` defaults
// to false and its checkbox is buried in Settings, so today NOBODY receives a
// digest — and a plan nobody is reminded of depends on remembering to open the
// app. Asking here means the Android permission prompt arrives with a reason
// attached, rather than as a bare system dialog.

import StateManager from '../../core/state.js';
import NotificationService from '../../services/NotificationService.js';
import { Toast } from './Toast.js';
import { APP_VERSION, FEATURES } from '../../utils/constants.js';

/** Major.minor only — a patch release is not worth interrupting anyone for. */
function releaseLine(version) {
    return String(version || '').split('.').slice(0, 2).join('.');
}

export class WhatsNew {
    /**
     * Show only when the stored "last seen" release differs from this build's.
     * A fresh install sees nothing: there is no "new" without an "old".
     */
    static shouldShow() {
        const settings = StateManager.getSettings();
        const seen = settings.whatsNewSeenVersion;
        if (!seen) {
            // First run after upgrading FROM a build that never recorded this.
            // An upgraded device has visitors; a fresh install does not.
            return StateManager.getVisitors().length > 0;
        }
        return releaseLine(seen) !== releaseLine(APP_VERSION);
    }

    static markSeen() {
        StateManager.updateSettings({ whatsNewSeenVersion: APP_VERSION });
    }

    static showIfNeeded() {
        if (!this.shouldShow()) return null;
        const card = new WhatsNew();
        document.body.appendChild(card.render());
        return card;
    }

    render() {
        this.root = document.createElement('div');
        this.root.className = 'modal-overlay';
        this.root.innerHTML = `
            <div class="modal whats-new" role="dialog" aria-modal="true" aria-label="What's new">
                <div class="modal-header">
                    <h3>नवीन काय आहे · What's new</h3>
                </div>
                <div class="modal-body">
                    <div class="wn-item">
                        <h4>🗓 कॅलेंडर आता पहिले दिसेल · The calendar opens first</h4>
                        <p>दिवस निवडा — त्या दिवशी कोण येणार आहे, कोणाला भेटायचे आहे आणि कोणते वाढदिवस आहेत, सर्व एका जागी.</p>
                        <p>Pick any day to see who is coming, who you planned to visit, and whose birthday it is.</p>
                    </div>
                    <div class="wn-item">
                        <h4>📞 कोणी येणार असल्यास लगेच नोंदवा · Log a visit while they are on the phone</h4>
                        <p>फोन नंबर टाका — व्यक्ती आधीच यादीत असल्यास आपोआप सापडेल, नसल्यास नवीन नोंद होईल.</p>
                        <p>Type their number: if they are already in your list it finds them, if not it adds them.</p>
                    </div>
                    <div class="wn-item">
                        <h4>📋 "My Day" कुठेही गेलेले नाही · My Day is still here</h4>
                        <p>Open it any time from the calendar, or make it your opening screen again in Settings.</p>
                    </div>

                    ${FEATURES.dailyDigest ? `
                    <label class="form-check wn-optin">
                        <input type="checkbox" id="wn-digest" checked>
                        <span>दररोज सकाळी ९ वाजता आठवण करा · Remind me each morning at 9 am</span>
                    </label>
                    <p class="form-hint">Your phone will ask permission once. You can turn this off in Settings.</p>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" id="wn-ok">ठीक आहे · Got it</button>
                </div>
            </div>
        `;

        this.root.querySelector('#wn-ok').addEventListener('click', () => this.accept());
        return this.root;
    }

    async accept() {
        const wantsDigest = this.root.querySelector('#wn-digest')?.checked;
        WhatsNew.markSeen();

        if (wantsDigest) {
            try {
                const perm = await NotificationService.requestPermission();
                if (perm && perm.granted) {
                    StateManager.updateSettings({ notificationsEnabled: true, notificationDigestTime: '09:00' });
                    await NotificationService.sync(StateManager.getSettings());
                    Toast.show('You will get a reminder each morning.', 'success');
                } else {
                    // Refused, or unavailable on desktop. Not an error, and not
                    // worth a scary message — just leave it off.
                    StateManager.updateSettings({ notificationsEnabled: false });
                }
            } catch (err) {
                console.error('WhatsNew: could not enable notifications', err);
            }
        }

        this.close();
    }

    close() {
        if (this.root?.parentNode) this.root.parentNode.removeChild(this.root);
    }
}

export default WhatsNew;
