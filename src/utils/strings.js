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
    'action.open':          { mr: 'उघडा',         en: 'Open' },
    'action.logThatDay':    { mr: 'त्या दिवशी काय झालं ते नोंदवा', en: 'Log what happened that day' },
    'nav.prevDay':          { mr: 'मागचा दिवस',    en: 'Previous day' },
    'nav.nextDay':          { mr: 'पुढचा दिवस',    en: 'Next day' },
    'nav.prevMonth':        { mr: 'मागचा महिना',   en: 'Previous month' },
    'nav.nextMonth':        { mr: 'पुढचा महिना',   en: 'Next month' },
    'cal.monthWide':        { mr: 'या महिन्यात (तारीख नक्की नाही)', en: 'This month (no exact date)' },

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
    // These three replace "Overdue", "Never contacted" and "today (overdue)".
    // Same rows, same urgency, stated as facts instead of verdicts.
    'status.waitingSince':  { mr: 'वाट पाहत आहेत',        en: 'Still waiting' },
    'status.dueToday':      { mr: 'आजच करायचं',           en: 'For today' },
    'status.viewAll':       { mr: 'सगळे {n} पाहा',         en: 'See all {n}' },

    /* --------------------------------------------------- people (list) */
    'people.title':         { mr: 'माणसं',                 en: 'People' },
    'people.add':           { mr: 'नवीन व्यक्ती',           en: 'Add person' },
    'people.search':        { mr: 'नाव किंवा नंबर शोधा...',  en: 'Search by name or number...' },
    'people.allCategories': { mr: 'सर्व प्रकार',            en: 'All categories' },
    'people.allCities':     { mr: 'सर्व गावं',              en: 'All places' },
    'people.showing':       { mr: '{n} माणसं',              en: '{n} people' },
    'people.filtered':      { mr: 'एकूण {total} पैकी',       en: 'of {total} in all' },
    'sort.lastUpdated':     { mr: 'अलीकडे बदललेले',         en: 'Recently changed' },
    'sort.recentlyAdded':   { mr: 'अलीकडे जोडलेले',         en: 'Recently added' },
    'sort.name':            { mr: 'नावाप्रमाणे',            en: 'By name' },
    'sort.city':            { mr: 'गावाप्रमाणे',            en: 'By place' },

    /* ---------------------------------------------------- empty states */
    // An invitation to act, with the one action that would fill the screen.
    'empty.today':          { mr: 'आज कुणी येणार नाही.',      en: 'Nobody is expected today.' },
    'empty.people':         { mr: 'अजून कुणी नाही.',          en: 'No one here yet.' },
    'empty.search':         { mr: 'असं कुणी सापडलं नाही.',     en: 'No one matches that.' },
    'empty.history':        { mr: 'अजून कोणतीही नोंद नाही.',   en: 'Nothing recorded yet.' },
    'empty.peopleHint':     { mr: 'पहिलं नाव जोडून सुरुवात करा — फोन नंबर पुरेसा आहे.',
                              en: 'Start with one person. A phone number is enough.' },
    'empty.searchHint':     { mr: 'कमी अक्षरं टाकून पाहा, किंवा फिल्टर काढा.',
                              en: 'Try fewer letters, or clear the filters.' },
    'empty.historyHint':    { mr: 'कुणी भेट दिली की इथे नोंद दिसेल.',
                              en: 'Records appear here once someone visits.' },
    'action.addFirst':      { mr: 'पहिली व्यक्ती जोडा',        en: 'Add the first person' },

    /* --------------------------------------------------------- toasts */
    'toast.saved':          { mr: 'जतन झालं',              en: 'Saved' },
    'toast.added':          { mr: '{name} यादीत जोडले.',    en: '{name} added to your supporters.' },
    'toast.deleted':        { mr: 'काढून टाकलं',           en: 'Deleted' },

    /* ------------------------------------------------------- settings */
    'settings.language':    { mr: 'भाषा',                 en: 'Language' },
    'settings.ngoName':     { mr: 'संस्थेचं नाव',           en: 'Your organisation’s name' },
    'settings.ngoNameHint': { mr: 'हे नाव प्रत्येक स्क्रीनवर वर दिसेल.',
                              en: 'This appears at the top of every screen.' },
    'settings.backup':      { mr: 'बॅकअप',                en: 'Backup' },

    /* ------------------------------------------------ getting to things */
    // These four screens lost their nav tabs when it went from eight to five.
    // They must be reachable from SOMEWHERE, and backup most of all: it is the
    // one behaviour we ask of them (PR-5), and it kept the register alive.
    'more.title':           { mr: 'इतर',                  en: 'More' },
    'more.backup':          { mr: 'बॅकअप आणि शेअर',        en: 'Backup and share' },
    'more.backupHint':      { mr: 'नवीन आवृत्ती घेण्याआधी नेहमी बॅकअप घ्या.',
                              en: 'Always take a backup before updating the app.' },
    'more.history':         { mr: 'सर्व नोंदी',            en: 'All records' },
    'more.historyHint':     { mr: 'आजवरच्या सगळ्या भेटी आणि फोन.',
                              en: 'Every visit and call so far.' },
    'more.campaigns':       { mr: 'सणाचे संदेश',           en: 'Festival messages' },
    'more.campaignsHint':   { mr: 'एकाच वेळी अनेकांना शुभेच्छा.',
                              en: 'Greet many people at once.' },
    'more.about':           { mr: 'ॲपबद्दल',              en: 'About this app' },

    /* ------------------------------------------------ backup and sharing */
    // The screen that saves their register. It must read in their language —
    // this is what they open when a phone is about to be replaced.
    'sync.title':           { mr: 'बॅकअप आणि शेअर',        en: 'Backup and share' },
    'sync.paste':           { mr: 'आलेला संदेश इथे पेस्ट करा', en: 'Paste the message you received' },
    'sync.review':          { mr: 'काय येणार आहे ते पाहा',   en: 'Review what will come in' },
    'sync.import':          { mr: 'घ्या',                  en: 'Import' },
    'sync.restore':         { mr: 'बॅकअपमधून परत आणा',      en: 'Restore from backup' },
    'sync.restorePasted':   { mr: 'पेस्ट केलेल्या बॅकअपमधून परत आणा', en: 'Restore from pasted backup' },
    'sync.undo':            { mr: 'शेवटचं घेतलेलं रद्द करा',  en: 'Undo the last import' },
    'sync.visitors':        { mr: 'माणसं',                 en: 'People' },
    'sync.visitNotes':      { mr: 'भेटींच्या नोंदी',         en: 'Visit records' },
    'sync.used':            { mr: 'वापरलेली जागा',          en: 'Space used' },

    /* ------------------------------------------------------------ reports */
    // What a trustee meeting asks for. Every label is a thing that happened,
    // never a metric: "किती जण आले", not "engagement".
    'report.title':         { mr: 'अहवाल',                 en: 'Report' },
    'report.period':        { mr: 'कोणता काळ?',            en: 'Which period?' },
    'report.thisMonth':     { mr: 'हा महिना',              en: 'This month' },
    'report.lastMonth':     { mr: 'मागचा महिना',           en: 'Last month' },
    'report.thisYear':      { mr: 'हे वर्ष',                en: 'This year' },
    'report.custom':        { mr: 'तारखा निवडा',           en: 'Choose dates' },
    'report.from':          { mr: 'पासून',                 en: 'From' },
    'report.to':            { mr: 'पर्यंत',                 en: 'To' },
    'report.visits':        { mr: 'भेटी',                  en: 'Visits' },
    'report.people':        { mr: 'माणसं',                 en: 'People' },
    'report.brought':       { mr: 'काही आणलं',             en: 'Brought something' },
    'report.thanked':       { mr: 'आभार पाठवले',           en: 'Thanked' },
    'report.whatBrought':   { mr: 'काय आणलं',              en: 'What was brought' },
    'report.download':      { mr: 'यादी उतरवा (CSV)',      en: 'Download the list (CSV)' },
    'report.copyText':      { mr: 'मजकूर कॉपी करा',         en: 'Copy as text' },
    'report.copyHint':      { mr: 'कमिटीला WhatsApp वर पाठवण्यासाठी.', en: 'To send your committee on WhatsApp.' },
    'report.empty':         { mr: 'या काळात कोणतीही नोंद नाही.', en: 'Nothing recorded in this period.' },
    'report.emptyHint':     { mr: 'दुसरा काळ निवडून पाहा.',  en: 'Try a different period.' },
    'report.copied':        { mr: 'कॉपी झालं',              en: 'Copied' },

    /* ---------------------------------------------------------- reminders */
    // The J2 screen. "Overdue" is gone for the reason D-10 gives: it accuses
    // the volunteer every morning for something that is nobody's fault.
    'rem.title':            { mr: 'आठवणी',                 en: 'Reminders' },
    'rem.upcoming':         { mr: 'येणारे दिवस',            en: 'Coming up' },
    'rem.search':           { mr: 'नावाने शोधा',            en: 'Search by name' },
    'rem.allCities':        { mr: 'सर्व गावं',              en: 'All places' },
    'rem.allEvents':        { mr: 'सर्व प्रसंग',             en: 'All occasions' },
    'rem.clear':            { mr: 'काढा',                  en: 'Clear' },
    'rem.selectAll':        { mr: 'सगळे निवडा',             en: 'Select all shown' },
    'rem.clearSelection':   { mr: 'निवड काढा',              en: 'Clear selection' },
    'rem.smsAll':           { mr: 'निवडलेल्यांना SMS पाठवा',  en: 'Send SMS to everyone selected' },
    'rem.whatsappEach':     { mr: 'प्रत्येकाला WhatsApp उघडा', en: 'Open WhatsApp for each' },
    'rem.waiting':          { mr: 'वाट पाहत आहेत',          en: 'Still waiting' },
    'rem.thisWeek':         { mr: 'या आठवड्यात',            en: 'This week' },
    'rem.later':            { mr: 'नंतर',                  en: 'Later' },
    'rem.none':             { mr: 'अजून कुणी नाही',          en: 'No one yet' },
    'rem.snoozed':          { mr: 'पुढे ढकललं',              en: 'Put off' },
    'rem.alreadyDone':      { mr: 'यावेळी संपर्क झाला',       en: 'Already contacted' },
    'rem.selectForGreeting': { mr: 'शुभेच्छांसाठी निवडा',      en: 'Select for greeting' },
    'rem.openSms':          { mr: 'SMS उघडा',              en: 'Open SMS' },
    'rem.markCalled':       { mr: 'फोन केला',               en: 'Called' },
    'rem.markVisited':      { mr: 'भेट झाली',               en: 'Visited' },
    'rem.snooze':           { mr: 'पुढे ढकला',              en: 'Put off' },
    'rem.tomorrow':         { mr: 'उद्या',                  en: 'Tomorrow' },
    'rem.logDetails':       { mr: 'तपशील नोंदवा',           en: 'Add details' },

    /* ------------------------------------------------------ backup nudge */
    // PR-5: we ask these NGOs for exactly ONE behaviour. This is the only place
    // the app asks for it. It states a fact and offers the action — it does not
    // scold, and it can be dismissed, because a nag that cannot be silenced
    // gets the whole app closed instead.
    'nudge.never':          { mr: 'तुम्ही अजून बॅकअप घेतलेला नाही.',
                              en: 'You have not taken a backup yet.' },
    'nudge.stale':          { mr: '{days} दिवसांपासून बॅकअप घेतलेला नाही.',
                              en: 'No backup for {days} days.' },
    'nudge.why':            { mr: 'फोन हरवला तर यादी परत आणता येईल.',
                              en: 'It is how the register comes back if a phone is lost.' },
    'nudge.action':         { mr: 'आत्ता बॅकअप घ्या',        en: 'Back up now' },
    'nudge.dismiss':        { mr: 'नंतर',                   en: 'Later' },

    /* ------------------------------------------- sync, said in plain words */
    // Named by what the person is doing — sending their list to a volunteer,
    // getting a volunteer's notes back — never by the mechanism.
    'sync.shareVolunteers': { mr: 'स्वयंसेवकांना पाठवा',       en: 'Send to volunteers' },
    'sync.sendDevice':      { mr: 'दुसऱ्या फोनवर पाठवा',      en: 'Send to another phone' },
    'sync.sendCoordinator': { mr: 'कार्यालयाला पाठवा',        en: 'Send to the office' },
    'sync.shareVolunteersHint': { mr: 'तुमची यादी स्वयंसेवकांच्या फोनवर पाठवा.',
                              en: 'Send your list to the volunteers’ phones.' },
    'sync.sendDeviceHint':  { mr: 'तुमच्या भेटींच्या नोंदी दुसऱ्या फोनवर पाठवा.',
                              en: 'Send your visit notes to another phone.' },
    'sync.sendCoordinatorHint': { mr: 'तुमच्या भेटींच्या नोंदी कार्यालयाला पाठवा.',
                              en: 'Send your visit notes to the office.' },
    'sync.importVolunteer': { mr: 'स्वयंसेवकाकडून घ्या',       en: 'Get from a volunteer' },
    'sync.receiveDevice':   { mr: 'दुसऱ्या फोनवरून घ्या',      en: 'Get from another phone' },
    'sync.getCoordinator':  { mr: 'कार्यालयाकडून घ्या',        en: 'Get from the office' },
    'sync.importVolunteerHint': { mr: 'स्वयंसेवकाच्या फोनवरच्या नवीन नोंदी घ्या.',
                              en: 'Bring in a volunteer’s new records.' },
    'sync.receiveDeviceHint': { mr: 'दुसऱ्या फोनवरून माणसं आणि नोंदी घ्या.',
                              en: 'Bring in people and records from another phone.' },
    'sync.viaWhatsApp':     { mr: 'WhatsApp वर पाठवा',        en: 'Send on WhatsApp' },
    'sync.copyPaste':       { mr: 'कॉपी करून WhatsApp मध्ये पेस्ट करा',
                              en: 'Copy, then paste into WhatsApp' },
    'sync.saveFile':        { mr: 'फाइल म्हणून ठेवा',          en: 'Save as a file' },
    'sync.undoQ':           { mr: 'शेवटचं घेतलेलं परत करायचं?',  en: 'Undo the last import?' },
    'sync.copyManual':      { mr: 'मजकूर निवडून स्वतः कॉपी करा.', en: 'Select the text and copy it yourself.' },
    'sync.unreadable':      { mr: 'हा मजकूर वाचता आला नाही.',   en: 'This could not be read.' },
    'sync.pasteFirst':      { mr: 'आधी बॅकअपचा मजकूर पेस्ट करा.', en: 'Paste the backup text first.' },
    'sync.restoreQ':        { mr: 'सगळं परत आणायचं?',          en: 'Restore everything?' },
    'sync.noSnapshot':      { mr: 'परत जाण्यासारखं काही नाही.',  en: 'There is nothing to go back to.' },
    'sync.nothingToSend':   { mr: 'पाठवण्यासारखं अजून काही नाही.', en: 'Nothing to send yet.' },

    /* ---------------------------------------------- adding a person */
    'form.primary':         { mr: 'मुख्य व्यक्ती',          en: 'The person' },
    'form.family':          { mr: 'कुटुंब',                en: 'Family' },
    'form.details':         { mr: 'इतर माहिती',            en: 'More' },
    'form.fullName':        { mr: 'नाव',                  en: 'Name' },
    'form.namePlaceholder': { mr: 'उदा. सुनीता पाटील',      en: 'e.g. Sunita Patil' },
    'form.preferredContact': { mr: 'कसा संपर्क करू?',       en: 'How to reach them' },
    'form.whatsapp':        { mr: 'WhatsApp',             en: 'WhatsApp' },
    'form.phoneCall':       { mr: 'फोन',                  en: 'Phone call' },
    'form.city':            { mr: 'गाव',                  en: 'Village or town' },
    'form.cityPlaceholder': { mr: 'उदा. बारामती',          en: 'e.g. Baramati' },
    'form.address':         { mr: 'पत्ता',                 en: 'Address' },
    'form.addressPlaceholder': { mr: 'घर / इमारत / भाग',    en: 'House, building, area' },
    'form.phones':          { mr: 'फोन नंबर',             en: 'Phone numbers' },
    'form.mobile':          { mr: 'मोबाईल नंबर',           en: 'Mobile number' },
    'form.removePhone':     { mr: 'हा नंबर काढा',          en: 'Remove this number' },
    'form.addPhone':        { mr: 'आणखी एक नंबर',          en: 'Add another number' },
    'form.emails':          { mr: 'ईमेल',                  en: 'Email' },
    'form.email':           { mr: 'ईमेल पत्ता',            en: 'Email address' },
    'form.removeEmail':     { mr: 'हा ईमेल काढा',          en: 'Remove this email' },
    'form.addEmail':        { mr: 'आणखी एक ईमेल',          en: 'Add another email' },
    'form.notes':           { mr: 'नोंद',                  en: 'Notes' },
    'form.generalNotes':    { mr: 'इतर नोंदी',             en: 'General notes' },
    'form.familyMembers':   { mr: 'कुटुंबातील माणसं',       en: 'Family members' },
    'form.familyName':      { mr: 'नाव',                  en: 'Their name' },
    'form.phoneOptional':   { mr: 'फोन (नसला तरी चालेल)',   en: 'Phone (optional)' },
    'form.newFamilyMember': { mr: 'नवीन व्यक्ती',           en: 'New family member' },
    'form.category':        { mr: 'प्रकार',                en: 'Category' },
    'form.tags':            { mr: 'खुणा',                  en: 'Tags' },
    'form.dob':             { mr: 'जन्मतारीख',             en: 'Date of birth' },
    'form.deathAnniversary': { mr: 'स्मरण दिवस',           en: 'Remembrance day' },
    'form.noYear':          { mr: 'वर्ष माहीत नाही (फक्त दिवस/महिना)', en: 'Year unknown (day and month only)' },
    'form.discard':         { mr: 'बदल टाकून द्या',         en: 'Discard changes' },
    'form.keepEditing':     { mr: 'इथेच राहा',              en: 'Keep editing' },
    'form.consentNeeded':   { mr: 'पुढे जाण्याआधी संमती द्या.', en: 'Please confirm consent to continue.' },
    'form.saved':           { mr: 'जतन झालं',              en: 'Saved' },
    'form.every':           { mr: 'दर',                   en: 'Every' },

    /* ------------------------------------------------- one person's page */
    'view.notFound':        { mr: 'ही व्यक्ती सापडली नाही.',  en: 'This person was not found.' },
    'view.back':            { mr: 'यादीकडे परत',            en: 'Back to the list' },
    'view.doNotContact':    { mr: 'संपर्क करू नका',          en: 'Do not contact' },
    'view.allowContact':    { mr: 'संपर्क करू शकता',         en: 'Contact allowed' },
    'view.markDnc':         { mr: 'संपर्क थांबवा',           en: 'Stop contacting' },
    'view.consent':         { mr: 'संमती',                  en: 'Consent' },
    'view.consentRecorded': { mr: 'संमती नोंदवली आहे',       en: 'Consent recorded' },
    'view.call':            { mr: 'फोन करा',                en: 'Call' },
    'view.email':           { mr: 'ईमेल',                   en: 'Email' },
    'view.logInteraction':  { mr: 'नोंद करा',               en: 'Add a record' },
    'view.primaryContact':  { mr: 'मुख्य व्यक्ती',           en: 'The person' },
    'view.family':          { mr: 'कुटुंब',                 en: 'Family' },
    'view.generalNotes':    { mr: 'नोंदी',                  en: 'Notes' },
    'view.timeline':        { mr: 'आजवरच्या भेटी',           en: 'Everything so far' },
    'view.tags':            { mr: 'खुणा',                   en: 'Tags' },
    'view.noTags':          { mr: 'खुणा नाहीत',             en: 'No tags' },
    'view.phones':          { mr: 'फोन',                   en: 'Phones' },
    'view.emails':          { mr: 'ईमेल',                   en: 'Emails' },
    'view.dates':           { mr: 'तारखा',                  en: 'Dates' },
    'view.noneLogged':      { mr: 'काही नाही',              en: 'None' },
    'view.specificNotes':   { mr: 'खास नोंदी',              en: 'Notes about them' },
    'view.noInteractions':  { mr: 'अजून कोणतीही भेट नाही.',  en: 'No visits recorded yet.' },
    'view.deletePerson':    { mr: 'ही व्यक्ती काढून टाका',    en: 'Remove this person' },
    'view.deleted':         { mr: 'काढून टाकलं',            en: 'Removed' },
    'view.dncSet':          { mr: 'यापुढे संपर्क करणार नाही.', en: 'They will not be contacted.' },
    'view.dncCleared':      { mr: 'संपर्क करू शकता.',        en: 'They can be contacted again.' },

    /* ----------------------------------------------------------- settings */
    // Named by what the person controls. "Machine Information" was our word for
    // it; "This device" is theirs.
    'set.preferences':      { mr: 'तुमच्या आवडीनुसार',       en: 'Your preferences' },
    'set.orgName':          { mr: 'संस्थेचं नाव',            en: 'Your organisation’s name' },
    'set.orgPlaceholder':   { mr: 'उदा. भगवान बाबा बालिकाश्रम', en: 'e.g. Bhagwan Baba Balikashram' },
    'set.opening':          { mr: 'सुरुवातीची स्क्रीन',       en: 'Opening screen' },
    'set.weekStart':        { mr: 'आठवडा कधी सुरू होतो',      en: 'Week starts on' },
    'set.sunday':           { mr: 'रविवार',                 en: 'Sunday' },
    'set.monday':           { mr: 'सोमवार',                 en: 'Monday' },
    'set.lookahead':        { mr: 'किती दिवस आधी आठवण द्यायची', en: 'How many days ahead to remind' },
    'set.backupEvery':      { mr: 'किती दिवसांनी बॅकअपची आठवण', en: 'Remind me to back up every' },
    'set.lapseAfter':       { mr: 'किती दिवसांनी "भेट नाही" म्हणायचं', en: 'Count as “not seen” after' },
    'set.tagline':          { mr: 'संदेशाखालची ओळ',          en: 'Sign-off line on messages' },
    'set.campaignLang':     { mr: 'संदेशांची भाषा',           en: 'Language for messages' },
    'set.english':          { mr: 'इंग्रजी',                 en: 'English' },
    'set.save':             { mr: 'जतन करा',               en: 'Save' },
    'set.thisDevice':       { mr: 'हा फोन',                 en: 'This device' },
    'set.deviceName':       { mr: 'फोनचं नाव',              en: 'Name for this device' },
    'set.role':             { mr: 'भूमिका',                 en: 'Role' },
    'set.deviceId':         { mr: 'ओळख क्रमांक',            en: 'Device ID' },
    'set.since':            { mr: 'कधीपासून',               en: 'In use since' },
    'set.about':            { mr: 'ॲपबद्दल',               en: 'About' },
    'set.templates':        { mr: 'संदेशांचे नमुने',          en: 'Message templates' },
    'set.saveTemplates':    { mr: 'नमुने जतन करा',           en: 'Save templates' },
    'set.resetTemplates':   { mr: 'पहिल्यासारखे करा',        en: 'Reset to the originals' },
    'set.smsPermission':    { mr: 'SMS ची परवानगी द्या',     en: 'Allow SMS' },
    'set.dailyNotif':       { mr: 'रोजची आठवण चालू करा',     en: 'Daily reminder' },
    'set.dailyTime':        { mr: 'किती वाजता',             en: 'At what time' },
    'set.platform':         { mr: 'कुठे चालू आहे',           en: 'Running on' },
    'set.appVersion':       { mr: 'आवृत्ती',                en: 'Version' },
    'set.people':           { mr: 'माणसं',                  en: 'People' },
    'set.records':          { mr: 'नोंदी',                  en: 'Records' },
    'set.knownDevices':     { mr: 'माहीत असलेले फोन',        en: 'Devices you sync with' },
    'set.lastSync':         { mr: 'शेवटचं sync',            en: 'Last sync' },
    'set.storageUsed':      { mr: 'वापरलेली जागा',           en: 'Space used' },
    'set.smsStatus':        { mr: 'SMS परवानगी',            en: 'SMS permission' },
    'set.testPaths':        { mr: 'तपासणी',                 en: 'Diagnostics' },
    'set.markAs':           { mr: 'इतक्या दिवसांनी "भेट नाही" म्हणा', en: 'Count as not seen after' }
};

export default STRINGS;
