export function validateCampaignForm({
  name,
  causeType,
  description,
  targetAmount,
  endDate,
  vendorId,
  aidPercent,
  logisticsPercent,
  adminPercent,
}) {
  if (!name || name.length < 3) {
    return 'Campaign name is required.'
  }

  if (!causeType) {
    return 'Campaign category is required.'
  }

  if (!description || description.trim().length < 10) {
    return 'Detailed description is required.'
  }

  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    return 'Target amount must be greater than 0.'
  }

  if (!endDate) {
    return 'End date is required.'
  }

  if (new Date(endDate) <= new Date()) {
    return 'End date must be in the future.'
  }

  if (!vendorId) {
    return 'Approved vendor is required.'
  }

  if (aidPercent + logisticsPercent + adminPercent !== 100) {
    return 'Fund allocation must total exactly 100%.'
  }

  return ''
}
