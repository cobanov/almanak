/**
 * Analysis. Every panel is a pure function over tweets plus a small
 * visualization, hand-drawn — a generic chart library would fight each of
 * these and the output would look like everyone else's.
 *
 * Two rules hold throughout: every percentage states its denominator, and any
 * number the archive makes unreliable says so on the same line.
 */

import { useMemo, useState, Fragment } from 'react'
import { useStore } from '../app/state.tsx'
import { useNavigate } from '../app/router.ts'
import { Panel, Caveat, Num, Pct } from '../ui/primitives.tsx'
import {
  punchcard, clientsOverTime, vocabularyDrift, orbit, replyRatio,
  gaps, nocturnal, firstUse, housekeeping,
} from '../analytics/panels.ts'

/**
 * A categorical ramp for stacked series, inside a black/blue/white palette.
 *
 * The previous version tinted one blue by opacity, which put five clients
 * within a few percent of each other: the data changed across the years and
 * nothing on screen did. These steps are far enough apart to read at the
 * height of a stacked bar.
 */
const SERIES_COLORS = [
  '#e7e9ea', // chalk
  '#1d9bf0', // blue
  '#7cc4f5', // pale blue
  '#4a5560', // slate
  '#0b5c94', // deep blue
  '#9aa3ab', // ash
  '#2f3336', // rule
]

const KIND_COLORS: Record<string, string> = {
  post: 'var(--text)', thread: 'var(--accent)', reply: 'var(--text-dim)',
  quote: 'color-mix(in srgb, var(--accent) 55%, var(--text-dim))', retweet: 'var(--danger)',
}

