/**
 * Generate a synthetic archive at the pathological size named in the brief:
 * 200,000 tweets. Used only to measure against the performance budgets, so
 * the README can carry numbers rather than hopes.
 *
 *   node scripts/make-stress-archive.ts <out-dir> [count]
 *
 * Tweet ids are built with BigInt. X's ids exceed Number.MAX_SAFE_INTEGER, so
 * generating them with ordinary arithmetic silently produces collisions — the
 * first version of this script made 200,000 records that deduplicated down to
 * 1,563 because thousands of them shared an id.
 */

import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2] ?? '/tmp/stress-archive'
const count = Number(process.argv[3] ?? 200_000)

if (existsSync(out)) rmSync(out, { recursive: true })
mkdirSync(join(out, 'data', 'tweets_media'), { recursive: true })

const WORDS = ('model modeli modelin modelleri veri veriyi verinin sistem sistemi kod kodu ' +
  'proje projeyi yapay zeka öğrenme ağı eğitim test sonuç deneme İstanbul ışık şey güzel ' +
  'the data model training network result system code project learning').split(' ')
const CLIENTS = ['Twitter for iPhone', 'Twitter Web App', 'Twitter for Android', 'Tweetbot for iOS', 'Twitter for iPad']
const LANGS = ['tr', 'tr', 'tr', 'tr', 'en', 'en', 'qme', 'zxx']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

let seed = 12345
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
const pad = (n: number) => String(n).padStart(2, '0')

const BASE_ID = 1_000_000_000_000_000_000n
const start = Date.UTC(2010, 0, 1)
const span = Date.UTC(2026, 7, 1) - start
const ME = '111'

const records: unknown[] = []
const mediaNames: string[] = []

for (let i = 0; i < count; i++) {
  const id = String(BASE_ID + BigInt(i) * 7n)
  const at = new Date(start + rnd() * span)
  const created = `${DAYS[at.getUTCDay()]} ${MONTHS[at.getUTCMonth()]} ${pad(at.getUTCDate())} ` +
    `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}:${pad(at.getUTCSeconds())} +0000 ${at.getUTCFullYear()}`

  const isReply = rnd() < 0.6
  const isSelf = isReply && rnd() < 0.2
  const body = Array.from({ length: 6 + Math.floor(rnd() * 24) },
    () => WORDS[Math.floor(rnd() * WORDS.length)]).join(' ')
  const mention = `user_${Math.floor(rnd() * 500)}`
  const text = isReply ? `@${mention} ${body}` : body

  const mentions = isReply
    ? [{ screen_name: mention, name: mention, id_str: '222', id: '222', indices: ['0', String(mention.length + 1)] }]
    : []

  const mediaCount = rnd() < 0.2 ? 1 + Math.floor(rnd() * 3) : 0
  const media = Array.from({ length: mediaCount }, (_, k) => {
    const mid = `${id}${k}`
    const ext = rnd() < 0.85 ? 'jpg' : 'mp4'
    mediaNames.push(`${id}-${mid}.${ext}`)
    return {
      id_str: mid, id: mid, type: ext === 'jpg' ? 'photo' : 'video',
      media_url_https: `https://pbs.twimg.com/media/${mid}.${ext === 'jpg' ? 'jpg' : 'mp4'}`,
      url: `https://t.co/${id.slice(-10)}`,
      indices: [String(text.length), String(text.length + 23)],
      sizes: { large: { w: '1200', h: '900' } },
    }
  })

  const parentIndex = Math.max(0, i - 1 - Math.floor(rnd() * 40))
  const parentId = String(BASE_ID + BigInt(parentIndex) * 7n)

  records.push({
    tweet: {
      edit_info: {
        initial: {
          editTweetIds: [id], editableUntil: at.toISOString(),
          editsRemaining: '5', isEditEligible: false,
        },
      },
      id, id_str: id, created_at: created,
      full_text: text, truncated: false,
      lang: LANGS[Math.floor(rnd() * LANGS.length)],
      source: `<a href="#" rel="nofollow">${CLIENTS[Math.floor(rnd() * CLIENTS.length)]}</a>`,
      favorite_count: String(Math.floor(rnd() * rnd() * 500)),
      retweet_count: String(Math.floor(rnd() * rnd() * 60)),
      display_text_range: ['0', String([...text].length)],
      favorited: false, retweeted: false,
      entities: { hashtags: [], symbols: [], urls: [], user_mentions: mentions },
      ...(media.length ? { extended_entities: { media } } : {}),
      ...(isReply ? {
        in_reply_to_status_id: parentId,
        in_reply_to_status_id_str: parentId,
        in_reply_to_user_id: isSelf ? ME : '333',
        in_reply_to_user_id_str: isSelf ? ME : '333',
        in_reply_to_screen_name: isSelf ? 'stress' : mention,
      } : {}),
    },
  })
}

writeFileSync(join(out, 'data', 'tweets.js'), `window.YTD.tweets.part0 = ${JSON.stringify(records)}`)
writeFileSync(join(out, 'data', 'manifest.js'), `window.__THAR_CONFIG = ${JSON.stringify({
  userInfo: { accountId: ME, userName: 'stress', displayName: 'Stress Test' },
  archiveInfo: {
    sizeBytes: '0', generationDate: new Date().toISOString(),
    isPartialArchive: false, maxPartSizeBytes: '0',
  },
  dataTypes: {
    tweets: {
      mediaDirectory: 'data/tweets_media',
      files: [{ fileName: 'data/tweets.js', globalName: 'YTD.tweets.part0', count: String(count) }],
    },
  },
}, null, 2)}`)

console.log(`${out}: ${count.toLocaleString()} tweets, ${mediaNames.length.toLocaleString()} media referenced (files not written)`)
