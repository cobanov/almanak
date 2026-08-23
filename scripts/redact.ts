/**
 * Redaction for archive samples and fixtures.
 *
 * The goal is documentation and test data that is structurally faithful and
 * semantically empty. Rather than blanking fields — which would hide the very
 * shapes the parser has to cope with — every letter is replaced by another
 * letter drawn from the same alphabet.
 *
 * That preserves length, script, casing pattern and diacritic density, so a
 * redacted Turkish tweet still exercises Turkish tokenization (dotted and
 * dotless i, agglutinative word lengths) while saying nothing.
 *
 * Identifiers, handles, hashtags and URLs get stable pseudonyms, so the same
 * account is the same pseudonym across every record — relationships survive,
 * identities do not.
 */

// ---------------------------------------------------------------- alphabets

const ALPHABETS: string[][] = [
  'abcdefghijklmnopqrstuvwxyz'.split(''),
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  'çğıöşü'.split(''),
  'ÇĞİÖŞÜ'.split(''),
  'àáâäéèêëíìîïóòôõúùûñ'.split(''),
  'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'.split(''),
  'αβγδεζηθικλμνξοπρστυφχψω'.split(''),
  'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'.split(''),
  '0123456789'.split(''),
]

const MEMBERSHIP = new Map<string, { set: string[]; index: number }>()
for (const set of ALPHABETS) {
  set.forEach((ch, index) => MEMBERSHIP.set(ch, { set, index }))
}

/** FNV-1a. Small, stable across runs, not cryptographic — none needed. */
function hash(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/**
 * Replace each letter with another from the same alphabet, deterministically.
 * Punctuation, whitespace, emoji and any script we do not model are passed
 * through; unmodelled letters become "x" so nothing readable survives.
 */
export function scrambleText(text: string, salt = ''): string {
  const offset = hash(salt + text) % 23 || 7
  let out = ''
  for (const ch of text) {
    const member = MEMBERSHIP.get(ch)
    if (member) {
      out += member.set[(member.index + offset) % member.set.length]
    } else if (/\p{L}/u.test(ch)) {
      out += 'x'
    } else {
      out += ch
    }
  }
  return out
}

// ------------------------------------------------------------- pseudonymity

/** Stable pseudonyms, so the same input always yields the same output. */
export class Pseudonyms {
  #maps = new Map<string, Map<string, string>>()
  #counters = new Map<string, number>()

  #next(kind: string): number {
    const n = (this.#counters.get(kind) ?? 0) + 1
    this.#counters.set(kind, n)
    return n
  }

  /** e.g. get('handle', 'someaccount') -> 'user_a' (stable per run) */
  get(kind: string, real: string, format: (n: number) => string): string {
    let map = this.#maps.get(kind)
    if (!map) this.#maps.set(kind, (map = new Map()))
    const existing = map.get(real)
    if (existing) return existing
    const made = format(this.#next(kind))
    map.set(real, made)
    return made
  }

  handle(real: string): string {
    return this.get('handle', real.toLowerCase(), (n) => `user_${letters(n)}`)
  }
  hashtag(real: string): string {
    return this.get('hashtag', real.toLowerCase(), (n) => `tag_${letters(n)}`)
  }
  /** Digits only, same length as the original: ids are length-sensitive. */
  id(real: string): string {
    return this.get('id', real, () => {
      let h = hash(`id:${real}`)
      let out = ''
      while (out.length < real.length) {
        out += String(h % 10)
        h = Math.imul(h, 0x01000193) >>> 0
      }
      // Never start with 0 — X ids never do, and consumers may parse them.
      return (out[0] === '0' ? '1' : out[0]) + out.slice(1, real.length)
    })
  }
  /** t.co codes are fixed-length base62. */
  shortcode(real: string): string {
    return this.get('shortcode', real, () => {
      const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      let h = hash(`tco:${real}`)
      let out = ''
      while (out.length < real.length) {
        out += alphabet[h % alphabet.length]
        h = Math.imul(h, 0x01000193) >>> 0
      }
      return out
    })
  }
}

/** 1 -> a, 2 -> b, ... 27 -> aa */
function letters(n: number): string {
  let out = ''
  let v = n
  while (v > 0) {
    v--
    out = String.fromCharCode(97 + (v % 26)) + out
    v = Math.floor(v / 26)
  }
  return out
}

// ------------------------------------------------------------------- fields

/**
 * Domains kept verbatim. These are public destinations, not identifying, and
 * the "links to a domain" filter needs realistic values to be testable.
 */
const PUBLIC_DOMAINS = new Set([
  'github.com', 'youtube.com', 'youtu.be', 'twitter.com', 'x.com',
  'arxiv.org', 'wikipedia.org', 'medium.com', 'huggingface.co',
  'stackoverflow.com', 'google.com', 'apple.com', 'openai.com',
])

export function redactUrl(url: string, names: Pseudonyms): string {
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 't.co') {
      return `https://t.co/${names.shortcode(parsed.pathname.slice(1))}`
    }
    const bare = parsed.hostname.replace(/^www\./, '')
    const keep = [...PUBLIC_DOMAINS].some((d) => bare === d || bare.endsWith(`.${d}`))
    const host = keep ? parsed.hostname : 'example.com'
    // A status URL must stay a status URL: quote-tweet detection depends on it.
    const status = parsed.pathname.match(/^\/([^/]+)\/status\/(\d+)/)
    if (status && keep) {
      return `https://${host}/${names.handle(status[1])}/status/${names.id(status[2])}`
    }
    // Keep any file extension: media filenames are joined on it, and the
    // gallery decides how to render from it.
    const path = parsed.pathname.slice(1)
    const dot = path.lastIndexOf('.')
    const ext = dot > 0 && /^\.[a-z0-9]{2,4}$/i.test(path.slice(dot)) ? path.slice(dot) : ''
    const stem = ext ? path.slice(0, dot) : path
    return `https://${host}/${scrambleText(stem, 'path')}${ext}`
  } catch {
    return 'https://example.com/redacted'
  }
}

