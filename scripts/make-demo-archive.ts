/**
 * Generate the demo archive.
 *
 * The demo used to be a real archive with every letter swapped for another
 * from the same alphabet. That is safe and it is honest, but it reads as
 * damage: a visitor sees "öfyfy nud fqxqhulkaz" and concludes the app is
 * broken rather than that the data is deliberately meaningless.
 *
 * So this invents one instead. Nobody's words, nobody's photographs — a
 * fictional account with a plausible shape: it ramps up, peaks, goes quiet for
 * a season, and comes back; it posts more on weekday evenings than on Sunday
 * mornings; its vocabulary moves with the years, so vocabulary drift and era
 * detection have something true to find. The point is that every panel in the
 * app shows what it would show on a real archive.
 *
 *   node scripts/make-demo-archive.ts [out-dir]
 */

import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { placeholderImage } from './make-placeholders.ts'

const out = process.argv[2] ?? join(process.cwd(), 'fixtures', 'demo')

// Deterministic: the demo must not shimmer between builds.
let seed = 0x1a2b3c4d
const rnd = () => {
  seed ^= seed << 13; seed >>>= 0
  seed ^= seed >> 17
  seed ^= seed << 5; seed >>>= 0
  return seed / 0x100000000
}
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]
const chance = (p: number) => rnd() < p

// --------------------------------------------------------------- the account

const ME = { id: '1470229385027', handle: 'demo_archive', name: 'Demo Archive' }

/**
 * What the account talked about, year by year. Era detection and vocabulary
 * drift both read this back out, so the years have to differ genuinely rather
 * than just being reshuffled.
 */
const ERAS: { year: number; weight: number; topics: string[]; verbs: string[] }[] = [
  { year: 2019, weight: 0.55,
    topics: ['docker', 'kubernetes', 'terraform', 'postgres', 'nginx', 'ansible', 'redis', 'ci pipeline', 'staging'],
    verbs: ['deployed', 'migrated', 'debugged', 'broke', 'rewrote'] },
  { year: 2020, weight: 0.8,
    topics: ['typescript', 'react hooks', 'vite', 'esbuild', 'monorepo', 'tailwind', 'graphql', 'sqlite'],
    verbs: ['shipped', 'refactored', 'benchmarked', 'ported', 'deleted'] },
  { year: 2021, weight: 0.65,
    topics: ['side project', 'newsletter', 'rust', 'wasm', 'edge functions', 'sqlite', 'analytics', 'burnout'],
    verbs: ['started', 'abandoned', 'rewrote', 'measured', 'shelved'] },
  { year: 2022, weight: 1.15,
    topics: ['stable diffusion', 'colab', 'gpu', 'diffusion models', 'prompt', 'checkpoint', 'inference', 'dreambooth'],
    verbs: ['trained', 'fine-tuned', 'generated', 'benchmarked', 'rented'] },
  { year: 2023, weight: 1.5,
    topics: ['embeddings', 'vector database', 'rag', 'langchain', 'gpt-4', 'chunking', 'retrieval', 'context window'],
    verbs: ['indexed', 'evaluated', 'chunked', 'compared', 'replaced'] },
  { year: 2024, weight: 1.05,
    topics: ['llama', 'quantization', 'fine-tuning', 'inference server', 'lora', 'vllm', 'throughput', 'latency'],
    verbs: ['quantized', 'served', 'profiled', 'measured', 'tuned'] },
  { year: 2025, weight: 0.85,
    topics: ['agents', 'tool use', 'mcp', 'evals', 'sandboxing', 'orchestration', 'context', 'traces'],
    verbs: ['wired', 'evaluated', 'sandboxed', 'traced', 'shipped'] },
  { year: 2026, weight: 0.7,
    topics: ['evals', 'agent harness', 'local models', 'inference cost', 'tool calls', 'long context'],
    verbs: ['measured', 'rebuilt', 'cut', 'automated', 'audited'] },
]

/** Turkish shows up too, so Turkish search has something to find. */
const TR_TOPICS = ['model', 'veri seti', 'eğitim', 'çıkarım', 'ölçüm', 'ışık', 'İstanbul', 'sunucu', 'gecikme']
const TR_TEMPLATES = [
  (t: string) => `${t} tarafında beklediğimden çok daha iyi sonuç aldık`,
  (t: string) => `${t} konusunda kafam karışık, deneyen var mı`,
  (t: string) => `bugün ${t} üzerinde çalıştım, notlarımı yakında paylaşırım`,
  (t: string) => `${t} için yazdığım küçük script işi fazlasıyla gördü`,
  (t: string) => `${t} ölçümlerini tekrarladım, ilk sonuç yanlışmış`,
]

