/**
 * Settings: exports, theme, and the delete control.
 *
 * "Delete everything" reports what it actually cleared rather than claiming
 * success, because a privacy control that lies is worse than none.
 */

import { useState } from 'react'
import { useStore, useApp } from '../app/state.tsx'
import { Panel, Button, Num, Caveat } from '../ui/primitives.tsx'
import { wipeEverything, type WipeReport } from '../app/persist.ts'
import { exportJson, exportCsv, exportMarkdown, archivePoster } from '../export/exporters.ts'

type Theme = 'system' | 'dark' | 'light'

export function Settings() {
  const store = useStore()
  const { close } = useApp()
  const [report, setReport] = useState<WipeReport | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('theme') as Theme) ?? 'system',
  )

  const applyTheme = (next: Theme) => {
    setTheme(next)
    localStorage.setItem('theme', next)
    if (next === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', next)
  }

  const wipe = async () => {
    const result = await wipeEverything()
    setReport(result)
    setConfirming(false)
    close()
  }

  const meta = store.meta

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Panel title="This archive">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-[var(--text-dim)]">Account</dt><dd>@{meta.handle}</dd>
            <dt className="text-[var(--text-dim)]">Exported</dt>
            <dd data-numeric>{meta.generatedAt.slice(0, 10)}</dd>
            <dt className="text-[var(--text-dim)]">Tweets</dt><dd><Num value={meta.tweetCount} /></dd>
            <dt className="text-[var(--text-dim)]">Media files</dt><dd><Num value={meta.mediaCount} /></dd>
            <dt className="text-[var(--text-dim)]">Direct messages</dt>
            <dd>{meta.hadDirectMessages ? 'found, skipped' : 'none'}</dd>
          </dl>
          {meta.absentFiles.length > 0 && (
            <Caveat>
              X did not include {meta.absentFiles.join(', ')} in this export. Panels that would
              need them are absent rather than empty.
            </Caveat>
          )}
          {meta.unverifiedPaths.length > 0 && (
            <Caveat>
              These format paths ran but have never been tested against real data:{' '}
              {meta.unverifiedPaths.join(', ')}.
            </Caveat>
          )}
        </Panel>

        <Panel title="Appearance">
          <div className="flex gap-2">
            {(['system', 'dark', 'light'] as Theme[]).map((t) => (
              <Button key={t} variant={theme === t ? 'primary' : 'quiet'} onClick={() => applyTheme(t)}>
                {t}
              </Button>
            ))}
          </div>
        </Panel>

        <Panel title="Export" note="Everything is generated in this tab and saved straight to disk.">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => exportJson(store.tweets, meta.handle)}>JSON</Button>
            <Button onClick={() => exportCsv(store.tweets, meta.handle)}>CSV</Button>
            <Button onClick={() => exportMarkdown(store.tweets, meta.handle)}>Markdown</Button>
            <Button variant="primary" onClick={() => void archivePoster(store.tweets, meta)}>
              Archive poster (PNG)
            </Button>
          </div>
          <Caveat>
            The poster draws one mark per tweet, positioned by time and coloured by kind. It is
            rendered at 3× for print.
          </Caveat>
        </Panel>

        <Panel title="Delete everything">
          <p className="text-sm text-[var(--text-dim)] leading-relaxed mb-3">
            Clears every trace this app has stored on this device: remembered folders,
            cached files, and offline data. Your actual archive folder is untouched.
          </p>
          {!confirming ? (
            <Button variant="danger" onClick={() => setConfirming(true)}>Delete everything</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="danger" onClick={() => void wipe()}>Yes, delete it all</Button>
              <Button onClick={() => setConfirming(false)}>Cancel</Button>
            </div>
          )}
          {report && (
            <dl className="mt-4 text-xs space-y-1">
              {Object.entries(report).map(([key, ok]) => (
                <div key={key} className="flex gap-2">
                  <dt className="text-[var(--text-dim)] w-36">{key}</dt>
                  <dd className={ok ? 'text-[var(--accent)]' : 'text-[var(--danger)]'}>
                    {ok ? 'cleared' : 'could not clear'}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </Panel>
      </div>
    </div>
  )
}
