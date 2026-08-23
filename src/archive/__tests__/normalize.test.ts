/**
 * The parser's contract with X's export format.
 *
 * Every case here corresponds to something the format does that is easy to get
 * wrong and silent when you do. They are written against the real shapes found
 * by surveying an actual archive, not against X's documentation.
 */

import { describe, it, expect } from 'vitest'
import { normalizeTweets, parseCreatedAt, parseClient } from '../normalize.ts'

const ME = '111'
const noMedia = new Map<string, string[]>()

/** Minimal well-formed record; override what a test cares about. */
function record(over: Record<string, unknown> = {}) {
  return {
    tweet: {
      id: '1', id_str: '1',
      created_at: 'Wed Oct 10 20:19:24 +0000 2018',
      full_text: 'hello',
      truncated: false,
      lang: 'en',
      source: '<a href="#">Twitter Web App</a>',
      favorite_count: '0', retweet_count: '0',
      display_text_range: ['0', '5'],
      favorited: false, retweeted: false,
      entities: { hashtags: [], symbols: [], user_mentions: [], urls: [] },
      edit_info: { initial: { editTweetIds: ['1'], editableUntil: '', editsRemaining: '5', isEditEligible: false } },
      ...over,
    },
  }
}

const run = (records: unknown[], filesById = noMedia) =>
  normalizeTweets(records as never[], { accountId: ME, filesById })

describe('parseCreatedAt', () => {
  it('reads X\'s format as UTC', () => {
    const at = parseCreatedAt('Wed Oct 10 20:19:24 +0000 2018')
    expect(new Date(at).toISOString()).toBe('2018-10-10T20:19:24.000Z')
  })

  it('reports an unparseable date rather than inventing one', () => {
    expect(Number.isNaN(parseCreatedAt('not a date'))).toBe(true)
  })
})

describe('parseClient', () => {
  it('keeps the label and drops the anchor', () => {
    expect(parseClient('<a href="x" rel="nofollow">Twitter for iPhone</a>')).toBe('Twitter for iPhone')
  })

  it('falls back rather than returning an empty string', () => {
    expect(parseClient('')).toBe('unknown')
  })
})

describe('entity offsets', () => {
  it('converts codepoint offsets to UTF-16 so slicing lands on the entity', () => {
    // X counts codepoints. JavaScript strings are UTF-16, so an emoji before a
    // mention shifts every later offset by one and the naive slice is wrong.
    const text = '🎉 @someone hello'
    const { tweets } = run([record({
      full_text: text,
      entities: {
        hashtags: [], symbols: [], urls: [],
        user_mentions: [{ screen_name: 'someone', name: 's', id_str: '9', id: '9', indices: ['2', '10'] }],
      },
    })])
    const mention = tweets[0].entities[0]
    expect(text.slice(mention.start!, mention.end!)).toBe('@someone')
  })

  it('leaves offsets null when they do not resolve', () => {
    const { tweets } = run([record({
      entities: {
        hashtags: [], symbols: [], urls: [],
        user_mentions: [{ screen_name: 'x', name: 'x', id_str: '9', id: '9', indices: ['bad', 'worse'] }],
      },
    })])
    expect(tweets[0].entities[0].start).toBeNull()
  })
})

describe('edit groups', () => {
  it('collapses revisions to the newest and counts them', () => {
    // An edited tweet is stored once per revision. Keeping all three would
    // triple-count it and show the same text three times.
    const ids = ['10', '11', '12']
    const initial = { editTweetIds: ids, editableUntil: '', editsRemaining: '3', isEditEligible: true }
    const { tweets } = run([
      record({ id: '10', id_str: '10', created_at: 'Wed Feb 05 19:19:36 +0000 2025', favorite_count: '1', edit_info: { initial } }),
      record({ id: '11', id_str: '11', created_at: 'Wed Feb 05 19:20:07 +0000 2025', favorite_count: '2', edit_info: { edit: { initialTweetId: '10', editControlInitial: initial } } }),
      record({ id: '12', id_str: '12', created_at: 'Wed Feb 05 19:20:48 +0000 2025', favorite_count: '493', edit_info: { edit: { initialTweetId: '10', editControlInitial: initial } } }),
    ])

    expect(tweets).toHaveLength(1)
    expect(tweets[0].id).toBe('12')          // the newest revision
    expect(tweets[0].likes).toBe(493)        // which is where the engagement is
    expect(tweets[0].revisions).toBe(3)
    expect(tweets[0].aliases).toEqual(ids)   // the old ids stay reachable
  })
})

