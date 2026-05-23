import crypto from 'node:crypto'

export function hashPassword(plaintext) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto
    .createHash('sha256')
    .update(salt + plaintext)
    .digest('hex')
  return `${salt}:${hash}`
}

export function checkPassword(plaintext, storedHash) {
  const [salt, expected] = (storedHash || '').split(':')
  if (!salt || !expected) return false
  const actual = crypto
    .createHash('sha256')
    .update(salt + plaintext)
    .digest('hex')
  return actual === expected
}
