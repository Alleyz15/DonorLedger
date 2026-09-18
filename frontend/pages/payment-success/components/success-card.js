export function renderSuccessCard(payment) {
  const txHash     = payment.txHash || null
  const donorHash  = payment.donorHash || null
  const trackerUrl = payment.trackerUrl || (donorHash ? `/track/${donorHash}` : null)
  const explorerUrl = txHash
    ? `https://testnet.monadexplorer.com/tx/${encodeURIComponent(txHash)}`
    : null

  return `
    <section class="payment-success-card">

      <div class="payment-success-icon" aria-hidden="true">
        <span></span>
      </div>
      <h1>Payment Successful!</h1>
      <p class="payment-success-subtitle">
        Your donation has been recorded on the <strong>Monad testnet blockchain</strong>.
        Every ringgit is now traceable — independently of the NGO.
      </p>

      <section class="payment-success-details">
        <div class="payment-success-amount-row">
          <span>Amount Donated</span>
          <strong>${formatCurrency(payment.amount)}</strong>
        </div>
        <dl>
          <div>
            <dt>Campaign</dt>
            <dd>${escapeHtml(payment.campaignName || 'DonorLedger')}</dd>
          </div>
          <div>
            <dt>Payment Method</dt>
            <dd>DuitNow · Bank Islam</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>${formatDate(payment.paidAt)}</dd>
          </div>
          <div>
            <dt>Blockchain TX</dt>
            <dd>
              ${txHash
                ? `<a class="payment-tx-link" href="${explorerUrl}" target="_blank" rel="noreferrer">
                    ${formatHash(txHash)}
                    <span aria-hidden="true">↗</span>
                   </a>`
                : '<span>Pending</span>'
              }
            </dd>
          </div>
        </dl>
      </section>

      ${donorHash ? `
        <div class="payment-tracker-callout">
          <div class="payment-tracker-callout-icon" aria-hidden="true">⛓</div>
          <div>
            <strong>Track Your Donation on the Blockchain</strong>
            <p>
              Your personal donor tracker shows every step your money takes —
              from receipt to fund release to beneficiary confirmation.
              This data is on-chain and cannot be altered.
            </p>
          </div>
        </div>

        <a class="payment-tracker-button" href="./donor-history.html">
          View My Donation Tracker
        </a>
      ` : ''}

      <a class="payment-return-button" href="./donor-campaigns.html">
        <span aria-hidden="true"></span>
        Return to Campaigns
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

function formatHash(value) {
  if (!value) return 'TXN-PENDING'
  const text = String(value)
  return text.length > 14 ? `${text.slice(0, 8)}...${text.slice(-6)}` : text
}

function formatDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-MY', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(value))
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')
}