/** Tail clauses, so one template does not always produce one sentence. */
const TAILS = [
  '', '', '', '',
  '.',
  ' still not sure it was worth it.',
  ' would do it again.',
  ' notes in the repo if anyone wants them.',
  ' anyway, back to it.',
  ' this is not advice.',
  ' happy to be wrong about this.',
  ' the docs disagree, the docs are old.',
]

const OPENERS = [
  (t: string, v: string) => `${v} the ${t} setup today and it is finally boring, which is the goal`,
  (t: string, v: string) => `spent the afternoon on ${t}. ${v} most of it. no regrets`,
  (t: string) => `the thing nobody tells you about ${t} is that the defaults are wrong for almost everyone`,
  (t: string) => `${t} is one of those tools that is either exactly right or completely wrong for your problem`,
  (t: string, v: string) => `${v} our ${t} pipeline. runtime went from unbearable to fine`,
  (t: string) => `does anyone have a ${t} setup they actually like? mine works but I don't trust it`,
  (t: string) => `hot take: most ${t} problems are actually data problems wearing a costume`,
  (t: string, v: string) => `${v} ${t} twice this week. the second time was much shorter`,
  (t: string) => `reading the ${t} source instead of the docs was, as usual, faster`,
  (t: string) => `three hours lost to a ${t} config typo. posting this so the next person searches better`,
  (t: string) => `every ${t} tutorial starts at step four. this is a complaint`,
  (t: string, v: string) => `${v} ${t} on a whim and now it is load bearing. classic`,
  (t: string) => `${t} finally clicked for me today, about two years later than it should have`,
  (t: string) => `if your ${t} benchmark fits in cache, you are benchmarking the cache`,
  (t: string, v: string) => `we ${v} ${t} for a client and kept the tooling. best accident this quarter`,
  (t: string) => `unpopular: ${t} is fine. your architecture around it is the problem`,
  (t: string, v: string) => `${v} the ${t} docs into something a human can follow. PR is up`,
  (t: string) => `week three of ${t} and I have opinions now, which is the dangerous stage`,
  (t: string) => `the ${t} migration is done. nobody noticed, which is the highest praise`,
  (t: string, v: string) => `${v} ${t} at 2am is not a personality, it is a scheduling failure`,
  (t: string) => `${t} costs are down 40% and I cannot fully explain why. investigating`,
  (t: string) => `genuinely surprised how far you get on ${t} with no infrastructure at all`,
  (t: string, v: string) => `${v} the whole ${t} layer. six hundred lines became ninety`,
  (t: string) => `asked three people about ${t} and got four answers, so that is where we are`,
]

const REPLIES = [
  'yes exactly this', 'same experience here', 'how are you measuring that?',
  'this matches what we saw', 'wait, really? that is surprising',
  'do you have a link for that?', 'agreed, though the tradeoff bites later',
  'thanks, this helped a lot', 'I ended up doing the opposite and it worked too',
  'that was the missing piece, thank you', 'we hit the same wall last month',
  'strong agree', 'depends heavily on the workload I think',
  'ha, I made exactly this mistake', 'that number seems low, what hardware?',
  'bunu ben de denedim, aynı sonucu aldım', 'çok haklısın', 'kaynak var mı acaba',
]

const THREAD_STARTS = [
  (t: string) => `some notes from a week of ${t}, since I keep getting asked:`,
  (t: string) => `short thread on why our ${t} numbers were wrong for two months:`,
  (t: string) => `things I wish someone had told me before I started with ${t}:`,
  (t: string) => `we replaced our ${t} stack. here is what actually changed:`,
]
const THREAD_BODY = [
  (t: string) => `first: the defaults assume a workload nobody has. ${t} is tuned for the demo, not for you.`,
  (t: string) => `second: measure before and after. we "improved" ${t} three times before noticing one of them was noise.`,
  (t: string) => `the tooling around ${t} is better than it was, but the error messages still assume you already know.`,
  (t: string) => `most of the ${t} win came from deleting code, not adding it. that keeps being true and I keep forgetting it.`,
  (t: string) => `cost matters more than latency here. ${t} was fast enough long before it was affordable.`,
  (t: string) => `if you take one thing from this: write the ${t} eval before you write the fix.`,
  (t: string) => `we kept the old ${t} path behind a flag for a month. glad we did, used it twice.`,
  (t: string) => `none of this is novel. ${t} just took us longer than it should have.`,
  (t: string) => `the ${t} rollback plan mattered more than the rollout plan. it usually does.`,
  (t: string) => `we were wrong about ${t} twice before we were right once.`,
  (t: string) => `nobody on the team had touched ${t} before. that turned out to be fine.`,
  (t: string) => `budget a week for ${t} and then double it, same as everything else.`,
]
const THREAD_END = [
  (t: string) => `that's it. happy to go deeper on any of the ${t} parts if useful.`,
  (t: string) => `writing the longer ${t} version up properly this week.`,
  (t: string) => `curious whether this matches anyone else's ${t} experience.`,
  (t: string) => `full ${t} config is in the repo, link in bio, etc.`,
  () => `corrections welcome, I have been wrong about most of this before.`,
]

