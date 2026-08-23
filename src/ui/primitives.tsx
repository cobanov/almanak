/**
 * The small set of shared pieces. Anything used once lives with its view.
 */

import type { ReactNode, ButtonHTMLAttributes } from 'react'

export function Num({ value, className = '' }: { value: number; className?: string }) {
  return <span data-numeric className={className}>{value.toLocaleString()}</span>
}

/**
 * A percentage always carries its denominator. Stating "31%" without saying
 * "of 10,090" is how honest numbers become misleading ones.
 */
export function Pct({ part, total, className = '' }: { part: number; total: number; className?: string }) {
  const pct = total === 0 ? 0 : (100 * part) / total
  return (
    <span className={className}>
      <span data-numeric>{pct.toFixed(1)}%</span>
      <span className="text-[var(--text-dim)] text-xs ml-1.5">
        of <span data-numeric>{total.toLocaleString()}</span>
      </span>
    </span>
  )
}

export function Button({
  variant = 'quiet', className = '', ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'quiet' | 'danger' }) {
  const styles = {
    primary: 'bg-[var(--accent)] text-[var(--bg)] hover:brightness-110 font-medium',
    quiet: 'border border-[var(--edge)] hover:border-[var(--text-dim)] hover:bg-[var(--surface-lit)]',
    danger: 'border border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white',
  }[variant]
  return (
    <button
      {...rest}
      className={`px-3 py-1.5 text-sm rounded-sm transition-colors disabled:opacity-40 disabled:pointer-events-none ${styles} ${className}`}
    />
  )
}

export function Panel({ title, note, children, className = '' }: {
  title?: string; note?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <section className={`bg-[var(--surface)] border border-[var(--edge)] rounded-sm ${className}`}>
      {title && (
        <header className="px-4 py-3 border-b border-[var(--edge)]">
          <h2 className="display text-sm tracking-tight">{title}</h2>
          {note && <p className="text-xs text-[var(--text-dim)] mt-1 leading-relaxed">{note}</p>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

/**
 * A one-line caveat sits beside the number it qualifies, not in a footnote.
 * Used wherever the archive's data is known to be unreliable.
 */
export function Caveat({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs text-[var(--text-dim)] leading-relaxed mt-2 border-l border-[var(--edge)] pl-2">
      {children}
    </p>
  )
}

export function Empty({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
      <p className="text-[var(--text-dim)] text-sm">{title}</p>
      {action}
    </div>
  )
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--text-dim)]">
      <span className="inline-block w-3 h-3 border border-[var(--text-dim)] border-t-transparent rounded-full animate-spin" />
      {label}
    </div>
  )
}
