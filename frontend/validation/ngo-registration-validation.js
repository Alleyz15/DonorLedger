export function validateNGORegistrationForm({
  name,
  registrationNum,
  contactEmail,
}) {
  if (!name || name.trim().length < 2) {
    return 'Organization name is required.'
  }

  if (!registrationNum || registrationNum.trim().length < 3) {
    return 'Registration number is required.'
  }

  if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return 'Enter a valid contact email.'
  }

  return ''
}