const HANDLES = [
  'kmontgomery', 'sarah_builds', 'devrimk', 'nlee', 'the_pragmatist', 'aycaozturk',
  'jbriggs', 'm_karadeniz', 'ops_kate', 'vectorpilot', 'ilkerd', 'quietcompute',
  'rmartinez', 'zeynep_ml', 'tinygrads', 'burakay', 'hnwatcher', 'dataplumber',
]
/**
 * Which app posted, by year. This is the panel the brief calls a nostalgia
 * machine, and it only works if the mix actually moves: Tweetbot and Twitter
 * for Mac fade out and stop entirely in 2023, when X shut third-party clients
 * down. A flat distribution would draw eight identical bars.
 */
const CLIENTS_BY_YEAR: Record<number, [string, number][]> = {
  2019: [['Tweetbot for iOS', .38], ['Twitter for iPhone', .24], ['Twitter Web App', .16], ['Twitter for Mac', .16], ['Twitter for iPad', .06]],
  2020: [['Tweetbot for iOS', .34], ['Twitter for iPhone', .27], ['Twitter Web App', .21], ['Twitter for Mac', .13], ['Twitter for iPad', .05]],
  2021: [['Tweetbot for iOS', .28], ['Twitter for iPhone', .31], ['Twitter Web App', .26], ['Twitter for Mac', .11], ['Twitter for iPad', .04]],
  2022: [['Tweetbot for iOS', .19], ['Twitter for iPhone', .36], ['Twitter Web App', .33], ['Twitter for Mac', .08], ['Twitter for iPad', .04]],
  2023: [['Twitter for iPhone', .48], ['Twitter Web App', .44], ['Twitter for iPad', .08]],
  2024: [['Twitter for iPhone', .5], ['Twitter Web App', .43], ['Twitter for iPad', .07]],
  2025: [['Twitter for iPhone', .54], ['Twitter Web App', .4], ['Twitter for iPad', .06]],
  2026: [['Twitter for iPhone', .57], ['Twitter Web App', .38], ['Twitter for iPad', .05]],
}
const DOMAINS = ['github.com', 'arxiv.org', 'news.ycombinator.com', 'youtube.com', 'huggingface.co']

// ------------------------------------------------------------------ shaping

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const pad = (n: number) => String(n).padStart(2, '0')
const fmtDate = (d: Date) =>
  `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCDate())} ` +
  `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} +0000 ${d.getUTCFullYear()}`

/** The archive ends where the calendar does; nothing may be dated ahead of it. */
const TODAY = Date.UTC(2026, 7, 20)

/** A quiet season, so "the gaps" and the silence marks have something real. */
const SILENCE = { from: Date.UTC(2021, 5, 8), to: Date.UTC(2021, 8, 2) }

/** Hour of day, weighted: morning coffee, lunch, evening, and some late night. */
function hourOfDay(): number {
  const r = rnd()
  if (r < 0.10) return 0 + Math.floor(rnd() * 3)     // 00–02, the nocturnal share
  if (r < 0.16) return 7 + Math.floor(rnd() * 2)
  if (r < 0.40) return 9 + Math.floor(rnd() * 4)     // 09–12
  if (r < 0.58) return 13 + Math.floor(rnd() * 4)
  if (r < 0.88) return 19 + Math.floor(rnd() * 4)    // 19–22, the peak
  return 23
}

function pickClient(year: number): string {
  const table = CLIENTS_BY_YEAR[year] ?? CLIENTS_BY_YEAR[2026]
  let r = rnd()
  for (const [name, p] of table) { if ((r -= p) <= 0) return name }
  return table[0][0]
}