describe('kinds', () => {
  it('detects a retweet only from its text prefix', () => {
    const { tweets } = run([record({ full_text: 'RT @someone: a thing' })])
    expect(tweets[0].kind).toBe('retweet')
    expect(tweets[0].retweetOf).toBe('someone')
  })

  it('marks a retweet cut off mid-word as truncated', () => {
    const { tweets } = run([record({ full_text: 'RT @someone: a long thing that ran ou…' })])
    expect(tweets[0].truncated).toBe(true)
  })

  it('separates a self-reply from a reply to someone else', () => {
    const mine = run([record({ in_reply_to_user_id_str: ME, in_reply_to_status_id_str: '99' })])
    const theirs = run([record({ in_reply_to_user_id_str: '222', in_reply_to_status_id_str: '99' })])
    expect(mine.tweets[0].kind).toBe('thread')
    expect(theirs.tweets[0].kind).toBe('reply')
  })

  it('knows a reply to someone else has no parent in the archive', () => {
    const { tweets } = run([record({ in_reply_to_user_id_str: '222', in_reply_to_status_id_str: '99' })])
    expect(tweets[0].parentInArchive).toBe(false)
  })

  it('detects a quote only from a status URL among the entities', () => {
    const { tweets } = run([record({
      entities: {
        hashtags: [], symbols: [], user_mentions: [],
        urls: [{ url: 'https://t.co/a', expanded_url: 'https://x.com/someone/status/123', display_url: 'x.com/…', indices: ['0', '1'] }],
      },
    })])
    expect(tweets[0].kind).toBe('quote')
    expect(tweets[0].quoteOf).toContain('/status/123')
  })
})

describe('media', () => {
  it('joins a photo by tweet id and marks it present', () => {
    const files = new Map([['1', ['1-abc.jpg']]])
    const { tweets } = run([record({
      extended_entities: { media: [{ id_str: 'abc', type: 'photo', media_url_https: 'https://p/abc.jpg', url: 'https://t.co/a', indices: ['0', '1'], sizes: { large: { w: '100', h: '50' } } }] },
    })], files)
    expect(tweets[0].media[0]).toMatchObject({ kind: 'photo', file: '1-abc.jpg', present: true, width: 100, height: 50 })
  })

  it('joins a video even though its filename suffix is not the media id', () => {
    // Photos are {id}-{media_id}.jpg; videos are {id}-{url_hash}.mp4.
    const files = new Map([['1', ['1-someurlhash.mp4']]])
    const { tweets } = run([record({
      extended_entities: { media: [{ id_str: 'abc', type: 'video', media_url_https: 'https://p/abc.mp4', url: 'https://t.co/a', indices: ['0', '1'], sizes: { large: { w: '1920', h: '1080' } } }] },
    })], files)
    expect(tweets[0].media[0]).toMatchObject({ kind: 'video', file: '1-someurlhash.mp4', present: true })
  })

  it('degrades rather than throwing when the file is missing', () => {
    const { tweets, unverified } = run([record({
      extended_entities: { media: [{ id_str: 'abc', type: 'photo', media_url_https: 'https://p/abc.jpg', url: 'https://t.co/a', indices: ['0', '1'], sizes: { large: { w: '1', h: '1' } } }] },
    })])
    expect(tweets[0].media[0].present).toBe(false)
    expect(unverified).toContain('missing media file')
  })
})

describe('field types', () => {
  it('coerces the counts X stores as strings', () => {
    const { tweets } = run([record({ favorite_count: '41275', retweet_count: '1545' })])
    expect(tweets[0].likes).toBe(41275)
    expect(tweets[0].retweets).toBe(1545)
  })

  it('flags lang values that are not languages', () => {
    for (const code of ['qme', 'zxx', 'und', 'qam']) {
      expect(run([record({ lang: code })]).tweets[0].langIsPlaceholder).toBe(true)
    }
    expect(run([record({ lang: 'tr' })]).tweets[0].langIsPlaceholder).toBe(false)
  })
})

describe('ordering', () => {
  it('returns tweets oldest first, whatever order they arrived in', () => {
    const { tweets } = run([
      record({ id: '2', id_str: '2', created_at: 'Wed Oct 10 20:19:24 +0000 2020', edit_info: { initial: { editTweetIds: ['2'] } } }),
      record({ id: '1', id_str: '1', created_at: 'Wed Oct 10 20:19:24 +0000 2018', edit_info: { initial: { editTweetIds: ['1'] } } }),
    ])
    expect(tweets.map((t) => t.id)).toEqual(['1', '2'])
  })
})
