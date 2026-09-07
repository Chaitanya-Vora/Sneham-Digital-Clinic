// Plain CSV — opens natively in Excel/Sheets/Numbers, needs no extra
// library, and is the simplest reliable "back this up" format. Web console
// only for now (a plain Blob+anchor download, same pattern already proven
// for the web branch of every PDF export in pdfExport.ts).

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv<T>(rows: T[], columns: { key: keyof T; label: string }[]): string {
  const header = columns.map((c) => csvCell(c.label)).join(',')
  const body = rows.map((row) => columns.map((c) => csvCell(row[c.key])).join(','))
  return [header, ...body].join('\r\n')
}

export function downloadCsv(filename: string, csv: string) {
  // Leading BOM so Excel opens UTF-8 correctly (₹ and Indian-language names) instead of mangling it.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