/** Power-law-ish engagement: most posts land quietly, a few do not. */
function engagement(kind: string): { likes: number; retweets: number } {
  if (kind === 'reply') {
    return { likes: chance(0.55) ? Math.floor(rnd() * 6) : 0, retweets: 0 }
  }
  const roll = rnd()
  const likes = roll > 0.985 ? 800 + Math.floor(rnd() * 5200)
    : roll > 0.93 ? 120 + Math.floor(rnd() * 500)
    : roll > 0.7 ? 25 + Math.floor(rnd() * 90)
    : Math.floor(rnd() * 26)
  return { likes, retweets: Math.floor(likes * (0.04 + rnd() * 0.14)) }
}

// ------------------------------------------------------------------ building

interface Media { id: string; kind: 'photo' | 'video' | 'gif'; w: number; h: number }
interface Draft {
  at: number; text: string
  kind: 'post' | 'reply' | 'thread' | 'retweet' | 'quote'
  /** Which thread this belongs to, and where in it. Resolved to ids after
      sorting — recording a parent's array index does not survive a sort. */
  thread?: { key: number; pos: number }
  replyToHandle?: string
  media: Media[]; url?: string; quoted?: string
}

const BASE_ID = 1300000000000000000n
const idOf = (i: number) => String(BASE_ID + BigInt(i) * 1013n)

const drafts: Draft[] = []
let threadSeq = 0

/** Realistic photo shapes, roughly what a phone and a laptop produce. */
const SHAPES: [number, number][] = [
  [1600, 1200], [1200, 1600], [1290, 2796], [2048, 1536],
  [1920, 1080], [1080, 1080], [2400, 1350], [1536, 2048], [3024, 1964],
]

let mediaSeq = 0
function makeMedia(): Media {
  const [w, h] = pick(SHAPES)
  const roll = rnd()
  const kind: Media['kind'] = roll > 0.9 ? 'video' : roll > 0.86 ? 'gif' : 'photo'
  return { id: `m${(mediaSeq++).toString().padStart(6, '0')}`, kind, w, h }
}

for (const era of ERAS) {
  // Volume per year, shaped by the era's weight plus a little wobble.
  const base = Math.round(340 * era.weight)
  for (let i = 0; i < base; i++) {
    const month = Math.floor(rnd() * 12)
    const day = 1 + Math.floor(rnd() * 28)
    let at = Date.UTC(era.year, month, day, hourOfDay(), Math.floor(rnd() * 60), Math.floor(rnd() * 60))

    if (at > TODAY) continue // no posting from the future
    // The quiet season: almost nothing gets through.
    if (at >= SILENCE.from && at < SILENCE.to && !chance(0.02)) continue
    // Sundays are slower.
    if (new Date(at).getUTCDay() === 0 && chance(0.45)) continue

    const topic = pick(era.topics)
    const verb = pick(era.verbs)
    const roll = rnd()

    if (roll < 0.42) {
      // A reply to someone else. Its parent is not in the archive, which is
      // the single most important thing about a real export.
      drafts.push({
        at, kind: 'reply', replyToHandle: pick(HANDLES),
        text: pick(REPLIES), media: [],
      })
    } else if (roll < 0.5) {
      drafts.push({
        at, kind: 'retweet', text: '', replyToHandle: pick(HANDLES), media: [],
      })
    } else if (roll < 0.57) {
      drafts.push({
        at, kind: 'quote',
        text: chance(0.5) ? `this is the clearest explanation of ${topic} I have read` : `worth your time if you touch ${topic} at all`,
        quoted: pick(HANDLES), media: [],
      })
    } else if (roll < 0.63) {
      // A thread. Written as consecutive self-replies, minutes apart.
      const length = 3 + Math.floor(rnd() * 7)
      const key = threadSeq++
      drafts.push({ at, kind: 'post', text: pick(THREAD_STARTS)(topic), media: [], thread: { key, pos: 0 } })
      // No line twice in the same thread — a person repeating themselves
      // three tweets later is exactly what makes generated text read as fake.
      const usedInThread = new Set<number>()
      for (let k = 1; k < length; k++) {
        at += 60_000 + Math.floor(rnd() * 240_000)
        let body: string
        if (k === length - 1) {
          body = pick(THREAD_END)(topic)
        } else {
          let idx = Math.floor(rnd() * THREAD_BODY.length)
          for (let tries = 0; usedInThread.has(idx) && tries < THREAD_BODY.length; tries++) {
            idx = (idx + 1) % THREAD_BODY.length
          }
          usedInThread.add(idx)
          body = THREAD_BODY[idx](topic)
        }
        drafts.push({
          at, kind: 'thread', thread: { key, pos: k },
          text: body, media: k > 1 && chance(0.15) ? [makeMedia()] : [],
        })
      }
    } else {
      // An original post.
      const turkish = chance(0.22)
      const body = turkish
        ? pick(TR_TEMPLATES)(pick(TR_TOPICS))
        : pick(OPENERS)(topic, verb)
      const tail = pick(TAILS)
      // The tail is a separate sentence; close the one before it first.
      const text = tail ? `${body.replace(/[.!?]*$/, '')}.${tail === '.' ? '' : tail}` : body
      const withMedia = chance(0.2)
      const withLink = !withMedia && chance(0.18)
      drafts.push({
        at, kind: 'post', text,
        media: withMedia ? Array.from({ length: 1 + (chance(0.35) ? Math.floor(rnd() * 3) : 0) }, makeMedia) : [],
        url: withLink ? `https://${pick(DOMAINS)}/${Math.random ? 'p' : 'p'}${Math.floor(rnd() * 90000)}` : undefined,
      })
    }
  }
}

