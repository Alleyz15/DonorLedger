// utils/format.utils.js
//
// Formatting helpers — keep the human-facing strings in one place. Donors
// see plain Malay/English strings (Section 6, Layer 2). Ringgit amounts are
// rendered with two decimals, no scientific notation.

const MYR = new Intl.NumberFormat('en-MY', {
  style: 'currency',
  currency: 'MYR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const NUMBER = new Intl.NumberFormat('en-MY')

/** "RM1,234.50" */
export function formatRinggit(amount) {
  const n = typeof amount === 'string' ? Number(amount) : Number(amount ?? 0)
  if (!Number.isFinite(n)) return 'RM0.00'
  return MYR.format(n).replace('MYR', 'RM').trim()
}

/** "1,247" */
export function formatCount(n) {
  return NUMBER.format(Number(n ?? 0))
}

/** "22 May 2026" — no time, donor-friendly */
export function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** "22 May 2026, 11:48 AM" — for Bank Islam dashboard */
export function formatDateTime(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

/** 0.873 → "87%" — used by the campaign progress bar */
export function formatPercent(ratio, digits = 0) {
  const n = Number(ratio ?? 0)
  if (!Number.isFinite(n)) return '0%'
  return `${(n * 100).toFixed(digits)}%`
}

/**
 * Donor-facing milestone strings (Section 6, Layer 2 — plain language ONLY).
 * Map the internal enum to the words a non-technical donor will read.
 */
export const DONOR_MILESTONE_TEXT = {
  RECEIVED: 'Your donation has been received',
  ALLOCATED: 'Bank Islam has locked your donation in escrow, earmarked for a verified vendor, while the NGO prepares evidence for release',
  RELEASED: 'Funds have been released to the vendor',
  FROZEN: 'Funds are paused while we investigate',
  COMPLETED: 'Your donation journey is complete',
}

/** Truncate an Ethereum address for display: 0x1234…abcd */
export function shortAddress(addr) {
  if (!addr || addr.length < 10) return addr ?? ''
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
