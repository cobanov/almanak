/**
 * Exports. Everything is built in the tab and handed to the browser as a blob;
 * nothing is uploaded and no service is contacted.
 */

import type { Tweet, ArchiveMeta } from '../archive/types.ts'
import { statusUrl } from '../ui/TweetView.tsx'

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  // Revoke on the next turn: revoking synchronously can cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const stamp = () => new Date().toISOString().slice(0, 10)

export function exportJson(tweets: Tweet[], handle: string) {
  const payload = tweets.map((t) => ({
    id: t.id, at: new Date(t.at).toISOString(), text: t.text, kind: t.kind,
    lang: t.lang, client: t.client, likes: t.likes, retweets: t.retweets,
    replyTo: t.replyTo, threadId: t.threadId, media: t.media.map((m) => m.file),
    url: statusUrl(handle, t.id),
  }))
  save(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
       `${handle}-${stamp()}.json`)
}

const csvCell = (value: unknown) => {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function exportCsv(tweets: Tweet[], handle: string) {
  const header = ['id', 'date', 'kind', 'text', 'lang', 'client', 'likes', 'retweets', 'media', 'url']
  const rows = tweets.map((t) => [
    t.id, new Date(t.at).toISOString(), t.kind, t.text, t.lang, t.client,
    t.likes, t.retweets, t.media.length, statusUrl(handle, t.id),
  ].map(csvCell).join(','))
  // BOM so Excel reads the Turkish characters correctly.
  save(new Blob(['﻿' + [header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' }),
       `${handle}-${stamp()}.csv`)
}

export function exportMarkdown(tweets: Tweet[], handle: string) {
  const lines = [`# @${handle}`, '', `${tweets.length.toLocaleString()} tweets. Exported ${stamp()}.`, '']
  let lastYear = ''
  for (const t of [...tweets].sort((a, b) => a.at - b.at)) {
    const date = new Date(t.at)
    const year = String(date.getUTCFullYear())
    if (year !== lastYear) { lines.push(`## ${year}`, ''); lastYear = year }
    lines.push(`**${date.toISOString().slice(0, 10)}** · [${t.kind}](${statusUrl(handle, t.id)})`, '')
    lines.push(t.text.split('\n').map((l) => `> ${l}`).join('\n'), '')
  }
  save(new Blob([lines.join('\n')], { type: 'text/markdown' }), `${handle}-${stamp()}.md`)
}

/**
 * The archive poster: one mark per tweet, positioned by time, coloured by
 * kind, sized by engagement. Rows are years, columns are days within the year,
 * so the whole history reads as a single block.
 */
export async function archivePoster(tweets: Tweet[], meta: ArchiveMeta) {
  const SCALE = 3
  const W = 1200, H = 1600
  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')!
  ctx.scale(SCALE, SCALE)

  const read = (name: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#12100e'

  const bg = read('--bg'), text = read('--text'), dim = read('--text-dim'), accent = read('--accent')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  const firstYear = new Date(meta.firstAt).getUTCFullYear()
  const lastYear = new Date(meta.lastAt).getUTCFullYear()
  const years = lastYear - firstYear + 1

  const marginX = 90, marginTop = 190, marginBottom = 110
  const gridW = W - marginX * 2
  const rowH = (H - marginTop - marginBottom) / years
  const dayW = gridW / 366

  const colors: Record<string, string> = {
    post: text, thread: accent, reply: dim,
    quote: accent, retweet: read('--danger'),
  }

  for (const t of tweets) {
    const d = new Date(t.at)
    const year = d.getUTCFullYear()
    const startOfYear = Date.UTC(year, 0, 1)
    const dayOfYear = Math.floor((t.at - startOfYear) / 86_400_000)

    const x = marginX + dayOfYear * dayW
    const y = marginTop + (year - firstYear) * rowH + rowH / 2

    // Engagement sets size, but is capped: one viral tweet must not swamp the page.
    const weight = Math.min(1, Math.log10(1 + t.likes) / 3)
    const r = 0.7 + weight * 3.2

    ctx.globalAlpha = t.kind === 'reply' ? 0.32 : 0.8
    ctx.fillStyle = colors[t.kind] ?? text
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  ctx.fillStyle = dim
  ctx.font = '500 13px "IBM Plex Mono", monospace'
  for (let y = firstYear; y <= lastYear; y++) {
    ctx.fillText(String(y), 34, marginTop + (y - firstYear) * rowH + rowH / 2 + 4)
  }

  ctx.fillStyle = text
  ctx.font = '600 40px "IBM Plex Sans", sans-serif'
  ctx.fillText(`@${meta.handle}`, marginX, 92)

  ctx.fillStyle = dim
  ctx.font = '400 15px "IBM Plex Mono", monospace'
  ctx.fillText(
    `${meta.tweetCount.toLocaleString()} tweets · ${firstYear}–${lastYear} · one mark per tweet, sized by likes`,
    marginX, 122,
  )

  let legendX = marginX
  ctx.font = '400 12px "IBM Plex Mono", monospace'
  for (const [kind, color] of Object.entries(colors)) {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(legendX + 4, H - 58, 3.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = dim
    ctx.fillText(kind, legendX + 14, H - 54)
    legendX += ctx.measureText(kind).width + 38
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (blob) save(blob, `${meta.handle}-archive-${stamp()}.png`)
}
