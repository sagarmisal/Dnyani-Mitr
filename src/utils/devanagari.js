// Devanagari text handling — INITIATIVE.md P1.1, P1.2, D-18.
//
// WHY THIS EXISTS
// ---------------
// Volunteers type with a transliteration keyboard: Latin in, Devanagari out
// (the way most people type Marathi in WhatsApp). The IME offers several
// Devanagari candidates for the same keystrokes, so the SAME name typed twice
// rarely comes back identical — सुनीता one day, सुनिता the next. A volunteer in
// a hurry may accept the plain Latin candidate instead, so one NGO ends up
// holding "Sunita Patil" and "सुनीता पाटील" for one person.
//
// `foldKey()` collapses all of that to one comparable string. It is used for
// search, for ranking, and for SUGGESTING a duplicate.
//
// IT MUST NEVER AUTO-MERGE (D-18). The fold is deliberately aggressive — it
// collapses श/ष/स and the aspirates — so it will occasionally match two people
// who are genuinely different. That is an acceptable cost for ranking and an
// unacceptable one for merging. This follows the rule already in SyncService: a
// phone match with a different name flags a duplicate rather than merging it.
//
// Identity remains the phone number (PR-1). This is a convenience layer over
// names, never a replacement for it.

/**
 * Unicode normalisation (P1.2).
 *
 * Devanagari has characters that can be written two ways — क़ is either the
 * precomposed U+0958, or क followed by the nukta U+093C. They look identical
 * and compare unequal. Different keyboards emit different forms, so every name
 * is normalised on the way in and every query on the way through.
 */
export function normalizeText(s) {
    if (s === null || s === undefined) return '';
    return String(s).normalize('NFC');
}

const CONSONANTS = {
    'क': 'k', 'ख': 'k', 'ग': 'g', 'घ': 'g', 'ङ': 'n',
    'च': 'c', 'छ': 'c', 'ज': 'j', 'झ': 'j', 'ञ': 'n',
    'ट': 't', 'ठ': 't', 'ड': 'd', 'ढ': 'd', 'ण': 'n',
    'त': 't', 'थ': 't', 'द': 'd', 'ध': 'd', 'न': 'n',
    'प': 'p', 'फ': 'p', 'ब': 'b', 'भ': 'b', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'ळ': 'l', 'व': 'v',
    'श': 's', 'ष': 's', 'स': 's', 'ह': 'h'
};

const VOWELS = {
    'अ': 'a', 'आ': 'a', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u',
    'ऋ': 'ri', 'ए': 'e', 'ऐ': 'e', 'ओ': 'o', 'औ': 'o'
};

/** Vowel signs. Long/short pairs collapse — the IME's choice between them is arbitrary. */
const MATRAS = {
    'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u',
    'ृ': 'ri', 'े': 'e', 'ै': 'e', 'ो': 'o', 'ौ': 'o', 'ॉ': 'o', 'ॅ': 'e'
};

/** Anusvara, chandrabindu, visarga, nukta. These do NOT suppress the inherent vowel. */
const SIGNS = { 'ं': 'n', 'ँ': 'n', 'ः': '', '़': '' };

const VIRAMA = '्';

/**
 * Conjuncts whose pronunciation is not the sum of their parts, and which are
 * therefore romanised inconsistently. ज्ञ is the important one: it reads "dnya"
 * in Marathi and "gya" in Hindi — and it is the first syllable of this app's
 * own name, ज्ञानी मित्र. Both readings fold to the same key.
 */
// Each maps to a private-use placeholder that is registered in CONSONANTS
// below, so the conjunct passes through the ordinary inherent-vowel rule
// instead of around it. Substituting the Latin directly would bake in a schwa
// the loop should decide: लक्ष्मी has none (a virama follows) while क्षमा does.
const IRREGULAR = [
    [/\u091c\u094d\u091e/g, '\uF001'],   // ज्ञ — "dnya" in Marathi, "gya" in Hindi
    [/\u0915\u094d\u0937/g, '\uF002'],   // क्ष
    [/\u0924\u094d\u0930/g, '\uF003'],   // त्र
    [/\u0936\u094d\u0930/g, '\uF004']    // श्र
];