drafts.sort((a, b) => a.at - b.at)

// Now that positions are final, every thread part can learn its parent's id.
const threadIds = new Map<string, string>()
drafts.forEach((d, i) => {
  if (d.thread) threadIds.set(`${d.thread.key}:${d.thread.pos}`, idOf(i))
})

// ------------------------------------------------------------------ emitting

const records = drafts.map((d, i) => {
  const id = idOf(i)
  const created = fmtDate(new Date(d.at))
  const { likes, retweets } = engagement(d.kind)

  let text = d.text
  const mentions: any[] = []
  const urls: any[] = []
  const mediaEntities: any[] = []

  if (d.kind === 'retweet') {
    const who = d.replyToHandle!
    const era = ERAS.find((e) => e.year === new Date(d.at).getUTCFullYear()) ?? ERAS[0]
    const body = pick(OPENERS)(pick(era.topics), pick(era.verbs))
    // Retweets arrive cut off, as X stores them.
    text = `RT @${who}: ${body.length > 96 ? body.slice(0, 96) + '…' : body}`
    mentions.push({ screen_name: who, name: who, id_str: '900', id: '900', indices: ['3', String(4 + who.length)] })
  } else if (d.kind === 'reply') {
    text = `@${d.replyToHandle} ${d.text}`
    mentions.push({
      screen_name: d.replyToHandle, name: d.replyToHandle, id_str: '901', id: '901',
      indices: ['0', String(1 + d.replyToHandle!.length)],
    })
  }

  if (d.quoted) {
    const link = `https://t.co/q${String(i).padStart(8, '0')}`
    text = `${text} ${link}`
    urls.push({
      url: link, expanded_url: `https://x.com/${d.quoted}/status/${idOf(i + 7)}`,
      display_url: `x.com/${d.quoted}/status/…`,
      indices: [String([...text].length - link.length), String([...text].length)],
    })
  }
  if (d.url) {
    const link = `https://t.co/l${String(i).padStart(8, '0')}`
    text = `${text} ${link}`
    urls.push({
      url: link, expanded_url: d.url, display_url: d.url.replace('https://', '').slice(0, 24) + '…',
      indices: [String([...text].length - link.length), String([...text].length)],
    })
  }
  if (d.media.length) {
    const link = `https://t.co/p${String(i).padStart(8, '0')}`
    text = `${text} ${link}`
    const start = String([...text].length - link.length), end = String([...text].length)
    for (const m of d.media) {
      mediaEntities.push({
        id_str: m.id, id: m.id, type: m.kind === 'gif' ? 'animated_gif' : m.kind,
        media_url: `http://pbs.twimg.com/media/${m.id}.png`,
        media_url_https: `https://pbs.twimg.com/media/${m.id}.${m.kind === 'photo' ? 'png' : 'mp4'}`,
        url: link, display_url: 'pic.x.com/…', expanded_url: `https://x.com/${ME.handle}/status/${id}/photo/1`,
        indices: [start, end],
        sizes: { large: { w: String(m.w), h: String(m.h), resize: 'fit' } },
      })
    }
  }

  const replyId = d.thread && d.thread.pos > 0
    ? threadIds.get(`${d.thread.key}:${d.thread.pos - 1}`) ?? null
    : null

  return {
    tweet: {
      edit_info: { initial: { editTweetIds: [id], editableUntil: new Date(d.at + 1800_000).toISOString(), editsRemaining: '5', isEditEligible: false } },
      retweeted: false,
      source: `<a href="https://x.com" rel="nofollow">${pickClient(new Date(d.at).getUTCFullYear())}</a>`,
      entities: { hashtags: [], symbols: [], user_mentions: mentions, urls },
      display_text_range: ['0', String([...text].length)],
      favorite_count: String(likes),
      id_str: id, id,
      truncated: false,
      retweet_count: String(retweets),
      created_at: created,
      favorited: false,
      full_text: text,
      lang: /[ğüşıöçİ]/.test(text) ? 'tr' : d.media.length && text.trim().startsWith('http') ? 'zxx' : 'en',
      ...(mediaEntities.length ? { extended_entities: { media: mediaEntities }, entities_media: undefined } : {}),
      ...(replyId ? {
        in_reply_to_status_id: replyId, in_reply_to_status_id_str: replyId,
        in_reply_to_user_id: ME.id, in_reply_to_user_id_str: ME.id,
        in_reply_to_screen_name: ME.handle,
      } : {}),
      ...(d.kind === 'reply' ? {
        in_reply_to_status_id: idOf(i) + '1', in_reply_to_status_id_str: idOf(i) + '1',
        in_reply_to_user_id: '902', in_reply_to_user_id_str: '902',
        in_reply_to_screen_name: d.replyToHandle,
      } : {}),
    },
  }
})

