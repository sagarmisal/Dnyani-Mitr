// String table — INITIATIVE.md D-10, D-23.
//
// The English column is not a translation of the Marathi. Both are written
// fresh, in the voice of someone running a children's home, because the point
// of D-10 is not that the app should speak Marathi — it is that it should stop
// speaking like an administrator.
//
// What the app used to say, and why each had to go:
//
//   "Machine Role: Root or Satellite?"  our architecture, on their first screen
//   "Overdue — 41 days"                 an accusation, every morning
//   "Never contacted"                   a reproach for a person who just arrived
//   "Follow-ups Due"                    a queue, not a relationship
//   "Data Quality"                      a maintainer's concern in a user's clothes
//
// Rules for anything added here:
//   1. Name things by what the person recognises, never by how it is built.
//   2. An action keeps the same word through the whole flow — the button that
//      says जतन करा produces a toast that says जतन झालं.
//   3. State a fact, never a judgement. "शेवटची भेट — जुलैमध्ये", not "उशीर".
//   4. An empty screen is an invitation, not a mood.

export const STRINGS = {
    /* ---------------------------------------------------------- identity */
    // Fixed forever (D-22). The NGO's own name sits above these, larger, and
    // is configurable; these two never are.
    'app.name':        { mr: 'ज्ञानी मित्र',    en: 'Dnyani Mitr' },
    'app.by':          { mr: 'सेवा संकल्प प्रतिष्ठान', en: 'Seva Sankalp Pratishthan' },

    /* -------------------------------------------------------------- nav */
    'nav.today':       { mr: 'आज',        en: 'Today' },
    'nav.people':      { mr: 'माणसं',      en: 'People' },
    'nav.remember':    { mr: 'आठवणी',     en: 'Remember' },
    'nav.reports':     { mr: 'अहवाल',     en: 'Reports' },
    'nav.settings':    { mr: 'सेटिंग',     en: 'Settings' },

    /* ------------------------------------------------------- the day */
    'today.coming':      { mr: 'आज येणारे',              en: 'Coming to us' },
    'today.catchUp':     { mr: 'बऱ्याच दिवसांत भेट नाही', en: 'Not seen for a while' },
    'today.going':       { mr: 'आपण जाणार',              en: 'We are going' },
    'today.yearAgo':     { mr: 'गेल्या वर्षी आज',         en: 'A year ago today' },
    'today.onThisDay':   { mr: 'या दिवशी',               en: 'On this day' },

    'stat.comingToday':  { mr: 'आज येणारे',    en: 'Coming today' },
    'stat.occasions':    { mr: 'वाढदिवस',      en: 'Occasions' },
    'stat.thanksDue':    { mr: 'आभार बाकी',    en: 'To thank' },
    'stat.notSeen':      { mr: 'बऱ्याच दिवसांत', en: 'Not seen' },

    /* --------------------------------------------------------- actions */
    'action.someoneComing': { mr: 'कुणीतरी येतंय',  en: 'Someone is coming' },
    'action.planVisit':     { mr: 'भेट ठरवा',      en: 'Plan a visit' },
    'action.sendThanks':    { mr: 'आभार पाठवा',    en: 'Send thanks' },
    'action.report':        { mr: 'अहवाल',        en: 'Report' },
    'action.save':          { mr: 'जतन करा',      en: 'Save' },
    'action.cancel':        { mr: 'रद्द',          en: 'Cancel' },
    'action.delete':        { mr: 'काढून टाका',    en: 'Delete' },
    'action.edit':          { mr: 'बदल करा',      en: 'Edit' },
    'action.done':          { mr: 'झालं',         en: 'Done' },
    'action.didTheyCome':   { mr: 'आले का?',      en: 'Did they come?' },
    'action.close':         { mr: 'बंद करा',       en: 'Close' },
    'action.today':         { mr: 'आज',           en: 'Today' },

    /* ----------------------------------------------- the capture sheet */
    'capture.phone':        { mr: 'फोन नंबर',            en: 'Phone number' },
    'capture.phoneHint':    { mr: 'फोन नंबर टाका — बाकी सगळं एका बोटाने.',
                              en: 'Start with the number — everything else is one tap.' },
    'capture.name':         { mr: 'त्यांचं नाव',          en: 'Their name' },
    'capture.noPhone':      { mr: 'त्यांनी नंबर दिला नाही', en: 'They did not give a number' },
    'capture.noPhoneWarn':  { mr: 'नंबराशिवाय पुढच्या वर्षी ही भेट त्यांच्याशी जोडता येणार नाही.',
                              en: 'Without a number this visit cannot be linked to them next year.' },
    'capture.headcount':    { mr: 'किती माणसं?',        en: 'How many people' },
    'capture.what':         { mr: 'काय आहे?',           en: 'What is it?' },
    'capture.date':         { mr: 'तारीख',              en: 'Date' },
    'capture.time':         { mr: 'वेळ',                en: 'Time' },
    'capture.type':         { mr: 'प्रकार',              en: 'Type' },
    'capture.notes':        { mr: 'नोंद',               en: 'Notes' },
    'capture.occasion':     { mr: 'कशासाठी?',           en: 'Is it for an occasion?' },
    'capture.occasionDate': { mr: 'त्या दिवसाची तारीख',   en: 'The occasion’s own date' },
    'capture.whose':        { mr: 'कुणाचा?',            en: 'Whose?' },
    'capture.relation':     { mr: 'नातं',               en: 'Relation' },
    // The reason the occasion carries a date of its own.
    'capture.occasionHint': { mr: 'वाढदिवसाची तारीख आणि भेटीची तारीख वेगळी असू शकते — लोक जवळच्या रविवारी येतात.',
                              en: 'The occasion’s date can differ from the visit — people often come on the nearest Sunday.' },
    'capture.localHint':    { mr: 'या नोंदी या फोनवर राहतात. प्रत्यक्ष काय घडलं ते sync केल्यावर सगळ्यांना कळतं.',
                              en: 'These plans stay on this phone. What actually happens is shared when you sync.' },

    'capture.known':        { mr: 'याआधी {n} वेळा',        en: '{n} previous visits' },
    'capture.new':          { mr: 'नवीन — यादीत जोडले जातील.', en: 'New — they will be added to your list.' },
    'capture.viaContact':   { mr: '{name} यांचा नंबर',      en: '{name}’s number' },

    /* --------------------------------------------------------- errors */
    // Say what happened and what to do. Never apologise, never be vague.
    'error.needPhoneOrName': { mr: 'फोन नंबर टाका, किंवा त्यांनी दिला नसेल तर नाव टाका.',
                               en: 'Enter a phone number, or a name if they did not give one.' },
    'error.storageFull':     { mr: 'जतन करता आलं नाही. फोनची जागा भरली असेल.',
                               en: 'Could not save. Your phone’s storage may be full.' },

    /* -------------------------------------------------------- statuses */
    // Facts, not verdicts. These replace "Overdue" and "Never contacted".
    'status.lastVisit':     { mr: 'शेवटची भेट — {when}',  en: 'Last visit — {when}' },
    'status.neverVisited':  { mr: 'नवीन — अजून भेट नाही', en: 'New — no visit yet' },
    'status.worthACall':    { mr: 'फोन करायला हवा',      en: 'Worth a call' },
    'status.thanked':       { mr: 'आभार पाठवले',         en: 'Thanked' },
    'status.noTimeSet':     { mr: 'वेळ ठरली नाही',        en: 'No time set' },

    /* ---------------------------------------------------- empty states */
    // An invitation to act, with the one action that would fill the screen.
    'empty.today':          { mr: 'आज कुणी येणार नाही.',      en: 'Nobody is expected today.' },
    'empty.people':         { mr: 'अजून कुणी नाही.',          en: 'No one here yet.' },
    'empty.search':         { mr: 'असं कुणी सापडलं नाही.',     en: 'No one matches that.' },
    'empty.history':        { mr: 'अजून कोणतीही नोंद नाही.',   en: 'Nothing recorded yet.' },

    /* --------------------------------------------------------- toasts */
    'toast.saved':          { mr: 'जतन झालं',              en: 'Saved' },
    'toast.added':          { mr: '{name} यादीत जोडले.',    en: '{name} added to your supporters.' },
    'toast.deleted':        { mr: 'काढून टाकलं',           en: 'Deleted' },

    /* ------------------------------------------------------- settings */
    'settings.language':    { mr: 'भाषा',                 en: 'Language' },
    'settings.ngoName':     { mr: 'संस्थेचं नाव',           en: 'Your organisation’s name' },
    'settings.ngoNameHint': { mr: 'हे नाव प्रत्येक स्क्रीनवर वर दिसेल.',
                              en: 'This appears at the top of every screen.' },
    'settings.backup':      { mr: 'बॅकअप',                en: 'Backup' }
};

export default STRINGS;
