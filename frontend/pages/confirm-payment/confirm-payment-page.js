import { getSession } from '../../services/auth-service.js'
import { getCampaignDetails } from '../../services/campaign-service.js'
import { submitDonation } from '../../services/donation-service.js'
import { validateDonationForm } from '../../validation/donation-validation.js'
import {
  bindPaymentSummary,
  readPaymentPayload,
  renderPaymentForm,
  setPaymentLoading,
  setPaymentStatus,
} from './components/payment-form.js'

const PAYMENT_RESULT_KEY = 'donorledger.paymentResult'
const root = document.querySelector('#confirm-payment-root')
const session = getSession()
const campaignId = new URLSearchParams(window.location.search).get('campaignId')

if (!session?.token) {
  window.location.href = './login.html'
} else if (session.role !== 'DONOR') {
  root.innerHTML = '<p class="payment-state">This page is only available for donor accounts.</p>'
} else {
  renderConfirmPaymentPage()
}

async function renderConfirmPaymentPage() {
  if (!campaignId) {
    root.innerHTML = '<p class="payment-state is-error">Campaign id is missing.</p>'
    return
  }

  root.innerHTML = '<p class="payment-state">Loading payment details...</p>'
  try {
    const [campaign, vendors] = await Promise.all([
      getCampaignDetails(campaignId),
      import('../../services/campaign-service.js').then(m => m.getCampaignVendors(campaignId)).catch(() => []),
    ])
    root.innerHTML = renderPaymentForm({ campaign, session, vendors })
    const form = root.querySelector('form')
    bindPaymentSummary(form)
    form.addEventListener('submit', (event) => handleSubmit(event, form, campaign))
  } catch (error) {
    root.innerHTML = `<p class="payment-state is-error">${escapeHtml(error.message)}</p>`
  }
}

async function handleSubmit(event, form, campaign) {
  event.preventDefault()
  const payload = readPaymentPayload(form, campaignId)
  payload.vendorId = form.querySelector('[name="vendorId"]')?.value || undefined
  const validationMessage = validateDonationForm(payload)

  if (validationMessage) {
    setPaymentStatus(form, validationMessage, 'error')
    return
  }

  setPaymentLoading(form, true)
  setPaymentStatus(form, 'Processing payment and writing blockchain record...', 'loading')

  try {
    const result = await submitDonation(payload)
    localStorage.setItem(
      PAYMENT_RESULT_KEY,
      JSON.stringify({
        ...result,
        amount: payload.amount,
        donorName: payload.donorName,
        donorEmail: payload.donorEmail,
        campaignName: campaign.name,
        paymentMethod: 'Bank Islam',
        paidAt: new Date().toISOString(),
      })
    )
    window.location.href = './payment-success.html'
  } catch (error) {
    setPaymentStatus(form, error.message, 'error')
  } finally {
    setPaymentLoading(form, false)
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
