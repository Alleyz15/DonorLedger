export function validateVendorForm({
  name,
  ssmNumber,
  serviceType,
  bankAccount,
  walletAddress,
  registrationDoc,
}) {
  if (!name || name.length < 2) {
    return 'Vendor name is required.'
  }

  if (!ssmNumber || ssmNumber.length < 3) {
    return 'SSM number is required.'
  }

  if (!serviceType) {
    return 'Service type is required.'
  }

  if (!bankAccount || bankAccount.length < 5) {
    return 'Bank account number is required.'
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return 'Enter a valid blockchain wallet address.'
  }

  if (!registrationDoc) {
    return 'Registration document is required.'
  }

  return ''
}
