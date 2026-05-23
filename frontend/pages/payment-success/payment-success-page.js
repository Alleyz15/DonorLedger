import { getSession } from '../../services/auth-service.js'
import { renderSuccessCard } from './components/success-card.js'

const PAYMENT_RESULT_KEY = 'donorledger.paymentResult'
const root = document.querySelector('#payment-success-root')
const session = getSession()

if (!session?.token) {
  window.location.href = './login.html'
} else if (session.role !== 'DONOR') {
  root.innerHTML = '<p class="payment-success-state">This page is only available for donor accounts.</p>'
} else {
  const payment = readPaymentResult()
  root.innerHTML = payment
    ? renderSuccessCard(payment)
    : '<p class="payment-success-state is-error">No completed payment was found.</p>'
}

function readPaymentResult() {
  const value = sessionStorage.getItem(PAYMENT_RESULT_KEY)
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
