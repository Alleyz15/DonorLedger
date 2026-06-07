export function renderPaymentForm({ campaign, session, vendors = [] }) {
  const donorName  = session?.user?.name  || ''
  const donorEmail = session?.user?.email || ''
  const vendorOptions = vendors.length
    ? vendors.map(v =>
        `<option value="${escapeHtml(v.id)}">${escapeHtml(v.name)} — ${escapeHtml(v.serviceType || '')}</option>`
      ).join('')
    : '<option value="">No vendors linked yet</option>'
  return `
    <form class="payment-layout" novalidate>
      <section class="payment-personal-card">
        <h1>Personal Information</h1>
        <p>Your details are secure and encrypted for radical transparency.</p>

        <label class="payment-campaign-field">
          <span>Selected Campaign</span>
          <strong><i aria-hidden="true"></i>${escapeHtml(campaign.name)}</strong>
        </label>

        <div class="payment-field-grid">
          <label class="payment-field">
            <span>Full Name</span>
            <input name="donorName" type="text" value="${escapeHtml(donorName)}" placeholder="Johnathan Doe" />
          </label>
          <label class="payment-field">
            <span>Email Address</span>
            <input name="donorEmail" type="email" value="${escapeHtml(donorEmail)}" placeholder="john@example.com" />
          </label>
        </div>

        <section class="payment-notice">
          <strong><i aria-hidden="true"></i>Important Notice</strong>
          <p>Thank you for supporting this campaign. Please check your donation details carefully before confirming. Once the payment is confirmed, this donation cannot be refunded.</p>
        </section>

        <button class="payment-pay-button" type="submit">
          <span aria-hidden="true"></span>
          Pay Now
        </button>
        <div class="payment-status" role="status" aria-live="polite"></div>
      </section>

      <aside class="payment-details-card">
        <h2>Payment Details</h2>

        <section class="payment-bank-section">
          <h3>Select Bank</h3>
          <div class="payment-bank-option">
            <span aria-hidden="true"></span>
            <strong>Bank Islam</strong>
            <i aria-hidden="true"></i>
          </div>
        </section>

        <label class="payment-field" style="margin-bottom:12px;">
          <span>Earmark Your Donation To</span>
          <select name="vendorId" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font:inherit;font-size:14px;">
            ${vendorOptions}
          </select>
          <small style="color:#94a3b8;font-size:11px;margin-top:4px;display:block;">Your donation will be earmarked to this vendor on-chain.</small>
        </label>

        <label class="payment-amount-field">
          <span>Donation Amount (RM)</span>
          <strong>RM <input name="amount" type="number" min="1" step="0.01" value="50" /></strong>
        </label>
        <p class="payment-ledger-note">Every cent is tracked via our public blockchain ledger.</p>

        <section class="payment-summary">
          <h3>Donation Summary</h3>
          <dl>
            <div>
              <dt>Subtotal</dt>
              <dd data-payment-subtotal>RM1,120.00</dd>
            </div>
            <div>
              <dt>Platform Fee (Optional)</dt>
              <dd data-payment-fee>RM100.80</dd>
            </div>
            <div class="payment-total-row">
              <dt>Total Amount</dt>
              <dd data-payment-total>RM1,220.80</dd>
            </div>
          </dl>
        </section>
      </aside>
    </form>
  `
}

export function readPaymentPayload(form, campaignId) {
  const formData = new FormData(form)
  return {
    campaignId,
    donorName: String(formData.get('donorName') || '').trim(),
    donorEmail: String(formData.get('donorEmail') || '').trim(),
    amount: Number(formData.get('amount') || 0),
  }
}

export function bindPaymentSummary(form) {
  const amountInput = form.querySelector('input[name="amount"]')
  const subtotal = form.querySelector('[data-payment-subtotal]')
  const fee = form.querySelector('[data-payment-fee]')
  const total = form.querySelector('[data-payment-total]')
  if (!amountInput || !subtotal || !fee || !total) return

  const update = () => {
    const amount = Number(amountInput.value || 0)
    const subtotalAmount = amount / 1.09
    subtotal.textContent = formatRinggit(subtotalAmount)
    fee.textContent = formatRinggit(amount - subtotalAmount)
    total.textContent = formatRinggit(amount)
  }

  amountInput.addEventListener('input', update)
  update()
}

export function setPaymentStatus(form, message, type = '') {
  const status = form.querySelector('.payment-status')
  if (!status) return
  status.textContent = message
  status.dataset.type = type
}

export function setPaymentLoading(form, isLoading) {
  const button = form.querySelector('.payment-pay-button')
  if (!button) return
  button.disabled = isLoading
  button.lastChild.textContent = isLoading ? ' Processing...' : ' Pay Now'
}

function formatRinggit(value) {
  return `RM${new Intl.NumberFormat('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))}`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