/**
 * Redact tweet text while keeping every feature the parser reads: the
 * "RT @handle:" prefix, mentions, hashtags, t.co links, emoji and layout.
 */
export function redactText(text: string, names: Pseudonyms): string {
  // "RT @handle: " is structure, not content — it is the only marker that a
  // record is a retweet. Preserve it verbatim and redact only what follows.
  const rt = text.match(/^RT @(\w+): ([\s\S]*)$/)
  if (rt) return `RT @${names.handle(rt[1])}: ${redactText(rt[2], names)}`

  // One pass, one alternation. Handling URLs, mentions, hashtags and plain
  // words in separate passes meant a later pass could chew through an earlier
  // pass's output — scrambling a URL scheme, or a placeholder's own index.
  const TOKEN = /(https?:\/\/\S+)|@(\w+)|#(\w+)|([\p{L}\p{N}]+)/gu

  return text.replace(TOKEN, (_match, url?: string, mention?: string, tag?: string, word?: string) => {
    if (url) return redactUrl(url, names)
    if (mention) return `@${names.handle(mention)}`
    if (tag) return `#${names.hashtag(tag)}`
    return scrambleText(word ?? '', 'text')
  })
}

// ------------------------------------------------------------------ records

/**
 * Keys whose values are safe verbatim: they describe the record rather than
 * its author or content, and every one of them is something the app filters,
 * groups or charts on.
 */
const KEEP_VERBATIM = new Set([
  'created_at', 'deleted_at', 'editableUntil', 'lang', 'source', 'type',
  'favorite_count', 'retweet_count', 'editsRemaining', 'width', 'height',
  'resize', 'bitrate', 'content_type', 'duration_millis', 'aspect_ratio',
])

const ID_KEY = /(^|_)id(_str)?$/i
const HANDLE_KEYS = new Set(['screen_name', 'in_reply_to_screen_name', 'username'])
const TEXT_KEYS = new Set(['full_text', 'text', 'description', 'displayName'])
const URL_KEYS = new Set(['url', 'expanded_url', 'media_url', 'media_url_https', 'video_url'])

/**
 * Redact one archive record, driven by key name rather than by a hardcoded
 * schema — so a field X adds tomorrow is scrambled by default rather than
 * leaking because nobody taught the redactor about it.
 */
export function redactRecord(
  value: unknown,
  names: Pseudonyms,
  key = '',
  path: readonly string[] = [],
): unknown {
  if (Array.isArray(value)) return value.map((v) => redactRecord(v, names, key, path))

  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    const here = key ? [...path, key] : path
    for (const [k, v] of Object.entries(value)) out[k] = redactRecord(v, names, k, here)
    return out
  }

  if (typeof value !== 'string') return value // numbers, booleans, null
  if (KEEP_VERBATIM.has(key)) return value
  if (ID_KEY.test(key)) return names.id(value)
  if (HANDLE_KEYS.has(key)) return names.handle(value)
  // A hashtag entity's `text` is the same token as the "#tag_x" in full_text.
  // Scrambling it independently would make the two disagree, and any test
  // that cross-checks entities against text would fail for the wrong reason.
  if (key === 'text' && path.includes('hashtags')) return names.hashtag(value)
  if (key === 'text' && path.includes('symbols')) return names.hashtag(value)
  if (TEXT_KEYS.has(key)) return redactText(value, names)
  if (URL_KEYS.has(key)) return redactUrl(value, names)
  if (key === 'display_url') return redactUrl(`https://${value}`, names).replace(/^https:\/\//, '')
  if (key === 'indices') return value

  return scrambleText(value, key) // unknown string: scramble by default
}
