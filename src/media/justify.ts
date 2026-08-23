/**
 * Justified rows for the gallery.
 *
 * Every media item carries the dimensions X recorded, so the whole layout is
 * computable before a single image loads. That matters twice: nothing reflows
 * as images arrive, and row heights are known exactly, so virtualization needs
 * no measurement pass.
 *
 * The algorithm is the usual one: fill a row until adding another item would
 * push it below the target height, then scale the row to exactly fill the
 * container width. The last row is left at target height rather than stretched,
 * because stretching three photos across a full width looks like a mistake.
 */

export interface Sized {
  /** Width divided by height. Fall back to 1 when the archive lacks dimensions. */
  ratio: number
}

export interface PlacedItem<T> {
  item: T
  width: number
  height: number
}

export interface Row<T> {
  items: PlacedItem<T>[]
  height: number
  /** Distance from the top of the whole grid. */
  top: number
}

export interface JustifyOptions {
  containerWidth: number
  targetHeight: number
  gap: number
  /** A row taller than this is scaled down even if it means a short last row. */
  maxHeight?: number
}

export function justify<T extends Sized>(
  items: T[],
  { containerWidth, targetHeight, gap, maxHeight = targetHeight * 1.6 }: JustifyOptions,
): { rows: Row<T>[]; totalHeight: number } {
  const rows: Row<T>[] = []
  if (items.length === 0 || containerWidth <= 0) return { rows, totalHeight: 0 }

  let current: T[] = []
  let ratioSum = 0
  let top = 0

  const flush = (isLast: boolean) => {
    if (current.length === 0) return
    const available = containerWidth - gap * (current.length - 1)
    // Height that makes this row exactly fill the width.
    let height = available / ratioSum
    if (isLast) height = Math.min(height, targetHeight)
    height = Math.min(height, maxHeight)

    const placed = current.map((item) => ({
      item,
      width: item.ratio * height,
      height,
    }))
    rows.push({ items: placed, height, top })
    top += height + gap
    current = []
    ratioSum = 0
  }

  for (const item of items) {
    current.push(item)
    ratioSum += item.ratio
    // Adding this item made the row short enough — commit it.
    const available = containerWidth - gap * (current.length - 1)
    if (available / ratioSum < targetHeight) flush(false)
  }
  flush(true)

  return { rows, totalHeight: Math.max(0, top - gap) }
}

/** Clamped so one panorama cannot own an entire row. */
export function ratioOf(width: number, height: number): number {
  if (!width || !height) return 1
  return Math.min(3, Math.max(0.4, width / height))
}