const CONJUNCTS = {
    '\uF001': 'jn',
    '\uF002': 'ks',
    '\uF003': 'tr',
    '\uF004': 'sr'
};

/**
 * A comparable key for a name, tolerant of the ways the same name gets typed.
 *
 * @param {string} raw - a name in Devanagari, Latin, or a mix of both
 * @returns {string} the fold key; '' for empty input
 *
 * @example
 *   foldKey('सुनीता') === foldKey('सुनिता')   // long vs short i
 *   foldKey('सुनीता') === foldKey('Sunita')   // across scripts
 *   foldKey('ज्ञानेश्वर') === foldKey('Dnyaneshwar')
 *   foldKey('सुनीता') !== foldKey('सुजाता')   // different people stay different
 */
export function foldKey(raw) {
    if (!raw) return '';
    let s = normalizeText(raw).trim().toLowerCase();
    for (const [re, rep] of IRREGULAR) s = s.replace(re, rep);

    let out = '';
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        const next = s[i + 1] || '';

        const consonant = CONSONANTS[ch] ?? CONJUNCTS[ch];
        if (consonant !== undefined) {
            out += consonant;
            // The inherent vowel. A Devanagari consonant carries an implicit 'a'
            // unless a vowel sign or virama follows — which is why विजय reads
            // "vijay" and not "vijy". It is dropped word-finally, matching how
            // the name is actually spoken and typed in Latin.
            const hasExplicitVowel = MATRAS[next] !== undefined || next === VIRAMA;
            const wordFinal = next === '' || next === ' ';
            if (!hasExplicitVowel && !wordFinal) out += 'a';
        } else if (VOWELS[ch]) {
            out += VOWELS[ch];
        } else if (MATRAS[ch]) {
            out += MATRAS[ch];
        } else if (SIGNS[ch] !== undefined) {
            out += SIGNS[ch];
        } else if (ch === VIRAMA) {
            // joins consonants; contributes nothing itself
        } else if (/[a-z0-9\s]/.test(ch)) {
            out += ch;
        }
        // everything else — punctuation, ZWJ/ZWNJ, other scripts — is dropped
    }

    return out
        // Latin-side equivalences: the same name attracts several English spellings
        .replace(/dny|gny|gy|jn|dn/g, 'jn')      // ज्ञ however it was typed
        .replace(/ksh|x/g, 'ks')
        .replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/aa/g, 'a')
        .replace(/([kgcjtdpb])h/g, '$1')          // aspirates: Bhau -> bau, Thakur -> takur
        .replace(/sh/g, 's').replace(/z/g, 'j').replace(/w/g, 'v')
        .replace(/(.)\1+/g, '$1')                 // doubled letters
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Do two names plausibly refer to the same person?
 *
 * A SUGGESTION, never grounds for a merge (D-18). Returns false for empty
 * input rather than treating two blanks as a match — under D-07 a nameless
 * visitor is normal, and "everyone with no name is the same person" would be
 * a data-destroying answer.
 */
export function namesLikelySame(a, b) {
    const ka = foldKey(a);
    const kb = foldKey(b);
    return ka !== '' && ka === kb;
}

/**
 * Is this string written in Devanagari, Latin, both, or neither?
 * Used for reporting, not for behaviour.
 */
export function scriptOf(s) {
    const t = normalizeText(s);
    if (!t) return 'empty';
    let dev = 0;
    let lat = 0;
    for (const ch of t) {
        const c = ch.codePointAt(0);
        if (c >= 0x0900 && c <= 0x097F) dev++;
        else if (/[A-Za-z]/.test(ch)) lat++;
    }
    if (dev && lat) return 'mixed';
    if (dev) return 'devanagari';
    if (lat) return 'latin';
    return 'other';
}

export default { foldKey, namesLikelySame, normalizeText, scriptOf };
