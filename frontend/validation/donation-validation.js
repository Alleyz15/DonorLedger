export function validateDonationForm({ donorName, donorEmail, amount }) {
  if (!donorName) return 'Full name is required.'
  if (!donorEmail) return 'Email address is required.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donorEmail)) {
    return 'Enter a valid email address.'
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Donation amount must be greater than 0.'
  }
  return ''
}