// Media entities live under extended_entities only; drop the helper key.
for (const r of records as any[]) delete r.tweet.entities_media

// --- write ------------------------------------------------------------------

if (existsSync(out)) rmSync(out, { recursive: true })
mkdirSync(join(out, 'data', 'tweets_media'), { recursive: true })

writeFileSync(join(out, 'data', 'tweets.js'), `window.YTD.tweets.part0 = ${JSON.stringify(records, null, 1)}\n`)
writeFileSync(join(out, 'data', 'tweet-headers.js'), `window.YTD.tweet_headers.part0 = ${JSON.stringify(
  records.map((r: any) => ({ tweet: { tweet_id: r.tweet.id_str, user_id: ME.id, created_at: r.tweet.created_at } })), null, 1)}\n`)

let mediaFiles = 0
for (const r of records as any[]) {
  for (const m of r.tweet.extended_entities?.media ?? []) {
    // The generator emits PNG. Labelling it .jpg made the server send
    // image/jpeg, and nosniff then stopped the browser decoding it.
    const ext = m.type === 'photo' ? 'png' : 'mp4'
    const w = Number(m.sizes.large.w), h = Number(m.sizes.large.h)
    const scale = Math.min(1, 420 / Math.max(w, h))
    writeFileSync(
      join(out, 'data', 'tweets_media', `${r.tweet.id_str}-${m.id_str}.${ext}`),
      placeholderImage(m.id_str, Math.round(w * scale), Math.round(h * scale)),
    )
    mediaFiles++
  }
}

writeFileSync(join(out, 'data', 'manifest.js'), `window.__THAR_CONFIG = ${JSON.stringify({
  userInfo: { accountId: ME.id, userName: ME.handle, displayName: ME.name },
  archiveInfo: { sizeBytes: '0', generationDate: '2026-08-20T09:14:00.000Z', isPartialArchive: false, maxPartSizeBytes: '53687091200' },
  dataTypes: {
    tweets: { mediaDirectory: 'data/tweets_media', files: [{ fileName: 'data/tweets.js', globalName: 'YTD.tweets.part0', count: String(records.length) }] },
    tweetHeaders: { files: [{ fileName: 'data/tweet-headers.js', globalName: 'YTD.tweet_headers.part0', count: String(records.length) }] },
    directMessages: { mediaDirectory: 'data/direct_messages_media', files: [{ fileName: 'data/direct-messages.js', globalName: 'YTD.direct_messages.part0', count: '1841' }] },
  },
}, null, 2)}\n`)

const years = new Set(records.map((r: any) => r.tweet.created_at.slice(-4)))
console.log(`${out}`)
console.log(`  ${records.length.toLocaleString()} tweets across ${years.size} years, ${mediaFiles} media files`)
