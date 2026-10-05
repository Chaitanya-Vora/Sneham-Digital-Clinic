// Returns `prev` itself whenever `next` is deeply equal to it, and otherwise a
// copy of `next` that still reuses every unchanged branch of `prev`. Used on
// data refreshes so a reload that changed one row leaves every other row
// (and every untouched table) with the same identity — screens that read
// unchanged data then skip re-rendering instead of redrawing everything.
function isPlainArray(v: unknown): v is unknown[] {
  return Array.isArray(v) && v.length === Object.keys(v).length
}
function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object') return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

export function replaceEqualDeep<T>(prev: unknown, next: T): T {
  if ((prev as unknown) === (next as unknown)) return prev as T
  const bothArrays = isPlainArray(prev) && isPlainArray(next)
  if (bothArrays || (isPlainObject(prev) && isPlainObject(next))) {
    const a = prev as Record<string, unknown>
    const b = next as Record<string, unknown>
    const aKeys = bothArrays ? null : Object.keys(a)
    const bKeys = bothArrays ? null : Object.keys(b)
    const aSize = bothArrays ? (prev as unknown[]).length : aKeys!.length
    const bSize = bothArrays ? (next as unknown[]).length : bKeys!.length
    const copy: any = bothArrays ? [] : {}
    let equal = 0
    for (let i = 0; i < bSize; i++) {
      const key: any = bothArrays ? i : bKeys![i]
      const shared = replaceEqualDeep(a[key], b[key])
      copy[key] = shared
      if (shared === a[key] && (a[key] !== undefined || (!bothArrays && aKeys!.includes(key)))) equal++
    }
    return aSize === bSize && equal === aSize ? (prev as T) : (copy as T)
  }
  return next
}