export function Analysis() {
  const store = useStore()
  const navigate = useNavigate()
  const [utc, setUtc] = useState(false)
  const [term, setTerm] = useState('')

  const tweets = store.tweets
  const card = useMemo(() => punchcard(tweets, utc), [tweets, utc])
  const clients = useMemo(() => clientsOverTime(tweets), [tweets])
  const vocab = useMemo(() => vocabularyDrift(tweets), [tweets])
  const orbits = useMemo(() => orbit(tweets), [tweets])
  const ratios = useMemo(() => replyRatio(tweets), [tweets])
  const silence = useMemo(() => gaps(tweets), [tweets])
  const night = useMemo(() => nocturnal(tweets, utc), [tweets, utc])
  const stats = useMemo(() => housekeeping(tweets), [tweets])
  const first = useMemo(() => (term ? firstUse(tweets, term) : null), [tweets, term])

  /** Every figure is clickable through to the tweets behind it. */
  const drill = (params: Record<string, string>) => {
    const p = new URLSearchParams(params)
    navigate('tweets', p)
  }

  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10)

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto p-4 grid gap-4 md:grid-cols-2">

        <Panel
          title="Rhythm"
          note={<>Hour of day against day of week, in <button onClick={() => setUtc(!utc)}
            className="text-[var(--accent)] hover:underline">{card.timezone}</button>. The archive stores UTC;
            reading it as UTC when you did not live there is how this chart goes wrong everywhere else.</>}
          className="md:col-span-2"
        >
          <div className="overflow-x-auto">
            <div className="inline-grid gap-[2px]" style={{ gridTemplateColumns: 'auto repeat(24, 1fr)' }}>
              <span />
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h} className="text-[9px] text-[var(--text-dim)] text-center tnum">
                  {h % 6 === 0 ? h : ''}
                </span>
              ))}
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, row) => (
                <Fragment key={label}>
                  <span className="text-[10px] text-[var(--text-dim)] pr-2 leading-4">{label}</span>
                  {card.grid[row].map((n, h) => (
                    <button
                      key={`${row}-${h}`}
                      title={`${label} ${String(h).padStart(2, '0')}:00 — ${n} ${n === 1 ? 'tweet' : 'tweets'}${n ? '. Click to read them.' : ''}`}
                      aria-label={`${label} at ${h}:00, ${n} tweets`}
                      disabled={n === 0}
                      onClick={() => drill({
                        weekday: String(row),
                        hour: String(h),
                        ...(utc ? { tz: 'utc' } : {}),
                      })}
                      className={`w-full h-4 min-w-[14px] rounded-[1px] transition-transform ${
                        n === 0 ? 'cursor-default' : 'hover:scale-125 hover:ring-1 hover:ring-[var(--text)]'
                      }`}
                      style={{
                        background: n === 0 ? 'var(--surface-lit)' : 'var(--accent)',
                        opacity: n === 0 ? 1 : 0.15 + 0.85 * (n / card.peak),
                      }}
                    />
                  ))}
                </Fragment>
              ))}
            </div>
          </div>
          <p className="text-xs text-[var(--text-dim)] mt-3">
            Busiest cell holds <Num value={card.peak} /> of <Num value={card.total} /> tweets.
          </p>
        </Panel>

        <Panel title="Client archaeology" note="Which app you posted from, by year.">
          <div className="space-y-2">
            {clients.years.map((year, yi) => (
              <div key={year} className="flex items-center gap-2">
                <span className="tnum text-xs text-[var(--text-dim)] w-10">{year}</span>
                <div className="flex-1 flex h-4 rounded-sm overflow-hidden">
                  {clients.clients.map((client, ci) => {
                    const share = clients.shares[ci][yi]
                    if (share < 0.005) return null
                    return (
                      <button
                        key={client}
                        title={`${client} — ${(share * 100).toFixed(1)}% of ${clients.counts.reduce((s, c) => s + c[yi], 0)} tweets in ${year}`}
                        onClick={() => drill({ client, from: `${year}-01-01`, to: `${year}-12-31` })}
                        style={{ width: `${share * 100}%`, background: SERIES_COLORS[ci % SERIES_COLORS.length] }}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[10px] text-[var(--text-dim)]">
            {clients.clients.map((c, i) => (
              <span key={c} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-[1px]"
                      style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                {c}
              </span>
            ))}
          </div>
        </Panel>

        <Panel title="Reply ratio" note="Whether you were broadcasting or talking.">
          <div className="space-y-2">
            {ratios.map((r) => (
              <div key={r.year} className="flex items-center gap-2">
                <span className="tnum text-xs text-[var(--text-dim)] w-10">{r.year}</span>
                <div className="flex-1 flex h-4 rounded-sm overflow-hidden">
                  {(['post', 'thread', 'reply', 'quote', 'retweet'] as const).map((k) => (
                    r[k] > 0 && (
                      <button
                        key={k}
                        title={`${k} — ${r[k]} of ${r.total} in ${r.year}`}
                        onClick={() => drill({ kind: k, from: `${r.year}-01-01`, to: `${r.year}-12-31` })}
                        style={{ width: `${(r[k] / r.total) * 100}%`, background: KIND_COLORS[k] }}
                      />
                    )
                  ))}
                </div>
                <span className="tnum text-[10px] text-[var(--text-dim)] w-12 text-right">{r.total}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[10px] text-[var(--text-dim)]">
            {Object.entries(KIND_COLORS).map(([k, color]) => (
              <span key={k} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-[1px]" style={{ background: color }} />{k}
              </span>
            ))}
          </div>
        </Panel>

        <Panel
          title="Vocabulary drift"
          note={<>Terms that were distinctively each year's, by TF-IDF against the whole archive.
            <span className="inferred"> generated, and weaker on Turkish than on English</span></>}
          className="md:col-span-2"
        >
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(140px, 1fr))` }}>
            {vocab.map((y) => (
              <div key={y.year}>
                <p className="tnum text-xs text-[var(--accent)] mb-1.5">{y.year}</p>
                <ul className="space-y-0.5">
                  {y.terms.map((t) => (
                    <li key={t.term}>
                      <button onClick={() => drill({ q: t.term, from: `${y.year}-01-01`, to: `${y.year}-12-31` })}
                              className="text-xs hover:text-[var(--accent)] text-left">
                        {t.term}
                        <span className="tnum text-[10px] text-[var(--text-dim)] ml-1.5">{t.count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] text-[var(--text-dim)] mt-1 tnum">of {y.total}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Your orbit" note="Who you mentioned, and when they came and went.">
          <div className="space-y-1">
            {orbits.entries.slice(0, 14).map((entry) => (
              <div key={entry.handle} className="flex items-center gap-2">
                <button onClick={() => drill({ mentions: entry.handle })}
                        className="text-xs w-28 truncate text-left hover:text-[var(--accent)]">
                  @{entry.handle}
                </button>
                <div className="flex-1 flex gap-[2px] h-3">
                  {orbits.years.map((y) => {
                    const n = entry.byYear.get(y) ?? 0
                    const max = Math.max(...orbits.years.map((yy) => entry.byYear.get(yy) ?? 0)) || 1
                    return (
                      <span key={y} title={`${y}: ${n}`} className="flex-1 rounded-[1px]"
                            style={{ background: n === 0 ? 'var(--surface-lit)' : 'var(--accent)',
                                     opacity: n === 0 ? 1 : 0.28 + 0.72 * (n / max) }} />
                    )
                  })}
                </div>
                <span className="tnum text-[10px] text-[var(--text-dim)] w-8 text-right">{entry.total}</span>
              </div>
            ))}
          </div>
          <Caveat>Counted from mentions in <Num value={orbits.total} /> tweets. A mention is not a conversation — replies to someone who never appears in your text are not counted here.</Caveat>
        </Panel>

        <Panel title="The gaps" note="Longest silences, and longest daily streaks.">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-2">silences</p>
              <ul className="space-y-1">
                {silence.gaps.slice(0, 6).map((g) => (
                  <li key={g.from}>
                    <button onClick={() => drill({ from: day(g.from), to: day(g.to) })}
                            className="text-xs hover:text-[var(--accent)] text-left w-full">
                      <span className="tnum text-[var(--accent)]">{g.days}d</span>
                      <span className="text-[var(--text-dim)] ml-2 tnum">{day(g.from)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-2">streaks</p>
              <ul className="space-y-1">
                {silence.streaks.slice(0, 6).map((s) => (
                  <li key={s.from}>
                    <button onClick={() => drill({ from: day(s.from), to: day(s.to) })}
                            className="text-xs hover:text-[var(--accent)] text-left w-full">
                      <span className="tnum text-[var(--accent)]">{s.days}d</span>
                      <span className="text-[var(--text-dim)] ml-2 tnum">{day(s.from)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Panel>

        <Panel title="Nocturnal index" note={`Share posted between 00:00 and 06:00, in ${card.timezone}.`}>
          <div className="space-y-1.5">
            {night.map((n) => (
              <div key={n.year} className="flex items-center gap-2">
                <span className="tnum text-xs text-[var(--text-dim)] w-10">{n.year}</span>
                <button
                  onClick={() => drill({
                    from: `${n.year}-01-01`, to: `${n.year}-12-31`,
                    hour: '0-5', ...(utc ? { tz: 'utc' } : {}),
                  })}
                  title={`Read the ${n.night} tweets posted before 06:00 in ${n.year}`}
                  className="flex-1 h-3 bg-[var(--surface-lit)] rounded-sm overflow-hidden
                             hover:ring-1 hover:ring-[var(--text-dim)]"
                >
                  <div className="h-full" style={{ width: `${(n.night / n.total) * 100}%`, background: 'var(--accent)' }} />
                </button>
                <span className="text-[10px] w-24 text-right">
                  <Pct part={n.night} total={n.total} />
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Firsts" note="The first time you used a word.">
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Type a word"
            className="w-full bg-[var(--surface-lit)] border border-[var(--edge)] rounded-sm px-3 py-2 text-sm
                       focus:border-[var(--accent)] outline-none mb-3"
          />
          {term && !first && <p className="text-xs text-[var(--text-dim)]">Never used.</p>}
          {first && (
            <button onClick={() => drill({ q: term })} className="text-left w-full">
              <p className="tnum text-xs text-[var(--accent)] mb-1">{day(first.at)}</p>
              <p className="text-sm leading-relaxed line-clamp-4">{first.text}</p>
            </button>
          )}
        </Panel>

        <Panel title="Housekeeping" className="md:col-span-2">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-y-3 gap-x-4 text-sm">
            <div><dt className="text-[var(--text-dim)] text-xs">Tweets</dt><dd data-numeric>{stats.total.toLocaleString()}</dd></div>
            <div><dt className="text-[var(--text-dim)] text-xs">Photos</dt><dd data-numeric>{stats.media.photos.toLocaleString()}</dd></div>
            <div><dt className="text-[var(--text-dim)] text-xs">Videos</dt><dd data-numeric>{stats.media.videos.toLocaleString()}</dd></div>
            <div><dt className="text-[var(--text-dim)] text-xs">GIFs</dt><dd data-numeric>{stats.media.gifs.toLocaleString()}</dd></div>
            <div><dt className="text-[var(--text-dim)] text-xs">Deleted</dt><dd data-numeric>{stats.deleted.toLocaleString()}</dd></div>
            <div><dt className="text-[var(--text-dim)] text-xs">Edited</dt><dd data-numeric>{stats.edited.toLocaleString()}</dd></div>
            <div><dt className="text-[var(--text-dim)] text-xs">Missing media</dt><dd data-numeric>{stats.media.missing.toLocaleString()}</dd></div>
            <div><dt className="text-[var(--text-dim)] text-xs">Languages</dt><dd data-numeric>{stats.languages.length}</dd></div>
          </dl>
          <Caveat>
            Likes and retweets are as of the export date, not live, and{' '}
            <Num value={stats.engagementZero} /> tweets show zero of both — some genuinely have none,
            some were never counted. Retweet text is stored cut off and cannot be recovered.{' '}
            <Num value={stats.placeholderLangs} /> tweets carry a language code that is not a
            language (<code>qme</code>, <code>zxx</code>) and are excluded from the language count.
          </Caveat>
        </Panel>
      </div>
    </div>
  )
}
