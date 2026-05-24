export function renderSuccessCard(payment) {
  return `
    <section class="payment-success-card">
      <div class="payment-success-icon" aria-hidden="true">
        <span></span>
      </div>
      <h1>Payment Successful!</h1>

      <section class="payment-success-details">
        <div class="payment-success-amount-row">
          <span>Amount</span>
          <strong>${formatCurrency(payment.amount)}</strong>
        </div>
        <dl>
          <div>
            <dt>Transaction ID</dt>
            <dd><span>${escapeHtml(formatTransaction(payment.txHash || payment.donationId))}</span></dd>
          </div>
          <div>
            <dt>Payment Method</dt>
            <dd>Bank Islam</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>${formatDate(payment.paidAt)}</dd>
          </div>
          <div>
            <dt>Merchant</dt>
            <dd>${escapeHtml(payment.campaignName || 'DonorLedger')}</dd>
          </div>
        </dl>
      </section>

      <a class="payment-return-button" href="./donor-campaigns.html">
        <span aria-hidden="true"></span>
        Return to Home
      </a>
    </section>
  `
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatTransaction(value) {
  if (!value) return 'TXN-PENDING'
  const text = String(value)
  return text.length > 14 ? `${text.slice(0, 6)}...${text.slice(-6)}` : text
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
