export function createVendorForm() {
  const form = document.createElement('form')
  form.className = 'vendor-review-card'
  form.noValidate = true
  form.innerHTML = `
    <header class="vendor-review-header">
      <div>
        <h1>Submit New Vendor for Review</h1>
        <p>Registration for the DonorLedger Institutional Portal</p>
      </div>
      <a href="./start-campaign.html" aria-label="Close">×</a>
    </header>

    <section class="vendor-review-body">
      <label class="field vendor-field-full">
        <span>Vendor Name</span>
        <input name="name" type="text" placeholder="e.g. Global Logistics Solutions" />
      </label>

      <div class="vendor-form-grid">
        <label class="field">
          <span>SSM Number</span>
          <input name="ssmNumber" type="text" placeholder="202301XXXXXX" />
        </label>

        <label class="field">
          <span>Service Type</span>
          <select name="serviceType">
            <option value="">Select service...</option>
            <option value="FOOD">Food</option>
            <option value="LOGISTICS">Logistics</option>
            <option value="MEDICAL">Medical</option>
            <option value="CONSTRUCTION">Construction</option>
            <option value="OTHER">Other</option>
          </select>
        </label>

        <label class="field">
          <span>Bank Account Number</span>
          <input name="bankAccount" type="text" placeholder="Standard Chartered/Maybank..." />
        </label>

        <label class="field">
          <span>Wallet Address (Blockchain)</span>
          <input name="walletAddress" type="text" placeholder="0x..." />
        </label>
      </div>

      <label class="vendor-upload">
        <span class="vendor-upload-label"><i aria-hidden="true"></i>Registration Document</span>
        <input name="registrationDoc" type="file" accept=".pdf,.png,.jpg,.jpeg" />
        <strong><i aria-hidden="true"></i>Click to upload or drag and drop</strong>
        <small data-empty-text="PDF, JPG or PNG (max. 10MB)">
          PDF, JPG or PNG (max. 10MB)
        </small>
      </label>

      <section class="vendor-protocol-note">
        <i aria-hidden="true"></i>
        <div>
          <strong>By submitting, you agree to DonorLedger's transparency protocols.</strong>
          <span>
            All transactions with this vendor will be recorded on the public ledger for donor verification.
          </span>
        </div>
      </section>

      <div class="vendor-form-actions">
        <a class="vendor-cancel-button" href="./start-campaign.html">Cancel</a>
        <button class="vendor-submit-button" type="submit">
          Submit Vendor for Review
        </button>
      </div>

      <div class="form-status" role="status" aria-live="polite"></div>
    </section>
  `
  return form
}

export function getVendorPayload(form, ngoId) {
  const formData = new FormData(form)
  const registrationDoc = formData.get('registrationDoc')
  return {
    ngoId,
    name: String(formData.get('name') || '').trim(),
    ssmNumber: String(formData.get('ssmNumber') || '').trim(),
    serviceType: String(formData.get('serviceType') || ''),
    bankAccount: String(formData.get('bankAccount') || '').trim(),
    walletAddress: String(formData.get('walletAddress') || '').trim(),
    registrationDoc: registrationDoc instanceof File && registrationDoc.size > 0
      ? registrationDoc
      : null,
  }
}

export function bindVendorUploadFeedback(form) {
  const input = form.querySelector('input[name="registrationDoc"]')
  const upload = form.querySelector('.vendor-upload')
  const hint = upload?.querySelector('small')
  if (!input || !upload || !hint) return

  input.addEventListener('change', () => {
    const fileName = input.files?.[0]?.name
    upload.dataset.hasFile = fileName ? 'true' : 'false'
    hint.textContent = fileName || hint.dataset.emptyText || 'PDF, JPG or PNG (max. 10MB)'
    hint.title = fileName || ''
  })
}
