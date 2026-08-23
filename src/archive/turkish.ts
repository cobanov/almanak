/**
 * Turkish-aware text normalization for search and term statistics.
 *
 * 77% of the reference archive is Turkish, and two properties of the language
 * break the usual approach:
 *
 * 1. Turkish has two i's. Dotted "i/İ" and dotless "ı/I" are separate letters.
 *    JavaScript's toLowerCase() applies the general Unicode rule, so "I"
 *    becomes "i" rather than "ı" and "İ" becomes "i̇" (i + combining dot).
 *    Searching "isik" would then miss "IŞIK" and searching "İstanbul" would
 *    miss itself.
 *
 * 2. Turkish is agglutinative. "model", "modeli", "modelin", "modelleri" and
 *    "modellerimiz" are one concept and five tokens. Without any stemming,
 *    term statistics fragment and search recall drops.
 *
 * The response is deliberately shallow: fold every i-variant to a single
 * letter, strip diacritics, then remove the most common inflectional suffixes
 * longest-first. This is not a real morphological analyser and does not try to
 * be. It is enough to make search and TF-IDF behave, and it degrades to
 * roughly "lowercase and fold" for languages it does not know.
 */

/** Every i-form collapses to "i" so the two dotted-i systems cannot diverge. */
const FOLD: Record<string, string> = {
  'İ': 'i', 'I': 'i', 'ı': 'i', 'i': 'i',
  'Ş': 's', 'ş': 's', 'Ğ': 'g', 'ğ': 'g',
  'Ü': 'u', 'ü': 'u', 'Ö': 'o', 'ö': 'o', 'Ç': 'c', 'ç': 'c',
  'Â': 'a', 'â': 'a', 'Î': 'i', 'î': 'i', 'Û': 'u', 'û': 'u',
}

/**
 * Suffixes stripped longest-first. Ordered so that "lerimiz" is removed before
 * "ler", and "imiz" before "i". Only suffixes that are unambiguous enough to
 * be worth the recall are listed; possessives and plurals cover most of the
 * useful ground.
 */
/*
  Bare 'e' and 'a' used to be here, for the Turkish dative. They came out: they
  stripped the last letter off ordinary English words — "stable" became "stabl",
  "llama" became "llam" — and those stems are shown to the reader in the
  vocabulary panel. The dative is spelled -ye/-ya after a vowel, which is still
  caught, so the recall lost is small and the damage avoided is visible.
*/
const SUFFIXES = [
  'lerimizde', 'larimizda', 'lerimize', 'larimiza', 'lerimiz', 'larimiz',
  'lerinde', 'larinda', 'lerine', 'larina', 'lerini', 'larini',
  'lerin', 'larin', 'lerle', 'larla', 'ler', 'lar',
  'imizde', 'imiza', 'imiz', 'iniz', 'in', 'im', 'i',
  'de', 'da', 'te', 'ta', 'den', 'dan', 'ten', 'tan',
  'ye', 'ya', 'le', 'la', 'ce', 'ca',
  'dir', 'dur', 'tir', 'tur', 'mis', 'mus', 'yor',
]

/** Words below this length are never stemmed: the stem would be noise. */
const MIN_STEM = 4

export function foldChar(ch: string): string {
  return FOLD[ch] ?? ch.toLowerCase()
}

/** Lowercase and fold, without stemming. Used where length must be preserved. */
export function fold(text: string): string {
  let out = ''
  for (const ch of text) out += foldChar(ch)
  return out.normalize('NFD').replace(/\p{Mn}/gu, '')
}

/** How many suffixes may come off one word. Turkish rarely stacks more. */
const MAX_STRIPS = 3

/**
 * Fold, then peel inflectional suffixes while the remainder stays a word.
 *
 * Peeling repeats because Turkish stacks: model + ler + i. A single pass left
 * "modelleri" as "modeller", which never met "model" and split one concept
 * across two entries in every term count.
 */
export function stem(word: string): string {
  let current = fold(word)

  for (let pass = 0; pass < MAX_STRIPS; pass++) {
    if (current.length < MIN_STEM) return current
    const before = current
    for (const suffix of SUFFIXES) {
      if (current.length - suffix.length >= MIN_STEM && current.endsWith(suffix)) {
        current = current.slice(0, current.length - suffix.length)
        break
      }
    }
    if (current === before) break // nothing matched, it is as short as it gets
  }

  return current
}

/**
 * Tokens paired with the word they came from.
 *
 * The stem is what search matches on; the surface form is what a reader should
 * ever see. Displaying stems turns "stable" into "stab" and "inference" into
 * "inferen", which reads as a bug in the app rather than as a deliberate
 * shortcut in the matcher.
 */
export function tokenizeWithSurface(text: string): { stem: string; surface: string }[] {
  const out: { stem: string; surface: string }[] = []
  for (const raw of text.split(/[^\p{L}\p{N}_]+/u)) {
    if (!raw) continue
    const s = stem(raw)
    if (s.length > 1) out.push({ stem: s, surface: raw.toLocaleLowerCase('tr') })
  }
  return out
}

/** Split into searchable tokens: folded, stemmed, no punctuation. */
export function tokenize(text: string): string[] {
  const out: string[] = []
  for (const raw of text.split(/[^\p{L}\p{N}_]+/u)) {
    if (!raw) continue
    const t = stem(raw)
    if (t.length > 1) out.push(t)
  }
  return out
}

/** The indexed form of a tweet: space-joined stems, for substring matching. */
export function normalizeForSearch(text: string): string {
  return tokenize(text).join(' ')
}

/**
 * Stopwords for term statistics. Turkish and English, since the reference
 * archive mixes them. Editable by the user at runtime; this is the default.
 */
export const STOPWORDS = new Set([
  // Turkish
  'bir', 'bu', 've', 'de', 'da', 'ne', 'ki', 'mi', 'ama', 'icin', 'gibi',
  'daha', 'cok', 'kadar', 'sonra', 'once', 'ile', 'her', 'hic', 'ben', 'sen',
  'biz', 'siz', 'onlar', 'var', 'yok', 'olan', 'oldu', 'olarak', 'diye',
  'ise', 'ya', 'yani', 'ancak', 'hem', 'sey', 'zaman', 'simdi', 'evet',
  'hayir', 'tamam', 'nasil', 'neden', 'niye', 'nerede', 'kim', 'hangi',
  'bende', 'sanki', 'bile', 'zaten', 'belki', 'tabi', 'valla', 'abi',
  // English
  'the', 'and', 'for', 'that', 'this', 'with', 'you', 'are', 'was', 'have',
  'before', 'after', 'than', 'then', 'worth', 'exactly', 'still', 'much',
  'most', 'more', 'other', 'some', 'which', 'been', 'into', 'over', 'only',
  'them', 'they', 'here', 'there', 'because', 'should', 'would', 'could',
  'anyway', 'actually', 'really', 'thing', 'things', 'today', 'week', 'year',
  'not', 'but', 'they', 'from', 'what', 'his', 'her', 'she', 'him', 'has',
  'had', 'were', 'been', 'their', 'would', 'there', 'when', 'your', 'can',
  'all', 'get', 'just', 'like', 'out', 'about', 'one', 'its', 'him', 'how',
  // Cross-language noise
  'http', 'https', 'com', 'www', 'amp',
])
