// middleware/validate.middleware.js
//
// Lightweight request body validator. We deliberately avoid pulling in
// Zod/Joi for the hackathon — schemas here are tiny and explicit. Each
// route file declares its own schema inline and hands it to validate().
//
// Schema format:
//   {
//     field: { type: 'string'|'number'|'integer'|'boolean'|'email'|'address',
//              required: true,
//              min?, max?, enum? }
//   }

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function checkField(value, rule, name) {
  if (value === undefined || value === null || value === '') {
    if (rule.required) return `${name} is required`
    return null
  }

  switch (rule.type) {
    case 'string':
      if (typeof value !== 'string') return `${name} must be a string`
      if (rule.min && value.length < rule.min) return `${name} too short`
      if (rule.max && value.length > rule.max) return `${name} too long`
      break
    case 'number':
      if (typeof value !== 'number' || Number.isNaN(value))
        return `${name} must be a number`
      if (rule.min !== undefined && value < rule.min)
        return `${name} must be >= ${rule.min}`
      if (rule.max !== undefined && value > rule.max)
        return `${name} must be <= ${rule.max}`
      break
    case 'integer':
      if (!Number.isInteger(value)) return `${name} must be an integer`
      if (rule.min !== undefined && value < rule.min)
        return `${name} must be >= ${rule.min}`
      if (rule.max !== undefined && value > rule.max)
        return `${name} must be <= ${rule.max}`
      break
    case 'boolean':
      if (typeof value !== 'boolean') return `${name} must be a boolean`
      break
    case 'email':
      if (typeof value !== 'string' || !EMAIL_RE.test(value))
        return `${name} must be a valid email`
      break
    case 'address':
      if (typeof value !== 'string' || !ADDRESS_RE.test(value))
        return `${name} must be a 0x-prefixed Ethereum address`
      if (value === '0x0000000000000000000000000000000000000000')
        return `${name} cannot be the zero address`
      break
  }

  if (rule.enum && !rule.enum.includes(value)) {
    return `${name} must be one of: ${rule.enum.join(', ')}`
  }
  return null
}

export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const data = req[source] || {}
    const errors = []
    for (const [name, rule] of Object.entries(schema)) {
      const msg = checkField(data[name], rule, name)
      if (msg) errors.push(msg)
    }
    if (errors.length) {
      const err = new Error(errors.join('; '))
      err.status = 400
      return next(err)
    }
    next()
  }
}
